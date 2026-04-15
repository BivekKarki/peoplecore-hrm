'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Input, Badge, Spinner, EmptyState, showToast } from '@/components/ui';
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from 'lucide-react';

interface ShiftTemplate {
  id: string; name: string; start_time: string; end_time: string;
  break_mins: number; color: string;
}

interface Shift {
  id: string; employee_id: string; shift_date: string;
  start_time: string; end_time: string; break_mins: number;
  status: string; location: string | null;
  first_name: string; last_name: string; department: string;
  avatar_color: string; template_name: string | null; template_color: string | null;
}

interface Employee {
  id: string; first_name: string; last_name: string;
  department: string; avatar_color: string;
}

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().split('T')[0];
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`;
}

export default function SchedulePage() {
  const [weekStart, setWeekStart]   = useState<Date>(getMondayOf(new Date()));
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [templates, setTemplates]   = useState<ShiftTemplate[]>([]);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [form, setForm]             = useState({
    employee_id: '', shift_template_id: '', shift_date: '',
    start_time: '09:00', end_time: '17:00', break_mins: '60',
    location: '', notes: '',
  });

  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ week: fmt(weekStart) });
      if (deptFilter) q.set('department', deptFilter);
      const r = await fetch(`/api/shifts?${q}`);
      const j = await r.json();
      setShifts(j.shifts ?? []);
      setTemplates(j.templates ?? []);
    } catch { showToast('Failed to load shifts', 'error'); }
    finally { setLoading(false); }
  }, [weekStart, deptFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200&status=active')
      .then(r => r.json())
      .then(j => setEmployees(j.data ?? []));
  }, []);

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const thisWeek = () => setWeekStart(getMondayOf(new Date()));

  const shiftsOn = (date: Date, empId?: string) => {
    const d = fmt(date);
    return shifts.filter(s =>
      s.shift_date === d && (empId ? s.employee_id === empId : true)
    );
  };

  const openModal = (date?: Date) => {
    setForm(p => ({
      ...p,
      shift_date: date ? fmt(date) : fmt(weekDates[0]),
      employee_id: '',
      shift_template_id: '',
    }));
    setModal(true);
  };

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      setForm(p => ({
        ...p,
        shift_template_id: templateId,
        start_time: tmpl.start_time.slice(0, 5),
        end_time: tmpl.end_time.slice(0, 5),
        break_mins: String(tmpl.break_mins),
      }));
    }
  };

  const saveShift = async () => {
    if (!form.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!form.shift_date)  { showToast('Select a date', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id:       form.employee_id,
          shift_template_id: form.shift_template_id || null,
          shift_date:        form.shift_date,
          start_time:        form.start_time,
          end_time:          form.end_time,
          break_mins:        parseInt(form.break_mins) || 30,
          location:          form.location || null,
          notes:             form.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Shift created', 'success');
      setModal(false);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const deleteShift = async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try {
      await fetch(`/api/shifts?id=${id}`, { method: 'DELETE' });
      showToast('Shift deleted', 'success');
      load();
    } catch { showToast('Failed to delete', 'error'); }
  };

  // Get unique employees who have shifts this week or all filtered
  const activeEmps = employees.filter(e =>
    !deptFilter || e.department === deptFilter
  ).slice(0, 20);

  const depts = [...new Set(employees.map(e => e.department))].sort();

  const weekLabel = `${weekDates[0].toLocaleDateString('en-AU', { day:'numeric', month:'short' })} — ${weekDates[6].toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}`;

  const totalShifts = shifts.length;
  const totalHours  = shifts.reduce((s, sh) => {
    const [sh1, sm1] = sh.start_time.split(':').map(Number);
    const [eh, em]   = sh.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh1 * 60 + sm1) - (sh.break_mins ?? 0);
    return s + Math.max(0, mins / 60);
  }, 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Shift Scheduling" action={
        <Button variant="primary" onClick={() => openModal()}>
          <Plus size={14} /> Add Shift
        </Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1 bg-[#1e2d42] border border-[#2a3a52] rounded-lg p-1">
            <button onClick={prevWeek} className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-[#2a3a52] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-200 px-2 font-medium min-w-[220px] text-center">{weekLabel}</span>
            <button onClick={nextWeek} className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-[#2a3a52] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={thisWeek}>
            <CalendarDays size={13} /> This Week
          </Button>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-300 px-3 py-2 text-sm outline-none"
          >
            <option value="">All Departments</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
          <div className="ml-auto flex gap-4 text-xs text-slate-500 font-mono">
            <span>{totalShifts} shifts</span>
            <span>{totalHours.toFixed(0)}h scheduled</span>
          </div>
        </div>

        {/* Roster grid */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={28} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    <th className="text-left px-4 py-3 text-xs text-slate-500 font-mono font-normal w-44">Employee</th>
                    {weekDates.map((date, i) => {
                      const isToday = fmt(date) === fmt(new Date());
                      const isWeekend = i >= 5;
                      return (
                        <th key={i}
                          className={`px-2 py-3 text-xs font-mono font-normal text-center cursor-pointer hover:bg-[#1e2d42] transition-colors ${isToday ? 'text-blue-400' : isWeekend ? 'text-slate-600' : 'text-slate-400'}`}
                          onClick={() => openModal(date)}
                          title="Click to add shift"
                        >
                          <div>{DAYS[i]}</div>
                          <div className={`text-base font-semibold mt-0.5 ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                            {date.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeEmps.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-slate-600 text-sm">No employees found</td></tr>
                  ) : (
                    activeEmps.map(emp => (
                      <tr key={emp.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                              style={{ backgroundColor: `${emp.avatar_color}33`, color: emp.avatar_color }}
                            >
                              {emp.first_name[0]}{emp.last_name[0]}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-slate-200 truncate max-w-[100px]">{emp.first_name} {emp.last_name}</div>
                              <div className="text-[10px] text-slate-500">{emp.department}</div>
                            </div>
                          </div>
                        </td>
                        {weekDates.map((date, di) => {
                          const dayShifts = shiftsOn(date, emp.id);
                          const isWeekend = di >= 5;
                          return (
                            <td
                              key={di}
                              className={`px-1 py-1.5 align-top cursor-pointer ${isWeekend ? 'bg-[#0f1724]/40' : ''}`}
                              onClick={() => { setForm(p => ({ ...p, shift_date: fmt(date), employee_id: emp.id })); setModal(true); }}
                            >
                              {dayShifts.length === 0 ? (
                                <div className="h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                  <Plus size={12} className="text-slate-600" />
                                </div>
                              ) : (
                                dayShifts.map(sh => (
                                  <div
                                    key={sh.id}
                                    className="rounded-md px-1.5 py-1 mb-1 text-[10px] font-mono group relative"
                                    style={{
                                      backgroundColor: `${sh.template_color ?? '#2563eb'}22`,
                                      borderLeft: `2px solid ${sh.template_color ?? '#2563eb'}`,
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <div className="font-medium text-slate-200">{fmtTime(sh.start_time.slice(0,5))} – {fmtTime(sh.end_time.slice(0,5))}</div>
                                    {sh.template_name && <div className="text-slate-500">{sh.template_name}</div>}
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteShift(sh.id); }}
                                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                                    >
                                      <Trash2 size={9} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Template legend */}
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-slate-600 font-mono self-center">Shift types:</span>
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-xs text-slate-400 bg-[#1e2d42] px-2 py-1 rounded-lg border border-[#2a3a52]">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span>{t.name}</span>
                <span className="text-slate-600 font-mono">{fmtTime(t.start_time.slice(0,5))}–{fmtTime(t.end_time.slice(0,5))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Shift Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Shift" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Select
            label="Employee"
            value={form.employee_id}
            onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}
          >
            <option value="">Select employee</option>
            {employees.filter(e => !deptFilter || e.department === deptFilter).map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.department}</option>
            ))}
          </Select>

          <Input
            label="Shift Date"
            type="date"
            value={form.shift_date}
            onChange={e => setForm(p => ({ ...p, shift_date: e.target.value }))}
          />

          <Select
            label="Shift Template (optional)"
            value={form.shift_template_id}
            onChange={e => { setForm(p => ({ ...p, shift_template_id: e.target.value })); applyTemplate(e.target.value); }}
          >
            <option value="">Custom times</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({fmtTime(t.start_time.slice(0,5))} – {fmtTime(t.end_time.slice(0,5))})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Start Time" type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
            <Input label="End Time"   type="time" value={form.end_time}   onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            <Input label="Break (min)" type="number" value={form.break_mins} onChange={e => setForm(p => ({ ...p, break_mins: e.target.value }))} />
          </div>

          <Input label="Location (optional)" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Office, Site A, Remote" />
          <Input label="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any special instructions" />

          {/* Duration preview */}
          {form.start_time && form.end_time && (
            <div className="bg-[#1e2d42] rounded-xl p-3 text-xs font-mono text-slate-400 flex justify-between">
              <span>Shift duration</span>
              <span className="text-slate-200">
                {(() => {
                  const [sh, sm] = form.start_time.split(':').map(Number);
                  const [eh, em] = form.end_time.split(':').map(Number);
                  const mins = (eh * 60 + em) - (sh * 60 + sm) - (parseInt(form.break_mins) || 0);
                  if (mins <= 0) return '—';
                  return `${Math.floor(mins / 60)}h ${mins % 60}m (incl. ${form.break_mins}min break)`;
                })()}
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={saveShift} loading={saving}>Create Shift</Button>
        </div>
      </Modal>
    </div>
  );
}

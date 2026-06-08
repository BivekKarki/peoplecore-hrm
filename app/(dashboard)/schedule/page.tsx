'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Input, Spinner, EmptyState, showToast } from '@/components/ui';
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Trash2,
  Clock, MapPin, Sparkles,
} from 'lucide-react';

interface Shift {
  id: string; employee_id: string; shift_date: string;
  start_time: string; end_time: string; break_mins: number;
  status: string; location: string | null; notes: string | null;
  first_name: string; last_name: string; department: string;
  avatar_color: string; template_name: string | null; template_color: string | null;
}

interface ShiftTemplate {
  id: string; name: string; start_time: string; end_time: string;
  break_mins: number; color: string;
}

interface Employee {
  id: string; first_name: string; last_name: string;
  department: string; avatar_color: string;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ap = hr >= 12 ? 'PM' : 'AM';
  const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${h12}:${m} ${ap}`;
}

function fmtDateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts]       = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);

  const [shiftModal, setShiftModal] = useState(false);
  const [editingDate, setEditingDate] = useState<string>('');
  const [shiftForm, setShiftForm] = useState({
    employee_id: '', shift_template_id: '',
    start_time: '09:00', end_time: '17:00',
    break_mins: 30, location: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [bulkModal, setBulkModal] = useState(false);
  const [bulkForm, setBulkForm]   = useState({
    employee_id: '', template_id: '',
    include_saturday: false, include_sunday: false,
    location: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const week = fmtDateKey(weekStart);
      const [shiftsRes, empRes] = await Promise.all([
        fetch(`/api/shifts?week=${week}`).then(r => r.json()),
        fetch('/api/employees?limit=200').then(r => r.json()),
      ]);
      setShifts(shiftsRes.shifts ?? []);
      setTemplates(shiftsRes.templates ?? []);
      setEmployees(empRes.data ?? []);
    } catch {
      showToast('Failed to load schedule', 'error');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const thisWeek = () => setWeekStart(getMonday(new Date()));

  const openShiftForDay = (date: string) => {
    setEditingDate(date);
    setShiftForm({
      employee_id: '', shift_template_id: '',
      start_time: '09:00', end_time: '17:00',
      break_mins: 30, location: '', notes: '',
    });
    setShiftModal(true);
  };

  const onTemplateChange = (tid: string) => {
    const t = templates.find(x => x.id === tid);
    setShiftForm(p => ({
      ...p,
      shift_template_id: tid,
      start_time: t ? t.start_time.slice(0, 5) : p.start_time,
      end_time:   t ? t.end_time.slice(0, 5)   : p.end_time,
      break_mins: t ? t.break_mins              : p.break_mins,
    }));
  };

  const saveShift = async () => {
    if (!shiftForm.employee_id) { showToast('Select an employee', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...shiftForm, shift_date: editingDate }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast(`Shift scheduled for ${editingDate}`, 'success');
      setShiftModal(false);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteShift = async (id: string) => {
    if (!confirm('Delete this shift?')) return;
    try {
      const r = await fetch(`/api/shifts?id=${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      showToast('Shift deleted', 'success');
      load();
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  const bulkAssign = async () => {
    if (!bulkForm.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!bulkForm.template_id) { showToast('Select a shift template', 'error'); return; }

    const t = templates.find(x => x.id === bulkForm.template_id);
    if (!t) { showToast('Template not found', 'error'); return; }

    setBulkSaving(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const shiftsToCreate = [];
      for (let i = 0; i < 14; i++) {
        const d = addDays(today, i);
        const day = d.getDay();

        if (day === 0 && !bulkForm.include_sunday)  continue;
        if (day === 6 && !bulkForm.include_saturday) continue;

        shiftsToCreate.push({
          employee_id:       bulkForm.employee_id,
          shift_template_id: t.id,
          shift_date:        fmtDateKey(d),
          start_time:        t.start_time,
          end_time:          t.end_time,
          break_mins:        t.break_mins,
          location:          bulkForm.location || null,
        });
      }

      const r = await fetch('/api/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: shiftsToCreate }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      const emp = employees.find(e => e.id === bulkForm.employee_id);
      showToast(`Created ${j.count} shifts for ${emp?.first_name} ${emp?.last_name} over 2 weeks`, 'success');
      setBulkModal(false);
      setBulkForm({ employee_id: '', template_id: '', include_saturday: false, include_sunday: false, location: '' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setBulkSaving(false);
    }
  };

  const shiftsByDate: Record<string, Shift[]> = {};
  shifts.forEach(s => {
    const key = fmtDateKey(new Date(s.shift_date));
    if (!shiftsByDate[key]) shiftsByDate[key] = [];
    shiftsByDate[key].push(s);
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd  = addDays(weekStart, 6);
  const today    = fmtDateKey(new Date());

  const navBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 8,
    backgroundColor: '#1e2d42',
    border: '1px solid #2a3a52',
    color: '#94a3b8',
    fontSize: 13, fontWeight: 500,
    cursor: 'pointer',
  };

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Schedule" action={
          <Button variant="ghost" onClick={() => setBulkModal(true)}>
            <Sparkles size={14} /> Quick Assign 2 Weeks
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Week navigator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={prevWeek} style={navBtnStyle}>
              <ChevronLeft size={14} /> Previous
            </button>
            <button onClick={thisWeek} style={{ ...navBtnStyle, backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#fff' }}>
              This Week
            </button>
            <button onClick={nextWeek} style={navBtnStyle}>
              Next <ChevronRight size={14} />
            </button>
            <div style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 14, color: '#94a3b8', fontWeight: 500,
            }}>
              <Calendar size={14} style={{ color: '#64748b' }} />
              {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} —{' '}
              {weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Calendar grid */}
          {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
          ) : (
              <div className="schedule-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 10,
                marginBottom: 24,
              }}>
                {weekDays.map(d => {
                  const dateKey = fmtDateKey(d);
                  const dayShifts = shiftsByDate[dateKey] ?? [];
                  const isToday = dateKey === today;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                  return (
                      <div key={dateKey} style={{
                        backgroundColor: isToday ? '#1e3a8a22' : '#162030',
                        border: `1px solid ${isToday ? '#2563eb' : '#2a3a52'}`,
                        borderRadius: 12,
                        padding: 10,
                        minHeight: 360,
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 10,
                          paddingBottom: 8,
                          borderBottom: `1px solid ${isToday ? '#1e40af' : '#2a3a52'}`,
                        }}>
                          <div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: isToday ? '#60a5fa' : '#64748b' }}>
                              {d.toLocaleDateString('en-AU', { weekday: 'short' })}
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? '#93c5fd' : isWeekend ? '#64748b' : '#e2e8f0', lineHeight: 1.2 }}>
                              {d.getDate()}
                            </div>
                            <div style={{ fontSize: 10, color: '#475569' }}>
                              {d.toLocaleDateString('en-AU', { month: 'short' })}
                            </div>
                          </div>
                          <button onClick={() => openShiftForDay(dateKey)} title="Add shift"
                                  style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    backgroundColor: '#1e2d42', border: '1px solid #2a3a52',
                                    color: '#94a3b8', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2563eb'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1e2d42'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflow: 'hidden' }}>
                          {dayShifts.length === 0 ? (
                              <div style={{ fontSize: 11, color: '#334155', textAlign: 'center', padding: '24px 0' }}>
                                No shifts
                              </div>
                          ) : (
                              dayShifts.map(s => (
                                  <ShiftCard key={s.id} shift={s} onDelete={() => deleteShift(s.id)} />
                              ))
                          )}
                        </div>
                      </div>
                  );
                })}
              </div>
          )}

          {/* Templates section */}
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Default Shift Templates</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Click a template below to quickly assign it to an employee for the next 2 weeks
                </div>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                {templates.length} templates
              </div>
            </div>

            {templates.length === 0 ? (
                <EmptyState message="No shift templates configured" icon="🕐" />
            ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 10,
                }}>
                  {templates.map(t => (
                      <div
                          key={t.id}
                          onClick={() => { setBulkForm(p => ({ ...p, template_id: t.id })); setBulkModal(true); }}
                          style={{
                            backgroundColor: '#1e2d42',
                            border: `1px solid #2a3a52`,
                            borderLeft: `4px solid ${t.color}`,
                            borderRadius: 10,
                            padding: 12,
                            cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#243548';
                            (e.currentTarget as HTMLElement).style.borderColor = t.color;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#1e2d42';
                            (e.currentTarget as HTMLElement).style.borderColor = '#2a3a52';
                          }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{t.name}</div>
                          <div style={{ fontSize: 10, padding: '2px 6px', backgroundColor: `${t.color}33`, color: t.color, borderRadius: 4, fontFamily: 'monospace' }}>
                            {t.break_mins}m break
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                          <Clock size={11} />
                          {fmtTime(t.start_time)} — {fmtTime(t.end_time)}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 10, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Sparkles size={10} /> Click to bulk-assign for 2 weeks
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </Card>

        </div>

        {/* Add Shift Modal */}
        <Modal open={shiftModal} onClose={() => setShiftModal(false)} title={`Schedule Shift — ${editingDate}`} maxWidth="max-w-md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Employee *" value={shiftForm.employee_id} onChange={e => setShiftForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.department}</option>
              ))}
            </Select>

            <Select label="Shift Template (optional)" value={shiftForm.shift_template_id} onChange={e => onTemplateChange(e.target.value)}>
              <option value="">Custom hours</option>
              {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtTime(t.start_time)} to {fmtTime(t.end_time)}</option>
              ))}
            </Select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Start Time *" type="time" value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} />
              <Input label="End Time *"   type="time" value={shiftForm.end_time}   onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Break (mins)" type="number" value={shiftForm.break_mins} onChange={e => setShiftForm(p => ({ ...p, break_mins: parseInt(e.target.value) || 0 }))} />
              <Input label="Location" value={shiftForm.location} onChange={e => setShiftForm(p => ({ ...p, location: e.target.value }))} placeholder="Office, Remote…" />
            </div>

            <Input label="Notes" value={shiftForm.notes} onChange={e => setShiftForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setShiftModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveShift} loading={saving}>Save Shift</Button>
          </div>
        </Modal>

        {/* Bulk Assign Modal */}
        <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Assign Shift — Next 2 Weeks" maxWidth="max-w-md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '10px 14px', backgroundColor: '#1e3a8a22', border: '1px solid #1e40af', borderRadius: 10, fontSize: 12, color: '#93c5fd', lineHeight: 1.6 }}>
              <Sparkles size={13} style={{ display: 'inline', marginRight: 4 }} />
              Creates the selected shift template every day for the next 14 days for one employee.
              Skips weekends unless you opt in.
            </div>

            <Select label="Employee *" value={bulkForm.employee_id} onChange={e => setBulkForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.department}</option>
              ))}
            </Select>

            <Select label="Shift Template *" value={bulkForm.template_id} onChange={e => setBulkForm(p => ({ ...p, template_id: e.target.value }))}>
              <option value="">Select template</option>
              {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtTime(t.start_time)} to {fmtTime(t.end_time)}</option>
              ))}
            </Select>

            <Input label="Location (optional)" value={bulkForm.location} onChange={e => setBulkForm(p => ({ ...p, location: e.target.value }))} placeholder="Office, Remote, Warehouse…" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>Include Weekends</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { key: 'include_saturday', label: 'Saturday' },
                  { key: 'include_sunday',   label: 'Sunday' },
                ].map(opt => {
                  const v = (bulkForm as Record<string, unknown>)[opt.key] as boolean;
                  return (
                      <button key={opt.key}
                              onClick={() => setBulkForm(p => ({ ...p, [opt.key]: !v }))}
                              style={{
                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                backgroundColor: v ? '#14532d22' : '#1e2d42',
                                border: `1px solid ${v ? '#166534' : '#2a3a52'}`,
                                color: v ? '#86efac' : '#94a3b8',
                                fontSize: 13, cursor: 'pointer',
                              }}>
                        {v ? '✓' : '○'} {opt.label}
                      </button>
                  );
                })}
              </div>
            </div>

            {bulkForm.employee_id && bulkForm.template_id && (
                <div style={{ padding: '10px 14px', backgroundColor: '#14532d22', border: '1px solid #166534', borderRadius: 10, fontSize: 12, color: '#86efac' }}>
                  Will create approximately{' '}
                  <strong>{10 + (bulkForm.include_saturday ? 2 : 0) + (bulkForm.include_sunday ? 2 : 0)} shifts</strong>
                  {' '}over 14 days.
                </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setBulkModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={bulkAssign} loading={bulkSaving} disabled={!bulkForm.employee_id || !bulkForm.template_id}>
              <Sparkles size={13} /> Create Shifts
            </Button>
          </div>
        </Modal>

        <style>{`
        @media (max-width: 1100px) {
          .schedule-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .schedule-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      </div>
  );
}

function ShiftCard({ shift, onDelete }: { shift: Shift; onDelete: () => void }) {
  const color = shift.template_color ?? shift.avatar_color ?? '#2563eb';
  const initials = `${shift.first_name[0]}${shift.last_name[0]}`.toUpperCase();

  return (
      <div style={{
        backgroundColor: `${color}15`,
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        padding: '8px 10px',
        position: 'relative',
        transition: 'all .15s',
      }}
           onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = `${color}25`}
           onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = `${color}15`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            backgroundColor: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, flexShrink: 0,
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shift.first_name} {shift.last_name}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  title="Delete shift"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', padding: 2, display: 'flex',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
          >
            <Trash2 size={11} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 3 }}>
          <Clock size={9} style={{ color }} />
          {fmtTime(shift.start_time)} — {fmtTime(shift.end_time)}
        </div>

        {shift.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
              <MapPin size={9} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.location}</span>
            </div>
        )}

        {shift.template_name && (
            <div style={{ marginTop: 4, fontSize: 9, color: color, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {shift.template_name}
            </div>
        )}
      </div>
  );
}
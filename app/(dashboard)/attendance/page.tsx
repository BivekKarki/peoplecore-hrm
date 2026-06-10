'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Badge, Button, Modal, Select, Input, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Plus, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';

interface AttendanceRecord {
  id: string; employee_id: string; date: string;
  check_in: string | null; check_out: string | null;
  status: string; method: string; notes: string | null;
  employee_name: string; department: string;
}

const STATUSES = ['present','absent','late','half_day','work_from_home'];
// const METHODS  = ['manual','kiosk','facial'];

export default function AttendancePage() {
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [employees, setEmps]    = useState<{ id: string; first_name: string; last_name: string; department: string }[]>([]);
  const [form, setForm]         = useState({
    employee_id: '', date: new Date().toISOString().split('T')[0],
    check_in: '09:00', check_out: '',
    status: 'present', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/attendance?date=${date}`);
      const j = await r.json();
      setRecords(j.data ?? []);
    } catch { showToast('Failed to load attendance', 'error'); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200')
        .then(r => r.json())
        .then(j => setEmps(j.data ?? []));
  }, []);

  const submit = async () => {
    if (!form.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!form.date)        { showToast('Select a date', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Attendance recorded', 'success');
      setModal(false);
      setForm({ employee_id: '', date, check_in: '09:00', check_out: '', status: 'present', notes: '' });
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const present = records.filter(r => r.status === 'present').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const late    = records.filter(r => r.status === 'late').length;
  const wfh     = records.filter(r => r.status === 'work_from_home').length;
  const rate    = records.length > 0 ? Math.round(((present + late + wfh) / records.length) * 100) : 0;

  const fmtTime = (t: string | null) => {
    if (!t) return '—';
    try { return new Date(t).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }); }
    catch { return t; }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'present':        return <CheckCircle size={14} style={{ color: '#4ade80' }} />;
      case 'absent':         return <XCircle size={14} style={{ color: '#f87171' }} />;
      case 'late':           return <AlertTriangle size={14} style={{ color: '#fbbf24' }} />;
      case 'work_from_home': return <span style={{ fontSize: 14 }}>🏠</span>;
      case 'half_day':       return <span style={{ fontSize: 14 }}>½</span>;
      default:               return null;
    }
  };

  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); };
  const isToday = date === new Date().toISOString().split('T')[0];

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Attendance" action={
          <Button variant="primary" onClick={() => setModal(true)}>
            <Plus size={14} /> Add Record
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Present" value={present} color="#16a34a" icon={<CheckCircle size={16}/>} />
            <StatCard label="Absent"  value={absent}  color="#dc2626" icon={<XCircle size={16}/>} />
            <StatCard label="Late"    value={late}    color="#d97706" icon={<AlertTriangle size={16}/>} />
            <StatCard label="WFH"     value={wfh}     color="#2563eb" icon={<Users size={16}/>} />
            <StatCard label="Rate"    value={`${rate}%`} color={rate >= 85 ? '#16a34a' : rate >= 70 ? '#d97706' : '#dc2626'} delta="attendance" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={prevDay} style={{ padding: '8px 12px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
            <button onClick={nextDay} disabled={isToday} style={{ padding: '8px 12px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: isToday ? '#334155' : '#94a3b8', cursor: isToday ? 'not-allowed' : 'pointer', fontSize: 16 }}>›</button>
            <button onClick={() => setDate(new Date().toISOString().split('T')[0])}
                    style={{ padding: '8px 14px', backgroundColor: isToday ? '#2563eb' : '#1e2d42', border: `1px solid ${isToday ? '#2563eb' : '#2a3a52'}`, borderRadius: 8, color: isToday ? '#fff' : '#94a3b8', cursor: 'pointer', fontSize: 12 }}>
              Today
            </button>
            <span style={{ fontSize: 13, color: '#64748b', fontFamily: 'monospace', marginLeft: 4 }}>
            {new Date(date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{records.length} records</div>
          </div>

          <Card>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
            ) : records.length === 0 ? (
                <EmptyState message={`No attendance records for ${formatDate(date)}`} icon="⏱️" />
            ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ borderBottom: '1px solid #2a3a52' }}>
                      {['Employee','Department','Status','Check In','Check Out','Hours','Method','Notes'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace', fontWeight: 'normal' }}>{h}</th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {records.map(rec => {
                      let hours = '—';
                      let openShift = false;
                      if (rec.check_in && rec.check_out) {
                        const diff = (new Date(rec.check_out).getTime() - new Date(rec.check_in).getTime()) / 3600000;
                        if (diff > 0) hours = `${diff.toFixed(1)}h`;
                      } else if (rec.check_in && !rec.check_out) {
                        openShift = true;
                      }
                      return (
                          <tr key={rec.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{rec.employee_name}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b' }}>{rec.department}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {statusIcon(rec.status)}
                                <Badge status={rec.status} />
                              </div>
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: '#4ade80' }}>{fmtTime(rec.check_in)}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: rec.check_out ? '#f87171' : '#475569' }}>
                              {rec.check_out ? fmtTime(rec.check_out) : '⏳ pending'}
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', color: '#e2e8f0', fontWeight: 600 }}>{hours}</td>
                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                              {openShift ? (
                                  <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fbbf24', animation: 'pulse 2s ease-in-out infinite' }} />
                                      Open
                                    </span>
                              ) : (
                                  <span style={{ color: '#e2e8f0' }}>{hours}</span>
                              )}
                            </td>
                            <td style={{ padding: '11px 16px', fontSize: 12, color: '#64748b' }}>{rec.notes ?? '—'}</td>
                          </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
            )}
          </Card>
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title="Add Attendance Record" maxWidth="max-w-lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Employee *" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.department}</option>)}
            </Select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Date *"   type="date" value={form.date}      onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              <Select label="Status *" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
              </Select>
              <Input label="Check In *"          type="time" value={form.check_in}  onChange={e => setForm(p => ({ ...p, check_in: e.target.value }))} />
              <Input label="Check Out (optional)" type="time" value={form.check_out} onChange={e => setForm(p => ({ ...p, check_out: e.target.value }))} />
            </div>
            {/*<Select label="Method" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>*/}
            {/*  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}*/}
            {/*</Select>*/}
            {!form.check_out && (
                <div style={{ padding: '10px 14px', backgroundColor: '#78350f22', border: '1px solid #92400e', borderRadius: 10, fontSize: 12, color: '#fcd34d', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span>💡</span>
                  <span>
                    <strong>Open shift</strong> — Leave check-out blank if you just want to record the clock-in.
                    The employee can clock out themselves at the kiosk later, and the hours will be calculated automatically.
                  </span>
                </div>
            )}

            <Input label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={saving}>Save Record</Button>
          </div>
        </Modal>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%      { opacity: 0.4; }
          }
        `}</style>
      </div>
  );
}
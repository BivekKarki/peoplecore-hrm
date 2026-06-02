'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Badge, Button, Modal, Select, Input, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, Plus, Calendar, Clock, Users, AlertCircle } from 'lucide-react';

interface LeaveRequest {
  id: string; employee_id: string; leave_type: string;
  start_date: string; end_date: string; days: number;
  status: string; reason: string | null; denial_reason: string | null;
  employee_name: string; approver_name: string | null;
  created_at: string;
}

const LEAVE_TYPES = [
  { value: 'annual',        label: 'Annual Leave' },
  { value: 'sick',          label: 'Sick Leave' },
  { value: 'parental',      label: 'Parental Leave' },
  { value: 'unpaid',        label: 'Unpaid Leave' },
  { value: 'compassionate', label: 'Compassionate Leave' },
  { value: 'long_service',  label: 'Long Service Leave' },
];

const STATUS_TABS = ['', 'pending', 'approved', 'denied', 'cancelled'];

export default function LeavePage() {
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('');
  const [applyModal, setApply]    = useState(false);
  const [denyModal, setDenyModal] = useState(false);
  const [denyId, setDenyId]       = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [saving, setSaving]       = useState(false);
  const [employees, setEmps]      = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [form, setForm]           = useState({
    employee_id: '', leave_type: 'annual',
    start_date: '', end_date: '', reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : '';
      const r = await fetch(`/api/leave${q}`);
      const j = await r.json();
      setRequests(j.data ?? []);
    } catch { showToast('Failed to load leave requests', 'error'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200')
        .then(r => r.json())
        .then(j => setEmps(j.data ?? []));
  }, []);

  const submit = async () => {
    if (!form.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!form.start_date)  { showToast('Select start date', 'error'); return; }
    if (!form.end_date)    { showToast('Select end date', 'error'); return; }
    if (form.end_date < form.start_date) { showToast('End date must be after start date', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Leave request submitted', 'success');
      setApply(false);
      setForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const approve = async (id: string) => {
    try {
      const r = await fetch(`/api/leave/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Leave approved', 'success');
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
  };

  const openDeny = (id: string) => { setDenyId(id); setDenyReason(''); setDenyModal(true); };

  const deny = async () => {
    if (!denyId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/leave/${denyId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deny', denial_reason: denyReason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Leave denied', 'success');
      setDenyModal(false);
      load();
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const pending  = requests.filter(r => r.status === 'pending');
  const approved = requests.filter(r => r.status === 'approved');
  const totalDays = approved.reduce((s, r) => s + r.days, 0);
  const typeLabel = (t: string) => LEAVE_TYPES.find(l => l.value === t)?.label ?? t;

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Leave Management" action={
          <Button variant="primary" onClick={() => setApply(true)}>
            <Plus size={14} /> New Request
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Requests" value={requests.length}  color="#2563eb" icon={<Calendar size={16}/>} />
            <StatCard label="Pending"        value={pending.length}   color="#d97706" icon={<Clock size={16}/>} delta={pending.length > 0 ? 'Action needed' : 'All clear'} />
            <StatCard label="Approved"       value={approved.length}  color="#16a34a" icon={<CheckCircle size={16}/>} />
            <StatCard label="Days Approved"  value={totalDays}        color="#7c3aed" icon={<Users size={16}/>} delta="This period" />
          </div>

          {pending.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', backgroundColor: '#78350f22', border: '1px solid #92400e', borderRadius: 12, marginBottom: 16 }}>
                <AlertCircle size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#fcd34d' }}>
              <strong>{pending.length}</strong> leave request{pending.length > 1 ? 's' : ''} pending approval
            </span>
              </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10, padding: 4 }}>
            {STATUS_TABS.map(s => (
                <button key={s} onClick={() => setFilter(s)}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'all .15s', backgroundColor: filter === s ? '#2563eb' : 'transparent', color: filter === s ? '#fff' : '#64748b' }}>
                  {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                </button>
            ))}
          </div>

          <Card>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
            ) : requests.length === 0 ? (
                <EmptyState message="No leave requests found" icon="📅" />
            ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ borderBottom: '1px solid #2a3a52' }}>
                      {['Employee','Type','From','To','Days','Status','Reason','Actions'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace', fontWeight: 'normal' }}>{h}</th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {requests.map(req => (
                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{req.employee_name}</td>
                          <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', color: '#94a3b8' }}>
                          {typeLabel(req.leave_type)}
                        </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{formatDate(req.start_date)}</td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{formatDate(req.end_date)}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', textAlign: 'center' }}>{req.days}</td>
                          <td style={{ padding: '12px 16px' }}><Badge status={req.status} /></td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.reason ?? req.denial_reason ?? '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {req.status === 'pending' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => approve(req.id)}
                                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, backgroundColor: '#14532d', border: '1px solid #166534', color: '#86efac', fontSize: 11, cursor: 'pointer' }}>
                                    <CheckCircle size={11} /> Approve
                                  </button>
                                  <button onClick={() => openDeny(req.id)}
                                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, backgroundColor: '#7f1d1d22', border: '1px solid #991b1b', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
                                    <XCircle size={11} /> Deny
                                  </button>
                                </div>
                            )}
                            {req.status === 'approved' && <span style={{ fontSize: 11, color: '#4ade80' }}>✓ {req.approver_name ?? 'HR'}</span>}
                            {req.status === 'denied'   && <span style={{ fontSize: 11, color: '#f87171' }}>✗ Denied</span>}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}
          </Card>
        </div>

        <Modal open={applyModal} onClose={() => setApply(false)} title="New Leave Request" maxWidth="max-w-lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Employee *" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </Select>
            <Select label="Leave Type *" value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Start Date *" type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              <Input label="End Date *"   type="date" value={form.end_date}   onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>Reason</label>
              <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                        placeholder="Optional reason for leave…" rows={3}
                        style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            </div>
            {form.start_date && form.end_date && form.end_date >= form.start_date && (
                <div style={{ padding: '10px 14px', backgroundColor: '#1e3a8a22', border: '1px solid #1e40af', borderRadius: 10, fontSize: 12, color: '#93c5fd', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Working days requested</span>
                  <strong>{Math.max(1, Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1)} days</strong>
                </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setApply(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={saving}>Submit Request</Button>
          </div>
        </Modal>

        <Modal open={denyModal} onClose={() => setDenyModal(false)} title="Deny Leave Request" maxWidth="max-w-md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Provide a reason for denying this leave request. The employee will be notified by email.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>Reason for Denial</label>
              <textarea value={denyReason} onChange={e => setDenyReason(e.target.value)}
                        placeholder="e.g. Insufficient leave balance, critical project deadline…" rows={4}
                        style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setDenyModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={deny} loading={saving}>Deny Request</Button>
          </div>
        </Modal>
      </div>
  );
}
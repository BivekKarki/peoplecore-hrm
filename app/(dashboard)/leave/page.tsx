'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Badge, Button, Modal, Select, Textarea, Input, Spinner, EmptyState, showToast, StatCard } from '@/components/ui';
import { LeaveRequest } from '@/types';
import { formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, Plus, Calendar } from 'lucide-react';

const LEAVE_TYPES = ['annual','sick','parental','unpaid','compassionate','long_service'];

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [applyModal, setApply]  = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ employee_id:'', leave_type:'annual', start_date:'', end_date:'', reason:'' });
  const [employees, setEmps]    = useState<{id:string;first_name:string;last_name:string}[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : '';
      const r = await fetch(`/api/leave${q}`);
      const j = await r.json();
      setRequests(j.data ?? []);
    } catch { showToast('Failed to load leave requests','error'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=100')
      .then((r) => r.json())
      .then((j) => setEmps(j.data ?? []));
  }, []);

  const action = async (id: string, act: 'approve' | 'deny') => {
    try {
      const r = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act }),
      });
      if (!r.ok) throw new Error();
      showToast(`Leave ${act}d`, act === 'approve' ? 'success' : 'error');
      load();
    } catch { showToast('Action failed','error'); }
  };

  const submit = async () => {
    if (!form.employee_id) { showToast('Select an employee','error'); return; }
    if (!form.start_date || !form.end_date) { showToast('Select dates','error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Leave request submitted','success');
      setApply(false);
      setForm({ employee_id:'', leave_type:'annual', start_date:'', end_date:'', reason:'' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed','error');
    } finally { setSaving(false); }
  };

  const pending  = requests.filter((r) => r.status === 'pending').length;
  const approved = requests.filter((r) => r.status === 'approved').length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Leave Management" action={
        <Button variant="primary" onClick={() => setApply(true)}><Plus size={14} /> Apply Leave</Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Pending"  value={pending}  color="#d97706" icon={<Calendar size={16} />} />
          <StatCard label="Approved" value={approved} color="#16a34a" />
          <StatCard label="This Month" value={requests.filter((r)=>r.created_at?.startsWith(new Date().toISOString().slice(0,7))).length} color="#2563eb" />
          <StatCard label="Total" value={requests.length} color="#94a3b8" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['','pending','approved','denied','cancelled'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-blue-600 text-white' : 'bg-[#1e2d42] text-slate-400 hover:text-slate-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        <Card>
          {loading ? <div className="flex justify-center py-16"><Spinner size={28} /></div> :
           requests.length === 0 ? <EmptyState message="No leave requests" icon="📅" /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Employee','Type','From','To','Days','Status','Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">{req.employee_name}</td>
                      <td className="px-4 py-3"><Badge status={req.leave_type} label={req.leave_type.replace('_',' ')} /></td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{formatDate(req.start_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{formatDate(req.end_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{req.days}d</td>
                      <td className="px-4 py-3"><Badge status={req.status} /></td>
                      <td className="px-4 py-3">
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <button onClick={() => action(req.id,'approve')} className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors" title="Approve"><CheckCircle size={14} /></button>
                            <button onClick={() => action(req.id,'deny')}    className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors" title="Deny"><XCircle size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={applyModal} onClose={() => setApply(false)} title="Apply for Leave" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Select label="Employee" value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}>
            <option value="">Select employee</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Select label="Leave Type" value={form.leave_type} onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            <Input label="To"   type="date" value={form.end_date}   onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
          <Textarea label="Reason (optional)" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Brief reason for leave..." />
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setApply(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Submit Request</Button>
        </div>
      </Modal>
    </div>
  );
}

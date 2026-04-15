'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Input, Spinner, EmptyState, StatCard, Badge, showToast } from '@/components/ui';
import { Receipt, Plus, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Expense {
  id: string; employee_id: string; title: string; amount: number;
  category: string; claim_date: string; status: string;
  notes: string | null; employee_name: string; approver_name: string | null;
}

const CATEGORIES = [
  { value:'travel',        label:'Travel' },
  { value:'meals',         label:'Meals & Entertainment' },
  { value:'accommodation', label:'Accommodation' },
  { value:'equipment',     label:'Equipment' },
  { value:'training',      label:'Training' },
  { value:'other',         label:'Other' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [employees, setEmps]      = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [statusFilter, setFilter] = useState('');
  const [form, setForm]           = useState({
    employee_id: '', title: '', amount: '',
    category: 'travel', claim_date: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const r = await fetch(`/api/expenses${q}`);
      const j = await r.json();
      setExpenses(j.data ?? []);
    } catch { showToast('Failed to load expenses', 'error'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then(r => r.json())
      .then(j => setEmps(j.data ?? []));
  }, []);

  const action = async (id: string, act: 'approve' | 'reject' | 'mark_paid') => {
    try {
      const r = await fetch('/api/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: act }),
      });
      if (!r.ok) throw new Error();
      showToast(`Expense ${act.replace('_',' ')}d`, 'success');
      load();
    } catch { showToast('Action failed', 'error'); }
  };

  const submit = async () => {
    if (!form.employee_id)           { showToast('Select employee', 'error'); return; }
    if (!form.title.trim())          { showToast('Title required', 'error'); return; }
    if (!form.amount || isNaN(Number(form.amount))) { showToast('Valid amount required', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          title:       form.title,
          amount:      Number(form.amount),
          category:    form.category,
          claim_date:  form.claim_date || new Date().toISOString().split('T')[0],
          notes:       form.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Expense submitted', 'success');
      setModal(false);
      setForm({ employee_id:'', title:'', amount:'', category:'travel', claim_date:'', notes:'' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const pending  = expenses.filter(e => e.status === 'pending');
  const approved = expenses.filter(e => e.status === 'approved');
  const totalPending  = pending.reduce((s, e) => s + Number(e.amount), 0);
  const totalApproved = approved.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Expense Claims" action={
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus size={14} /> New Claim
        </Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Claims"      value={expenses.length}          color="#2563eb" icon={<Receipt size={16}/>} />
          <StatCard label="Pending"           value={pending.length}           color="#d97706" delta={formatCurrency(totalPending)} />
          <StatCard label="Approved"          value={approved.length}          color="#16a34a" delta={formatCurrency(totalApproved)} />
          <StatCard label="Awaiting Payment"  value={approved.length}          color="#7c3aed" icon={<CreditCard size={16}/>} />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {['','pending','approved','rejected','paid'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-[#1e2d42] text-slate-400 hover:text-slate-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={28} /></div>
          ) : expenses.length === 0 ? (
            <EmptyState message="No expense claims" icon="🧾" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Employee','Title','Category','Amount','Date','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">{exp.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{exp.title}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-slate-400 bg-[#1e2d42] px-2 py-0.5 rounded border border-[#2a3a52]">
                          {CATEGORIES.find(c => c.value === exp.category)?.label ?? exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-200">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(exp.claim_date)}</td>
                      <td className="px-4 py-3"><Badge status={exp.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {exp.status === 'pending' && (
                            <>
                              <button onClick={() => action(exp.id, 'approve')} className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors" title="Approve">
                                <CheckCircle size={13} />
                              </button>
                              <button onClick={() => action(exp.id, 'reject')} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors" title="Reject">
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                          {exp.status === 'approved' && (
                            <button onClick={() => action(exp.id, 'mark_paid')} className="p-1.5 text-purple-400 hover:bg-purple-900/30 rounded-lg transition-colors text-xs font-mono" title="Mark Paid">
                              Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Expense Claim" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Select label="Employee" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
            <option value="">Select employee</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Input label="Description" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Taxi to client meeting" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Input label="Amount (AUD)" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
          </div>
          <Input label="Date" type="date" value={form.claim_date} onChange={e => setForm(p => ({ ...p, claim_date: e.target.value }))} />
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">Notes / Justification</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Business purpose, client name, etc."
              className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y min-h-[60px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Submit Claim</Button>
        </div>
      </Modal>
    </div>
  );
}

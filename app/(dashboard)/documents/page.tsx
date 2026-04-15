'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Input, Textarea, Badge, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { FileText, Plus, CheckCircle, AlertTriangle, Trash2, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Doc {
  id: string; employee_id: string; doc_type: string; title: string;
  file_name: string | null; expiry_date: string | null;
  is_verified: boolean; uploaded_at: string; employee_name: string;
  notes: string | null;
}

const DOC_TYPES = [
  { value:'contract',      label:'Employment Contract' },
  { value:'id',            label:'Photo ID' },
  { value:'passport',      label:'Passport' },
  { value:'visa',          label:'Visa / Work Permit' },
  { value:'tax',           label:'Tax File Declaration' },
  { value:'certificate',   label:'Certificate / Licence' },
  { value:'qualification', label:'Qualification' },
  { value:'medical',       label:'Medical Certificate' },
  { value:'other',         label:'Other' },
];

export default function DocumentsPage() {
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [employees, setEmps]      = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [filter, setFilter]       = useState('');
  const [expFilter, setExpFilter] = useState(false);
  const [form, setForm]           = useState({
    employee_id: '', doc_type: 'contract', title: '',
    file_name: '', expiry_date: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (expFilter) q.set('expiring', 'true');
      const r = await fetch(`/api/documents?${q}`);
      const j = await r.json();
      setDocs(j.data ?? []);
    } catch { showToast('Failed to load documents', 'error'); }
    finally { setLoading(false); }
  }, [expFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then(r => r.json())
      .then(j => setEmps(j.data ?? []));
  }, []);

  const submit = async () => {
    if (!form.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          doc_type:    form.doc_type,
          title:       form.title,
          file_name:   form.file_name || null,
          expiry_date: form.expiry_date || null,
          notes:       form.notes || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Document saved', 'success');
      setModal(false);
      setForm({ employee_id:'', doc_type:'contract', title:'', file_name:'', expiry_date:'', notes:'' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const verify = async (id: string, verified: boolean) => {
    try {
      const r = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_verified: verified }),
      });
      if (!r.ok) throw new Error();
      showToast(verified ? 'Document verified' : 'Verification removed', 'success');
      load();
    } catch { showToast('Failed to update', 'error'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      showToast('Document deleted', 'success');
      load();
    } catch { showToast('Failed to delete', 'error'); }
  };

  const today = new Date();
  const expiringSoon = docs.filter(d =>
    d.expiry_date && new Date(d.expiry_date) <= new Date(Date.now() + 30 * 86400000)
  );
  const expired = docs.filter(d =>
    d.expiry_date && new Date(d.expiry_date) < today
  );
  const verified = docs.filter(d => d.is_verified);

  const filtered = docs.filter(d => {
    if (!filter) return true;
    return d.employee_name.toLowerCase().includes(filter.toLowerCase()) ||
           d.doc_type.includes(filter.toLowerCase()) ||
           d.title.toLowerCase().includes(filter.toLowerCase());
  });

  const getExpiryStatus = (expiry: string | null) => {
    if (!expiry) return null;
    const exp = new Date(expiry);
    const now = new Date();
    const days = Math.round((exp.getTime() - now.getTime()) / 86400000);
    if (days < 0)  return { label: 'Expired',       className: 'bg-red-900/60 text-red-300 border border-red-700/40' };
    if (days <= 30) return { label: `${days}d left`, className: 'bg-amber-900/60 text-amber-300 border border-amber-700/40' };
    return { label: `${days}d left`, className: 'bg-green-900/60 text-green-300 border border-green-700/40' };
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Document Management" action={
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus size={14} /> Add Document
        </Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Documents" value={docs.length}          color="#2563eb" icon={<FileText size={16}/>} />
          <StatCard label="Verified"        value={verified.length}      color="#16a34a" icon={<ShieldCheck size={16}/>} />
          <StatCard label="Expiring (30d)"  value={expiringSoon.length}  color="#d97706" icon={<AlertTriangle size={16}/>} delta={expiringSoon.length > 0 ? 'Action needed' : 'All good'} />
          <StatCard label="Expired"         value={expired.length}       color="#dc2626" icon={<AlertTriangle size={16}/>} />
        </div>

        {/* Expiry alerts */}
        {expiringSoon.length > 0 && (
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-300">
              <strong>{expiringSoon.length} document{expiringSoon.length > 1 ? 's' : ''}</strong> expiring within 30 days:{' '}
              {expiringSoon.slice(0, 3).map(d => `${d.employee_name} (${d.title})`).join(', ')}
              {expiringSoon.length > 3 && ` and ${expiringSoon.length - 3} more`}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search employee, type, title…"
            className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 flex-1 min-w-[200px] max-w-xs"
          />
          <label className="flex items-center gap-2 px-3 py-2 bg-[#1e2d42] border border-[#2a3a52] rounded-lg cursor-pointer text-sm text-slate-300">
            <input type="checkbox" checked={expFilter} onChange={e => setExpFilter(e.target.checked)} className="accent-blue-500" />
            Expiring soon only
          </label>
          <div className="ml-auto text-xs text-slate-500 font-mono self-center">{filtered.length} documents</div>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={28} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState message="No documents found" icon="📄" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Employee','Type','Title','Expiry','Status','Uploaded','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => {
                    const expStatus = getExpiryStatus(doc.expiry_date);
                    const typeLabel = DOC_TYPES.find(t => t.value === doc.doc_type)?.label ?? doc.doc_type;
                    return (
                      <tr key={doc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] group">
                        <td className="px-4 py-3 text-sm font-medium text-slate-200">{doc.employee_name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono bg-[#1e2d42] text-slate-400 border border-[#2a3a52]">
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{doc.title}</td>
                        <td className="px-4 py-3">
                          {expStatus ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono ${expStatus.className}`}>
                              {expStatus.label}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">No expiry</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {doc.is_verified ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle size={12} /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Unverified</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(doc.uploaded_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => verify(doc.id, !doc.is_verified)}
                              className={`p-1.5 rounded-lg transition-colors ${doc.is_verified ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-400 hover:text-green-400 hover:bg-green-900/30'}`}
                              title={doc.is_verified ? 'Remove verification' : 'Mark verified'}
                            >
                              <ShieldCheck size={13} />
                            </button>
                            <button
                              onClick={() => remove(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Document Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Employee Document" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Select label="Employee" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
            <option value="">Select employee</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Select label="Document Type" value={form.doc_type} onChange={e => setForm(p => ({ ...p, doc_type: e.target.value }))}>
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input label="Title / Description" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Full-time Employment Contract 2025" />
          <Input label="File Name (optional)" value={form.file_name} onChange={e => setForm(p => ({ ...p, file_name: e.target.value }))} placeholder="e.g. john_smith_contract.pdf" />
          <Input label="Expiry Date (if applicable)" type="date" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional notes…"
              className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y min-h-[60px]"
            />
          </div>
          <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-xl text-xs text-slate-400">
            📎 File upload storage (S3/Cloudflare R2) can be connected via the <code className="text-blue-400">file_url</code> field. Contact your system administrator to configure cloud storage.
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Save Document</Button>
        </div>
      </Modal>
    </div>
  );
}

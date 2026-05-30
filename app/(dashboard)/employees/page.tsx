'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserPlus, Search, Trash2, Pencil, Mail } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Avatar, Badge, Button, Modal, Input, Select, Spinner, EmptyState, ConfirmDialog, showToast } from '@/components/ui';
import { Employee } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const DEPTS   = ['Engineering','Sales','Marketing','Operations','Finance','HR','Legal','Product'];
const TYPES   = ['full-time','part-time','contract','casual'];
const STATUSES = ['active','pending','inactive','on_leave'];

const EMPTY: Partial<Employee> = {
  first_name:'', last_name:'', email:'', phone:'', department:'', job_title:'',
  employment_type:'full-time', status:'pending', start_date:'', salary:0,
};

function EmployeesContent() {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState(searchParams.get('search') ?? '');
  const [dept, setDept]           = useState(searchParams.get('department') ?? '');
  const [status, setStatus]       = useState(searchParams.get('status') ?? '');
  const [page, setPage]           = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Employee>>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [errors, setErrors]       = useState<Record<string,string>>({});

  // Email modal state
  const [emailModal, setEmailModal]     = useState(false);
  const [emailTarget, setEmailTarget]   = useState<Employee | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody]       = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const LIMIT = 20;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) q.set('search', search);
      if (dept)   q.set('department', dept);
      if (status) q.set('status', status);
      const r = await fetch(`/api/employees?${q}`);
      const j = await r.json();
      setEmployees(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, dept, status, page]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openAdd  = () => { setEditing({ ...EMPTY }); setErrors({}); setModalOpen(true); };
  const openEdit = (e: Employee) => { setEditing({ ...e }); setErrors({}); setModalOpen(true); };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!editing.first_name?.trim()) e.first_name = 'Required';
    if (!editing.last_name?.trim())  e.last_name  = 'Required';
    if (!editing.email?.includes('@')) e.email    = 'Valid email required';
    if (!editing.department)         e.department = 'Required';
    if (!editing.job_title?.trim())  e.job_title  = 'Required';
    if (!editing.start_date)         e.start_date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = !!editing.id;
      const url    = isEdit ? `/api/employees/${editing.id}` : '/api/employees';
      const method = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const j = await r.json();
      if (!r.ok) { showToast(j.error ?? 'Save failed', 'error'); return; }
      showToast(isEdit ? 'Employee updated' : 'Employee added', 'success');
      setModalOpen(false);
      fetchEmployees();
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/employees/${confirmId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      showToast('Employee deactivated', 'success');
      setConfirmId(null);
      fetchEmployees();
    } catch {
      showToast('Failed to deactivate', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Open email modal for an employee
  const openEmailModal = (emp: Employee) => {
    setEmailTarget(emp);
    setEmailSubject('');
    setEmailBody('');
    setEmailModal(true);
  };

  // Send email via Resend
  const submitEmail = async () => {
    if (!emailTarget) return;
    if (!emailSubject.trim()) { showToast('Subject is required', 'error'); return; }
    if (!emailBody.trim())    { showToast('Message is required', 'error'); return; }
    if (!emailTarget.email)   { showToast('This employee has no email address', 'error'); return; }

    setSendingEmail(true);
    try {
      const r = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      emailTarget.email,
          name:    `${emailTarget.first_name} ${emailTarget.last_name}`,
          subject: emailSubject,
          message: emailBody,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Failed');
      showToast(`Email sent to ${emailTarget.first_name} successfully!`, 'success');
      setEmailModal(false);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const set = (k: keyof Employee, v: unknown) => setEditing((p) => ({ ...p, [k]: v }));
  const totalPages = Math.ceil(total / LIMIT);

  return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar title="Employees" action={
          <Button variant="primary" onClick={openAdd}><UserPlus size={14} /> Add Employee</Button>
        } />

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 bg-[#1e2d42] border border-[#2a3a52] rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-xs">
              <Search size={13} className="text-slate-500" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                     placeholder="Search name, email, ID…"
                     className="bg-transparent text-sm text-slate-100 placeholder-slate-600 outline-none flex-1" />
            </div>
            <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }}
                    className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-300 px-3 py-2 text-sm outline-none cursor-pointer">
              <option value="">All Departments</option>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-300 px-3 py-2 text-sm outline-none cursor-pointer">
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
            <div className="ml-auto text-xs text-slate-500 self-center font-mono">{total} employees</div>
          </div>

          {/* Table */}
          <Card>
            {loading ? (
                <div className="flex justify-center py-16"><Spinner size={28} /></div>
            ) : employees.length === 0 ? (
                <EmptyState message="No employees found" icon="👥" />
            ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                    <tr className="border-b border-[#2a3a52]">
                      {['Employee','Department','Role','Type','Status','Salary','Started','Actions'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar firstName={emp.first_name} lastName={emp.last_name} color={emp.avatar_color} />
                              <div>
                                <div className="text-sm font-medium text-slate-200">{emp.first_name} {emp.last_name}</div>
                                <div className="text-xs text-slate-500">{emp.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">{emp.department}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{emp.job_title}</td>
                          <td className="px-4 py-3"><Badge status={emp.employment_type} /></td>
                          <td className="px-4 py-3"><Badge status={emp.status} /></td>
                          <td className="px-4 py-3 text-sm text-slate-300 font-mono">{formatCurrency(emp.salary)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{formatDate(emp.start_date)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(emp)}
                                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                                      title="Edit">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => setConfirmId(emp.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                                      title="Deactivate">
                                <Trash2 size={13} />
                              </button>
                              <button onClick={() => openEmailModal(emp)}
                                      className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                                      title="Send Email">
                                <Mail size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a3a52]">
                  <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
                  <span className="text-xs text-slate-500 font-mono">Page {page} of {totalPages}</span>
                  <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
                </div>
            )}
          </Card>
        </div>

        {/* Add / Edit Employee Modal */}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? 'Edit Employee' : 'Add New Employee'}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First Name"  value={editing.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} placeholder="John" />
            <Input label="Last Name"   value={editing.last_name ?? ''}  onChange={(e) => set('last_name', e.target.value)}  error={errors.last_name}  placeholder="Smith" />
            <Input label="Email" type="email" value={editing.email ?? ''} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="john@company.com" className="col-span-2" />
            <Input label="Phone" value={editing.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+61 4XX XXX XXX" />
            <Select label="Department" value={editing.department ?? ''} onChange={(e) => set('department', e.target.value)} error={errors.department}>
              <option value="">Select department</option>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </Select>
            <Input label="Job Title" value={editing.job_title ?? ''} onChange={(e) => set('job_title', e.target.value)} error={errors.job_title} placeholder="Software Engineer" className="col-span-2" />
            <Select label="Employment Type" value={editing.employment_type ?? 'full-time'} onChange={(e) => set('employment_type', e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Status" value={editing.status ?? 'pending'} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </Select>
            <Input label="Start Date" type="date" value={editing.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} error={errors.start_date} />
            <Input label="Annual Salary (AUD)" type="number" value={editing.salary ?? ''} onChange={(e) => set('salary', parseFloat(e.target.value) || 0)} placeholder="80000" />
            <Input label="Bank BSB"     value={editing.bank_bsb ?? ''}       onChange={(e) => set('bank_bsb', e.target.value)}       placeholder="XXX-XXX" />
            <Input label="Bank Account" value={editing.bank_account ?? ''}   onChange={(e) => set('bank_account', e.target.value)}   placeholder="XXXXXXXXXX" />
            <Input label="Tax File Number" value={editing.tax_file_number ?? ''} onChange={(e) => set('tax_file_number', e.target.value)} placeholder="XXX XXX XXX" />
            <Input label="Super Fund"   value={editing.super_fund ?? ''}     onChange={(e) => set('super_fund', e.target.value)}     placeholder="Australian Super" />
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>Save Employee</Button>
          </div>
        </Modal>

        {/* Send Email Modal */}
        <Modal open={emailModal} onClose={() => setEmailModal(false)} title={`Send Email to ${emailTarget?.first_name ?? ''}`} maxWidth="max-w-lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Recipient info */}
            {emailTarget && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${emailTarget.avatar_color}33`, color: emailTarget.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                    {emailTarget.first_name[0]}{emailTarget.last_name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>
                      {emailTarget.first_name} {emailTarget.last_name}
                    </div>
                    <div style={{ fontSize: 11, color: emailTarget.email ? '#60a5fa' : '#f87171', marginTop: 2 }}>
                      {emailTarget.email || '⚠ No email address on file'}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
                    {emailTarget.department}
                  </div>
                </div>
            )}

            {/* Quick templates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>
                Quick Templates
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Meeting Request',  subject: 'Meeting Request',              body: `Hi ${emailTarget?.first_name},\n\nI would like to schedule a meeting with you to discuss your role and performance.\n\nPlease let me know your availability.\n\nKind regards,\nHR Team` },
                  { label: 'Document Needed', subject: 'Document Required',             body: `Hi ${emailTarget?.first_name},\n\nWe require the following document from you for our records.\n\nPlease submit it at your earliest convenience.\n\nKind regards,\nHR Team` },
                  { label: 'Reminder',        subject: 'Important Reminder',           body: `Hi ${emailTarget?.first_name},\n\nThis is a friendly reminder regarding your upcoming obligations.\n\nPlease contact HR if you have any questions.\n\nKind regards,\nHR Team` },
                  { label: 'Congratulations', subject: 'Congratulations! 🎉',          body: `Hi ${emailTarget?.first_name},\n\nWe wanted to take a moment to congratulate you on your outstanding work. Your dedication and effort are truly appreciated by the whole team.\n\nKeep up the great work!\n\nKind regards,\nHR Team` },
                ].map(t => (
                    <button key={t.label}
                            onClick={() => { setEmailSubject(t.subject); setEmailBody(t.body); }}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', color: '#94a3b8', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#2a3a52'}
                    >
                      {t.label}
                    </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <Input
                label="Subject *"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="e.g. Important HR Update"
            />

            {/* Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>
                Message *
              </label>
              <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder={`Hi ${emailTarget?.first_name ?? 'Employee'},\n\nType your message here…`}
                  rows={7}
                  style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'}
                  onBlur={e  => (e.currentTarget as HTMLElement).style.borderColor = '#2a3a52'}
              />
              <div style={{ fontSize: 11, color: '#475569', textAlign: 'right' }}>
                {emailBody.length} characters
              </div>
            </div>

            {/* Warning if no email */}
            {emailTarget && !emailTarget.email && (
                <div style={{ padding: '10px 14px', backgroundColor: '#7f1d1d22', border: '1px solid #991b1b', borderRadius: 8, fontSize: 12, color: '#fca5a5' }}>
                  ⚠ This employee doesn't have an email address. Please edit their profile first.
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #2a3a52' }}>
              <Button variant="ghost" onClick={() => setEmailModal(false)}>Cancel</Button>
              <Button
                  variant="primary"
                  onClick={submitEmail}
                  loading={sendingEmail}
                  disabled={!emailTarget?.email}
              >
                <Mail size={13} /> Send Email
              </Button>
            </div>
          </div>
        </Modal>

        {/* Deactivate confirm */}
        <ConfirmDialog
            open={!!confirmId}
            title="Deactivate Employee"
            message="This will mark the employee as inactive. Their data will be preserved. Continue?"
            onConfirm={deactivate}
            onCancel={() => setConfirmId(null)}
            loading={deleting}
        />
      </div>
  );
}

export default function EmployeesPage() {
  return (
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner size={32} /></div>}>
        <EmployeesContent />
      </Suspense>
  );
}
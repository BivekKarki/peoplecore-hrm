'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Input, Select, Badge, Spinner, EmptyState, showToast } from '@/components/ui';
import { Shield, Plus, Pencil, UserX, UserCheck } from 'lucide-react';
import { ROLE_INFO, type Role } from '@/lib/rbac';
import { formatDateTime } from '@/lib/utils';

interface AdminUser {
  id: string; name: string; email: string; role: string;
  is_active: boolean; last_login: string | null; created_at: string;
}

const ROLES: Role[] = ['super_admin', 'hr_manager', 'hr_staff'];

export default function UsersPage() {
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState<AdminUser | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    name: '', email: '', password: '', role: 'hr_staff' as Role, is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/users');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setUsers(j.data ?? []);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to load users', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name:'', email:'', password:'', role:'hr_staff', is_active:true });
    setModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditing(u);
    setForm({ name:u.name, email:u.email, password:'', role:u.role as Role, is_active:u.is_active });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim())       { showToast('Name required','error'); return; }
    if (!editing && !form.email.includes('@')) { showToast('Valid email required','error'); return; }
    if (!editing && form.password.length < 8) { showToast('Password min 8 chars','error'); return; }
    setSaving(true);
    try {
      const url    = editing ? '/api/admin/users' : '/api/admin/users';
      const method = editing ? 'PATCH' : 'POST';
      const body   = editing
        ? { id: editing.id, name: form.name, role: form.role, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) }
        : { name: form.name, email: form.email, password: form.password, role: form.role };

      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast(editing ? 'User updated' : 'User created', 'success');
      setModal(false);
      load();
    } catch (e:unknown) {
      showToast(e instanceof Error ? e.message : 'Failed','error');
    } finally { setSaving(false); }
  };

  const toggle = async (u: AdminUser) => {
    try {
      const r = await fetch('/api/admin/users', {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id: u.id, is_active: !u.is_active }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast(`User ${u.is_active ? 'deactivated' : 'activated'}`, 'success');
      load();
    } catch (e:unknown) { showToast(e instanceof Error ? e.message : 'Failed','error'); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Admin Users & Permissions" action={
        <Button variant="primary" onClick={openAdd}><Plus size={14}/> Add User</Button>
      }/>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* Role legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {ROLES.map(role => {
            const info = ROLE_INFO[role];
            return (
              <div key={role} className={`p-3 rounded-xl border ${info.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={14}/>
                  <span className="text-sm font-semibold">{info.label}</span>
                </div>
                <p className="text-xs opacity-70">{info.description}</p>
              </div>
            );
          })}
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={28}/></div>
          ) : users.length === 0 ? (
            <EmptyState message="No admin users" icon="👤"/>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Name','Email','Role','Status','Last Login','Created','Actions'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const info = ROLE_INFO[u.role as Role] ?? ROLE_INFO.hr_staff;
                    return (
                      <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-400 flex-shrink-0">
                              {u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-200">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={u.is_active ? 'active' : 'inactive'} label={u.is_active ? 'Active' : 'Inactive'}/>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                          {u.last_login ? formatDateTime(u.last_login) : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"><Pencil size={13}/></button>
                            <button onClick={() => toggle(u)} className={`p-1.5 rounded-lg transition-colors ${u.is_active ? 'text-slate-400 hover:text-red-400 hover:bg-red-900/30' : 'text-slate-400 hover:text-green-400 hover:bg-green-900/30'}`}>
                              {u.is_active ? <UserX size={13}/> : <UserCheck size={13}/>}
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit User' : 'Add Admin User'} maxWidth="max-w-md">
        <div className="space-y-3">
          <Input label="Full Name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Jane Smith"/>
          {!editing && <Input label="Email" type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder="jane@company.com"/>}
          <Input label={editing ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} placeholder="Min 8 characters"/>
          <Select label="Role" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value as Role}))}>
            {ROLES.map(r=><option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
          </Select>
          {editing && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e=>setForm(p=>({...p,is_active:e.target.checked}))} className="accent-blue-500 w-4 h-4"/>
              <span className="text-sm text-slate-300">Account active</span>
            </label>
          )}
          <div className={`p-3 rounded-xl border text-xs ${ROLE_INFO[form.role]?.color ?? ''}`}>
            <strong>{ROLE_INFO[form.role]?.label}:</strong> {ROLE_INFO[form.role]?.description}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {editing ? 'Update User' : 'Create User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

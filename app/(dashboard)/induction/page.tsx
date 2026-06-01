'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Badge, Spinner, EmptyState, StatCard, Modal, Select, showToast } from '@/components/ui';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  UserPlus, Users, Clock, Trophy, Mail, RefreshCw,
} from 'lucide-react';

interface Induction {
  id: string; employee_id: string; status: string; step: number;
  personal_details_done: boolean; documents_done: boolean;
  training_done: boolean; it_setup_done: boolean;
  welcome_pack_sent: boolean; contract_signed: boolean;
  payroll_setup_done: boolean; team_intro_done: boolean;
  notes: string | null; completed_at: string | null;
  updated_at: string;
  first_name: string; last_name: string; department: string;
  job_title: string; email: string; avatar_color: string; employee_code: string;
  [key: string]: unknown;
}

interface Employee {
  id: string; first_name: string; last_name: string;
  department: string; job_title: string; email: string; avatar_color: string;
}

const WIZARD_STEPS = [
  { label: 'Welcome',   icon: '👋' },
  { label: 'Documents', icon: '📄' },
  { label: 'Training',  icon: '📚' },
  { label: 'IT Setup',  icon: '💻' },
  { label: 'Complete',  icon: '🎉' },
];

const CHECKLIST_ITEMS = [
  { key: 'welcome_pack_sent',    label: 'Welcome pack sent to employee',         step: 1 },
  { key: 'personal_details_done',label: 'Personal details collected & verified', step: 1 },
  { key: 'contract_signed',      label: 'Employment contract signed',            step: 2 },
  { key: 'documents_done',       label: 'All required documents uploaded',       step: 2 },
  { key: 'payroll_setup_done',   label: 'Payroll & banking details configured',  step: 2 },
  { key: 'training_done',        label: 'Mandatory training completed',          step: 3 },
  { key: 'it_setup_done',        label: 'IT equipment & system access granted',  step: 4 },
  { key: 'team_intro_done',      label: 'Introduced to team & showed around',    step: 4 },
];

const TRAINING_MODULES = [
  { title: 'WHS & Workplace Safety',         duration: '30 min', required: true  },
  { title: 'Code of Conduct',               duration: '20 min', required: true  },
  { title: 'IT Security & Password Policy', duration: '15 min', required: true  },
  { title: 'Anti-Discrimination & EEO',     duration: '25 min', required: true  },
  { title: 'Privacy & Data Protection',     duration: '20 min', required: true  },
  { title: 'Emergency Evacuation',          duration: '10 min', required: true  },
  { title: 'Customer Service Standards',    duration: '30 min', required: false },
];

const DOCUMENTS_REQUIRED = [
  { name: 'Passport or National ID',     required: true },
  { name: 'Right to Work Evidence',      required: true },
  { name: 'Signed Employment Contract',  required: true },
  { name: 'Tax File Number Declaration', required: true },
  { name: 'Bank Account Details',        required: true },
  { name: 'Superannuation Choice Form',  required: true },
  { name: 'Emergency Contact Form',      required: true },
];

const IT_SETUP_ITEMS = [
  'Laptop / Desktop assigned and configured',
  'Company email account created',
  'Slack / Teams access granted',
  'HR system login created',
  'VPN and security tools installed',
  'Building access card / badge issued',
  'Relevant software licences allocated',
];

function progressPercent(ind: Induction): number {
  const fields = [
    'welcome_pack_sent', 'personal_details_done', 'contract_signed',
    'documents_done', 'payroll_setup_done', 'training_done',
    'it_setup_done', 'team_intro_done',
  ];
  const done = fields.filter(f => ind[f] === true).length;
  return Math.round((done / fields.length) * 100);
}

function initials(ind: Induction): string {
  return `${ind.first_name?.[0] ?? ''}${ind.last_name?.[0] ?? ''}`.toUpperCase();
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
      <div
          onClick={onChange}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            backgroundColor: checked ? '#14532d22' : '#1e2d42',
            border: `1px solid ${checked ? '#166534' : '#2a3a52'}`,
            borderRadius: 10, cursor: 'pointer', transition: 'all .2s',
          }}
      >
        {checked
            ? <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
            : <Circle      size={16} style={{ color: '#475569', flexShrink: 0 }} />
        }
        <span style={{ fontSize: 13, color: checked ? '#86efac' : '#e2e8f0', textDecoration: checked ? 'line-through' : 'none' }}>
        {label}
      </span>
      </div>
  );
}

export default function InductionPage() {
  const [inductions, setInductions]     = useState<Induction[]>([]);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Induction | null>(null);
  const [wizardStep, setWizardStep]     = useState(1);
  const [saving, setSaving]             = useState(false);
  const [addModal, setAddModal]         = useState(false);
  const [newEmpId, setNewEmpId]         = useState('');
  const [creating, setCreating]         = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [checks, setChecks]             = useState<Record<string, boolean>>({});
  const [modules, setModules]           = useState<Record<string, boolean>>({});
  const [itItems, setItItems]           = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [indRes, empRes] = await Promise.all([
        fetch('/api/induction').then(r => r.json()).catch(e => { console.error('Inductions fetch failed:', e); return { data: [] }; }),
        fetch('/api/employees?limit=200').then(r => r.json()).catch(e => { console.error('Employees fetch failed:', e); return { data: [] }; }),
      ]);
      setInductions(indRes.data ?? []);
      setEmployees(empRes.data ?? []);
    } catch (err) {
      console.error('Load error:', err);
      showToast('Failed to load inductions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const syncSelected = (ind: Induction) => {
    setSelected(ind);
    setWizardStep(ind.step ?? 1);
    setChecks({
      welcome_pack_sent:     ind.welcome_pack_sent,
      personal_details_done: ind.personal_details_done,
      contract_signed:       ind.contract_signed,
      documents_done:        ind.documents_done,
      payroll_setup_done:    ind.payroll_setup_done,
      training_done:         ind.training_done,
      it_setup_done:         ind.it_setup_done,
      team_intro_done:       ind.team_intro_done,
    });
    setModules({});
    setItItems({});
  };

  const saveProgress = async (overrides: Record<string, unknown> = {}) => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch('/api/induction', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:                    selected.id,
          step:                  wizardStep,
          welcome_pack_sent:     checks.welcome_pack_sent     ?? false,
          personal_details_done: checks.personal_details_done ?? false,
          contract_signed:       checks.contract_signed       ?? false,
          documents_done:        checks.documents_done        ?? false,
          payroll_setup_done:    checks.payroll_setup_done    ?? false,
          training_done:         checks.training_done         ?? false,
          it_setup_done:         checks.it_setup_done         ?? false,
          team_intro_done:       checks.team_intro_done       ?? false,
          ...overrides,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setInductions(prev => prev.map(i => i.id === j.data.id ? { ...i, ...j.data } : i));
      setSelected(prev => prev ? { ...prev, ...j.data } : prev);
      showToast('Progress saved', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    const next = Math.min(5, wizardStep + 1);
    await saveProgress({ step: next });
    setWizardStep(next);
  };

  const createInduction = async () => {
    if (!newEmpId) { showToast('Select an employee', 'error'); return; }
    setCreating(true);
    try {
      const r = await fetch('/api/induction', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: newEmpId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Induction started', 'success');
      setAddModal(false);
      setNewEmpId('');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const sendCompletionEmail = async () => {
    if (!selected) return;
    setSendingEmail(true);
    try {
      const r = await fetch('/api/email/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:      selected.email,
          name:    `${selected.first_name} ${selected.last_name}`,
          subject: 'Welcome to the Team — Induction Complete! 🎉',
          message: `Congratulations ${selected.first_name}!\n\nYou have successfully completed your employee induction.\n\nHere's a summary of what you've completed:\n✓ Personal details verified\n✓ All documents submitted\n✓ Mandatory training completed\n✓ IT equipment and access granted\n✓ Team introduction completed\n\nWe're excited to have you on board!\n\nKind regards,\nHR Team`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast(`Welcome email sent to ${selected.first_name}!`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Email failed', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const stats = {
    total:       inductions.length,
    not_started: inductions.filter(i => i.status === 'not_started').length,
    in_progress: inductions.filter(i => i.status === 'in_progress').length,
    completed:   inductions.filter(i => i.status === 'completed').length,
  };

  const inductedIds = new Set(inductions.map(i => i.employee_id));
  const uninducted  = employees.filter(e => !inductedIds.has(e.id));

  const renderWizardStep = () => {
    if (!selected) return null;
    switch (wizardStep) {

      case 1: return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Send the welcome pack and collect personal details.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', backgroundColor: '#1e3a8a22', border: '1px solid #1e40af', borderRadius: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: `${selected.avatar_color}33`, color: selected.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                {initials(selected)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{selected.first_name} {selected.last_name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{selected.job_title} · {selected.department}</div>
                <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 2 }}>{selected.email}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{selected.employee_code}</div>
            </div>
            {CHECKLIST_ITEMS.filter(c => c.step === 1).map(item => (
                <CheckItem key={item.key} label={item.label} checked={checks[item.key] ?? false} onChange={() => setChecks(p => ({ ...p, [item.key]: !p[item.key] }))} />
            ))}
            <div style={{ padding: '12px 14px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10, fontSize: 12, color: '#64748b' }}>
              💡 Send the welcome pack email first, then collect personal details from the employee.
            </div>
          </div>
      );

      case 2: return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Collect, verify and upload all required employment documents.</p>
            {DOCUMENTS_REQUIRED.map(doc => (
                <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📄</span>
                    <div>
                      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{doc.name}</div>
                      {doc.required && <div style={{ fontSize: 10, color: '#f87171', fontFamily: 'monospace' }}>Required</div>}
                    </div>
                  </div>
                  <button onClick={() => showToast('Go to Documents page to upload files', 'info')}
                          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, backgroundColor: '#1e3a8a33', border: '1px solid #1e40af', color: '#60a5fa', cursor: 'pointer' }}>
                    Upload →
                  </button>
                </div>
            ))}
            {CHECKLIST_ITEMS.filter(c => c.step === 2).map(item => (
                <CheckItem key={item.key} label={item.label} checked={checks[item.key] ?? false} onChange={() => setChecks(p => ({ ...p, [item.key]: !p[item.key] }))} />
            ))}
          </div>
      );

      case 3: return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Employee must complete all mandatory training modules before starting.</p>
            {TRAINING_MODULES.map(m => {
              const done = modules[m.title] ?? false;
              return (
                  <div key={m.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: done ? '#14532d22' : '#1e2d42', border: `1px solid ${done ? '#166534' : '#2a3a52'}`, borderRadius: 10, transition: 'all .2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setModules(p => ({ ...p, [m.title]: !p[m.title] }))} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        {done ? <CheckCircle2 size={18} style={{ color: '#4ade80' }} /> : <Circle size={18} style={{ color: '#475569' }} />}
                      </button>
                      <div>
                        <div style={{ fontSize: 13, color: done ? '#86efac' : '#e2e8f0', textDecoration: done ? 'line-through' : 'none' }}>{m.title}</div>
                        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{m.duration} {m.required ? '· Required' : '· Optional'}</div>
                      </div>
                    </div>
                    <button onClick={() => setModules(p => ({ ...p, [m.title]: !p[m.title] }))}
                            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: 'none', backgroundColor: done ? '#166534' : '#2563eb', color: '#fff' }}>
                      {done ? '✓ Done' : 'Mark Done'}
                    </button>
                  </div>
              );
            })}
            <button
                onClick={() => {
                  const all: Record<string, boolean> = {};
                  TRAINING_MODULES.forEach(m => { all[m.title] = true; });
                  setModules(all);
                  setChecks(p => ({ ...p, training_done: true }));
                }}
                style={{ padding: '10px', borderRadius: 10, backgroundColor: '#14532d22', border: '1px solid #166534', color: '#86efac', fontSize: 13, cursor: 'pointer' }}
            >
              ✓ Mark All Training Complete
            </button>
            <CheckItem label="All mandatory training completed" checked={checks.training_done ?? false} onChange={() => setChecks(p => ({ ...p, training_done: !p.training_done }))} />
          </div>
      );

      case 4: return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Set up IT equipment, system access, and introduce to the team.</p>
            {IT_SETUP_ITEMS.map(item => {
              const done = itItems[item] ?? false;
              return (
                  <div key={item} onClick={() => setItItems(p => ({ ...p, [item]: !p[item] }))}
                       style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: done ? '#14532d22' : '#1e2d42', border: `1px solid ${done ? '#166534' : '#2a3a52'}`, borderRadius: 10, cursor: 'pointer', transition: 'all .2s' }}>
                    {done ? <CheckCircle2 size={16} style={{ color: '#4ade80', flexShrink: 0 }} /> : <Circle size={16} style={{ color: '#475569', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, color: done ? '#86efac' : '#e2e8f0', textDecoration: done ? 'line-through' : 'none' }}>{item}</span>
                  </div>
              );
            })}
            {CHECKLIST_ITEMS.filter(c => c.step === 4).map(item => (
                <CheckItem key={item.key} label={item.label} checked={checks[item.key] ?? false} onChange={() => setChecks(p => ({ ...p, [item.key]: !p[item.key] }))} />
            ))}
          </div>
      );

      case 5: {
        const pct = progressPercent({ ...selected, ...checks } as Induction);
        const allDone = pct === 100;
        return (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>{allDone ? '🎉' : '⚠️'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: allDone ? '#4ade80' : '#fcd34d', marginBottom: 8 }}>
                {allDone ? 'Induction Complete!' : 'Almost There!'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                {allDone ? `${selected.first_name} is fully onboarded and ready to start.` : `${pct}% complete — finish remaining items.`}
              </div>
              <div style={{ height: 8, backgroundColor: '#1e2d42', borderRadius: 4, marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ height: 8, backgroundColor: allDone ? '#16a34a' : '#d97706', width: `${pct}%`, borderRadius: 4, transition: 'width .5s' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, textAlign: 'left' }}>
                {CHECKLIST_ITEMS.map(item => {
                  const done = checks[item.key] ?? false;
                  return (
                      <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: done ? '#86efac' : '#f87171' }}>
                        {done ? '✓' : '✗'} {item.label}
                      </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {allDone ? (
                    <>
                      <Button variant="success" onClick={() => saveProgress({ status: 'completed' })} loading={saving}>
                        ✓ Finalise Induction
                      </Button>
                      <Button variant="ghost" onClick={sendCompletionEmail} loading={sendingEmail}>
                        <Mail size={13} /> Send Welcome Email
                      </Button>
                    </>
                ) : (
                    <Button variant="ghost" onClick={() => setWizardStep(1)}>← Go Back & Complete</Button>
                )}
              </div>
            </div>
        );
      }

      default: return null;
    }
  };

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Employee Induction" action={
          <Button variant="primary" onClick={() => setAddModal(true)}>
            <UserPlus size={14} /> Start Induction
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total"       value={stats.total}       color="#2563eb" icon={<Users  size={16}/>} />
            <StatCard label="Not Started" value={stats.not_started} color="#64748b" icon={<Circle size={16}/>} />
            <StatCard label="In Progress" value={stats.in_progress} color="#d97706" icon={<Clock  size={16}/>} />
            <StatCard label="Completed"   value={stats.completed}   color="#16a34a" icon={<Trophy size={16}/>} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>

            {/* Left list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Active Inductions
                  <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}><RefreshCw size={12} /></button>
                </div>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}><Spinner /></div>
                ) : inductions.length === 0 ? (
                    <EmptyState message="No inductions yet" icon="📋" />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {inductions.map(ind => {
                        const pct      = progressPercent(ind);
                        const isActive = selected?.id === ind.id;
                        return (
                            <div key={ind.id} onClick={() => syncSelected(ind)}
                                 style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', backgroundColor: isActive ? '#1e3a8a22' : '#1e2d42', border: `1px solid ${isActive ? '#2563eb' : '#2a3a52'}`, transition: 'all .2s' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${ind.avatar_color}33`, color: ind.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                  {initials(ind)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.first_name} {ind.last_name}</div>
                                  <div style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ind.department}</div>
                                </div>
                                <Badge status={ind.status} />
                              </div>
                              <div style={{ height: 4, backgroundColor: '#2a3a52', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: 4, backgroundColor: ind.status === 'completed' ? '#16a34a' : '#2563eb', width: `${pct}%`, borderRadius: 2, transition: 'width .5s' }} />
                              </div>
                              <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 4 }}>{pct}% complete · Step {ind.step}/5</div>
                            </div>
                        );
                      })}
                    </div>
                )}
              </Card>

              {uninducted.length > 0 && (
                  <Card style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', marginBottom: 10 }}>
                      ⚠ Need Induction ({uninducted.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {uninducted.slice(0, 5).map(emp => (
                          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#7f1d1d22', border: '1px solid #7f1d1d', borderRadius: 8 }}>
                            <div style={{ fontSize: 12, color: '#fca5a5' }}>{emp.first_name} {emp.last_name}</div>
                            <button onClick={() => { setNewEmpId(emp.id); setAddModal(true); }}
                                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, backgroundColor: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
                              Start
                            </button>
                          </div>
                      ))}
                      {uninducted.length > 5 && <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>+{uninducted.length - 5} more</div>}
                    </div>
                  </Card>
              )}
            </div>

            {/* Right wizard */}
            {selected ? (
                <Card style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{selected.first_name} {selected.last_name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selected.job_title} · {selected.department}</div>
                    </div>
                    <Badge status={selected.status} />
                  </div>

                  {/* Step indicators */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                    {WIZARD_STEPS.map((s, i) => {
                      const n = i + 1; const done = n < wizardStep; const active = n === wizardStep;
                      return (
                          <div key={s.label} style={{ display: 'flex', alignItems: 'center', flex: i < WIZARD_STEPS.length - 1 ? 1 : 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div onClick={() => setWizardStep(n)}
                                   style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: done ? 14 : 16, fontWeight: 700, backgroundColor: done ? '#16a34a' : active ? '#2563eb' : '#1e2d42', border: `2px solid ${done ? '#16a34a' : active ? '#2563eb' : '#2a3a52'}`, color: '#fff', transition: 'all .3s', cursor: 'pointer' }}>
                                {done ? '✓' : s.icon}
                              </div>
                              <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: active ? '#93c5fd' : done ? '#4ade80' : '#475569', whiteSpace: 'nowrap' }}>{s.label}</span>
                            </div>
                            {i < WIZARD_STEPS.length - 1 && <div style={{ flex: 1, height: 2, marginBottom: 20, backgroundColor: done ? '#16a34a' : '#2a3a52', transition: 'background .3s' }} />}
                          </div>
                      );
                    })}
                  </div>

                  <div style={{ flex: 1, minHeight: 300 }}>{renderWizardStep()}</div>

                  {wizardStep < 5 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #2a3a52' }}>
                        <Button variant="ghost" onClick={() => setWizardStep(p => Math.max(1, p - 1))} disabled={wizardStep === 1}>
                          <ChevronLeft size={14} /> Back
                        </Button>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="ghost" onClick={() => saveProgress()} loading={saving}>Save Progress</Button>
                          <Button variant="primary" onClick={nextStep} loading={saving}>
                            {wizardStep === 4 ? 'Review & Complete' : 'Continue'} <ChevronRight size={14} />
                          </Button>
                        </div>
                      </div>
                  )}
                </Card>
            ) : (
                <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Select an Induction</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>Click an employee on the left to open their induction wizard.</div>
                  <Button variant="primary" onClick={() => setAddModal(true)}><UserPlus size={14} /> Start New Induction</Button>
                </Card>
            )}
          </div>
        </div>

        {/* Add modal */}
        <Modal open={addModal} onClose={() => { setAddModal(false); setNewEmpId(''); }} title="Start New Induction" maxWidth="max-w-md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Select Employee" value={newEmpId} onChange={e => setNewEmpId(e.target.value)}>
              <option value="">Choose employee…</option>
              {employees.map(emp => {
                const hasInduction = inductedIds.has(emp.id);
                return (
                    <option key={emp.id} value={emp.id} disabled={hasInduction}>
                      {emp.first_name} {emp.last_name} — {emp.department}
                      {hasInduction ? ' (already inducted)' : ''}
                    </option>
                );
              })}
            </Select>

            {employees.length === 0 && (
                <div style={{ padding: '12px 14px', backgroundColor: '#7f1d1d22', border: '1px solid #991b1b', borderRadius: 10, fontSize: 13, color: '#fca5a5' }}>
                  No employees found. Add employees first.
                </div>
            )}

            {employees.length > 0 && employees.every(e => inductedIds.has(e.id)) && (
                <div style={{ padding: '12px 14px', backgroundColor: '#14532d22', border: '1px solid #166534', borderRadius: 10, fontSize: 13, color: '#86efac' }}>
                  ✓ All employees already have an induction record.
                </div>
            )}

            <div style={{ padding: '12px 14px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              Creates a 5-step induction wizard: welcome, documents, training, IT setup, and completion.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => { setAddModal(false); setNewEmpId(''); }}>Cancel</Button>
            <Button variant="primary" onClick={createInduction} loading={creating} disabled={!newEmpId}>
              <UserPlus size={13} /> Start Induction
            </Button>
          </div>
        </Modal>
      </div>
  );
}
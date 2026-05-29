'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Input, Select, Textarea, showToast } from '@/components/ui';
import { UserPlus, CheckCircle, Camera } from 'lucide-react';
import dynamic from 'next/dynamic';

const FaceEnrollment = dynamic(() => import('@/components/FaceEnrollment'), { ssr: false });

const DEPTS = ['Engineering','Sales','Marketing','Operations','Finance','HR','Legal','Product'];
const TYPES = ['full-time','part-time','contract','casual'];

type FormData = {
  first_name:string; last_name:string; email:string; phone:string;
  department:string; job_title:string; employment_type:string;
  start_date:string; salary:string; manager_id:string;
  address:string; emergency_contact:string;
  tax_file_number:string; bank_bsb:string; bank_account:string;
  super_fund:string; super_member_no:string; notes:string;
};

const EMPTY: FormData = {
  first_name:'',last_name:'',email:'',phone:'',department:'',
  job_title:'',employment_type:'full-time',start_date:'',salary:'',
  manager_id:'',address:'',emergency_contact:'',tax_file_number:'',
  bank_bsb:'',bank_account:'',super_fund:'',super_member_no:'',notes:'',
};

type Step = 'form' | 'face' | 'done';

function StepBar({ current }: { current: Step }) {
  const steps = [
    { key:'form', n:1, label:'Employee Details' },
    { key:'face', n:2, label:'Face Enrollment' },
    { key:'done', n:3, label:'Complete' },
  ];
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div className="flex items-center gap-3 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            i < idx  ? 'bg-green-600 text-white' :
            i === idx ? 'bg-blue-600 text-white' :
            'bg-[#2a3a52] text-slate-500'
          }`}>{i < idx ? '✓' : s.n}</div>
          <span className={`text-sm ${i === idx ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>{s.label}</span>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px ${i < idx ? 'bg-green-600' : 'bg-[#2a3a52]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function RegistrationPage() {
  const router = useRouter();
  const [step, setStep]     = useState<Step>('form');
  const [form, setForm]     = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState<{ id:string; name:string } | null>(null);

  const set = (k: keyof FormData, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.first_name.trim())   e.first_name = 'Required';
    if (!form.last_name.trim())    e.last_name  = 'Required';
    if (!form.email.includes('@')) e.email      = 'Valid email required';
    if (!form.department)          e.department = 'Required';
    if (!form.job_title.trim())    e.job_title  = 'Required';
    if (!form.start_date)          e.start_date = 'Required';
    if (form.salary && isNaN(Number(form.salary))) e.salary = 'Must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) { showToast('Please fix the errors below', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, salary: Number(form.salary) || 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSaved({ id: j.data.id, name: `${form.first_name} ${form.last_name}` });
      showToast('Employee saved! Now enroll their face.', 'success');
      setStep('face');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Registration failed', 'error');
    } finally { setSaving(false); }
  };

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Registration Complete" />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="p-10 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-green-900/30 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="text-green-400" size={36} />
          </div>
          <h2 className="text-lg font-semibold text-slate-100 mb-2">{saved?.name} is ready!</h2>
          <p className="text-sm text-slate-400 mb-1">Employee registered and face enrolled successfully.</p>
          <p className="text-xs text-slate-500 mb-7">They can now clock in at the attendance kiosk using facial recognition.</p>
          <div className="flex flex-col gap-2.5">
            <Button variant="primary" className="w-full" onClick={() => window.open('/kiosk','_blank')}>
              <Camera size={14} /> Open Kiosk (New Tab)
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/employees')}>
              View All Employees
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setForm(EMPTY); setErrors({}); setSaved(null); setStep('form'); }}>
              Register Another Employee
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  // ── FACE ENROLLMENT ───────────────────────────────────────────────────────
  if (step === 'face' && saved) return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Face Enrollment" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-lg mx-auto">
          <StepBar current="face" />
          <Card className="p-5">
            <FaceEnrollment
              employeeId={saved.id}
              employeeName={saved.name}
              onComplete={() => setStep('done')}
              onSkip={() => setStep('done')}
            />
          </Card>
        </div>
      </div>
    </div>
  );

  // ── REGISTRATION FORM ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Employee Registration" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <StepBar current="form" />
          <Card className="p-6">
            <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-[#2a3a52]">
              <div className="w-9 h-9 rounded-lg bg-blue-900/40 flex items-center justify-center">
                <UserPlus size={18} className="text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">New Employee Registration</div>
                <div className="text-xs text-slate-500">Step 1 of 3 — Personal & Employment Details</div>
              </div>
            </div>

            {/* Personal */}
            <SectionHeader label="Personal Information" />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Input label="First Name *" value={form.first_name} onChange={e=>set('first_name',e.target.value)} error={errors.first_name} placeholder="John" />
              <Input label="Last Name *"  value={form.last_name}  onChange={e=>set('last_name',e.target.value)}  error={errors.last_name}  placeholder="Smith" />
              <Input label="Email Address *" type="email" value={form.email} onChange={e=>set('email',e.target.value)} error={errors.email} placeholder="john@company.com" className="col-span-2" />
              <Input label="Phone Number" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+61 4XX XXX XXX" />
              <div />
              <Textarea label="Home Address" value={form.address} onChange={e=>set('address',e.target.value)} placeholder="123 Main St, Darwin NT 0800" className="col-span-2" />
              <Input label="Emergency Contact" value={form.emergency_contact} onChange={e=>set('emergency_contact',e.target.value)} placeholder="Name — Relationship — Phone" className="col-span-2" />
            </div>

            {/* Employment */}
            <SectionHeader label="Employment Details" />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Select label="Department *" value={form.department} onChange={e=>set('department',e.target.value)} error={errors.department}>
                <option value="">Select department</option>
                {DEPTS.map(d=><option key={d}>{d}</option>)}
              </Select>
              <Input label="Job Title *" value={form.job_title} onChange={e=>set('job_title',e.target.value)} error={errors.job_title} placeholder="Software Engineer" />
              <Select label="Employment Type" value={form.employment_type} onChange={e=>set('employment_type',e.target.value)}>
                {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </Select>
              <Input label="Start Date *" type="date" value={form.start_date} onChange={e=>set('start_date',e.target.value)} error={errors.start_date} />
              <Input label="Annual Salary (AUD)" type="number" value={form.salary} onChange={e=>set('salary',e.target.value)} error={errors.salary} placeholder="80000" />
            </div>

            {/* Payroll */}
            <SectionHeader label="Payroll & Banking" />
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Input label="Tax File Number" value={form.tax_file_number} onChange={e=>set('tax_file_number',e.target.value)} placeholder="XXX XXX XXX" />
              <Input label="Bank BSB" value={form.bank_bsb} onChange={e=>set('bank_bsb',e.target.value)} placeholder="XXX-XXX" />
              <Input label="Bank Account Number" value={form.bank_account} onChange={e=>set('bank_account',e.target.value)} placeholder="XXXXXXXXXX" />
              <Input label="Super Fund" value={form.super_fund} onChange={e=>set('super_fund',e.target.value)} placeholder="Australian Super" />
              <Input label="Super Member No." value={form.super_member_no} onChange={e=>set('super_member_no',e.target.value)} placeholder="XXXXXXXX" />
            </div>

            {/* Notes */}
            <div className="mb-5">
              <Textarea label="Additional Notes" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any additional information…" />
            </div>

            {/* Face notice */}
            <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-xl mb-5">
              <Camera size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <span className="text-blue-400 font-medium">Face enrollment follows.</span>{' '}
                After saving, you will capture the employee&#39;s face from 3 angles (front, left, right) so they can use the kiosk to clock in automatically.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#2a3a52]">
              <Button variant="ghost" onClick={() => { setForm(EMPTY); setErrors({}); }}>Clear</Button>
              <Button variant="primary" onClick={submit} loading={saving} size="lg">
                <UserPlus size={14} /> Save & Continue →
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="flex-1 h-px bg-[#2a3a52]" />
      <span className="text-xs uppercase tracking-widest text-slate-500 font-mono">{label}</span>
      <div className="flex-1 h-px bg-[#2a3a52]" />
    </div>
  );
}

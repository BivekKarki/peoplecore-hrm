'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Badge, Button, Spinner, EmptyState, showToast } from '@/components/ui';
import { CheckCircle2, Circle, ChevronRight, ChevronLeft } from 'lucide-react';

interface InductionRecord {
  id: string; employee_id: string; status: string; step: number;
  personal_details_done: boolean; documents_done: boolean;
  training_done: boolean; it_setup_done: boolean;
  welcome_pack_sent: boolean; contract_signed: boolean;
  payroll_setup_done: boolean; team_intro_done: boolean;
  employee_name?: string; department?: string;
}

const STEPS = ['Personal Details','Documents','Training','IT Setup','Complete'];
const CHECKLIST = [
  { key:'welcome_pack_sent',   label:'Welcome pack sent' },
  { key:'personal_details_done', label:'Personal details verified' },
  { key:'documents_done',      label:'Documents uploaded & verified' },
  { key:'contract_signed',     label:'Employment contract signed' },
  { key:'payroll_setup_done',  label:'Payroll & banking setup' },
  { key:'training_done',       label:'Mandatory training completed' },
  { key:'it_setup_done',       label:'IT equipment & access granted' },
  { key:'team_intro_done',     label:'Team introduction done' },
];

const TRAINING_MODULES = [
  { title:'WHS & Safety Induction', duration:'30 min', required:true },
  { title:'Code of Conduct',        duration:'20 min', required:true },
  { title:'IT Security Policy',     duration:'15 min', required:true },
  { title:'Anti-Discrimination',    duration:'25 min', required:true },
  { title:'Privacy & Data Handling',duration:'20 min', required:false },
];

export default function InductionPage() {
  const [records, setRecords] = useState<InductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState(1);
  const [checks, setChecks]   = useState<Record<string,boolean>>({});
  const [modules, setModules] = useState<Record<string,boolean>>({});

  useEffect(() => {
    fetch('/api/employees?limit=200')
      .then(r => r.json())
      .then(async j => {
        // Simulate induction records from employees
        const emps = j.data ?? [];
        const mock: InductionRecord[] = emps.slice(0,5).map((e: {id:string;first_name:string;last_name:string;department:string}, i: number) => ({
          id: e.id,
          employee_id: e.id,
          status: i===0 ? 'completed' : i===1 ? 'in_progress' : 'not_started',
          step: i===1 ? 2 : 1,
          personal_details_done: i>=1,
          documents_done: false,
          training_done: false,
          it_setup_done: false,
          welcome_pack_sent: i>=1,
          contract_signed: i>=1,
          payroll_setup_done: false,
          team_intro_done: false,
          employee_name: `${e.first_name} ${e.last_name}`,
          department: e.department,
        }));
        setRecords(mock);
      })
      .catch(() => showToast('Failed to load inductions','error'))
      .finally(() => setLoading(false));
  }, []);

  const toggleCheck = (key: string) => setChecks(p => ({ ...p, [key]: !p[key] }));
  const toggleModule = (key: string) => setModules(p => ({ ...p, [key]: !p[key] }));

  const stepContent = () => {
    switch(step) {
      case 1: return (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Collect and verify employee personal information.</p>
          <div className="grid grid-cols-2 gap-3">
            {['Full Legal Name','Date of Birth','Nationality','Visa Status','Emergency Contact','Home Address'].map(f=>(
              <div key={f} className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-mono uppercase tracking-wider">{f}</label>
                <input className="bg-[#0f1724] border border-[#2a3a52] rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500" placeholder={`Enter ${f.toLowerCase()}`}/>
              </div>
            ))}
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Upload and verify required employment documents.</p>
          {['Passport / National ID','Signed Employment Contract','Bank & Superannuation Details','Tax File Number Declaration','Right to Work Evidence'].map(doc=>(
            <div key={doc} className="flex items-center justify-between p-3 bg-[#0f1724] border border-[#2a3a52] border-dashed rounded-xl cursor-pointer hover:border-blue-500 transition-colors" onClick={()=>showToast(`${doc} — upload simulated`,'info')}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📄</span>
                <span className="text-sm text-slate-300">{doc}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={e=>{e.stopPropagation();showToast('Upload simulated','info');}}>Upload</Button>
            </div>
          ))}
        </div>
      );
      case 3: return (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Complete mandatory training modules before starting.</p>
          {TRAINING_MODULES.map(m=>(
            <div key={m.title} className="flex items-center justify-between p-3 bg-[#0f1724] rounded-xl border border-[#2a3a52]">
              <div className="flex items-center gap-2.5">
                <button onClick={()=>toggleModule(m.title)} className="transition-colors">
                  {modules[m.title]
                    ? <CheckCircle2 size={18} className="text-green-400"/>
                    : <Circle size={18} className="text-slate-600"/>
                  }
                </button>
                <div>
                  <div className="text-sm text-slate-300">{m.title}</div>
                  <div className="text-xs text-slate-500">{m.duration}{m.required && ' · Required'}</div>
                </div>
              </div>
              <Button variant={modules[m.title] ? 'ghost' : 'primary'} size="sm" onClick={()=>{toggleModule(m.title); showToast(`${m.title} ${modules[m.title]?'marked incomplete':'completed'}`,modules[m.title]?'info':'success');}}>
                {modules[m.title] ? '✓ Done' : 'Start'}
              </Button>
            </div>
          ))}
        </div>
      );
      case 4: return (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Set up IT equipment and system access.</p>
          {['Laptop / Desktop assigned','Email account created','Slack / Teams access','HR system account','VPN & security tools','Badge / access card issued'].map(item=>(
            <div key={item} className="flex items-center gap-2.5 p-3 bg-[#0f1724] rounded-xl border border-[#2a3a52] cursor-pointer hover:border-blue-500/50 transition-colors" onClick={()=>toggleCheck('it_'+item)}>
              {checks['it_'+item]
                ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/>
                : <Circle size={16} className="text-slate-600 flex-shrink-0"/>
              }
              <span className={`text-sm ${checks['it_'+item]?'text-slate-500 line-through':'text-slate-300'}`}>{item}</span>
            </div>
          ))}
        </div>
      );
      case 5: return (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🎉</div>
          <div className="text-lg font-semibold text-slate-100 mb-2">Induction Complete!</div>
          <div className="text-sm text-slate-400 mb-6">The employee has been fully onboarded and is ready to start.</div>
          <Button variant="success" onClick={()=>showToast('Induction record saved & email sent to employee','success')}>Finalise & Notify Employee</Button>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Employee Induction"/>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Induction tracker */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">Active Inductions</div>
            {loading ? <div className="flex justify-center py-8"><Spinner size={20}/></div> :
             records.length===0 ? <EmptyState message="No inductions" icon="📋"/> : (
              <div className="space-y-3">
                {records.map(rec=>(
                  <div key={rec.id} className="p-3 bg-[#1e2d42] rounded-xl">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-200">{rec.employee_name}</span>
                      <Badge status={rec.status}/>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">{rec.department} · Step {rec.step} of 5</div>
                    <div className="h-1.5 bg-[#2a3a52] rounded-full">
                      <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{width:`${((rec.step-1)/4)*100}%`}}/>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 font-mono">{Math.round(((rec.step-1)/4)*100)}% complete</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Wizard */}
          <Card className="p-4 lg:col-span-2">
            <div className="text-xs font-semibold text-slate-300 mb-4">New Employee Induction Wizard</div>

            {/* Step indicators */}
            <div className="flex items-center mb-6">
              {STEPS.map((s,i)=>{
                const n = i+1;
                const done = n < step;
                const active = n === step;
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-mono transition-colors ${done?'bg-green-600 text-white':active?'bg-blue-600 text-white':'bg-[#2a3a52] text-slate-500'}`}>
                        {done ? '✓' : n}
                      </div>
                      <span className={`text-[9px] font-mono whitespace-nowrap hidden md:block ${active?'text-slate-200':done?'text-green-400':'text-slate-600'}`}>{s}</span>
                    </div>
                    {i < STEPS.length-1 && <div className={`flex-1 h-px mx-2 transition-colors ${done?'bg-green-600':'bg-[#2a3a52]'}`}/>}
                  </div>
                );
              })}
            </div>

            <div className="min-h-[280px]">{stepContent()}</div>

            <div className="flex justify-between mt-6 pt-4 border-t border-[#2a3a52]">
              <Button variant="ghost" onClick={()=>setStep(p=>Math.max(1,p-1))} disabled={step===1}><ChevronLeft size={14}/> Back</Button>
              {step < 5
                ? <Button variant="primary" onClick={()=>setStep(p=>Math.min(5,p+1))}>Continue <ChevronRight size={14}/></Button>
                : <Button variant="success" onClick={()=>{setStep(1); showToast('Induction completed!','success');}}>Start New</Button>
              }
            </div>
          </Card>
        </div>

        {/* Master checklist */}
        <Card className="p-4 mt-4">
          <div className="text-xs font-semibold text-slate-300 mb-3">Onboarding Checklist</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CHECKLIST.map(item=>(
              <div key={item.key} className="flex items-center gap-2.5 p-2.5 bg-[#1e2d42] rounded-lg cursor-pointer hover:bg-[#243548] transition-colors" onClick={()=>toggleCheck(item.key)}>
                <button className="transition-colors flex-shrink-0">
                  {checks[item.key]
                    ? <CheckCircle2 size={16} className="text-green-400"/>
                    : <Circle size={16} className="text-slate-600"/>
                  }
                </button>
                <span className={`text-sm ${checks[item.key]?'text-slate-500 line-through':'text-slate-300'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

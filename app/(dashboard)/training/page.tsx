'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Input, Select, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { GraduationCap, CheckCircle, Circle, AlertTriangle, Plus, Star } from 'lucide-react';

interface Module {
  id: string; title: string; description: string | null;
  duration_mins: number; is_mandatory: boolean; category: string;
  completions_count: number; avg_score: number | null;
}

interface ComplianceSummary {
  employee_name: string; department: string;
  modules_completed: number; total_modules: number;
  mandatory_total: number; mandatory_completed: number;
  completion_rate: number;
}

const CATEGORIES = ['compliance','safety','professional','leadership','technical','other'];

export default function TrainingPage() {
  const [tab, setTab]             = useState<'modules'|'compliance'>('modules');
  const [modules, setModules]     = useState<Module[]>([]);
  const [compliance, setCompliance] = useState<ComplianceSummary[]>([]);
  const [employees, setEmps]      = useState<{id:string;first_name:string;last_name:string}[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [completeModal, setCompleteModal] = useState<Module | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({
    title:'', description:'', duration_mins:'30',
    is_mandatory: false, category:'compliance',
  });
  const [completeForm, setCompleteForm] = useState({ employee_id:'', score:'' });

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/training?type=modules');
      const j = await r.json();
      setModules(j.data ?? []);
    } catch { showToast('Failed to load modules','error'); }
    finally { setLoading(false); }
  }, []);

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/training?type=summary');
      const j = await r.json();
      setCompliance(j.data ?? []);
    } catch { showToast('Failed to load compliance','error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'modules')    loadModules();
    if (tab === 'compliance') loadCompliance();
  }, [tab, loadModules, loadCompliance]);

  useEffect(() => {
    fetch('/api/employees?limit=200&status=active')
      .then(r=>r.json()).then(j=>setEmps(j.data??[]));
  }, []);

  const createModule = async () => {
    if (!form.title.trim()) { showToast('Title required','error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/training', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create_module', ...form, duration_mins: parseInt(form.duration_mins)||30 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Module created','success');
      setModal(false);
      setForm({ title:'', description:'', duration_mins:'30', is_mandatory:false, category:'compliance' });
      loadModules();
    } catch (e:unknown) { showToast(e instanceof Error ? e.message : 'Failed','error'); }
    finally { setSaving(false); }
  };

  const recordCompletion = async () => {
    if (!completeForm.employee_id || !completeModal) { showToast('Select employee','error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/training', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'complete',
          employee_id: completeForm.employee_id,
          module_id: completeModal.id,
          score: completeForm.score ? parseInt(completeForm.score) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Completion recorded','success');
      setCompleteModal(null);
      setCompleteForm({ employee_id:'', score:'' });
      loadModules();
    } catch (e:unknown) { showToast(e instanceof Error ? e.message : 'Failed','error'); }
    finally { setSaving(false); }
  };

  const mandatory   = modules.filter(m => m.is_mandatory).length;
  const totalComps  = modules.reduce((s,m) => s + m.completions_count, 0);
  const avgComplete = compliance.length
    ? Math.round(compliance.reduce((s,c) => s + c.completion_rate, 0) / compliance.length)
    : 0;
  const nonCompliant = compliance.filter(c => c.mandatory_completed < c.mandatory_total).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Training & LMS" action={
        <Button variant="primary" onClick={() => setModal(true)}>
          <Plus size={14}/> Add Module
        </Button>
      }/>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Modules"     value={modules.length}   color="#2563eb" icon={<GraduationCap size={16}/>}/>
          <StatCard label="Mandatory"         value={mandatory}        color="#dc2626" icon={<AlertTriangle size={16}/>}/>
          <StatCard label="Avg Completion"    value={`${avgComplete}%`} color="#16a34a" delta="across all employees"/>
          <StatCard label="Non-Compliant"     value={nonCompliant}     color="#d97706" delta="missing mandatory"/>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[['modules','Training Modules'],['compliance','Compliance Overview']].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id as 'modules'|'compliance')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===id?'bg-blue-600 text-white':'bg-[#1e2d42] text-slate-400 hover:text-slate-200 border border-[#2a3a52]'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28}/></div>
        ) : tab === 'modules' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.length === 0 ? (
              <div className="col-span-3"><EmptyState message="No training modules yet" icon="🎓"/></div>
            ) : modules.map(mod => (
              <Card key={mod.id} className="p-4 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-200">{mod.title}</span>
                      {mod.is_mandatory && (
                        <span className="text-[9px] font-mono bg-red-900/40 text-red-300 border border-red-700/40 px-1.5 py-0.5 rounded-full">MANDATORY</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">{mod.category} · {mod.duration_mins} min</div>
                  </div>
                </div>

                {mod.description && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{mod.description}</p>
                )}

                <div className="flex items-center gap-3 mt-auto pt-3 border-t border-[#2a3a52]">
                  <div className="flex-1 text-xs text-slate-500">
                    <span className="text-slate-300 font-semibold">{mod.completions_count}</span> completions
                    {mod.avg_score && <span className="ml-2">· avg {mod.avg_score}%</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setCompleteModal(mod); setCompleteForm({ employee_id:'', score:'' }); }}>
                    <CheckCircle size={13}/> Record
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Employee','Dept','Mandatory','Optional','Rate','Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compliance.map((c,i) => {
                    const mandatoryDone = c.mandatory_completed >= c.mandatory_total;
                    return (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-sm font-medium text-slate-200">{c.employee_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{c.department}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {mandatoryDone
                              ? <CheckCircle size={14} className="text-green-400"/>
                              : <Circle size={14} className="text-red-400"/>
                            }
                            <span className="text-xs font-mono text-slate-300">{c.mandatory_completed}/{c.mandatory_total}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {c.modules_completed - c.mandatory_completed}/{c.total_modules - c.mandatory_total}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#2a3a52] rounded-full">
                              <div className={`h-1.5 rounded-full ${c.completion_rate >= 80 ? 'bg-green-500' : c.completion_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                   style={{ width:`${c.completion_rate}%` }}/>
                            </div>
                            <span className="text-xs font-mono text-slate-400">{c.completion_rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${mandatoryDone ? 'bg-green-900/40 text-green-300 border-green-700/40' : 'bg-red-900/40 text-red-300 border-red-700/40'}`}>
                            {mandatoryDone ? 'Compliant' : 'Non-compliant'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create Module Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Training Module" maxWidth="max-w-lg">
        <div className="space-y-3">
          <Input label="Module Title *" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. WHS & Workplace Safety"/>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">Description</label>
            <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
              placeholder="What this module covers…"
              className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y min-h-[70px]"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (minutes)" type="number" value={form.duration_mins} onChange={e=>setForm(p=>({...p,duration_mins:e.target.value}))}/>
            <Select label="Category" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.is_mandatory} onChange={e=>setForm(p=>({...p,is_mandatory:e.target.checked}))} className="accent-blue-500 w-4 h-4"/>
            <span className="text-sm text-slate-300">Mandatory for all employees</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={createModule} loading={saving}>Create Module</Button>
        </div>
      </Modal>

      {/* Record Completion Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title={`Record Completion: ${completeModal?.title ?? ''}`} maxWidth="max-w-md">
        <div className="space-y-3">
          <div className="p-3 bg-[#1e2d42] rounded-xl text-xs text-slate-400">
            <div className="font-medium text-slate-300 mb-1">{completeModal?.title}</div>
            <div>{completeModal?.duration_mins} minutes · {completeModal?.category}{completeModal?.is_mandatory ? ' · MANDATORY' : ''}</div>
          </div>
          <Select label="Employee" value={completeForm.employee_id} onChange={e=>setCompleteForm(p=>({...p,employee_id:e.target.value}))}>
            <option value="">Select employee</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Input label="Score (0-100, optional)" type="number" min={0} max={100} value={completeForm.score} onChange={e=>setCompleteForm(p=>({...p,score:e.target.value}))} placeholder="e.g. 92"/>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setCompleteModal(null)}>Cancel</Button>
          <Button variant="success" onClick={recordCompletion} loading={saving}><CheckCircle size={14}/> Record Completion</Button>
        </div>
      </Modal>
    </div>
  );
}

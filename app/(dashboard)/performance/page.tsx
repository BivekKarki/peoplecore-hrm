'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Textarea, Input, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { PerformanceReview } from '@/types';
import { formatDate } from '@/lib/utils';
import { Star, Plus, TrendingUp } from 'lucide-react';

const PERIODS = ['Q1-2025','Q2-2025','Q3-2025','Q4-2025','Q1-2024','Annual-2024'];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i=>(
        <Star key={i} size={13} className={i<=rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}/>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [reviews, setReviews]   = useState<PerformanceReview[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [employees, setEmps]    = useState<{id:string;first_name:string;last_name:string}[]>([]);
  const [form, setForm]         = useState({
    employee_id:'', review_period:'Q1-2025', rating:3,
    kpi_achievement:80, goals_met:80, comments:'',
    strengths:'', improvements:'', next_review_date:'', salary_adjustment:'',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/performance');
      const j = await r.json();
      setReviews(j.data ?? []);
    } catch { showToast('Failed to load reviews','error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200&status=active')
      .then(r=>r.json())
      .then(j=>setEmps(j.data ?? []));
  }, []);

  const submit = async () => {
    if (!form.employee_id) { showToast('Select employee','error'); return; }
    if (!form.comments.trim()) { showToast('Comments required','error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/performance',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...form, rating:Number(form.rating), kpi_achievement:Number(form.kpi_achievement), goals_met:Number(form.goals_met)}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Review submitted','success');
      setModal(false);
      load();
    } catch (e:unknown) {
      showToast(e instanceof Error ? e.message : 'Failed','error');
    } finally { setSaving(false); }
  };

  const avgRating  = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—';
  const avgKpi     = reviews.length ? Math.round(reviews.reduce((s,r)=>s+r.kpi_achievement,0)/reviews.length) : 0;
  const top        = reviews.filter(r=>r.rating>=4).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Performance" action={
        <Button variant="primary" onClick={()=>setModal(true)}><Plus size={14}/> Add Review</Button>
      }/>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Reviews"   value={reviews.length} color="#2563eb" icon={<Star size={16}/>}/>
          <StatCard label="Avg Rating"      value={avgRating}      color="#d97706"/>
          <StatCard label="Avg KPI %"       value={`${avgKpi}%`}   color="#16a34a" icon={<TrendingUp size={16}/>}/>
          <StatCard label="High Performers" value={top}            color="#7c3aed"/>
        </div>

        <Card>
          {loading ? <div className="flex justify-center py-16"><Spinner size={24}/></div> :
           reviews.length===0 ? <EmptyState message="No performance reviews yet" icon="⭐"/> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3a52]">
                    {['Employee','Period','Rating','KPI %','Goals %','Reviewer','Date','Comments'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(rev=>(
                    <tr key={rev.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-medium text-slate-200">{rev.employee_name}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rev.review_period}</td>
                      <td className="px-4 py-3"><StarRating rating={rev.rating}/></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#2a3a52] rounded-full">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{width:`${Math.min(rev.kpi_achievement,100)}%`}}/>
                          </div>
                          <span className="text-xs font-mono text-slate-400">{rev.kpi_achievement}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{rev.goals_met}%</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{rev.reviewer_name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(rev.created_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{rev.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Add Performance Review">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Employee" value={form.employee_id} onChange={e=>setForm(p=>({...p,employee_id:e.target.value}))}>
            <option value="">Select employee</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Select label="Review Period" value={form.review_period} onChange={e=>setForm(p=>({...p,review_period:e.target.value}))}>
            {PERIODS.map(p=><option key={p}>{p}</option>)}
          </Select>
          <Select label="Overall Rating (1–5)" value={String(form.rating)} onChange={e=>setForm(p=>({...p,rating:Number(e.target.value)}))}>
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} — {['Very Poor','Poor','Meets Expectations','Good','Excellent'][n-1]}</option>)}
          </Select>
          <Input label="KPI Achievement %" type="number" min={0} max={200} value={form.kpi_achievement} onChange={e=>setForm(p=>({...p,kpi_achievement:Number(e.target.value)}))}/>
          <Input label="Goals Met %" type="number" min={0} max={100} value={form.goals_met} onChange={e=>setForm(p=>({...p,goals_met:Number(e.target.value)}))}/>
          <Input label="Salary Adjustment %" type="number" value={form.salary_adjustment} onChange={e=>setForm(p=>({...p,salary_adjustment:e.target.value}))} placeholder="e.g. 5"/>
          <div className="col-span-2">
            <Textarea label="Overall Comments *" value={form.comments} onChange={e=>setForm(p=>({...p,comments:e.target.value}))} placeholder="Summary of performance, achievements…"/>
          </div>
          <Textarea label="Strengths" value={form.strengths} onChange={e=>setForm(p=>({...p,strengths:e.target.value}))} placeholder="Key strengths observed…"/>
          <Textarea label="Areas for Improvement" value={form.improvements} onChange={e=>setForm(p=>({...p,improvements:e.target.value}))} placeholder="Areas to develop…"/>
          <Input label="Next Review Date" type="date" value={form.next_review_date} onChange={e=>setForm(p=>({...p,next_review_date:e.target.value}))}/>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={()=>setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Submit Review</Button>
        </div>
      </Modal>
    </div>
  );
}

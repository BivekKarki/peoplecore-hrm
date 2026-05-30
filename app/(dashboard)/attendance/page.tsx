'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Badge, Button, Modal, Select, Input, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { AttendanceRecord } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Clock, Plus } from 'lucide-react';

const STATUSES = ['present','absent','late','half_day','work_from_home'];

export default function AttendancePage() {
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [employees, setEmps]    = useState<{id:string;first_name:string;last_name:string}[]>([]);
  const [form, setForm]         = useState({ employee_id:'', date:'', check_in:'', check_out:'', status:'present', method:'manual', notes:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/attendance?date=${date}`);
      const j = await r.json();
      setRecords(j.data ?? []);
    } catch { showToast('Failed to load attendance','error'); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200&status=active')
      .then(r => r.json())
      .then(j => setEmps(j.data ?? []));
  }, []);

  const openModal = () => {
    setForm({ employee_id:'', date, check_in:'', check_out:'', status:'present', method:'manual', notes:'' });
    setModal(true);
  };

  const save = async () => {
    if (!form.employee_id) { showToast('Select employee','error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Attendance recorded','success');
      setModal(false);
      load();
    } catch (e:unknown) {
      showToast(e instanceof Error ? e.message : 'Failed','error');
    } finally { setSaving(false); }
  };

  const present   = records.filter(r => r.status === 'present').length;
  const absent    = records.filter(r => r.status === 'absent').length;
  const late      = records.filter(r => r.status === 'late').length;
  const wfh       = records.filter(r => r.status === 'work_from_home').length;
  const rate      = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  // Mini heatmap: generate last 5 weeks × 5 days
  const heatmap = Array.from({ length: 25 }, () => Math.floor(Math.random() * 5));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Attendance" action={
        <Button variant="primary" onClick={openModal}><Plus size={14} /> Record</Button>
      }/>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Present"        value={present} color="#16a34a" icon={<Clock size={16}/>}/>
          <StatCard label="Absent"         value={absent}  color="#dc2626"/>
          <StatCard label="Late"           value={late}    color="#d97706"/>
          <StatCard label="Attendance Rate" value={`${rate}%`} color="#2563eb" delta="Today"/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-slate-300">Daily Log</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"/>
            </div>

            {loading ? <div className="flex justify-center py-12"><Spinner size={24}/></div> :
             records.length === 0 ? <EmptyState message="No records for this date" icon="📋"/> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2a3a52]">
                      {['Employee','Check-In','Check-Out','Hours','Method','Status'].map(h=>(
                        <th key={h} className="text-left px-3 py-2.5 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec=>(
                      <tr key={rec.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-sm font-medium text-slate-200">{rec.employee_name}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{rec.check_in ? new Date(rec.check_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{rec.check_out ? new Date(rec.check_out).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{rec.hours_worked ? `${rec.hours_worked}h` : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{rec.method ?? 'manual'}</td>
                        <td className="px-3 py-2.5"><Badge status={rec.status}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-300 mb-3">Attendance Heatmap</div>
              <div className="flex gap-1">
                {['M','T','W','TH','F'].map(d=>(
                  <div key={d} className="flex-1 text-center text-[9px] text-slate-600 font-mono mb-1">{d}</div>
                ))}
              </div>
              <div className="grid gap-1" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
                {heatmap.map((v,i)=>{
                  const shades = ['bg-[#1e2d42]','bg-blue-900','bg-blue-700','bg-blue-500','bg-blue-400'];
                  return <div key={i} className={`aspect-square rounded-sm ${shades[v]}`} title={`${v*20+20}%`}/>;
                })}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-[9px] text-slate-600 font-mono">
                <span>Less</span>
                {['bg-[#1e2d42]','bg-blue-900','bg-blue-700','bg-blue-500','bg-blue-400'].map((c,i)=>(
                  <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`}/>
                ))}
                <span>More</span>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-300 mb-3">Summary</div>
              <div className="space-y-2">
                {[
                  {label:'Present',  val:present, color:'text-green-400'},
                  {label:'Absent',   val:absent,  color:'text-red-400'},
                  {label:'Late',     val:late,    color:'text-yellow-400'},
                  {label:'WFH',      val:wfh,     color:'text-blue-400'},
                ].map(s=>(
                  <div key={s.label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{s.label}</span>
                    <span className={`font-mono font-semibold ${s.color}`}>{s.val}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[#2a3a52]">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => showToast('Exporting CSV…','info')}>Export CSV</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Record Attendance" maxWidth="max-w-md">
        <div className="space-y-3">
          <Select label="Employee" value={form.employee_id} onChange={e=>setForm(p=>({...p,employee_id:e.target.value}))}>
            <option value="">Select employee</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
          <Input label="Date" type="date" value={form.date||date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-In" type="datetime-local" value={form.check_in} onChange={e=>setForm(p=>({...p,check_in:e.target.value}))}/>
            <Input label="Check-Out" type="datetime-local" value={form.check_out} onChange={e=>setForm(p=>({...p,check_out:e.target.value}))}/>
          </div>
          <Select label="Status" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
            {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </Select>
          <Select label="Method" value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))}>
            {['manual','facial','card','app'].map(m=><option key={m}>{m}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={()=>setModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>Save Record</Button>
        </div>
      </Modal>
    </div>
  );
}

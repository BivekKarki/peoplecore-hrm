'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, StatCard, Spinner } from '@/components/ui';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#2563eb','#7c3aed','#0d9488','#d97706','#dc2626','#16a34a','#db2777'];

const TOOLTIP_STYLE = {
  contentStyle: { background:'#1e2d42', border:'1px solid #2a3a52', borderRadius:8, fontSize:12 },
  labelStyle: { color:'#94a3b8' },
  itemStyle: { color:'#60a5fa' },
};

export default function AnalyticsPage() {
  const [data, setData]     = useState<Record<string, unknown> | null>(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    // Fetch multiple reports in parallel
    Promise.all([
      fetch('/api/reports?type=headcount').then(r => r.json()),
      fetch('/api/reports?type=payroll').then(r => r.json()),
      fetch('/api/reports?type=attendance').then(r => r.json()),
      fetch('/api/reports?type=performance').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
    ]).then(([hc, pay, att, perf, dash]) => {
      setData({ headcount: hc.data, payroll: pay.data, attendance: att.data, performance: perf.data, dashboard: dash });
    }).catch(console.error).finally(() => setLoad(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Analytics" />
      <div className="flex-1 flex items-center justify-center"><Spinner size={32} /></div>
    </div>
  );

  const hc   = (data?.headcount as Record<string,unknown>[] | null) ?? [];
  const pay  = (data?.payroll   as Record<string,unknown>[] | null) ?? [];
  const att  = (data?.attendance as Record<string,unknown>[] | null) ?? [];
  const perf = (data?.performance as Record<string,unknown>[] | null) ?? [];
  const dash = (data?.dashboard as { stats: Record<string,number>; departments: Record<string,unknown>[] } | null);

  // Derived metrics
  const totalHeadcount  = hc.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const totalPayrollCost = hc.reduce((s, r) => s + Number(r.total_salary_cost ?? 0), 0);
  const avgAttendance   = att.length
    ? Math.round(att.reduce((s, r) => s + Number(r.attendance_rate ?? 0), 0) / att.length)
    : 0;
  const avgRating       = perf.length
    ? (perf.reduce((s, r) => s + Number(r.avg_rating ?? 0), 0) / perf.filter(r => r.avg_rating).length).toFixed(1)
    : '—';

  // Headcount pie
  const pieData = hc.map((r, i) => ({
    name: String(r.department), value: Number(r.total), color: COLORS[i % COLORS.length],
  }));

  // Payroll trend line
  const payrollLine = pay.slice(0, 6).reverse().map(r => ({
    period: String(r.period ?? ''),
    gross:  Math.round(Number(r.total_gross ?? 0)),
    net:    Math.round(Number(r.total_net   ?? 0)),
    tax:    Math.round(Number(r.total_tax   ?? 0)),
  }));

  // Attendance bar
  const attBar = att.slice(0, 10).map(r => ({
    name:  String(r.employee_name ?? '').split(' ')[0],
    rate:  Number((r.attendance_rate ?? 0)),
    absent: Number(r.absent_days ?? 0),
    late:   Number(r.late_days   ?? 0),
  }));

  // Performance scatter (rating vs kpi)
  const perfBar = perf.slice(0, 10).map(r => ({
    name: String(r.employee_name ?? '').split(' ')[0],
    rating: Number(r.avg_rating ?? 0),
    kpi:    Number(r.avg_kpi    ?? 0),
  }));

  // Salary by department
  const salaryBar = hc.map(r => ({
    dept: String(r.department ?? '').slice(0, 4),
    avg:  Number(r.avg_salary ?? 0),
    total: Number(r.total_salary_cost ?? 0),
  }));

  // Employment type breakdown
  const empTypes = hc.reduce((acc: Record<string, number>, r) => {
    const types = ['full_time','part_time','contract','casual'];
    types.forEach(t => {
      const label = t.replace('_',' ');
      acc[label] = (acc[label] || 0) + Number((r as Record<string,unknown>)[t] ?? 0);
    });
    return acc;
  }, {} as Record<string, number>);
  const empTypePie = Object.entries(empTypes).map(([name, value], i) => ({
    name, value, color: COLORS[i % COLORS.length],
  })).filter(e => e.value > 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Analytics & Insights" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Workforce"   value={totalHeadcount}              color="#2563eb" icon={<Users size={16}/>}     delta={`${hc.length} departments`} />
          <StatCard label="Annual Salary Cost" value={formatCurrency(totalPayrollCost)} color="#16a34a" icon={<DollarSign size={16}/>} delta="All active employees" />
          <StatCard label="Avg Attendance"    value={`${avgAttendance}%`}          color="#0d9488" icon={<Clock size={16}/>}      delta="Last 30 days" />
          <StatCard label="Avg Performance"   value={avgRating}                   color="#d97706" icon={<TrendingUp size={16}/>}  delta="Out of 5.0" />
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Headcount pie */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">Headcount by Department</div>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`} labelLine={false} fontSize={9}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pieData.map(e => (
                    <div key={e.name} className="flex items-center gap-1 text-[10px] text-slate-400">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                      {e.name}
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No data</div>}
          </Card>

          {/* Employment type */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">Employment Types</div>
            {empTypePie.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={empTypePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                    {empTypePie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend formatter={(v) => <span style={{ fontSize:11, color:'#94a3b8' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No data</div>}
          </Card>

          {/* Salary by dept */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">Avg Salary by Department</div>
            {salaryBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salaryBar} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" tick={{ fill:'#64748b', fontSize:9 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="dept" tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Avg Salary']} />
                  <Bar dataKey="avg" fill="#2563eb" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No data</div>}
          </Card>
        </div>

        {/* Payroll trend */}
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-300 mb-3">Payroll Trend — Last 6 Runs</div>
          {payrollLine.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={payrollLine} margin={{ top:4, right:20, left:0, bottom:0 }}>
                <XAxis dataKey="period" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
                <Legend formatter={(v) => <span style={{ fontSize:11, color:'#94a3b8' }}>{v}</span>} />
                <Line type="monotone" dataKey="gross" stroke="#2563eb" strokeWidth={2} dot={{ fill:'#2563eb', r:3 }} name="Gross" />
                <Line type="monotone" dataKey="net"   stroke="#16a34a" strokeWidth={2} dot={{ fill:'#16a34a', r:3 }} name="Net Pay" />
                <Line type="monotone" dataKey="tax"   stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Tax" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-slate-600 text-sm gap-2">
              <span>No payroll runs yet</span>
              <a href="/payroll" className="text-blue-400 text-xs hover:underline">Run Payroll →</a>
            </div>
          )}
        </Card>

        {/* Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Attendance rates */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">Attendance by Employee (Last 30 Days)</div>
            {attBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attBar} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`]} />
                  <Bar dataKey="rate" fill="#0d9488" radius={[4,4,0,0]} name="Rate %" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No attendance data yet</div>}
          </Card>

          {/* Performance KPI */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3">KPI Achievement by Employee</div>
            {perfBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={perfBar} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0,100]} tick={{ fill:'#64748b', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`]} />
                  <Bar dataKey="kpi" fill="#d97706" radius={[4,4,0,0]} name="KPI %" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-44 flex items-center justify-center text-slate-600 text-sm">No reviews yet</div>}
          </Card>
        </div>

        {/* Workforce health scorecard */}
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-300 mb-4">Workforce Health Scorecard</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Headcount Growth',    value: dash?.stats?.new_this_month ?? 0, unit:'new/mo',    color:'text-blue-400',   good: true },
              { label:'Attendance Rate',     value: `${avgAttendance}%`,              unit:'avg',       color: avgAttendance > 90 ? 'text-green-400' : avgAttendance > 75 ? 'text-yellow-400' : 'text-red-400',   good: avgAttendance > 85 },
              { label:'Pending Leave',       value: dash?.stats?.pending_leaves ?? 0, unit:'requests',  color: (dash?.stats?.pending_leaves ?? 0) > 5 ? 'text-amber-400' : 'text-green-400', good: (dash?.stats?.pending_leaves ?? 0) <= 3 },
              { label:'Avg Performance',     value: avgRating,                        unit:'/ 5.0',     color: Number(avgRating) >= 4 ? 'text-green-400' : Number(avgRating) >= 3 ? 'text-yellow-400' : 'text-red-400', good: Number(avgRating) >= 3.5 },
            ].map(m => (
              <div key={m.label} className="bg-[#1e2d42] rounded-xl p-3 text-center">
                <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">{m.label}</div>
                <div className={`text-2xl font-semibold font-mono ${m.color}`}>{m.value}</div>
                <div className="text-xs text-slate-600 mt-1">{m.unit}</div>
                <div className={`text-[10px] mt-2 font-mono ${m.good ? 'text-green-500' : 'text-amber-500'}`}>
                  {m.good ? '● Good' : '● Needs attention'}
                </div>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Clock, DollarSign, Calendar, UserPlus, AlertCircle } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { StatCard, Card, Badge, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface DashboardData {
  stats: {
    total_employees: number; active_employees: number; on_leave: number;
    pending_inductions: number; present_today: number; absent_today: number;
    monthly_payroll: number; pending_leaves: number; new_this_month: number;
  };
  departments: { department: string; count: number; avg_salary: number }[];
  hiring: { month: string; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Dashboard" action={
        <Link href="/registration" className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <UserPlus size={14} /> Add Employee
        </Link>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <StatCard label="Total Employees" value={s?.total_employees ?? 0} delta={`+${s?.new_this_month ?? 0} this month`} deltaUp color="#2563eb" icon={<Users size={16} />} />
              <StatCard label="Present Today" value={s?.present_today ?? 0} delta={`${s?.active_employees ? Math.round(((s?.present_today ?? 0) / s.active_employees) * 100) : 0}% attendance`} deltaUp color="#16a34a" icon={<Clock size={16} />} />
              <StatCard label="On Leave" value={s?.on_leave ?? 0} delta={`${s?.pending_leaves ?? 0} requests pending`} color="#d97706" icon={<Calendar size={16} />} />
              <StatCard label="Monthly Payroll" value={formatCurrency(s?.monthly_payroll ?? 0)} delta="Estimated gross" color="#0d9488" icon={<DollarSign size={16} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Hiring chart */}
              <Card className="p-4 lg:col-span-2">
                <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
                  Hiring Activity <span className="text-slate-500 font-normal font-mono">Last 6 months</span>
                </div>
                {data?.hiring && data.hiring.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.hiring} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#94a3b8' }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Hires" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-slate-500 text-sm">No hiring data yet</div>
                )}
              </Card>

              {/* Department breakdown */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3">Headcount by Dept</div>
                <div className="space-y-2">
                  {(data?.departments ?? []).map((d) => {
                    const max = Math.max(...(data?.departments ?? []).map((x) => x.count), 1);
                    return (
                      <div key={d.department}>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{d.department}</span>
                          <span className="font-mono">{d.count}</span>
                        </div>
                        <div className="h-1.5 bg-[#1e2d42] rounded-full">
                          <div className="h-1.5 bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${(d.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Pending actions */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-400" /> Pending Actions
                </div>
                <div className="space-y-2">
                  <Link href="/leave?status=pending" className="flex items-center justify-between p-2.5 bg-[#1e2d42] rounded-lg hover:bg-[#243548] transition-colors">
                    <span className="text-sm text-slate-300">Leave approvals</span>
                    <Badge status="pending" label={`${s?.pending_leaves ?? 0} pending`} />
                  </Link>
                  <Link href="/induction" className="flex items-center justify-between p-2.5 bg-[#1e2d42] rounded-lg hover:bg-[#243548] transition-colors">
                    <span className="text-sm text-slate-300">Inductions due</span>
                    <Badge status="in_progress" label={`${s?.pending_inductions ?? 0} active`} />
                  </Link>
                  <Link href="/employees?status=pending" className="flex items-center justify-between p-2.5 bg-[#1e2d42] rounded-lg hover:bg-[#243548] transition-colors">
                    <span className="text-sm text-slate-300">Pending employees</span>
                    <Badge status="pending" label="View" />
                  </Link>
                </div>
              </Card>

              {/* Quick actions */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3">Quick Actions</div>
                <div className="space-y-2">
                  {[
                    { href: '/registration', label: 'Register New Employee', icon: '📋' },
                    { href: '/payroll',      label: 'Run Payroll',           icon: '💰' },
                    { href: '/facial',       label: 'Facial Login',          icon: '👁️' },
                    { href: '/reports',      label: 'Generate Report',       icon: '📊' },
                  ].map((a) => (
                    <Link key={a.href} href={a.href} className="flex items-center gap-2.5 p-2.5 bg-[#1e2d42] rounded-lg hover:bg-[#243548] transition-colors text-sm text-slate-300">
                      <span className="text-base">{a.icon}</span> {a.label}
                    </Link>
                  ))}
                </div>
              </Card>

              {/* Dept table */}
              <Card className="p-4">
                <div className="text-xs font-semibold text-slate-300 mb-3">Department Salaries</div>
                <div className="space-y-2">
                  {(data?.departments ?? []).slice(0, 5).map((d) => (
                    <div key={d.department} className="flex justify-between text-xs">
                      <span className="text-slate-400">{d.department}</span>
                      <span className="font-mono text-slate-300">{formatCurrency(d.avg_salary)} avg</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

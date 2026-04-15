'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Badge, Spinner, EmptyState, showToast } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Download } from 'lucide-react';

const REPORTS = [
  { type:'headcount',  label:'Headcount Report',    icon:'👥', desc:'By dept, role, type, salary' },
  { type:'payroll',    label:'Payroll Summary',      icon:'💰', desc:'Monthly payroll history' },
  { type:'attendance', label:'Attendance Report',    icon:'⏱️', desc:'Presence & punctuality trends' },
  { type:'leave',      label:'Leave Analysis',       icon:'📅', desc:'Balances, approvals, trends' },
  { type:'performance',label:'Performance Report',   icon:'⭐', desc:'KPIs, reviews, rankings' },
  { type:'compliance', label:'Compliance Report',    icon:'✅', desc:'Docs, inductions, audit' },
];

export default function ReportsPage() {
  const [active, setActive]   = useState('');
  const [data, setData]       = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (type: string) => {
    setActive(type);
    setLoading(true);
    try {
      const r = await fetch(`/api/reports?type=${type}`);
      const j = await r.json();
      setData(j.data ?? []);
    } catch { showToast('Failed to generate report','error'); }
    finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv  = [keys.join(','), ...data.map((row) => keys.map((k) => `"${row[k] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${active}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV exported','success');
  };

  const renderTable = () => {
    if (!data.length) return <EmptyState message="No data for this report" icon="📊" />;
    const keys = Object.keys(data[0]);
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a3a52]">
              {keys.map((k) => (
                <th key={k} className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500 font-mono font-normal whitespace-nowrap">
                  {k.replace(/_/g,' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                {keys.map((k) => {
                  const v = row[k];
                  const isStatus = ['status','induction_status'].includes(k) && typeof v === 'string';
                  const isBool   = typeof v === 'boolean';
                  const isMoney  = ['avg_salary','total_salary_cost','total_gross','total_net','total_tax','total_super'].includes(k);
                  const isDate   = ['start_date','pay_date'].includes(k) && v;
                  return (
                    <td key={k} className="px-4 py-3 text-sm text-slate-400">
                      {isStatus ? <Badge status={v as string} /> :
                       isBool   ? <span className={v ? 'text-green-400' : 'text-red-400'}>{v ? '✓' : '✗'}</span> :
                       isMoney  ? <span className="font-mono">{formatCurrency(Number(v))}</span> :
                       isDate   ? formatDate(v as string) :
                       String(v ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Reports" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {/* Report tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {REPORTS.map((r) => (
            <button
              key={r.type}
              onClick={() => load(r.type)}
              className={`text-left p-4 rounded-xl border transition-all ${active === r.type ? 'border-blue-500 bg-blue-900/20' : 'border-[#2a3a52] bg-[#162030] hover:bg-[#1e2d42]'}`}
            >
              <div className="text-2xl mb-2">{r.icon}</div>
              <div className="text-sm font-medium text-slate-200">{r.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
            </button>
          ))}
        </div>

        {/* Report output */}
        {active && (
          <Card>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3a52]">
              <div className="text-sm font-semibold text-slate-200">
                {REPORTS.find((r) => r.type === active)?.label}
              </div>
              <Button variant="ghost" size="sm" onClick={exportCSV} disabled={!data.length}>
                <Download size={13} /> Export CSV
              </Button>
            </div>
            {loading ? <div className="flex justify-center py-16"><Spinner size={28} /></div> : renderTable()}
          </Card>
        )}
      </div>
    </div>
  );
}

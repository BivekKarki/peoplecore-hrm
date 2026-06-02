'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Spinner, EmptyState, showToast } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Download, BarChart2, Users, Calendar, Star, Shield } from 'lucide-react';

const REPORTS = [
  { type: 'headcount',   label: 'Headcount Report',   icon: Users,    desc: 'Employee count by department, type, and status',  color: '#2563eb' },
  { type: 'payroll',     label: 'Payroll Summary',     icon: BarChart2,desc: 'Payroll runs, gross/net/tax totals by period',     color: '#16a34a' },
  { type: 'attendance',  label: 'Attendance Report',   icon: Calendar, desc: 'Attendance rates, punctuality and absence trends', color: '#0d9488' },
  { type: 'leave',       label: 'Leave Analysis',      icon: Calendar, desc: 'Leave balances, approvals and type breakdown',    color: '#d97706' },
  { type: 'performance', label: 'Performance Report',  icon: Star,     desc: 'KPI averages, ratings, and top/low performers',   color: '#7c3aed' },
  { type: 'compliance',  label: 'Compliance Report',   icon: Shield,   desc: 'Document expiry, induction status, audit items',  color: '#dc2626' },
];

const DEPTS = ['Engineering','Sales','Marketing','Operations','Finance','HR','Legal','Product'];

export default function ReportsPage() {
  const [active, setActive]   = useState('');
  const [data, setData]       = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [params, setParams]   = useState({ date_from: '', date_to: '', department: '' });

  const runReport = async (type: string) => {
    setActive(type);
    setLoading(true);
    setData([]);
    try {
      const q = new URLSearchParams({ type });
      if (params.date_from)  q.set('date_from', params.date_from);
      if (params.date_to)    q.set('date_to', params.date_to);
      if (params.department) q.set('department', params.department);
      const r = await fetch(`/api/reports?${q}`);
      const j = await r.json();
      setData(j.data ?? []);
      if ((j.data ?? []).length === 0) showToast('No data found for selected filters', 'info');
    } catch { showToast('Failed to generate report', 'error'); }
    finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g,'""')}"` : str;
        }).join(',')
    );
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${active}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded', 'success');
  };

  const renderCell = (key: string, val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (key.includes('salary') || key.includes('gross') || key.includes('net') || key.includes('tax') || key.includes('super') || key.includes('amount') || key.includes('cost'))
      return formatCurrency(Number(val));
    if (key.includes('date') || key.includes('_at'))
      return formatDate(String(val));
    if (typeof val === 'number' && key.includes('rate'))
      return `${Number(val).toFixed(1)}%`;
    if (typeof val === 'boolean')
      return val ? '✓ Yes' : '✗ No';
    return String(val);
  };

  const fmtHeader = (key: string) =>
      key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());

  const activeReport = REPORTS.find(r => r.type === active);

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Reports" action={
          data.length > 0 ? (
              <Button variant="success" onClick={exportCSV}>
                <Download size={14} /> Export CSV
              </Button>
          ) : undefined
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {REPORTS.map(rep => {
              const Icon = rep.icon;
              const isActive = active === rep.type;
              return (
                  <div key={rep.type} onClick={() => runReport(rep.type)}
                       style={{ backgroundColor: isActive ? `${rep.color}22` : '#162030', border: `1px solid ${isActive ? rep.color : '#2a3a52'}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'all .2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, backgroundColor: `${rep.color}22`, border: `1px solid ${rep.color}44`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={16} style={{ color: rep.color }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{rep.label}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{rep.desc}</div>
                    {isActive && !loading && data.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: rep.color, fontFamily: 'monospace' }}>✓ {data.length} rows</div>
                    )}
                  </div>
              );
            })}
          </div>

          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>From</label>
                <input type="date" value={params.date_from} onChange={e => setParams(p => ({ ...p, date_from: e.target.value }))}
                       style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>To</label>
                <input type="date" value={params.date_to} onChange={e => setParams(p => ({ ...p, date_to: e.target.value }))}
                       style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>Department</label>
                <select value={params.department} onChange={e => setParams(p => ({ ...p, department: e.target.value }))}
                        style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#94a3b8', padding: '8px 12px', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  <option value="">All Departments</option>
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              {active && (
                  <Button variant="primary" onClick={() => runReport(active)} loading={loading}>
                    <BarChart2 size={14} /> Regenerate
                  </Button>
              )}
              {(params.date_from || params.date_to || params.department) && (
                  <Button variant="ghost" onClick={() => setParams({ date_from: '', date_to: '', department: '' })}>
                    Clear Filters
                  </Button>
              )}
            </div>
          </Card>

          {!active ? (
              <Card style={{ padding: 40 }}>
                <EmptyState message="Select a report type above to generate data" icon="📊" />
              </Card>
          ) : loading ? (
              <Card style={{ padding: 60 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Spinner size={32} />
                  <div style={{ fontSize: 13, color: '#64748b' }}>Generating {activeReport?.label}…</div>
                </div>
              </Card>
          ) : data.length === 0 ? (
              <Card style={{ padding: 40 }}>
                <EmptyState message="No data found for this report" icon="📋" />
              </Card>
          ) : (
              <Card>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a3a52', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {activeReport && <activeReport.icon size={14} style={{ color: activeReport.color }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{activeReport?.label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{data.length} rows</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={exportCSV}>
                    <Download size={13} /> Export CSV
                  </Button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ borderBottom: '1px solid #2a3a52' }}>
                      {Object.keys(data[0]).map(col => (
                          <th key={col} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                            {fmtHeader(col)}
                          </th>
                      ))}
                    </tr>
                    </thead>
                    <tbody>
                    {data.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          {Object.entries(row).map(([k,v]) => (
                              <td key={k} style={{ padding: '10px 16px', fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap', fontFamily: (k.includes('salary') || k.includes('gross') || k.includes('net')) ? 'monospace' : 'inherit' }}>
                                {renderCell(k, v)}
                              </td>
                          ))}
                        </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </Card>
          )}
        </div>
      </div>
  );
}
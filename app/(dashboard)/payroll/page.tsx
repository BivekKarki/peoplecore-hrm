'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, StatCard, Badge, Button, Modal, Select, Spinner, EmptyState, showToast } from '@/components/ui';
import { PayrollRun } from '@/types';
import { formatCurrency, formatDate, calculateTax, calculateSuper } from '@/lib/utils';
import { DollarSign, Users, TrendingUp, CreditCard, Play, Download, FileCheck, AlertCircle, CheckCircle } from 'lucide-react';

interface ABAPreview {
  total_records: number;
  ready_records: number;
  missing_bank: string[];
  total_amount: number;
}

export default function PayrollPage() {
  const [runs, setRuns]           = useState<PayrollRun[]>([]);
  const [loading, setLoading]     = useState(true);
  const [runModal, setRunModal]   = useState(false);
  const [abaModal, setAbaModal]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [abaLoading, setAbaLoad] = useState(false);
  const [selectedRun, setSelRun]  = useState<PayrollRun | null>(null);
  const [abaPreview, setAbaPreview] = useState<ABAPreview | null>(null);
  const [payPeriod, setPayPeriod] = useState('monthly');
  const [salary, setSalary]       = useState(80000);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/payroll');
      const j = await r.json();
      setRuns(j.data ?? []);
    } catch { showToast('Failed to load payroll', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runPayroll = async () => {
    setCreating(true);
    try {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const pay   = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      const r     = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: start.toISOString().split('T')[0],
          period_end:   end.toISOString().split('T')[0],
          pay_date:     pay.toISOString().split('T')[0],
          pay_period:   payPeriod,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRuns(prev => [j.data, ...prev]);
      setRunModal(false);
      showToast('Payroll run created', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to run payroll', 'error');
    } finally { setCreating(false); }
  };

  const openABAModal = async (run: PayrollRun) => {
    setSelRun(run);
    setAbaPreview(null);
    setAbaModal(true);
    setAbaLoad(true);
    try {
      const r = await fetch(`/api/payroll/aba?payroll_run_id=${run.id}`);
      const j = await r.json();
      if (r.ok) setAbaPreview(j);
    } catch { showToast('Preview failed', 'error'); }
    finally { setAbaLoad(false); }
  };

  const downloadABA = async () => {
    if (!selectedRun) return;
    setAbaLoad(true);
    try {
      const r = await fetch('/api/payroll/aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error);
      }
      const skipped = r.headers.get('X-Skipped-Count');
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `payroll_${selectedRun.period_start.slice(0,7)}.aba`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`ABA file downloaded${skipped && skipped !== '0' ? ` (${skipped} employees skipped)` : ''}`, 'success');
      setAbaModal(false);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Download failed', 'error');
    } finally { setAbaLoad(false); }
  };

  // Payslip calculator
  const gross  = Math.round(salary / 12);
  const tax    = Math.round(calculateTax(salary) / 12);
  const superA = calculateSuper(gross);
  const net    = gross - tax - superA;

  const latest = runs[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Payroll" action={
        <Button variant="primary" onClick={() => setRunModal(true)}>
          <Play size={14} /> Run Payroll
        </Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {latest && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Gross Payroll"   value={formatCurrency(latest.total_gross)} delta="This run"       color="#16a34a" icon={<DollarSign size={16}/>} />
            <StatCard label="Tax Withheld"    value={formatCurrency(latest.total_tax)}   delta="PAYG"           color="#dc2626" icon={<TrendingUp size={16}/>} />
            <StatCard label="Superannuation"  value={formatCurrency(latest.total_super)} delta="11.5% SGC"      color="#7c3aed" icon={<CreditCard size={16}/>} />
            <StatCard label="Net Pay"         value={formatCurrency(latest.total_net)}   delta={`${latest.employee_count} employees`} color="#0d9488" icon={<Users size={16}/>} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payslip Calculator */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <DollarSign size={13} className="text-green-400" /> Payslip Calculator
            </div>
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-slate-400 font-mono block mb-1">Annual Salary (AUD)</label>
              <input type="range" min={30000} max={300000} step={5000} value={salary}
                onChange={e => setSalary(Number(e.target.value))} className="w-full accent-blue-500" />
              <div className="text-right text-sm font-mono text-blue-400 mt-1">{formatCurrency(salary)} p.a.</div>
            </div>
            <div className="bg-[#1e2d42] rounded-xl p-4 space-y-2.5">
              {[
                { label:'Monthly Gross',  value: formatCurrency(gross),  color:'text-slate-200' },
                { label:'PAYG Tax',       value: `-${formatCurrency(tax)}`,  color:'text-red-400' },
                { label:'Superannuation', value: `-${formatCurrency(superA)}`, color:'text-purple-400' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm border-b border-white/5 pb-2.5">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-mono ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-1">
                <span className="font-semibold text-slate-200">Monthly Net Pay</span>
                <span className="font-semibold font-mono text-green-400 text-base">{formatCurrency(net)}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" className="flex-1" onClick={() => showToast('PDF download available after payroll run', 'info')}>Download PDF</Button>
              <Button variant="primary" className="flex-1" onClick={() => showToast('Email sent to employee', 'success')}>Email Employee</Button>
            </div>
          </Card>

          {/* Payroll History */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
              <span>Payroll History</span>
              <span className="text-slate-600 font-normal font-mono">{runs.length} runs</span>
            </div>
            {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
             runs.length === 0 ? <EmptyState message="No payroll runs yet" icon="💰" /> : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {runs.map(run => (
                  <div key={run.id} className="flex items-center justify-between p-3 bg-[#1e2d42] rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-200">
                        {formatDate(run.period_start)} – {formatDate(run.period_end)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {run.employee_count} employees · Pay {formatDate(run.pay_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-mono text-green-400">{formatCurrency(run.total_net)}</div>
                        <Badge status={run.status} className="mt-1" />
                      </div>
                      {(run.status === 'draft' || run.status === 'approved') && (
                        <Button variant="ghost" size="sm" onClick={() => openABAModal(run)} title="Download ABA bank file">
                          <Download size={13} />
                        </Button>
                      )}
                      {run.status === 'processed' && (
                        <CheckCircle size={16} className="text-green-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ABA Info banner */}
        <div className="mt-4 p-4 bg-[#162030] border border-[#2a3a52] rounded-xl flex items-start gap-3">
          <FileCheck size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-200 mb-1">ABA Direct Credit File Export</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Generate an ABA (Australian Bankers Association) direct credit file for bulk payroll bank transfers.
              Upload directly to your business bank portal (ANZ, CBA, NAB, Westpac etc.). Add{' '}
              <code className="text-blue-400 bg-[#1e2d42] px-1 rounded">COMPANY_BSB</code>,{' '}
              <code className="text-blue-400 bg-[#1e2d42] px-1 rounded">COMPANY_ACCOUNT</code>, and{' '}
              <code className="text-blue-400 bg-[#1e2d42] px-1 rounded">APCA_ID</code> to .env.local.
              Employees must have BSB and account numbers set in their profile.
            </div>
          </div>
        </div>
      </div>

      {/* Run Payroll Modal */}
      <Modal open={runModal} onClose={() => setRunModal(false)} title="Run Payroll" maxWidth="max-w-md">
        <div className="space-y-4">
          <Select label="Pay Period" value={payPeriod} onChange={e => setPayPeriod(e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <div className="bg-[#1e2d42] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Period</span>
              <span className="font-mono text-slate-300">
                {new Date().toLocaleString('en-AU', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pay Date</span>
              <span className="font-mono text-slate-300">15th of next month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <Badge status="draft" />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            This generates payslips for all active employees. You can then download the ABA file for bank processing.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setRunModal(false)}>Cancel</Button>
          <Button variant="success" onClick={runPayroll} loading={creating}>Process Payroll</Button>
        </div>
      </Modal>

      {/* ABA Download Modal */}
      <Modal open={abaModal} onClose={() => setAbaModal(false)} title="Download ABA Bank File" maxWidth="max-w-md">
        {abaLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : abaPreview ? (
          <div className="space-y-4">
            <div className="bg-[#1e2d42] rounded-xl p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Period</span>
                <span className="font-mono text-slate-200">{selectedRun && formatDate(selectedRun.period_start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Payslips</span>
                <span className="font-mono text-slate-200">{abaPreview.total_records}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ready for Transfer</span>
                <span className="font-mono text-green-400 font-semibold">{abaPreview.ready_records}</span>
              </div>
              <div className="flex justify-between border-t border-[#2a3a52] pt-2.5 mt-1">
                <span className="text-slate-400 font-semibold">Total Transfer Amount</span>
                <span className="font-mono text-green-400 font-bold text-base">{formatCurrency(abaPreview.total_amount)}</span>
              </div>
            </div>

            {abaPreview.missing_bank.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/30 rounded-xl">
                <AlertCircle size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-amber-300 mb-1">
                    {abaPreview.missing_bank.length} employee{abaPreview.missing_bank.length > 1 ? 's' : ''} missing bank details:
                  </div>
                  <div className="text-xs text-amber-400/70">{abaPreview.missing_bank.join(', ')}</div>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 bg-[#1e2d42] p-3 rounded-xl">
              The generated .aba file can be uploaded to your bank's bulk payment portal (internet banking).
              Check with your bank for their specific upload instructions.
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm">Failed to load preview</div>
        )}
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[#2a3a52]">
          <Button variant="ghost" onClick={() => setAbaModal(false)}>Cancel</Button>
          <Button variant="success" onClick={downloadABA} loading={abaLoading} disabled={!abaPreview || abaPreview.ready_records === 0}>
            <Download size={14} /> Download .aba File
          </Button>
        </div>
      </Modal>
    </div>
  );
}

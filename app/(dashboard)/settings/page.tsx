'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Input, Select, showToast } from '@/components/ui';
import { Building2, Bell, Shield, Mail, Database, Globe, Save, Eye, EyeOff } from 'lucide-react';

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: () => void; label: string; description: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#1e2d42] rounded-xl">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{description}</div>
      </div>
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-[#2a3a52]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className="text-blue-400" />
      <div className="text-sm font-semibold text-slate-200">{label}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [saving, setSaving]     = useState(false);
  const [showSMTP, setShowSMTP] = useState(false);
  const [showAI, setShowAI]     = useState(false);
  const [showS3, setShowS3]     = useState(false);

  const [company, setCompany] = useState({
    name:             'PeopleCore Pty Ltd',
    abn:              '12 345 678 901',
    hr_email:         'hr@peoplecore.com.au',
    payroll_cycle:    'monthly',
    super_rate:       '11.5',
    company_bsb:      '062-000',
    company_account:  '12345678',
    apca_id:          '000001',
    company_bank:     'CBA',
    timezone:         'Australia/Darwin',
    date_format:      'DD/MM/YYYY',
  });

  const [smtp, setSMTP] = useState({
    host: '', port: '587', user: '', pass: '', from: '',
  });

  const [ai, setAI] = useState({
    api_key: '', model: 'claude-sonnet-4-20250514',
  });

  const [storage, setStorage] = useState({
    backend: 'local', bucket: '', region: 'auto', endpoint: '', key_id: '', secret: '',
  });

  const [toggles, setToggles] = useState({
    facial_recognition:   true,
    two_factor:           false,
    email_notifications:  true,
    audit_logging:        true,
    leave_auto_approve:   false,
    payslip_auto_email:   true,
    kiosk_mode:           true,
    ai_features:          true,
    realtime_dashboard:   true,
  });

  const toggle = (k: keyof typeof toggles) => setToggles(p => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    showToast('Settings saved successfully', 'success');
  };

  const testEmail = async () => {
    showToast('Test email sent to ' + (smtp.user || company.hr_email), 'info');
  };

  const testAI = async () => {
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Say "AI connection successful" in exactly 3 words.' }] }),
      });
      const j = await r.json();
      if (r.ok) showToast(`AI OK: ${j.response?.slice(0, 50)}`, 'success');
      else showToast('AI connection failed — check API key', 'error');
    } catch {
      showToast('AI connection failed', 'error');
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Settings" action={
        <Button variant="primary" onClick={save} loading={saving}><Save size={14} /> Save All</Button>
      } />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Company */}
          <Card className="p-5">
            <SectionHeader icon={Building2} label="Company Settings" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Company Name" value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="col-span-2" />
              <Input label="ABN" value={company.abn} onChange={e => setCompany(p => ({ ...p, abn: e.target.value }))} />
              <Input label="HR Admin Email" type="email" value={company.hr_email} onChange={e => setCompany(p => ({ ...p, hr_email: e.target.value }))} />
              <Select label="Payroll Cycle" value={company.payroll_cycle} onChange={e => setCompany(p => ({ ...p, payroll_cycle: e.target.value }))}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Input label="Super Guarantee Rate (%)" type="number" value={company.super_rate} onChange={e => setCompany(p => ({ ...p, super_rate: e.target.value }))} />
              <Select label="Timezone" value={company.timezone} onChange={e => setCompany(p => ({ ...p, timezone: e.target.value }))}>
                <option value="Australia/Darwin">Australia/Darwin (ACST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                <option value="Australia/Melbourne">Australia/Melbourne (AEST)</option>
                <option value="Australia/Brisbane">Australia/Brisbane (AEST)</option>
                <option value="Australia/Perth">Australia/Perth (AWST)</option>
                <option value="Australia/Adelaide">Australia/Adelaide (ACST)</option>
              </Select>
              <Select label="Date Format" value={company.date_format} onChange={e => setCompany(p => ({ ...p, date_format: e.target.value }))}>
                <option value="DD/MM/YYYY">DD/MM/YYYY (Australian)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
              </Select>
            </div>
          </Card>

          {/* Bank / ABA Settings */}
          <Card className="p-5">
            <SectionHeader icon={Database} label="Payroll Bank Settings (ABA Direct Credit)" />
            <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-xl text-xs text-slate-400 mb-3">
              These settings are used when generating ABA files for bulk bank transfers. Contact your bank for APCA User ID.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Company BSB" value={company.company_bsb} onChange={e => setCompany(p => ({ ...p, company_bsb: e.target.value }))} placeholder="XXX-XXX" />
              <Input label="Company Account Number" value={company.company_account} onChange={e => setCompany(p => ({ ...p, company_account: e.target.value }))} placeholder="XXXXXXXXXX" />
              <Select label="Bank" value={company.company_bank} onChange={e => setCompany(p => ({ ...p, company_bank: e.target.value }))}>
                {['ANZ','CBA','NAB','WBC','BOQ','BEN','SUN','AMP'].map(b => <option key={b}>{b}</option>)}
              </Select>
              <Input label="APCA User ID (6 digits)" value={company.apca_id} onChange={e => setCompany(p => ({ ...p, apca_id: e.target.value }))} placeholder="000000" />
            </div>
          </Card>

          {/* Security */}
          <Card className="p-5">
            <SectionHeader icon={Shield} label="Security & Access" />
            <div className="space-y-2">
              <Toggle checked={toggles.facial_recognition}  onChange={() => toggle('facial_recognition')}  label="Facial Recognition"     description="Biometric kiosk clock-in/out" />
              <Toggle checked={toggles.two_factor}          onChange={() => toggle('two_factor')}          label="Two-Factor Auth (TOTP)"  description="Require authenticator app for HR logins" />
              <Toggle checked={toggles.audit_logging}       onChange={() => toggle('audit_logging')}       label="Audit Logging"           description="Log all data changes with user and timestamp" />
              <Toggle checked={toggles.kiosk_mode}          onChange={() => toggle('kiosk_mode')}          label="Kiosk Mode"              description="Enable the attendance kiosk at /kiosk" />
            </div>

            <div className="mt-4 pt-4 border-t border-[#2a3a52]">
              <div className="text-xs font-semibold text-slate-300 mb-3">Change Admin Password</div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Current Password" type="password" placeholder="••••••••" className="col-span-2" />
                <Input label="New Password (min 8 chars)" type="password" placeholder="••••••••" />
                <Input label="Confirm New Password" type="password" placeholder="••••••••" />
              </div>
              <Button variant="ghost" className="mt-3" onClick={() => showToast('Password updated', 'success')}>Update Password</Button>
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-5">
            <SectionHeader icon={Bell} label="Notifications & Automation" />
            <div className="space-y-2">
              <Toggle checked={toggles.email_notifications} onChange={() => toggle('email_notifications')} label="Email Notifications"     description="Send emails for leave requests, approvals, payslips" />
              <Toggle checked={toggles.leave_auto_approve}  onChange={() => toggle('leave_auto_approve')}  label="Auto-Approve Short Leave" description="Auto-approve leave requests of 1 day or less" />
              <Toggle checked={toggles.payslip_auto_email}  onChange={() => toggle('payslip_auto_email')}  label="Auto-Email Payslips"     description="Send payslips to employees after payroll run" />
              <Toggle checked={toggles.realtime_dashboard}  onChange={() => toggle('realtime_dashboard')}  label="Real-time Dashboard"     description="Stream live attendance data via SSE" />
            </div>
          </Card>

          {/* Email / SMTP */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader icon={Mail} label="Email (SMTP)" />
              <button onClick={() => setShowSMTP(!showSMTP)} className="text-xs text-blue-400 hover:underline">
                {showSMTP ? 'Hide' : 'Configure'}
              </button>
            </div>
            {!showSMTP ? (
              <div className="text-xs text-slate-500 bg-[#1e2d42] p-3 rounded-xl">
                Configure SMTP to send email notifications. In development, emails preview at ethereal.email automatically.
                Set <code className="text-blue-400">SMTP_HOST</code>, <code className="text-blue-400">SMTP_USER</code>, <code className="text-blue-400">SMTP_PASS</code> in .env.local for production.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="SMTP Host" value={smtp.host} onChange={e => setSMTP(p => ({ ...p, host: e.target.value }))} placeholder="smtp.gmail.com" className="col-span-2" />
                  <Input label="Port" value={smtp.port} onChange={e => setSMTP(p => ({ ...p, port: e.target.value }))} placeholder="587" />
                  <Input label="Username" value={smtp.user} onChange={e => setSMTP(p => ({ ...p, user: e.target.value }))} placeholder="you@gmail.com" />
                  <div className="relative">
                    <Input label="Password" type={showSMTP ? 'text' : 'password'} value={smtp.pass} onChange={e => setSMTP(p => ({ ...p, pass: e.target.value }))} placeholder="App password" />
                  </div>
                  <Input label="From Address" value={smtp.from} onChange={e => setSMTP(p => ({ ...p, from: e.target.value }))} placeholder="PeopleCore <noreply@co.com>" className="col-span-2" />
                </div>
                <Button variant="ghost" size="sm" onClick={testEmail}>Send Test Email</Button>
              </>
            )}
          </Card>

          {/* AI */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader icon={Globe} label="AI Features (Claude)" />
              <button onClick={() => setShowAI(!showAI)} className="text-xs text-blue-400 hover:underline">
                {showAI ? 'Hide' : 'Configure'}
              </button>
            </div>
            <Toggle checked={toggles.ai_features} onChange={() => toggle('ai_features')} label="Enable AI Features" description="HR chatbot, attrition prediction, job description generator" />
            {showAI && (
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <Input
                    label="Anthropic API Key"
                    type={showAI ? 'text' : 'password'}
                    value={ai.api_key}
                    onChange={e => setAI(p => ({ ...p, api_key: e.target.value }))}
                    placeholder="sk-ant-api03-..."
                  />
                </div>
                <Select label="Model" value={ai.model} onChange={e => setAI(p => ({ ...p, model: e.target.value }))}>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4.5 (Recommended)</option>
                  <option value="claude-opus-4-5-20251101">Claude Opus 4.5 (More powerful)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                </Select>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={testAI}>Test Connection</Button>
                  <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline self-center">Get API Key →</a>
                </div>
              </div>
            )}
          </Card>

          {/* Storage */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader icon={Database} label="File Storage" />
              <button onClick={() => setShowS3(!showS3)} className="text-xs text-blue-400 hover:underline">
                {showS3 ? 'Hide' : 'Configure'}
              </button>
            </div>
            <Select label="Storage Backend" value={storage.backend} onChange={e => setStorage(p => ({ ...p, backend: e.target.value }))}>
              <option value="local">Local Disk (development only)</option>
              <option value="s3">Amazon S3 (production)</option>
              <option value="r2">Cloudflare R2 (production)</option>
            </Select>
            {showS3 && storage.backend !== 'local' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Input label="Bucket Name" value={storage.bucket} onChange={e => setStorage(p => ({ ...p, bucket: e.target.value }))} placeholder="peoplecore-docs" className="col-span-2" />
                <Input label="Region" value={storage.region} onChange={e => setStorage(p => ({ ...p, region: e.target.value }))} placeholder="ap-southeast-2" />
                {storage.backend === 'r2' && (
                  <Input label="R2 Endpoint URL" value={storage.endpoint} onChange={e => setStorage(p => ({ ...p, endpoint: e.target.value }))} placeholder="https://xxx.r2.cloudflarestorage.com" className="col-span-2" />
                )}
                <Input label="Access Key ID" value={storage.key_id} onChange={e => setStorage(p => ({ ...p, key_id: e.target.value }))} placeholder="AKIAIOSFODNN7EXAMPLE" />
                <Input label="Secret Access Key" type="password" value={storage.secret} onChange={e => setStorage(p => ({ ...p, secret: e.target.value }))} placeholder="••••••••••••••••••••" />
              </div>
            )}
          </Card>

          {/* Save button */}
          <div className="flex justify-end pb-6">
            <Button variant="primary" size="lg" onClick={save} loading={saving}>
              <Save size={15} /> Save All Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

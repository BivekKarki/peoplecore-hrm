'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Input, Select, Spinner, showToast } from '@/components/ui';
import {
  Bot, TrendingDown, AlertTriangle, FileText,
  Send, RefreshCw, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';

// ─────────────────────────────── Types ───────────────────────────────────────
interface ChatMsg { role: 'user' | 'assistant'; content: string; }

interface AttritionResult {
  employee_id: string; name: string; department: string; job_title: string;
  risk_score: number; risk_level: 'low' | 'medium' | 'high' | 'critical';
  key_factors: string[]; recommendations: string[];
}

// ─────────────────────────────── Tab system ──────────────────────────────────
type Tab = 'chat' | 'attrition' | 'jobgen';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id:'chat',      label:'HR Assistant',      icon:<Bot size={16}/>,           desc:'Ask anything about HR, policies, data' },
  { id:'attrition', label:'Attrition Risk',    icon:<TrendingDown size={16}/>,  desc:'AI-powered flight risk predictions' },
  { id:'jobgen',    label:'Job Description',   icon:<FileText size={16}/>,      desc:'Generate professional JDs instantly' },
];

const RISK_COLORS: Record<string, string> = {
  low:      'bg-green-900/40 text-green-300 border-green-700/40',
  medium:   'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  high:     'bg-orange-900/40 text-orange-300 border-orange-700/40',
  critical: 'bg-red-900/40 text-red-300 border-red-700/40',
};

const RISK_BAR: Record<string, string> = {
  low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-orange-500', critical: 'bg-red-500',
};

const STARTER_QUESTIONS = [
  'How many employees are on leave this week?',
  'What are Australian NES leave entitlements?',
  'How should I handle a performance improvement plan?',
  'What is the minimum notice period under Fair Work Act?',
];

// ─────────────────────────────── Main page ───────────────────────────────────
export default function AIHubPage() {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="AI Hub" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/20 border border-blue-700/30 rounded-2xl">
          <div className="w-10 h-10 bg-blue-600/30 border border-blue-500/40 rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">PeopleCore AI Hub</div>
            <div className="text-xs text-slate-400">Powered by Claude claude-sonnet-4-20250514 · Add <code className="text-blue-400 bg-[#1e2d42] px-1 rounded">ANTHROPIC_API_KEY</code> to .env.local to activate</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1e2d42] text-slate-400 hover:text-slate-200 border border-[#2a3a52]'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'chat'      && <ChatTab />}
        {tab === 'attrition' && <AttritionTab />}
        {tab === 'jobgen'    && <JobGenTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────── Chat tab ────────────────────────────────────
function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([{
    role: 'assistant',
    content: "Hi! I'm your AI HR assistant. I can help with HR policies, employee data insights, Fair Work Act questions, and more. What would you like to know?",
  }]);
  const [input, setInput]   = useState('');
  const [loading, setLoad]  = useState(false);
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const newMessages: ChatMsg[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoad(true);

    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.filter(m => m.role !== 'assistant' || newMessages.indexOf(m) > 0) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMessages(prev => [...prev, { role: 'assistant', content: j.response }]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e instanceof Error ? e.message : 'AI service unavailable. Check ANTHROPIC_API_KEY in .env.local'}`,
      }]);
    } finally { setLoad(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Chat window */}
      <div className="lg:col-span-3 bg-[#162030] border border-[#2a3a52] rounded-xl flex flex-col" style={{ height: 540 }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={13} className="text-blue-400" />
                </div>
              )}
              <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-[#1e2d42] text-slate-200 border border-[#2a3a52] rounded-tl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-blue-400" />
              </div>
              <div className="bg-[#1e2d42] border border-[#2a3a52] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-[#2a3a52] p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about HR policies, employee data, compliance…"
              className="flex-1 bg-[#1e2d42] border border-[#2a3a52] rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500"
              disabled={loading}
            />
            <button onClick={() => send()}
              disabled={!input.trim() || loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Starter questions */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Quick Questions</div>
        {STARTER_QUESTIONS.map((q, i) => (
          <button key={i} onClick={() => send(q)} disabled={loading}
            className="w-full text-left p-3 bg-[#1e2d42] border border-[#2a3a52] rounded-xl text-xs text-slate-300 hover:border-blue-500/50 hover:bg-[#243548] transition-all">
            {q}
          </button>
        ))}
        <button onClick={() => setMessages([messages[0]])}
          className="w-full flex items-center justify-center gap-1.5 p-2 text-xs text-slate-600 hover:text-slate-400 transition-colors">
          <RefreshCw size={11} /> Clear chat
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────── Attrition tab ───────────────────────────────
function AttritionTab() {
  const [results, setResults]   = useState<AttritionResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ran, setRan]           = useState(false);

  const run = async () => {
    setLoading(true);
    setRan(true);
    try {
      const r = await fetch('/api/ai/attrition');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResults(j.data ?? []);
      showToast(`Analysed ${j.data.length} employees`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Analysis failed', 'error');
    } finally { setLoading(false); }
  };

  const critical = results.filter(r => r.risk_level === 'critical').length;
  const high     = results.filter(r => r.risk_level === 'high').length;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <TrendingDown size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-200 mb-1">AI Attrition Risk Prediction</div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Analyses tenure, attendance patterns, performance ratings, leave usage, and time since last review
              to predict which employees are most likely to resign. Run periodically to proactively retain talent.
            </div>
          </div>
          <Button variant="primary" onClick={run} loading={loading}>
            <Sparkles size={13} /> {ran ? 'Re-analyse' : 'Run Analysis'}
          </Button>
        </div>
      </Card>

      {/* Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(['critical','high','medium','low'] as const).map(level => {
            const count = results.filter(r => r.risk_level === level).length;
            return (
              <div key={level} className={`p-4 rounded-xl border ${RISK_COLORS[level]} text-center`}>
                <div className="text-2xl font-bold font-mono">{count}</div>
                <div className="text-xs capitalize mt-1">{level} risk</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert */}
      {(critical > 0 || high > 0) && (
        <div className="flex items-center gap-2.5 p-3 bg-red-900/20 border border-red-700/30 rounded-xl text-sm text-red-300">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span><strong>{critical + high} employee{critical + high > 1 ? 's' : ''}</strong> at high/critical risk — immediate retention action recommended</span>
        </div>
      )}

      {/* Results list */}
      {loading ? (
        <Card className="p-10 flex flex-col items-center gap-3">
          <Spinner size={32} />
          <div className="text-sm text-slate-400">AI is analysing employee patterns…</div>
          <div className="text-xs text-slate-600">This may take 10-30 seconds</div>
        </Card>
      ) : results.length > 0 ? (
        <Card>
          <div className="divide-y divide-[#2a3a52]">
            {results.map(r => (
              <div key={r.employee_id} className="p-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(expanded === r.employee_id ? null : r.employee_id)}>
                  {/* Risk bar */}
                  <div className="w-16 flex-shrink-0">
                    <div className="h-1.5 bg-[#2a3a52] rounded-full">
                      <div className={`h-1.5 rounded-full ${RISK_BAR[r.risk_level]} transition-all`} style={{ width: `${r.risk_score}%` }} />
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5 text-center">{r.risk_score}%</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{r.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border capitalize ${RISK_COLORS[r.risk_level]}`}>{r.risk_level}</span>
                    </div>
                    <div className="text-xs text-slate-500">{r.job_title} · {r.department}</div>
                  </div>

                  {expanded === r.employee_id ? <ChevronUp size={14} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-500 flex-shrink-0" />}
                </div>

                {expanded === r.employee_id && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="bg-[#1e2d42] rounded-xl p-3">
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Key Risk Factors</div>
                      <ul className="space-y-1">
                        {r.key_factors.map((f, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-amber-400 flex-shrink-0 mt-0.5">▸</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-[#1e2d42] rounded-xl p-3">
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2">Recommendations</div>
                      <ul className="space-y-1">
                        {r.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                            <span className="text-green-400 flex-shrink-0 mt-0.5">✓</span>{rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : ran ? (
        <Card className="p-10 text-center text-slate-500 text-sm">No employees to analyse or no data available yet.</Card>
      ) : null}
    </div>
  );
}

// ─────────────────────────────── Job Description Generator ────────────────────
const DEPTS = ['Engineering','Sales','Marketing','Operations','Finance','HR','Legal','Product'];
const TYPES = ['full-time','part-time','contract','casual'];

function JobGenTab() {
  const [form, setForm]       = useState({ job_title:'', department:'', employment_type:'full-time', salary_range:'', key_responsibilities:'' });
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!form.job_title.trim()) { showToast('Enter a job title', 'error'); return; }
    if (!form.department)       { showToast('Select a department', 'error'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/ai/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setResult(j.description);
      showToast('Job description generated', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Generation failed', 'error');
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    showToast('Copied to clipboard', 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Form */}
      <Card className="p-4 lg:col-span-2">
        <div className="text-xs font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <FileText size={14} /> Generate Job Description
        </div>
        <div className="space-y-3">
          <Input label="Job Title *" value={form.job_title} onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))} placeholder="e.g. Senior Software Engineer" />
          <Select label="Department *" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
            <option value="">Select department</option>
            {DEPTS.map(d => <option key={d}>{d}</option>)}
          </Select>
          <Select label="Employment Type" value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Salary Range (optional)" value={form.salary_range} onChange={e => setForm(p => ({ ...p, salary_range: e.target.value }))} placeholder="e.g. $90,000–$120,000 AUD" />
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">Key Focus Areas (optional)</label>
            <textarea
              value={form.key_responsibilities}
              onChange={e => setForm(p => ({ ...p, key_responsibilities: e.target.value }))}
              placeholder="e.g. React development, team leadership, CI/CD pipelines"
              className="bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y min-h-[80px]"
            />
          </div>
        </div>
        <Button variant="primary" className="w-full mt-4" onClick={generate} loading={loading}>
          <Sparkles size={13} /> Generate with AI
        </Button>
      </Card>

      {/* Result */}
      <Card className="p-4 lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate-300">Generated Job Description</div>
          {result && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={copy}>Copy</Button>
              <Button variant="ghost" size="sm" onClick={generate} loading={loading}>Regenerate</Button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Spinner size={28} />
            <div className="text-sm text-slate-400">AI is crafting your job description…</div>
          </div>
        ) : result ? (
          <div className="prose prose-invert prose-sm max-w-none overflow-y-auto" style={{ maxHeight: 440 }}>
            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{result}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-3">
            <FileText size={36} className="opacity-30" />
            <div className="text-sm">Fill in the form and click Generate</div>
            <div className="text-xs text-slate-700">AI will create a professional, tailored job description</div>
          </div>
        )}
      </Card>
    </div>
  );
}

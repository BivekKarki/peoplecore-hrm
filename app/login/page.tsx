'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { ToastProvider, showToast } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('admin@peoplecore.com');
  const [password, setPassword] = useState('Admin@1234');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? 'Login failed'); return; }
      showToast(`Welcome back, ${j.user.name}!`,'success');
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="min-h-screen bg-[#0f1724] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">P</div>
            <div>
              <div className="text-base font-semibold text-slate-100">PeopleCore</div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">HR Management Suite</div>
            </div>
          </div>

          <div className="bg-[#162030] border border-[#2a3a52] rounded-2xl p-6">
            <h1 className="text-sm font-semibold text-slate-200 mb-1">Sign in to your account</h1>
            <p className="text-xs text-slate-500 mb-5">Enter your HR admin credentials to continue</p>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700/40 rounded-xl text-xs text-red-400">{error}</div>
            )}

            <form onSubmit={login} className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-mono mb-1">Email</label>
                <input
                  type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                  className="w-full bg-[#1e2d42] border border-[#2a3a52] rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                  placeholder="admin@company.com"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-mono mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} required
                    className="w-full bg-[#1e2d42] border border-[#2a3a52] rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={()=>setShowPw(p=>!p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-colors mt-2">
                {loading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</>
                  : <><LogIn size={15}/>Sign In</>
                }
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#2a3a52]">
              <div className="text-xs text-slate-600 font-mono">Demo credentials:</div>
              <div className="text-xs text-slate-500 font-mono mt-1">
                admin@peoplecore.com<br/>Admin@1234
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            PeopleCore HRM · Enterprise Edition · v1.0.0
          </p>
        </div>
      </div>
      <ToastProvider/>
    </>
  );
}

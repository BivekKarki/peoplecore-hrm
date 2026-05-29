'use client';

import { useState, useEffect, useRef } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Badge, showToast } from '@/components/ui';
import { Camera, UserCheck, UserX, Scan } from 'lucide-react';

interface LoginEntry { name: string; time: string; success: boolean; }

const DEMO_NAMES = ['Sarah Kim','James Liu','Priya Mehta','David Chen','Lucas Pham'];

export default function FacialPage() {
  const [scanning, setScanning]   = useState(false);
  const [result, setResult]       = useState<'idle'|'success'|'fail'>('idle');
  const [matchedName, setMatched] = useState('');
  const [history, setHistory]     = useState<LoginEntry[]>([]);
  const [enrolled, setEnrolled]   = useState(DEMO_NAMES);
  const [progress, setProgress]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startScan = () => {
    if (scanning) return;
    setScanning(true);
    setResult('idle');
    setProgress(0);

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timerRef.current) clearInterval(timerRef.current);

          // Defer ALL state updates outside the updater function
          setTimeout(() => {
            const success = Math.random() > 0.2;
            const name    = enrolled[Math.floor(Math.random() * enrolled.length)];
            const timeStr = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

            setResult(success ? 'success' : 'fail');
            setScanning(false);
            setProgress(0);
            if (success) {
              setMatched(name);
              showToast(`Welcome, ${name}!`, 'success');
            } else {
              showToast('Face not recognized', 'error');
            }
            setHistory(prev => [{ name: success ? name : 'Unknown', time: timeStr, success }, ...prev].slice(0, 10));
            setTimeout(() => setResult('idle'), 4000);
          }, 0);

          return 100;
        }
        return p + 2;
      });
    }, 60);
  };

  const removeEnrolled = (name: string) => {
    setEnrolled((prev) => prev.filter((n) => n !== name));
    showToast(`${name} removed from facial recognition`, 'info');
  };

  const enrollNew = () => {
    showToast('Point camera at new employee and capture 3 angles', 'info');
    setTimeout(() => showToast('Face enrolled successfully!', 'success'), 2500);
  };

  const borderColor = result === 'success' ? 'border-green-500' : result === 'fail' ? 'border-red-500' : scanning ? '' : 'border-[#2a3a52]';
  const boxClass = `relative overflow-hidden rounded-xl border-2 ${scanning ? 'scanning-box border-blue-500' : borderColor} bg-[#0f1724] h-52 flex flex-col items-center justify-center gap-3 transition-all duration-300`;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Facial Recognition Login" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto">

          {/* Scanner */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Camera size={14} /> Face Scanner
            </div>

            <div className={boxClass}>
              {/* Corner brackets */}
              <svg className="absolute opacity-30" width="130" height="130" viewBox="0 0 130 130">
                <path d="M5 35 L5 5 L35 5" fill="none" stroke="currentColor" strokeWidth="3"/>
                <path d="M95 5 L125 5 L125 35" fill="none" stroke="currentColor" strokeWidth="3"/>
                <path d="M5 95 L5 125 L35 125" fill="none" stroke="currentColor" strokeWidth="3"/>
                <path d="M95 125 L125 125 L125 95" fill="none" stroke="currentColor" strokeWidth="3"/>
              </svg>

              {/* Scan line */}
              {scanning && (
                <div className="scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent z-10" />
              )}

              {/* Icon / result */}
              {result === 'success' && <UserCheck size={48} className="text-green-400" />}
              {result === 'fail'    && <UserX size={48} className="text-red-400" />}
              {result === 'idle'    && (
                <div className={`text-5xl opacity-${scanning ? '60' : '20'}`}>👤</div>
              )}

              <div className="text-xs text-slate-500 font-mono text-center px-4">
                {scanning        ? 'Scanning… hold still' :
                 result==='success' ? `✓ Identity verified: ${matchedName}` :
                 result==='fail'    ? '✗ Face not recognized' :
                 'Position face within frame'}
              </div>

              {/* Progress */}
              {scanning && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2d42]">
                  <div className="h-1 bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>

            {result === 'success' && (
              <div className="mt-3 p-3 bg-green-900/30 border border-green-700/40 rounded-lg text-sm text-green-300">
                ✓ Logged in as <strong>{matchedName}</strong> — {new Date().toLocaleTimeString()}
              </div>
            )}
            {result === 'fail' && (
              <div className="mt-3 p-3 bg-red-900/30 border border-red-700/40 rounded-lg text-sm text-red-300">
                ✗ Identity not recognized. Please try again or use password login.
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button variant="primary" className="flex-1" onClick={startScan} disabled={scanning}>
                <Scan size={14} /> {scanning ? 'Scanning…' : 'Start Scan'}
              </Button>
              <Button variant="ghost" onClick={enrollNew}>Enroll Face</Button>
            </div>
          </Card>

          {/* Enrolled + History */}
          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
                Enrolled Employees
                <span className="text-slate-500 font-mono font-normal">{enrolled.length} faces</span>
              </div>
              <div className="space-y-2">
                {enrolled.map((name) => (
                  <div key={name} className="flex items-center justify-between p-2.5 bg-[#1e2d42] rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-900/60 flex items-center justify-center text-xs text-blue-300">👤</div>
                      <span className="text-sm text-slate-300">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status="active" label="enrolled" />
                      <button onClick={() => removeEnrolled(name)} className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-900/20">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-semibold text-slate-300 mb-3">Login History</div>
              {history.length === 0 ? (
                <div className="text-xs text-slate-600 text-center py-4">No logins yet today</div>
              ) : (
                <div className="space-y-1.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-[#1e2d42] rounded-lg text-xs">
                      <span className={h.success ? 'text-green-400' : 'text-red-400'}>{h.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">{h.time}</span>
                        <Badge status={h.success ? 'active' : 'inactive'} label={h.success ? '✓ OK' : '✗ Fail'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

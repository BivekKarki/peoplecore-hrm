'use client';

import { useEffect, useState, useRef } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, StatCard } from '@/components/ui';
import { Wifi, WifiOff, Clock, Users, AlertCircle } from 'lucide-react';

interface RealtimeStats {
  present: number; absent: number; late: number;
  wfh: number; on_leave: number; total_active: number;
}

interface RecentCheckin {
  employee_name: string; check_in: string; avatar_color: string;
}

interface SSEPayload {
  stats: RealtimeStats;
  recent_checkins: RecentCheckin[];
  timestamp: string;
}

export default function RealtimePage() {
  const [connected, setConnected]     = useState(false);
  const [stats, setStats]             = useState<RealtimeStats | null>(null);
  const [recent, setRecent]           = useState<RecentCheckin[]>([]);
  const [lastUpdate, setLastUpdate]   = useState<string>('');
  const [pulses, setPulses]           = useState<{ id: number; name: string }[]>([]);
  const [time, setTime]               = useState('');
  const esRef                         = useRef<EventSource | null>(null);
  const pulseIdRef                    = useRef(0);

  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-AU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // SSE connection
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/realtime/attendance');
      esRef.current = es;

      es.addEventListener('attendance', (e: MessageEvent) => {
        const payload: SSEPayload = JSON.parse(e.data);
        setStats(payload.stats);
        setLastUpdate(new Date(payload.timestamp).toLocaleTimeString('en-AU'));

        // Show pulse for new check-ins
        if (payload.recent_checkins.length > 0) {
          const prev = recent.map(r => r.employee_name);
          const newOnes = payload.recent_checkins.filter(c => !prev.includes(c.employee_name));
          newOnes.forEach(c => {
            const id = ++pulseIdRef.current;
            setPulses(p => [...p, { id, name: c.employee_name }]);
            setTimeout(() => setPulses(p => p.filter(x => x.id !== id)), 4000);
          });
        }

        setRecent(payload.recent_checkins);
        setConnected(true);
      });

      es.addEventListener('error', () => {
        setConnected(false);
        es.close();
        // Reconnect after 5s
        setTimeout(connect, 5000);
      });
    };

    connect();
    return () => { esRef.current?.close(); };
  }, []);

  const attendanceRate = stats && stats.total_active > 0
    ? Math.round((stats.present / stats.total_active) * 100)
    : 0;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="Live Attendance Monitor" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* Connection status + clock */}
        <div className="flex items-center justify-between mb-5">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${
            connected
              ? 'bg-green-900/20 border-green-700/30 text-green-400'
              : 'bg-red-900/20 border-red-700/30 text-red-400'
          }`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? `Live · Updated ${lastUpdate}` : 'Reconnecting…'}
          </div>
          <div className="text-2xl font-mono font-semibold text-slate-200 tracking-wider">{time}</div>
        </div>

        {/* Toast pulses for new check-ins */}
        {pulses.length > 0 && (
          <div className="fixed top-16 right-4 z-50 space-y-2 pointer-events-none">
            {pulses.map(p => (
              <div key={p.id} className="bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-xl animate-pulse">
                ✓ {p.name} just clocked in
              </div>
            ))}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Present"     value={stats?.present ?? '—'}    color="#16a34a" icon={<Users size={16}/>} />
          <StatCard label="Late"        value={stats?.late ?? '—'}       color="#d97706" />
          <StatCard label="WFH"         value={stats?.wfh ?? '—'}        color="#2563eb" />
          <StatCard label="On Leave"    value={stats?.on_leave ?? '—'}   color="#7c3aed" />
          <StatCard label="Attendance"  value={`${attendanceRate}%`}     color={attendanceRate >= 85 ? '#16a34a' : attendanceRate >= 70 ? '#d97706' : '#dc2626'} delta="of active staff" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Live gauge */}
          <Card className="p-5 flex flex-col items-center justify-center">
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">Attendance Rate</div>
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e2d42" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={attendanceRate >= 85 ? '#16a34a' : attendanceRate >= 70 ? '#d97706' : '#dc2626'}
                  strokeWidth="12"
                  strokeDasharray={`${(attendanceRate / 100) * 314} 314`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold font-mono text-slate-100">{attendanceRate}%</div>
                <div className="text-xs text-slate-500 mt-1">attendance</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500 text-center">
              {stats?.present ?? 0} of {stats?.total_active ?? 0} active employees
            </div>
          </Card>

          {/* Breakdown bars */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-4">Today's Breakdown</div>
            {stats ? (
              <div className="space-y-3">
                {[
                  { label:'Present',   value: stats.present,   color:'#16a34a', icon:'🟢' },
                  { label:'Late',      value: stats.late,       color:'#d97706', icon:'🟡' },
                  { label:'WFH',       value: stats.wfh,        color:'#2563eb', icon:'🔵' },
                  { label:'On Leave',  value: stats.on_leave,   color:'#7c3aed', icon:'🟣' },
                  { label:'Absent',    value: stats.absent,     color:'#dc2626', icon:'🔴' },
                ].map(row => {
                  const total = stats.total_active || 1;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{row.icon} {row.label}</span>
                        <span className="font-mono text-slate-300">{row.value} <span className="text-slate-600">({Math.round(row.value/total*100)}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-[#1e2d42] rounded-full">
                        <div
                          className="h-1.5 rounded-full transition-all duration-700"
                          style={{ width:`${(row.value/total)*100}%`, background: row.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                <div className="flex items-center gap-2"><AlertCircle size={16} /> Connecting to live feed…</div>
              </div>
            )}
          </Card>

          {/* Recent check-ins */}
          <Card className="p-4">
            <div className="text-xs font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Clock size={13} /> Recent Check-ins
              {connected && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />}
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-600 text-xs gap-2">
                <Clock size={24} className="opacity-20" />
                No recent check-ins (last 5 min)
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 bg-[#1e2d42] rounded-xl">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: `${r.avatar_color}33`, color: r.avatar_color }}
                    >
                      {r.employee_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{r.employee_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Checked in {formatTime(r.check_in)}</div>
                    </div>
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-[#2a3a52] text-[10px] text-slate-600 text-center font-mono">
              Auto-refreshes every 10 seconds via SSE
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

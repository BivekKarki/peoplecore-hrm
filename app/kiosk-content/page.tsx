'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle, Clock, LogIn, LogOut, User, Wifi, WifiOff } from 'lucide-react';

type KioskState = 'idle' | 'scanning' | 'matched' | 'no_match' | 'checked_in' | 'checked_out' | 'error';

interface MatchedEmployee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string;
  job_title: string;
  avatar_color: string;
}

interface Session {
  id: string;
  check_in: string;
  check_out: string | null;
  status: string;
  duration_mins: number | null;
}

export default function KioskPage() {
  const videoRef          = useRef<HTMLVideoElement>(null);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const faceApiRef        = useRef<typeof import('face-api.js') | null>(null);
  const detectionLoopRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState]             = useState<KioskState>('idle');
  const [modelsLoaded, setLoaded]     = useState(false);
  const [faceDetected, setFaceDet]    = useState(false);
  const [employee, setEmployee]       = useState<MatchedEmployee | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [confidence, setConfidence]   = useState(0);
  const [scanning, setScanning]       = useState(false);
  const [time, setTime]               = useState('');
  const [date, setDate]               = useState('');
  const [online, setOnline]           = useState(true);
  const [actionMsg, setActionMsg]     = useState('');

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Online status
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Load models + camera
  useEffect(() => {
    const init = async () => {
      try {
        const api = await import('face-api.js');
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri('/models'),
          api.nets.faceLandmark68Net.loadFromUri('/models'),
          api.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        faceApiRef.current = api;
        setLoaded(true);
        startCamera();
      } catch (err) {
        console.error('Model load failed', err);
        setState('error');
      }
    };
    init();
    return () => { stopCamera(); clearTimers(); };
  }, []);

  // Face detection loop when idle
  useEffect(() => {
    if (!modelsLoaded || state !== 'idle') return;
    detectionLoopRef.current = setInterval(async () => {
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const det = await faceApiRef.current.detectSingleFace(
          videoRef.current,
          new faceApiRef.current.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        );
        setFaceDet(!!det);
      } catch { /* ignore */ }
    }, 500);
    return () => { if (detectionLoopRef.current) clearInterval(detectionLoopRef.current); };
  }, [modelsLoaded, state]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error', err);
      setState('error');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const clearTimers = () => {
    if (detectionLoopRef.current)  clearInterval(detectionLoopRef.current);
    if (resetTimerRef.current)     clearTimeout(resetTimerRef.current);
  };

  const resetToIdle = useCallback((delay = 6000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState('idle');
      setEmployee(null);
      setSession(null);
      setConfidence(0);
      setActionMsg('');
    }, delay);
  }, []);

  const scanFace = async () => {
    if (scanning || !faceApiRef.current || !videoRef.current || !canvasRef.current) return;
    setScanning(true);
    setState('scanning');

    try {
      const api    = faceApiRef.current;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      // Get face descriptor
      const detection = await api
        .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setState('no_match');
        resetToIdle(4000);
        setScanning(false);
        return;
      }

      const descriptorJson = JSON.stringify(Array.from(detection.descriptor));

      // Send to matching API
      const r = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: descriptorJson }),
      });

      const j = await r.json();

      if (!r.ok || !j.matched) {
        setState('no_match');
        resetToIdle(4000);
        setScanning(false);
        return;
      }

      setEmployee(j.employee);
      setSession(j.session);
      setConfidence(j.confidence);
      setState('matched');
    } catch (err) {
      console.error('Scan error', err);
      setState('error');
      resetToIdle(4000);
    } finally {
      setScanning(false);
    }
  };

  const checkIn = async () => {
    if (!employee) return;
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id, device_id: 'kiosk-1' }),
      });
      const j = await r.json();

      if (j.already_checked_in) {
        setActionMsg('You have already checked in today!');
        setState('checked_in');
        setSession(j.session);
      } else if (r.ok) {
        setState('checked_in');
        setSession(j.session);
        setActionMsg('Work session started. Have a great day!');
      } else {
        setActionMsg(j.error ?? 'Check-in failed');
      }
      resetToIdle(8000);
    } catch {
      setActionMsg('Network error. Please try again.');
      resetToIdle(4000);
    }
  };

  const checkOut = async () => {
    if (!employee) return;
    try {
      const r = await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employee.id }),
      });
      const j = await r.json();
      if (r.ok) {
        setState('checked_out');
        setActionMsg(`Great work today! You worked ${j.duration}.`);
        setSession(j.session);
      } else {
        setActionMsg(j.error ?? 'Check-out failed');
      }
      resetToIdle(8000);
    } catch {
      setActionMsg('Network error. Please try again.');
      resetToIdle(4000);
    }
  };

  const isAlreadyCheckedIn = session?.status === 'active';

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  const initials = employee
    ? `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase()
    : '';

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0f1724] border-b border-[#1e2d42]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
          <div>
            <div className="text-sm font-semibold text-slate-100">PeopleCore</div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Attendance Kiosk</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-slate-100 font-mono tracking-wider">{time}</div>
          <div className="text-xs text-slate-500">{date}</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          {online
            ? <><Wifi size={14} className="text-green-400" /><span className="text-green-400">Online</span></>
            : <><WifiOff size={14} className="text-red-400" /><span className="text-red-400">Offline</span></>
          }
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6 gap-8">

        {/* Camera panel */}
        <div className="flex flex-col items-center gap-4" style={{ flex: '0 0 480px' }}>
          <div className="relative w-full rounded-2xl overflow-hidden bg-black border-2 border-[#1e2d42]"
               style={{ aspectRatio: '4/3' }}>
            <video ref={videoRef} className="w-full h-full object-cover"
                   muted playsInline style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} className="hidden" />

            {/* Corner brackets */}
            {state === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative" style={{ width: 200, height: 200 }}>
                  {[
                    { cls: 'top-0 left-0', b: 'border-t-2 border-l-2 rounded-tl-xl' },
                    { cls: 'top-0 right-0', b: 'border-t-2 border-r-2 rounded-tr-xl' },
                    { cls: 'bottom-0 left-0', b: 'border-b-2 border-l-2 rounded-bl-xl' },
                    { cls: 'bottom-0 right-0', b: 'border-b-2 border-r-2 rounded-br-xl' },
                  ].map(({ cls, b }, i) => (
                    <div key={i} className={`absolute w-10 h-10 ${cls} ${b} ${
                      faceDetected ? 'border-green-400' : 'border-blue-500'
                    } transition-colors duration-300`} />
                  ))}
                </div>
              </div>
            )}

            {/* Scanning overlay */}
            {state === 'scanning' && (
              <div className="absolute inset-0 bg-blue-900/20 flex items-center justify-center">
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-[scanMove_1.5s_linear_infinite]"
                     style={{ animation: 'scanMove 1.5s linear infinite' }} />
                <div className="text-blue-300 text-sm font-mono animate-pulse">Scanning…</div>
              </div>
            )}

            {/* Match overlay */}
            {(state === 'matched' || state === 'checked_in' || state === 'checked_out') && (
              <div className="absolute inset-0 bg-green-900/30 flex items-center justify-center">
                <CheckCircle size={64} className="text-green-400" />
              </div>
            )}

            {/* No match overlay */}
            {state === 'no_match' && (
              <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2">🚫</div>
                  <div className="text-red-300 text-sm font-mono">Face not recognized</div>
                </div>
              </div>
            )}

            {/* Face status badge */}
            {state === 'idle' && (
              <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono backdrop-blur-sm border ${
                faceDetected
                  ? 'bg-green-900/70 text-green-300 border-green-600/40'
                  : 'bg-slate-900/70 text-slate-400 border-slate-600/40'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${faceDetected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                {faceDetected ? 'Face detected — ready to scan' : 'Position face in frame'}
              </div>
            )}

            {/* Confidence badge */}
            {state === 'matched' && confidence > 0 && (
              <div className="absolute top-3 right-3 bg-green-900/80 border border-green-600/40 px-2.5 py-1 rounded-lg text-xs font-mono text-green-300 backdrop-blur-sm">
                {confidence}% match
              </div>
            )}
          </div>

          {/* Models loading */}
          {!modelsLoaded && (
            <div className="text-xs text-blue-400 font-mono animate-pulse text-center">
              Loading face recognition models…
            </div>
          )}

          {/* Scan button */}
          {(state === 'idle') && modelsLoaded && (
            <button
              onClick={scanFace}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl text-base transition-colors"
              style={{ fontSize: 16 }}
            >
              <Camera size={20} />
              {scanning ? 'Scanning Face…' : faceDetected ? 'Scan My Face' : 'Show Face & Scan'}
            </button>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="w-full text-center p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
              <div className="text-red-400 text-sm">Camera or model error. Please refresh.</div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 360px' }}>

          {/* Idle state */}
          {state === 'idle' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-[#1e2d42] rounded-full flex items-center justify-center mx-auto mb-5">
                <User size={40} className="text-slate-600" />
              </div>
              <div className="text-xl font-semibold text-slate-300 mb-2">Welcome</div>
              <div className="text-sm text-slate-500 leading-relaxed">
                Look at the camera and press<br />
                <span className="text-blue-400 font-medium">Scan My Face</span> to clock in or out
              </div>
              <div className="mt-6 p-3 bg-[#1e2d42] rounded-xl border border-[#2a3a52]">
                <div className="text-xs text-slate-500 font-mono mb-2">HOW IT WORKS</div>
                <div className="space-y-2 text-left">
                  {[
                    { n: '1', t: 'Stand in front of the kiosk' },
                    { n: '2', t: 'Look at the camera' },
                    { n: '3', t: 'Click "Scan My Face"' },
                    { n: '4', t: 'Confirm to start or end shift' },
                  ].map(s => (
                    <div key={s.n} className="flex items-center gap-2.5 text-xs text-slate-400">
                      <div className="w-5 h-5 bg-blue-600/30 text-blue-400 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold">{s.n}</div>
                      {s.t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Scanning */}
          {state === 'scanning' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-blue-900/30 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
                <Camera size={36} className="text-blue-400" />
              </div>
              <div className="text-lg font-semibold text-blue-300">Scanning…</div>
              <div className="text-sm text-slate-500 mt-2">Hold still, please</div>
            </div>
          )}

          {/* No match */}
          {state === 'no_match' && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">😕</div>
              <div className="text-lg font-semibold text-red-400 mb-2">Not Recognized</div>
              <div className="text-sm text-slate-500">Face not found in system.<br />Please ensure you are enrolled.</div>
              <div className="mt-4 text-xs text-slate-600">Resetting in a moment…</div>
            </div>
          )}

          {/* Matched — show employee and action buttons */}
          {state === 'matched' && employee && (
            <div>
              {/* Employee card */}
              <div className="p-5 bg-[#162030] border border-green-700/30 rounded-2xl mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                       style={{ backgroundColor: employee.avatar_color }}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-slate-100">
                      {employee.first_name} {employee.last_name}
                    </div>
                    <div className="text-sm text-slate-400">{employee.job_title}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{employee.department} · {employee.employee_id}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#1e2d42] rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-500 font-mono mb-1">TODAY</div>
                    <div className="text-sm font-semibold text-slate-200">{new Date().toLocaleDateString('en-AU', { day:'numeric', month:'short' })}</div>
                  </div>
                  <div className="bg-[#1e2d42] rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-500 font-mono mb-1">STATUS</div>
                    <div className={`text-sm font-semibold ${isAlreadyCheckedIn ? 'text-green-400' : 'text-slate-400'}`}>
                      {isAlreadyCheckedIn ? `Since ${formatTime(session!.check_in)}` : 'Not checked in'}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono text-center mb-3">
                  Match confidence: {confidence}%
                </div>

                {/* Action buttons */}
                {isAlreadyCheckedIn ? (
                  <button
                    onClick={checkOut}
                    className="w-full flex items-center justify-center gap-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
                  >
                    <LogOut size={20} /> End Shift
                  </button>
                ) : (
                  <button
                    onClick={checkIn}
                    className="w-full flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-base transition-colors"
                  >
                    <LogIn size={20} /> Start Work
                  </button>
                )}
              </div>

              <button onClick={() => { setState('idle'); setEmployee(null); setSession(null); }}
                className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-2">
                Not you? Cancel
              </button>
            </div>
          )}

          {/* Checked in success */}
          {state === 'checked_in' && employee && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-green-900/30 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={36} className="text-green-400" />
              </div>
              <div className="text-xl font-semibold text-green-400 mb-1">
                Welcome, {employee.first_name}!
              </div>
              <div className="text-sm text-slate-400 mb-2">{actionMsg}</div>
              {session?.check_in && (
                <div className="inline-block bg-[#1e2d42] border border-[#2a3a52] rounded-xl px-4 py-2.5 mt-2">
                  <div className="text-xs text-slate-500 font-mono">CHECKED IN AT</div>
                  <div className="text-2xl font-semibold text-slate-100 font-mono mt-1">{formatTime(session.check_in)}</div>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                <Clock size={12} /> Resetting in a moment…
              </div>
            </div>
          )}

          {/* Checked out success */}
          {state === 'checked_out' && employee && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-amber-900/30 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={36} className="text-amber-400" />
              </div>
              <div className="text-xl font-semibold text-amber-400 mb-1">
                Goodbye, {employee.first_name}!
              </div>
              <div className="text-sm text-slate-400 mb-3">{actionMsg}</div>
              {session && (
                <div className="bg-[#1e2d42] border border-[#2a3a52] rounded-xl p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Started</span>
                    <span className="font-mono text-slate-300">{formatTime(session.check_in)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Finished</span>
                    <span className="font-mono text-slate-300">{session.check_out ? formatTime(session.check_out) : '—'}</span>
                  </div>
                  {session.duration_mins && (
                    <div className="flex justify-between text-sm border-t border-[#2a3a52] pt-2 mt-2">
                      <span className="text-slate-400 font-medium">Total Time</span>
                      <span className="font-mono font-semibold text-green-400">
                        {Math.floor(session.duration_mins / 60)}h {Math.round(session.duration_mins % 60)}m
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-2 text-[10px] text-slate-700 font-mono border-t border-[#1e2d42]">
        PeopleCore Kiosk · Face data is processed locally · Data is encrypted
      </div>
    </div>
  );
}

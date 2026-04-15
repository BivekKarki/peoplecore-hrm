'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle, Clock, LogIn, LogOut, Wifi, WifiOff, Eye } from 'lucide-react';

type KioskState = 'idle' | 'liveness' | 'scanning' | 'matched' | 'no_match' | 'checked_in' | 'checked_out' | 'error';

interface MatchedEmployee {
  id: string; employee_id: string; first_name: string;
  last_name: string; department: string; job_title: string; avatar_color: string;
}

interface Session {
  id: string; check_in: string; check_out: string | null;
  status: string; duration_mins: number | null;
}

interface LivenessState {
  blinkDetected: boolean;
  progress: number;
  confidence: number;
  message: string;
  frameCount: number;
  earHistory: number[];
}

const LIVENESS_MIN_FRAMES = 40;
const EAR_BLINK_THRESHOLD = 0.22;
const LEFT_EYE  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];

function calcEAR(pts: { x: number; y: number }[]): number {
  const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
  const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
  const h  = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
  return (v1 + v2) / (2 * h + 1e-6);
}

export default function KioskPage() {
  const videoRef         = useRef<HTMLVideoElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const faceApiRef       = useRef<typeof import('face-api.js') | null>(null);
  const detectionRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const livenessRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkCountRef    = useRef(0);
  const frameCountRef    = useRef(0);
  const prevEarRef       = useRef(1);

  const [state, setState]         = useState<KioskState>('idle');
  const [modelsLoaded, setLoaded] = useState(false);
  const [faceVisible, setFaceVis] = useState(false);
  const [employee, setEmployee]   = useState<MatchedEmployee | null>(null);
  const [session, setSession]     = useState<Session | null>(null);
  const [confidence, setConf]     = useState(0);
  const [scanning, setScanning]   = useState(false);
  const [time, setTime]           = useState('');
  const [date, setDate]           = useState('');
  const [online, setOnline]       = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [liveness, setLiveness]   = useState<LivenessState>({
    blinkDetected: false, progress: 0, confidence: 0,
    message: 'Look at camera and blink naturally', frameCount: 0, earHistory: [],
  });

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
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  // Load face-api.js models + start camera
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
        await startCamera();
      } catch (err) {
        console.error('Model/camera init failed', err);
        setState('error');
      }
    };
    init();
    return () => { stopAll(); };
  }, []);

  // Idle face detection loop
  useEffect(() => {
    if (!modelsLoaded || state !== 'idle') return;
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const det = await faceApiRef.current.detectSingleFace(
          videoRef.current,
          new faceApiRef.current.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 })
        );
        setFaceVis(!!det);
      } catch { /* ignore */ }
    }, 400);
    return () => { if (detectionRef.current) clearInterval(detectionRef.current); };
  }, [modelsLoaded, state]);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  };

  const stopAll = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    [detectionRef, livenessRef].forEach(r => { if (r.current) clearInterval(r.current); });
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const resetToIdle = useCallback((delay = 7000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState('idle');
      setEmployee(null);
      setSession(null);
      setConf(0);
      setActionMsg('');
      blinkCountRef.current = 0;
      frameCountRef.current = 0;
      prevEarRef.current = 1;
      setLiveness({ blinkDetected: false, progress: 0, confidence: 0, message: 'Look at camera and blink naturally', frameCount: 0, earHistory: [] });
    }, delay);
  }, []);

  // Start liveness check
  const startLiveness = () => {
    if (!faceApiRef.current || state !== 'idle') return;
    blinkCountRef.current = 0;
    frameCountRef.current = 0;
    prevEarRef.current = 1;
    setState('liveness');

    livenessRef.current = setInterval(async () => {
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const det = await faceApiRef.current
          .detectSingleFace(videoRef.current, new faceApiRef.current.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks();

        if (!det) {
          setLiveness(p => ({ ...p, message: '⚠ No face detected — position yourself in frame' }));
          return;
        }

        frameCountRef.current++;
        const pts = det.landmarks.positions;

        // Compute EAR for both eyes
        const leftPts  = LEFT_EYE.map(i  => pts[i]);
        const rightPts = RIGHT_EYE.map(i => pts[i]);
        const ear      = (calcEAR(leftPts) + calcEAR(rightPts)) / 2;

        // Detect blink: EAR drops below threshold from above
        const prevEar = prevEarRef.current;
        if (prevEar > EAR_BLINK_THRESHOLD && ear <= EAR_BLINK_THRESHOLD) {
          blinkCountRef.current++;
        }
        prevEarRef.current = ear;

        const fc          = frameCountRef.current;
        const blinkDetected = blinkCountRef.current >= 1;
        const progress    = Math.min(100, Math.round((fc / LIVENESS_MIN_FRAMES) * 100));

        let confidence = 0;
        if (blinkDetected) confidence += 60;
        if (fc >= 20)      confidence += 20;
        if (fc >= LIVENESS_MIN_FRAMES) confidence += 20;

        const message = !blinkDetected
          ? `👁 Blink naturally (${blinkCountRef.current}/1 blinks detected)`
          : fc < LIVENESS_MIN_FRAMES
          ? `✓ Blink detected — hold still (${progress}%)`
          : '✓ Liveness verified — scanning face…';

        setLiveness({ blinkDetected, progress, confidence, message, frameCount: fc, earHistory: [] });

        // All checks passed — proceed to face recognition
        if (blinkDetected && fc >= LIVENESS_MIN_FRAMES) {
          if (livenessRef.current) clearInterval(livenessRef.current);
          await performFaceScan();
        }
      } catch (err) {
        console.error('[Liveness]', err);
      }
    }, 150); // 150ms = ~6fps for liveness
  };

  const performFaceScan = async () => {
    if (!faceApiRef.current || !videoRef.current || !canvasRef.current || scanning) return;
    setScanning(true);
    setState('scanning');

    try {
      const api    = faceApiRef.current;
      const video  = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);

      const detection = await api
        .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setState('no_match');
        resetToIdle(4000);
        return;
      }

      const descriptorJson = JSON.stringify(Array.from(detection.descriptor));
      const r = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: descriptorJson }),
      });
      const j = await r.json();

      if (!r.ok || !j.matched) {
        setState('no_match');
        resetToIdle(5000);
        return;
      }

      setEmployee(j.employee);
      setSession(j.session);
      setConf(j.confidence);
      setState('matched');
    } catch (err) {
      console.error('[Scan]', err);
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
        setActionMsg('Already checked in today!');
        setState('checked_in');
        setSession(j.session);
      } else if (r.ok) {
        setState('checked_in');
        setSession(j.session);
        setActionMsg('Work session started. Have a great day!');
      } else {
        setActionMsg(j.error ?? 'Check-in failed');
      }
      resetToIdle(9000);
    } catch { setActionMsg('Network error. Please try again.'); resetToIdle(4000); }
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
      resetToIdle(9000);
    } catch { setActionMsg('Network error.'); resetToIdle(4000); }
  };

  const isCheckedIn = session?.status === 'active';
  const initials    = employee ? `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase() : '';
  const fmtT        = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  // Liveness progress bar color
  const livenessColor = liveness.blinkDetected
    ? liveness.progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
    : 'bg-amber-500';

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col select-none" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#0f1724] border-b border-[#1e2d42]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">P</div>
          <div>
            <div className="text-sm font-semibold text-slate-100">PeopleCore</div>
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Attendance Kiosk</div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono font-semibold text-slate-100 tracking-wider">{time}</div>
          <div className="text-xs text-slate-500">{date}</div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          {online
            ? <><Wifi size={13} className="text-green-400" /><span className="text-green-400">Online</span></>
            : <><WifiOff size={13} className="text-red-400" /><span className="text-red-400">Offline</span></>
          }
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6 gap-8">

        {/* Camera panel */}
        <div className="flex flex-col items-center gap-4" style={{ flex: '0 0 480px' }}>
          <div className="relative w-full rounded-2xl overflow-hidden bg-black border-2 border-[#1e2d42]" style={{ aspectRatio: '4/3' }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={canvasRef} className="hidden" />

            {/* Corner brackets */}
            {(state === 'idle' || state === 'liveness') && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative" style={{ width: 200, height: 200 }}>
                  {[
                    { pos: 'top-0 left-0',     border: 'border-t-2 border-l-2 rounded-tl-xl' },
                    { pos: 'top-0 right-0',    border: 'border-t-2 border-r-2 rounded-tr-xl' },
                    { pos: 'bottom-0 left-0',  border: 'border-b-2 border-l-2 rounded-bl-xl' },
                    { pos: 'bottom-0 right-0', border: 'border-b-2 border-r-2 rounded-br-xl' },
                  ].map(({ pos, border }, i) => (
                    <div key={i} className={`absolute w-10 h-10 ${pos} ${border} transition-colors duration-300 ${
                      state === 'liveness' && liveness.blinkDetected ? 'border-green-400' :
                      state === 'liveness' ? 'border-amber-400' :
                      faceVisible ? 'border-green-400' : 'border-blue-500'
                    }`} />
                  ))}
                </div>
              </div>
            )}

            {/* Liveness progress overlay */}
            {state === 'liveness' && (
              <div className="absolute inset-x-0 bottom-0">
                <div className="bg-black/60 px-4 py-3">
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Eye size={12} className={liveness.blinkDetected ? 'text-green-400' : 'text-amber-400'} />
                      Anti-Spoofing Check
                    </span>
                    <span className="font-mono">{liveness.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1e2d42] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${livenessColor}`}
                         style={{ width: `${liveness.progress}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5 text-center">{liveness.message}</div>
                </div>
              </div>
            )}

            {/* Scanning overlay */}
            {state === 'scanning' && (
              <div className="absolute inset-0 bg-blue-900/30 flex items-center justify-center">
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                     style={{ animation: 'scanMove 1.5s linear infinite', top: '50%' }} />
                <div className="text-blue-300 text-sm font-mono animate-pulse mt-8">Identifying…</div>
              </div>
            )}

            {/* Match overlay */}
            {(state === 'matched' || state === 'checked_in' || state === 'checked_out') && (
              <div className="absolute inset-0 bg-green-900/20 flex items-center justify-center">
                <CheckCircle size={64} className="text-green-400" />
              </div>
            )}

            {/* No match */}
            {state === 'no_match' && (
              <div className="absolute inset-0 bg-red-900/30 flex flex-col items-center justify-center gap-2">
                <div className="text-4xl">😕</div>
                <div className="text-red-300 text-sm font-mono">Not recognized</div>
              </div>
            )}

            {/* Face detection badge */}
            {state === 'idle' && (
              <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono backdrop-blur-sm border ${
                faceVisible
                  ? 'bg-green-900/70 text-green-300 border-green-600/40'
                  : 'bg-slate-900/70 text-slate-400 border-slate-600/40'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${faceVisible ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
                {faceVisible ? 'Face detected' : 'Position face in frame'}
              </div>
            )}

            {/* Liveness badge */}
            {state === 'liveness' && liveness.blinkDetected && (
              <div className="absolute top-3 right-3 bg-green-900/80 border border-green-600/40 px-2.5 py-1 rounded-lg text-xs font-mono text-green-300 backdrop-blur-sm">
                ✓ Blink verified
              </div>
            )}

            {/* Confidence badge */}
            {state === 'matched' && (
              <div className="absolute top-3 right-3 bg-green-900/80 border border-green-600/40 px-2.5 py-1 rounded-lg text-xs font-mono text-green-300 backdrop-blur-sm">
                {confidence}% match
              </div>
            )}
          </div>

          {/* Loading state */}
          {!modelsLoaded && (
            <div className="text-xs text-blue-400 font-mono animate-pulse text-center">
              Loading face recognition models…
            </div>
          )}

          {/* Main action button */}
          {state === 'idle' && modelsLoaded && (
            <button onClick={startLiveness} disabled={scanning}
              className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-base transition-colors">
              <Eye size={20} />
              {faceVisible ? 'Start Verification' : 'Show Face & Verify'}
            </button>
          )}

          {state === 'liveness' && (
            <button onClick={() => { if (livenessRef.current) clearInterval(livenessRef.current); setState('idle'); }}
              className="w-full py-3 rounded-xl bg-[#1e2d42] border border-[#2a3a52] text-slate-400 text-sm hover:text-slate-200 transition-colors">
              Cancel
            </button>
          )}

          {state === 'error' && (
            <div className="w-full p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-sm text-red-400 text-center">
              Camera or model error — please refresh the page
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 360px' }}>

          {/* Idle */}
          {state === 'idle' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-[#1e2d42] rounded-full flex items-center justify-center mx-auto mb-5">
                <Camera size={40} className="text-slate-600" />
              </div>
              <div className="text-xl font-semibold text-slate-300 mb-2">Welcome</div>
              <div className="text-sm text-slate-500 leading-relaxed mb-6">
                Look at the camera and press<br />
                <span className="text-blue-400 font-medium">Start Verification</span> to clock in or out
              </div>
              <div className="p-3 bg-[#1e2d42] rounded-xl border border-[#2a3a52] text-left">
                <div className="text-xs text-slate-500 font-mono mb-2 uppercase tracking-wider">Security Features</div>
                <div className="space-y-2">
                  {[
                    { icon:'👁', label:'Liveness detection', desc:'Blink verification prevents photo spoofing' },
                    { icon:'🔍', label:'128-dim face matching', desc:'AI matches your face descriptor' },
                    { icon:'🔒', label:'Encrypted storage', desc:'Face data stored securely in database' },
                  ].map(f => (
                    <div key={f.label} className="flex items-start gap-2 text-xs">
                      <span className="text-base">{f.icon}</span>
                      <div>
                        <div className="text-slate-300 font-medium">{f.label}</div>
                        <div className="text-slate-600">{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Liveness check */}
          {state === 'liveness' && (
            <div className="text-center py-8">
              <div className={`w-24 h-24 border-2 rounded-full flex items-center justify-center mx-auto mb-5 transition-colors ${
                liveness.blinkDetected ? 'bg-green-900/30 border-green-500' : 'bg-amber-900/30 border-amber-500'
              }`}>
                <Eye size={40} className={liveness.blinkDetected ? 'text-green-400' : 'text-amber-400'} />
              </div>
              <div className="text-lg font-semibold text-slate-200 mb-2">Anti-Spoofing Check</div>
              <div className="text-sm text-slate-400 mb-4">{liveness.message}</div>
              <div className="space-y-3 text-left">
                {[
                  { done: liveness.blinkDetected, label: 'Natural blink detected' },
                  { done: liveness.progress >= 50, label: 'Motion analysis complete' },
                  { done: liveness.progress >= 100, label: 'Liveness confirmed' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      step.done ? 'bg-green-600 text-white' : 'bg-[#2a3a52] text-slate-500'
                    }`}>{step.done ? '✓' : i + 1}</div>
                    <span className={step.done ? 'text-green-300' : 'text-slate-500'}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanning */}
          {state === 'scanning' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-blue-900/30 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
                <Camera size={36} className="text-blue-400" />
              </div>
              <div className="text-lg font-semibold text-blue-300">Identifying…</div>
              <div className="text-sm text-slate-500 mt-2">Matching face against database</div>
            </div>
          )}

          {/* No match */}
          {state === 'no_match' && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">😕</div>
              <div className="text-lg font-semibold text-red-400 mb-2">Not Recognized</div>
              <div className="text-sm text-slate-500">Face not found in system.<br />Ensure you are enrolled by HR.</div>
              <div className="mt-4 text-xs text-slate-600">Resetting in a moment…</div>
            </div>
          )}

          {/* Matched */}
          {state === 'matched' && employee && (
            <div>
              <div className="p-5 bg-[#162030] border border-green-700/30 rounded-2xl mb-3">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                       style={{ backgroundColor: employee.avatar_color }}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-slate-100">{employee.first_name} {employee.last_name}</div>
                    <div className="text-sm text-slate-400">{employee.job_title}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{employee.department} · {employee.employee_id}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#1e2d42] rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-500 font-mono mb-1">TODAY</div>
                    <div className="text-sm font-semibold text-slate-200">
                      {new Date().toLocaleDateString('en-AU', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <div className="bg-[#1e2d42] rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-500 font-mono mb-1">STATUS</div>
                    <div className={`text-sm font-semibold ${isCheckedIn ? 'text-green-400' : 'text-slate-400'}`}>
                      {isCheckedIn && session ? `Since ${fmtT(session.check_in)}` : 'Not checked in'}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono text-center mb-3">
                  Match confidence: {confidence}% · Liveness: ✓ Verified
                </div>

                {isCheckedIn ? (
                  <button onClick={checkOut}
                    className="w-full flex items-center justify-center gap-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-xl text-base transition-colors">
                    <LogOut size={20} /> End Shift
                  </button>
                ) : (
                  <button onClick={checkIn}
                    className="w-full flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-base transition-colors">
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

          {/* Checked in */}
          {state === 'checked_in' && employee && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-green-900/30 border-2 border-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={36} className="text-green-400" />
              </div>
              <div className="text-xl font-semibold text-green-400 mb-1">Welcome, {employee.first_name}!</div>
              <div className="text-sm text-slate-400 mb-3">{actionMsg}</div>
              {session?.check_in && (
                <div className="inline-block bg-[#1e2d42] border border-[#2a3a52] rounded-xl px-4 py-2.5">
                  <div className="text-xs text-slate-500 font-mono">CHECKED IN AT</div>
                  <div className="text-2xl font-semibold text-slate-100 font-mono mt-1">{fmtT(session.check_in)}</div>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                <Clock size={12} /> Resetting shortly…
              </div>
            </div>
          )}

          {/* Checked out */}
          {state === 'checked_out' && employee && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-amber-900/30 border-2 border-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={36} className="text-amber-400" />
              </div>
              <div className="text-xl font-semibold text-amber-400 mb-1">Goodbye, {employee.first_name}!</div>
              <div className="text-sm text-slate-400 mb-3">{actionMsg}</div>
              {session && (
                <div className="bg-[#1e2d42] border border-[#2a3a52] rounded-xl p-4 text-left space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Started</span>
                    <span className="font-mono text-slate-300">{fmtT(session.check_in)}</span>
                  </div>
                  {session.check_out && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Finished</span>
                      <span className="font-mono text-slate-300">{fmtT(session.check_out)}</span>
                    </div>
                  )}
                  {session.duration_mins && (
                    <div className="flex justify-between text-sm border-t border-[#2a3a52] pt-2">
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

      <div className="text-center py-2 text-[10px] text-slate-700 font-mono border-t border-[#1e2d42]">
        PeopleCore Kiosk · Liveness Detection Active · Face data is encrypted
      </div>

      <style jsx global>{`
        @keyframes scanMove { 0% { top: 10%; } 100% { top: 90%; } }
      `}</style>
    </div>
  );
}

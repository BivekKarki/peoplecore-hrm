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

const LEFT_EYE  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE = [42, 43, 44, 45, 46, 47];
const LIVENESS_FRAMES = 25;
const EAR_THRESHOLD   = 0.28;

function calcEAR(pts: { x: number; y: number }[]): number {
  const v1 = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
  const v2 = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
  const h  = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
  return (v1 + v2) / (2 * h + 1e-6);
}

export default function KioskPage() {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const faceApiRef      = useRef<typeof import('@vladmandic/face-api') | null>(null);
  const detectionRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const livenessRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const resetTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkCountRef   = useRef(0);
  const frameCountRef   = useRef(0);
  const prevEarRef      = useRef(1);

  const [state, setState]           = useState<KioskState>('idle');
  const [modelsLoaded, setLoaded]   = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [faceVisible, setFaceVis]   = useState(false);
  const [employee, setEmployee]     = useState<MatchedEmployee | null>(null);
  const [session, setSession]       = useState<Session | null>(null);
  const [confidence, setConf]       = useState(0);
  const [scanning, setScanning]     = useState(false);
  const [time, setTime]             = useState('');
  const [date, setDate]             = useState('');
  const [online, setOnline]         = useState(true);
  const [actionMsg, setActionMsg]   = useState('');
  const [blinkCount, setBlinkCount] = useState(0);
  const [livenessProgress, setLivenessProgress] = useState(0);

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(n.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(n.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Online
  useEffect(() => {
    window.addEventListener('online',  () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
  }, []);

  // Load models + camera
  useEffect(() => {
    const init = async () => {
      try {
        const api = await import('@vladmandic/face-api');
        const res = await fetch('/models/tiny_face_detector_model-weights_manifest.json');
        if (!res.ok) throw new Error('Model files missing. Run: node scripts/download-models.js');
        const manifest = await res.json();
        if (!manifest || !Array.isArray(manifest)) throw new Error('Model files are empty. Run: node scripts/download-models.js');
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri('/models'),
          api.nets.faceLandmark68Net.loadFromUri('/models'),
          api.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        faceApiRef.current = api;
        setLoaded(true);
        await startCamera();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load models';
        console.error('[Kiosk init]', msg);
        setModelError(msg);
        setState('error');
      }
    };
    init();
    return () => stopAll();
  }, []);

  // Face detection loop while idle
  useEffect(() => {
    if (!modelsLoaded || state !== 'idle') return;
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const det = await faceApiRef.current.detectSingleFace(
            videoRef.current,
            new faceApiRef.current.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        );
        setFaceVis(!!det);
      } catch { /* ignore */ }
    }, 400);
    return () => { if (detectionRef.current) clearInterval(detectionRef.current); };
  }, [modelsLoaded, state]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.onloadedmetadata = async () => {
        try {
          await video.play();
          console.log('Camera started:', video.videoWidth, video.videoHeight);
        } catch (err) {
          console.error('Video play failed:', err);
        }
      };
    } catch (err) {
      console.error('Camera error:', err);
      setModelError('Camera permission denied or camera not available');
      setState('error');
    }
  };

  const stopAll = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    [detectionRef, livenessRef].forEach(r => { if (r.current) clearInterval(r.current); });
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  };

  const resetToIdle = useCallback((delay = 8000) => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setState('idle');
      setEmployee(null);
      setSession(null);
      setConf(0);
      setActionMsg('');
      blinkCountRef.current = 0;
      frameCountRef.current = 0;
      prevEarRef.current    = 1;
      setBlinkCount(0);
      setLivenessProgress(0);
    }, delay);
  }, []);

  // Start liveness check → then face scan
  const startLiveness = () => {
    if (!faceApiRef.current || state !== 'idle') return;
    blinkCountRef.current = 0;
    frameCountRef.current = 0;
    prevEarRef.current    = 1;
    setBlinkCount(0);
    setLivenessProgress(0);
    setState('liveness');

    livenessRef.current = setInterval(async () => {
      if (!videoRef.current || !faceApiRef.current) return;
      try {
        const det = await faceApiRef.current
            .detectSingleFace(videoRef.current, new faceApiRef.current.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
            .withFaceLandmarks();

        if (!det) return;

        frameCountRef.current++;
        const pts = det.landmarks.positions;

        const leftEAR  = calcEAR(LEFT_EYE.map(i => pts[i]));
        const rightEAR = calcEAR(RIGHT_EYE.map(i => pts[i]));
        const ear      = (leftEAR + rightEAR) / 2;
        const prevEar  = prevEarRef.current;

        // Detect blink two ways — catches both slow and fast blinks
        const droppedBelow    = ear < EAR_THRESHOLD;
        const significantDrop = (prevEar - ear) > 0.06 && prevEar > 0.20;

        if ((droppedBelow || significantDrop) && prevEar > EAR_THRESHOLD) {
          blinkCountRef.current++;
          setBlinkCount(blinkCountRef.current);
        }
        prevEarRef.current = ear;

        const progress = Math.min(100, Math.round((frameCountRef.current / LIVENESS_FRAMES) * 100));
        setLivenessProgress(progress);

        if (blinkCountRef.current >= 1 && frameCountRef.current >= LIVENESS_FRAMES) {
          if (livenessRef.current) clearInterval(livenessRef.current);
          await performFaceScan();
        }
      } catch (err) { console.error('[Liveness]', err); }
    }, 80);
  };

  const skipLiveness = async () => {
    if (livenessRef.current) clearInterval(livenessRef.current);
    blinkCountRef.current = LIVENESS_FRAMES;
    frameCountRef.current = LIVENESS_FRAMES;
    await performFaceScan();
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
          .detectSingleFace(video, new api.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

      if (!detection) {
        setState('no_match');
        resetToIdle(5000);
        return;
      }

      const descriptor = JSON.stringify(Array.from(detection.descriptor));
      const r = await fetch('/api/face-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor }),
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
        setActionMsg('You have already checked in today!');
        setState('checked_in');
        setSession(j.session);
      } else if (r.ok) {
        setState('checked_in');
        setSession(j.session);
        setActionMsg('Work session started. Have a great day! 🎉');
      } else {
        setActionMsg(j.error ?? 'Check-in failed');
      }
      resetToIdle(10000);
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
        setActionMsg(`Great work! You worked ${j.duration}.`);
        setSession(j.session);
      } else {
        setActionMsg(j.error ?? 'Check-out failed');
      }
      resetToIdle(10000);
    } catch {
      setActionMsg('Network error.');
      resetToIdle(4000);
    }
  };

  const isCheckedIn = session?.status === 'active';
  const initials    = employee ? `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase() : '';
  const fmtT        = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });

  const borderColor = state === 'liveness'
      ? (blinkCount >= 1 ? '#16a34a' : '#d97706')
      : state === 'scanning' ? '#2563eb'
          : (state === 'matched' || state === 'checked_in' || state === 'checked_out') ? '#16a34a'
              : state === 'no_match' ? '#dc2626'
                  : faceVisible ? '#16a34a' : '#2a3a52';

  return (
      <div
          style={{
            minHeight: '100dvh',
            height: '100dvh',
            overflowY: 'auto',
            backgroundColor: '#0a0f1a',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            userSelect: 'none',
          }}
      >
        {/* Header */}
        <div className="kiosk-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', backgroundColor: '#0f1724', borderBottom: '1px solid #1e2d42' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, backgroundColor: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>P</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>PeopleCore</div>
              <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Attendance Kiosk</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="kiosk-clock" style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{time}</div>
            <div className="kiosk-date" style={{ fontSize: 11, color: '#64748b' }}>{date}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'monospace' }}>
            {online
                ? <><Wifi size={13} style={{ color: '#4ade80' }} /><span style={{ color: '#4ade80' }}>Online</span></>
                : <><WifiOff size={13} style={{ color: '#f87171' }} /><span style={{ color: '#f87171' }}>Offline</span></>
            }
          </div>
        </div>

        {/* Body */}
        <div className="kiosk-body">

          {/* Camera panel */}
          <div className="kiosk-camera-panel">
            <div style={{ position: 'relative', width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', border: `2px solid ${borderColor}`, aspectRatio: '4/3', transition: 'border-color .3s' }}>
              <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Corner brackets */}
              {(state === 'idle' || state === 'liveness') && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ position: 'relative', width: 180, height: 180 }}>
                      {[
                        { top: 0,    left: 0,    borderTop:    `2px solid ${borderColor}`, borderLeft:   `2px solid ${borderColor}`, borderRadius: '8px 0 0 0' },
                        { top: 0,    right: 0,   borderTop:    `2px solid ${borderColor}`, borderRight:  `2px solid ${borderColor}`, borderRadius: '0 8px 0 0' },
                        { bottom: 0, left: 0,    borderBottom: `2px solid ${borderColor}`, borderLeft:   `2px solid ${borderColor}`, borderRadius: '0 0 0 8px' },
                        { bottom: 0, right: 0,   borderBottom: `2px solid ${borderColor}`, borderRight:  `2px solid ${borderColor}`, borderRadius: '0 0 8px 0' },
                      ].map((s, i) => (
                          <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s, transition: 'border-color .3s' }} />
                      ))}
                    </div>
                  </div>
              )}

              {/* Scan line */}
              {state === 'scanning' && (
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#2563eb,transparent)', animation: 'scanMove 1.5s linear infinite' }} />
              )}

              {/* Success overlay */}
              {(state === 'matched' || state === 'checked_in' || state === 'checked_out') && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={64} style={{ color: '#4ade80' }} />
                  </div>
              )}

              {/* No match overlay */}
              {state === 'no_match' && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(220,38,38,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: 40 }}>😕</span>
                    <span style={{ color: '#fca5a5', fontSize: 13, fontFamily: 'monospace' }}>Not recognized</span>
                  </div>
              )}

              {/* Face detected badge */}
              {state === 'idle' && (
                  <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', backdropFilter: 'blur(4px)', backgroundColor: faceVisible ? 'rgba(20,83,45,0.8)' : 'rgba(15,23,36,0.8)', border: `1px solid ${faceVisible ? '#166534' : '#334155'}`, color: faceVisible ? '#86efac' : '#94a3b8' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: faceVisible ? '#4ade80' : '#64748b', animation: faceVisible ? 'pulse 2s infinite' : 'none' }} />
                    {faceVisible ? 'Face detected — ready' : 'Position face in frame'}
                  </div>
              )}

              {/* Liveness progress bar */}
              {state === 'liveness' && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Eye size={11} /> Anti-spoofing check
                    </span>
                        <span style={{ fontFamily: 'monospace' }}>{livenessProgress}%</span>
                      </div>
                      <div style={{ height: 4, backgroundColor: '#1e293b', borderRadius: 2 }}>
                        <div style={{ height: 4, borderRadius: 2, transition: 'width .15s', backgroundColor: blinkCount >= 1 ? '#16a34a' : '#d97706', width: `${livenessProgress}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
                        {blinkCount < 1
                            ? `👁 Please blink naturally (${blinkCount}/1 detected)`
                            : livenessProgress < 100
                                ? '✓ Blink detected — verifying…'
                                : '✓ Liveness confirmed — scanning face…'
                        }
                      </div>
                    </div>
                  </div>
              )}

              {/* Confidence badge */}
              {state === 'matched' && confidence > 0 && (
                  <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(20,83,45,0.9)', border: '1px solid #166534', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#86efac' }}>
                    {confidence}% match
                  </div>
              )}
            </div>

            {/* Loading */}
            {!modelsLoaded && state !== 'error' && (
                <div style={{ fontSize: 12, color: '#60a5fa', fontFamily: 'monospace', animation: 'pulse 2s infinite' }}>
                  Loading face recognition models…
                </div>
            )}

            {/* Start button */}
            {state === 'idle' && modelsLoaded && (
                <button onClick={startLiveness}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'background .15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1d4ed8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#2563eb'}
                >
                  <Eye size={20} />
                  {faceVisible ? 'Start Verification' : 'Show Face & Verify'}
                </button>
            )}

            {/* Liveness buttons */}
            {state === 'liveness' && (
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button
                      onClick={() => { if (livenessRef.current) clearInterval(livenessRef.current); setState('idle'); }}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, backgroundColor: 'transparent', border: '1px solid #2a3a52', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                      onClick={skipLiveness}
                      style={{ flex: 1, padding: '12px', borderRadius: 12, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
                  >
                    Skip blink check
                  </button>
                </div>
            )}

            {/* Error */}
            {state === 'error' && (
                <div style={{ width: '100%', padding: 16, backgroundColor: '#7f1d1d22', border: '1px solid #991b1b', borderRadius: 12, fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
                  {modelError ?? 'Camera error — please refresh'}
                  {modelError?.includes('download-models') && (
                      <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace', color: '#f87171' }}>
                        Run: node scripts/download-models.js
                      </div>
                  )}
                </div>
            )}
          </div>

          {/* Info panel */}
          <div className="kiosk-info-panel">

            {/* Idle */}
            {state === 'idle' && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 80, height: 80, backgroundColor: '#1e2d42', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Camera size={36} style={{ color: '#475569' }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Welcome</div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 24 }}>
                    Look at the camera and press<br />
                    <span style={{ color: '#60a5fa', fontWeight: 500 }}>Start Verification</span> to clock in or out
                  </div>
                  <div style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                    <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>How it works</div>
                    {[
                      { n: '1', t: 'Stand in front of the kiosk' },
                      { n: '2', t: 'Look directly at the camera' },
                      { n: '3', t: 'Blink naturally when prompted' },
                      { n: '4', t: 'Confirm to start or end your shift' },
                    ].map(s => (
                        <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 12, color: '#94a3b8' }}>
                          <div style={{ width: 20, height: 20, backgroundColor: '#1e3a8a33', color: '#60a5fa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
                          {s.t}
                        </div>
                    ))}
                  </div>
                </div>
            )}

            {/* Liveness */}
            {state === 'liveness' && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 80, height: 80, backgroundColor: blinkCount >= 1 ? '#14532d22' : '#78350f22', border: `2px solid ${blinkCount >= 1 ? '#16a34a' : '#d97706'}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', transition: 'all .3s' }}>
                    <Eye size={36} style={{ color: blinkCount >= 1 ? '#4ade80' : '#fcd34d' }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>Anti-Spoofing Check</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
                    {blinkCount < 1 ? 'Close your eyes fully then open — blink naturally' : 'Blink verified — processing…'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                    {[
                      { done: blinkCount >= 1,         label: 'Natural blink detected' },
                      { done: livenessProgress >= 50,  label: 'Motion analysis complete' },
                      { done: livenessProgress >= 100, label: 'Liveness confirmed' },
                    ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: s.done ? '#16a34a' : '#1e2d42', border: `1px solid ${s.done ? '#16a34a' : '#2a3a52'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: s.done ? '#fff' : '#64748b', flexShrink: 0 }}>
                            {s.done ? '✓' : i + 1}
                          </div>
                          <span style={{ color: s.done ? '#86efac' : '#64748b' }}>{s.label}</span>
                        </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 20, padding: 12, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10, fontSize: 11, color: '#475569' }}>
                    💡 Tip: Close your eyes completely then open. Still not working? Tap <strong style={{ color: '#64748b' }}>Skip blink check</strong>.
                  </div>
                </div>
            )}

            {/* Scanning */}
            {state === 'scanning' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ width: 80, height: 80, backgroundColor: '#1e3a8a22', border: '2px solid #2563eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'pulse 1.5s infinite' }}>
                    <Camera size={36} style={{ color: '#60a5fa' }} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#93c5fd' }}>Identifying…</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Matching face against database</div>
                </div>
            )}

            {/* No match */}
            {state === 'no_match' && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Not Recognized</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Face not found in system.<br />Ensure you are enrolled by HR.</div>
                  <div style={{ marginTop: 16, fontSize: 12, color: '#334155' }}>Resetting in a moment…</div>
                </div>
            )}

            {/* Matched */}
            {state === 'matched' && employee && (
                <div>
                  <div style={{ backgroundColor: '#162030', border: '1px solid #166534', borderRadius: 20, padding: 20, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: employee.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>{employee.first_name} {employee.last_name}</div>
                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{employee.job_title}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{employee.department} · {employee.employee_id}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                      <div style={{ backgroundColor: '#1e2d42', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Today</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                          {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div style={{ backgroundColor: '#1e2d42', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isCheckedIn ? '#4ade80' : '#94a3b8' }}>
                          {isCheckedIn && session ? `Since ${fmtT(session.check_in)}` : 'Not checked in'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', textAlign: 'center', marginBottom: 14 }}>
                      Match: {confidence}% · Liveness: ✓ Verified
                    </div>
                    {isCheckedIn ? (
                        <button onClick={checkOut}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: 12, padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#b45309'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#d97706'}
                        >
                          <LogOut size={20} /> End Shift
                        </button>
                    ) : (
                        <button onClick={checkIn}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#15803d'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#16a34a'}
                        >
                          <LogIn size={20} /> Start Work
                        </button>
                    )}
                  </div>
                  <button onClick={() => { setState('idle'); setEmployee(null); setSession(null); }}
                          style={{ width: '100%', fontSize: 12, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' }}>
                    Not you? Cancel
                  </button>
                </div>
            )}

            {/* Checked in */}
            {state === 'checked_in' && employee && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 72, height: 72, backgroundColor: '#14532d22', border: '2px solid #16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <CheckCircle size={32} style={{ color: '#4ade80' }} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>Welcome, {employee.first_name}!</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{actionMsg}</div>
                  {session?.check_in && (
                      <div style={{ display: 'inline-block', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 12, padding: '12px 24px' }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>Checked in at</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>{fmtT(session.check_in)}</div>
                      </div>
                  )}
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
                    <Clock size={11} /> Resetting shortly…
                  </div>
                </div>
            )}

            {/* Checked out */}
            {state === 'checked_out' && employee && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 72, height: 72, backgroundColor: '#78350f22', border: '2px solid #d97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <LogOut size={32} style={{ color: '#fcd34d' }} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#fcd34d', marginBottom: 6 }}>Goodbye, {employee.first_name}!</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{actionMsg}</div>
                  {session && (
                      <div style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                        {[
                          { label: 'Started',  value: fmtT(session.check_in) },
                          { label: 'Finished', value: session.check_out ? fmtT(session.check_out) : '—' },
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                              <span style={{ color: '#64748b' }}>{row.label}</span>
                              <span style={{ fontFamily: 'monospace', color: '#e2e8f0' }}>{row.value}</span>
                            </div>
                        ))}
                        {session.duration_mins && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 10, borderTop: '1px solid #2a3a52', marginTop: 4 }}>
                              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Total Time</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>
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
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, color: '#1e293b', fontFamily: 'monospace', borderTop: '1px solid #1e2d42' }}>
          PeopleCore Kiosk · Liveness Detection Active · Face data encrypted
        </div>

        <style>{`
  @keyframes scanMove { 0% { top: 10%; } 100% { top: 90%; } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .kiosk-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    gap: 32px;
    overflow-y: auto;
  }

  .kiosk-camera-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: min(480px, 100%);
    flex-shrink: 0;
  }

  .kiosk-info-panel {
    width: min(360px, 100%);
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .kiosk-body {
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 16px;
      gap: 16px;
      overflow-y: visible;
    }

    .kiosk-camera-panel,
    .kiosk-info-panel {
      width: 100%;
      max-width: 480px;
    }
  }

  @media (max-width: 500px) {
    .kiosk-body {
      padding: 12px;
      gap: 12px;
    }

    .kiosk-header {
      padding: 10px 14px !important;
    }

    .kiosk-header .kiosk-clock {
      font-size: 18px !important;
    }

    .kiosk-header .kiosk-date {
      font-size: 9px !important;
    }
  }

  /* Phone landscape fix */
  @media (max-height: 500px) and (orientation: landscape) {
    .kiosk-body {
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      padding: 10px;
      gap: 12px;
      overflow-y: visible;
    }

    .kiosk-camera-panel {
      width: min(42vw, 360px);
      gap: 8px;
    }

    .kiosk-info-panel {
      width: min(42vw, 340px);
    }

    .kiosk-header {
      padding: 6px 14px !important;
    }

    .kiosk-header .kiosk-clock {
      font-size: 16px !important;
    }

    .kiosk-header .kiosk-date {
      display: none;
    }

    .kiosk-camera-panel button {
      padding: 10px 14px !important;
      font-size: 13px !important;
    }
  }
`}</style>
      </div>
  );
}
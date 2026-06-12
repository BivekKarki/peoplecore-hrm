'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Spinner, showToast } from '@/components/ui';
import {
  Camera, CheckCircle2, XCircle, Clock, LogIn, LogOut,
  RefreshCw, ShieldCheck, User, Building, Mail, Briefcase,
  AlertTriangle,
} from 'lucide-react';

type Mode = 'login' | 'verify';
type Status = 'loading_models' | 'starting_camera' | 'ready' | 'scanning' | 'matched' | 'no_match' | 'processing' | 'done' | 'error';

interface MatchedEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string;
  department: string;
  avatar_color: string;
  status: string;
  confidence: number;
  // Active work session info (if any)
  active_session?: {
    id: string;
    check_in: string;
    minutes_elapsed: number;
  };
}

export default function FacialPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [mode, setMode]         = useState<Mode>('login');
  const [status, setStatus]     = useState<Status>('loading_models');
  const [statusMsg, setMsg]     = useState('Loading face recognition models…');
  const [matched, setMatched]   = useState<MatchedEmployee | null>(null);
  const [autoScan, setAutoScan] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ── 1. Load face-api models ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      try {
        setStatus('loading_models');
        setMsg('Loading face recognition models…');
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        await startCamera();
      } catch (err) {
        console.error('Model load error:', err);
        setStatus('error');
        setMsg('Failed to load face recognition models. Run: node scripts/download-models.js');
      }
    };
    loadModels();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Camera control ───────────────────────────────────────────────────────
  const startCamera = async () => {
    setStatus('starting_camera');
    setMsg('Starting camera…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setMsg('Camera requires HTTPS or localhost. Use https:// or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
      setMsg('Position face in frame');
    } catch (err) {
      console.error('Camera error:', err);
      setStatus('error');
      setMsg('Camera permission denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  // ── 3. Capture frame & detect face ──────────────────────────────────────────
  const detectFace = useCallback(async (): Promise<Float32Array | null> => {
    if (!videoRef.current) return null;
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
    const detection = await faceapi
        .detectSingleFace(videoRef.current, opts)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) return null;

    // Draw overlay for visual feedback
    if (canvasRef.current && videoRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width  = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const box = detection.detection.box;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth   = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
    }
    return detection.descriptor;
  }, []);

  // ── 4. Match against database ───────────────────────────────────────────────
  const matchFace = async (descriptor: Float32Array) => {
    setStatus('processing');
    setMsg('Identifying employee…');
    try {
      const r = await fetch('/api/face-match', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ descriptor: Array.from(descriptor) }),
      });
      const j = await r.json();
      if (j.matched && j.employee) {
        const emp = j.employee as MatchedEmployee;

        // For Login mode, fetch the active work session (if any)
        if (mode === 'login') {
          try {
            const sRes = await fetch(`/api/sessions?employee_id=${emp.id}&date=today`);
            const sJson = await sRes.json();
            const active = (sJson.data ?? []).find((s: { check_in: string; check_out: string | null }) => s.check_in && !s.check_out);
            if (active) {
              const mins = Math.floor((Date.now() - new Date(active.check_in).getTime()) / 60000);
              emp.active_session = { id: active.id, check_in: active.check_in, minutes_elapsed: mins };
            }
          } catch { /* ignore — show employee anyway */ }
        }

        setMatched(emp);
        setStatus('matched');
        setMsg(`Identified: ${emp.first_name} ${emp.last_name}`);
        setAutoScan(false); // stop auto-scanning once matched
      } else {
        setMatched(null);
        setStatus('no_match');
        setMsg('Face not recognised. Try again or check enrollment.');
        setTimeout(() => { if (autoScan) setStatus('ready'); }, 3000);
      }
    } catch (err) {
      console.error('Match error:', err);
      setStatus('error');
      setMsg('Identification failed. Check connection.');
    }
  };

  // ── 5. Auto-scan loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoScan || status !== 'ready') {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }
    scanIntervalRef.current = setInterval(async () => {
      if (status !== 'ready') return;
      const desc = await detectFace();
      if (desc) {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        await matchFace(desc);
      }
    }, 1500);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan, status, detectFace, mode]);

  // ── 6. Actions: Clock In / Out / Reset ─────────────────────────────────────
  const clockIn = async () => {
    if (!matched) return;
    setActionLoading(true);
    try {
      const r = await fetch('/api/sessions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employee_id: matched.id, method: 'facial' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast(`✓ ${matched.first_name} clocked in`, 'success');
      setStatus('done');
      setMsg(`${matched.first_name} clocked in successfully`);
      setTimeout(reset, 4000);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Clock-in failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const clockOut = async () => {
    if (!matched?.active_session) return;
    setActionLoading(true);
    try {
      const r = await fetch('/api/sessions', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ session_id: matched.active_session.id, method: 'facial' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const hrs = (matched.active_session.minutes_elapsed / 60).toFixed(1);
      showToast(`✓ ${matched.first_name} clocked out — ${hrs}h worked`, 'success');
      setStatus('done');
      setMsg(`${matched.first_name} clocked out after ${hrs} hours`);
      setTimeout(reset, 4000);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Clock-out failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const reset = () => {
    setMatched(null);
    setStatus('ready');
    setMsg('Position face in frame');
    setAutoScan(true);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  // ── 7. Status styles ────────────────────────────────────────────────────────
  const statusColor = {
    loading_models:  '#64748b',
    starting_camera: '#64748b',
    ready:           '#60a5fa',
    scanning:        '#fbbf24',
    matched:         '#4ade80',
    no_match:        '#f87171',
    processing:      '#a78bfa',
    done:            '#4ade80',
    error:           '#f87171',
  }[status];

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Facial Recognition" action={
          <Button variant="ghost" onClick={reset}>
            <RefreshCw size={14} /> Reset
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 10, padding: 4, maxWidth: 500 }}>
            {[
              { id: 'login',  label: 'Clock In / Out',     icon: LogIn,        desc: 'Backup attendance' },
              { id: 'verify', label: 'Identity Verification', icon: ShieldCheck, desc: 'Verify enrollment' },
            ].map(t => {
              const active = mode === t.id;
              const Icon   = t.icon;
              return (
                  <button key={t.id} onClick={() => switchMode(t.id as Mode)}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: active ? '#2563eb' : 'transparent',
                            color: active ? '#fff' : '#94a3b8',
                            transition: 'all .15s',
                          }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <Icon size={14} /> {t.label}
                    </div>
                    <div style={{ fontSize: 10, color: active ? '#bfdbfe' : '#64748b' }}>{t.desc}</div>
                  </button>
              );
            })}
          </div>

          {/* Main layout */}
          <div className="facial-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: 16,
          }}>

            {/* ── Camera panel ─────────────────────────────────── */}
            <Card style={{ padding: 16 }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', backgroundColor: '#0f1724', borderRadius: 10, overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay muted playsInline
                       style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />

                {/* Scanning overlay */}
                {(status === 'ready' || status === 'scanning') && (
                    <>
                      <div style={{
                        position: 'absolute', top: '15%', left: '20%', width: '60%', height: '70%',
                        border: '2px dashed rgba(96,165,250,0.4)', borderRadius: 16, pointerEvents: 'none',
                      }} />
                      <div style={{
                        position: 'absolute', left: '20%', width: '60%', height: 2,
                        backgroundColor: '#60a5fa', boxShadow: '0 0 12px #60a5fa',
                        animation: 'scanLine 2s ease-in-out infinite alternate',
                        pointerEvents: 'none',
                      }} />
                    </>
                )}

                {/* Loading overlay */}
                {(status === 'loading_models' || status === 'starting_camera' || status === 'processing') && (
                    <div style={{
                      position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,36,0.85)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                    }}>
                      <Spinner size={36} />
                      <div style={{ fontSize: 13, color: '#94a3b8' }}>{statusMsg}</div>
                    </div>
                )}

                {/* Status badge */}
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8,
                  backgroundColor: 'rgba(15,23,36,0.85)',
                  border: `1px solid ${statusColor}66`,
                  color: statusColor,
                  fontSize: 11, fontFamily: 'monospace',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor, animation: status === 'scanning' || status === 'ready' ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                  {statusMsg}
                </div>

                {/* Confidence badge */}
                {matched && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      padding: '6px 12px', borderRadius: 8,
                      backgroundColor: 'rgba(15,23,36,0.85)',
                      border: '1px solid #166534',
                      color: '#86efac',
                      fontSize: 11, fontFamily: 'monospace',
                    }}>
                      Match: {Math.round((1 - matched.confidence) * 100)}%
                    </div>
                )}
              </div>

              {/* Manual capture button */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                {status === 'ready' && (
                    <Button variant="ghost" onClick={async () => {
                      setAutoScan(false);
                      const d = await detectFace();
                      if (d) await matchFace(d);
                      else { setStatus('no_match'); setMsg('No face detected — try again'); setTimeout(reset, 2500); }
                    }}>
                      <Camera size={14} /> Capture Now
                    </Button>
                )}
              </div>
            </Card>

            {/* ── Result panel ─────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Mode info card */}
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {mode === 'login' ? '🕐 Clock In / Out Mode' : '🛡 Identity Verification'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                  {mode === 'login'
                      ? 'Use this as a backup when the kiosk is unavailable. Each clock-in/out is recorded as a work session with method "facial".'
                      : 'Verify an employee\'s enrollment quality, or confirm someone\'s identity for security purposes. No attendance is recorded.'}
                </div>
              </Card>

              {/* Result */}
              {status === 'matched' && matched ? (
                  <Card style={{ padding: 18 }}>
                    {/* Employee header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        backgroundColor: `${matched.avatar_color}33`,
                        color: matched.avatar_color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, flexShrink: 0,
                        border: `2px solid ${matched.avatar_color}`,
                      }}>
                        {matched.first_name[0]}{matched.last_name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>
                          {matched.first_name} {matched.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{matched.job_title}</div>
                      </div>
                      <CheckCircle2 size={20} style={{ color: '#4ade80', flexShrink: 0 }} />
                    </div>

                    {/* Profile details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {[
                        { icon: Building, label: 'Department', value: matched.department },
                        { icon: Mail,     label: 'Email',      value: matched.email },
                        { icon: Briefcase,label: 'Status',     value: matched.status },
                      ].map(d => (
                          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <d.icon size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ color: '#64748b', fontFamily: 'monospace', minWidth: 80 }}>{d.label}</span>
                            <span style={{ color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.value}</span>
                          </div>
                      ))}
                    </div>

                    {/* Mode A — Clock In/Out actions */}
                    {mode === 'login' && (
                        <>
                          {matched.active_session ? (
                              <div style={{ padding: '12px 14px', backgroundColor: '#14532d22', border: '1px solid #166534', borderRadius: 10, marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#86efac', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>
                                  🟢 Currently on shift
                                </div>
                                <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                                  Clocked in {Math.floor(matched.active_session.minutes_elapsed / 60)}h {matched.active_session.minutes_elapsed % 60}m ago
                                </div>
                              </div>
                          ) : (
                              <div style={{ padding: '12px 14px', backgroundColor: '#1e3a8a22', border: '1px solid #1e40af', borderRadius: 10, marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 4 }}>
                                  Ready to start
                                </div>
                                <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                                  No active shift today
                                </div>
                              </div>
                          )}

                          <div style={{ display: 'flex', gap: 8 }}>
                            {matched.active_session ? (
                                <Button variant="danger" onClick={clockOut} loading={actionLoading} style={{ flex: 1 }}>
                                  <LogOut size={14} /> Clock Out
                                </Button>
                            ) : (
                                <Button variant="success" onClick={clockIn} loading={actionLoading} style={{ flex: 1 }}>
                                  <LogIn size={14} /> Clock In
                                </Button>
                            )}
                            <Button variant="ghost" onClick={reset}>Cancel</Button>
                          </div>
                        </>
                    )}

                    {/* Mode B — Verification info */}
                    {mode === 'verify' && (
                        <>
                          <div style={{ padding: '12px 14px', backgroundColor: '#14532d22', border: '1px solid #166534', borderRadius: 10, marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <ShieldCheck size={13} style={{ color: '#4ade80' }} />
                              <div style={{ fontSize: 11, color: '#86efac', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                                Identity confirmed
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                              Face matched with {Math.round((1 - matched.confidence) * 100)}% confidence — enrollment is working correctly.
                            </div>
                          </div>
                          <Button variant="primary" onClick={reset} style={{ width: '100%' }}>
                            <RefreshCw size={13} /> Verify Another
                          </Button>
                        </>
                    )}
                  </Card>

              ) : status === 'no_match' ? (
                  <Card style={{ padding: 18, textAlign: 'center' }}>
                    <XCircle size={36} style={{ color: '#f87171', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', marginBottom: 6 }}>Not Recognised</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
                      No matching employee found. This person may not be enrolled, or lighting/angle conditions are poor.
                    </div>
                    <Button variant="ghost" onClick={reset} style={{ width: '100%' }}>
                      <RefreshCw size={13} /> Try Again
                    </Button>
                  </Card>

              ) : status === 'done' ? (
                  <Card style={{ padding: 18, textAlign: 'center' }}>
                    <CheckCircle2 size={36} style={{ color: '#4ade80', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#86efac', marginBottom: 6 }}>Success</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{statusMsg}</div>
                    <div style={{ marginTop: 12, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                      Resetting in a moment…
                    </div>
                  </Card>

              ) : status === 'error' ? (
                  <Card style={{ padding: 18, textAlign: 'center' }}>
                    <AlertTriangle size={36} style={{ color: '#fbbf24', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fcd34d', marginBottom: 6 }}>Error</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>{statusMsg}</div>
                    <Button variant="ghost" onClick={() => window.location.reload()} style={{ width: '100%' }}>
                      Reload Page
                    </Button>
                  </Card>

              ) : (
                  <Card style={{ padding: 24, textAlign: 'center' }}>
                    <Clock size={32} style={{ color: '#475569', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Waiting for face…
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>
                      Look into the camera and stay still
                    </div>
                  </Card>
              )}

              {/* Tips */}
              <Card style={{ padding: 12 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 8 }}>
                  💡 Tips
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
                  <li>Face the camera directly with good lighting</li>
                  <li>Remove glasses if recognition fails</li>
                  <li>Stay within the dashed frame</li>
                  <li>Stay still during capture</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>

        <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
        @keyframes scanLine {
          0%   { top: 18%; }
          100% { top: 80%; }
        }
        @media (max-width: 900px) {
          .facial-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      </div>
  );
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle, AlertCircle, RotateCcw, User } from 'lucide-react';
import { showToast } from '@/components/ui';

interface FaceEnrollmentProps {
  employeeId: string;
  employeeName: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

type Angle = 'front' | 'left' | 'right';
type StepStatus = 'pending' | 'capturing' | 'done' | 'error';

interface Step {
  angle: Angle;
  label: string;
  instruction: string;
  icon: string;
}

const STEPS: Step[] = [
  { angle: 'front', label: 'Front',      instruction: 'Look straight at the camera',    icon: '😐' },
  { angle: 'left',  label: 'Left Side',  instruction: 'Slowly turn your head LEFT 45°', icon: '👈' },
  { angle: 'right', label: 'Right Side', instruction: 'Slowly turn your head RIGHT 45°',icon: '👉' },
];

export default function FaceEnrollment({ employeeId, employeeName, onComplete, onSkip }: FaceEnrollmentProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [faceApi, setFaceApi]         = useState<typeof import('@vladmandic/face-api') | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraOn, setCameraOn]       = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [statuses, setStatuses]       = useState<Record<Angle, StepStatus>>({ front:'pending', left:'pending', right:'pending' });
  const [descriptors, setDescriptors] = useState<Record<Angle, string | null>>({ front:null, left:null, right:null });
  const [capturing, setCapturing]     = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [enrolled, setEnrolled]       = useState(false);
  const detectionLoopRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load face-api models
  useEffect(() => {
    const load = async () => {
      try {
        const api = await import('@vladmandic/face-api');
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri('/models'),
          api.nets.faceLandmark68Net.loadFromUri('/models'),
          api.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setFaceApi(api);
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models', err);
        showToast('Failed to load face recognition models', 'error');
      }
    };
    load();
    return () => { stopCamera(); };
  }, []);

  // Face detection loop
  useEffect(() => {
    if (!modelsLoaded || !cameraOn || !faceApi) return;

    detectionLoopRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const detection = await faceApi.detectSingleFace(
          videoRef.current,
          new faceApi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        );
        setFaceDetected(!!detection);
      } catch { /* ignore */ }
    }, 300);

    return () => { if (detectionLoopRef.current) clearInterval(detectionLoopRef.current); };
  }, [modelsLoaded, cameraOn, faceApi]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load before playing
        await new Promise<void>(resolve => {
          videoRef.current!.onloadedmetadata = () => resolve();
        });
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      showToast('Camera access denied. Please allow camera permissions.', 'error');
      console.error(err);
    }
  };

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.muted = true;
    video.playsInline = true;

    const playVideo = async () => {
      try {
        await video.play();
        console.log('Camera playing:', video.videoWidth, video.videoHeight);
      } catch (err) {
        console.error('Video play failed:', err);
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.onloadedmetadata = playVideo;
    }

    return () => {
      video.onloadedmetadata = null;
    };
  }, [cameraOn]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const captureAngle = async () => {
    if (!videoRef.current || !canvasRef.current || !faceApi || capturing) return;

    const step = STEPS[currentStep];
    setCapturing(true);
    setStatuses(p => ({ ...p, [step.angle]: 'capturing' }));

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      // Detect face and compute descriptor
      const detection = await faceApi
        .detectSingleFace(video, new faceApi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatuses(p => ({ ...p, [step.angle]: 'error' }));
        showToast('No face detected. Make sure your face is clearly visible.', 'error');
        setCapturing(false);
        return;
      }

      // Store the 128-dim descriptor as JSON string
      const descriptorJson = JSON.stringify(Array.from(detection.descriptor));
      setDescriptors(p => ({ ...p, [step.angle]: descriptorJson }));
      setStatuses(p => ({ ...p, [step.angle]: 'done' }));
      showToast(`${step.label} captured successfully!`, 'success');

      // Move to next step
      if (currentStep < STEPS.length - 1) {
        setTimeout(() => setCurrentStep(s => s + 1), 800);
      }
    } catch (err) {
      console.error('Capture error', err);
      setStatuses(p => ({ ...p, [step.angle]: 'error' }));
      showToast('Capture failed. Please try again.', 'error');
    } finally {
      setCapturing(false);
    }
  };

  const retakeAngle = (angle: Angle) => {
    const stepIdx = STEPS.findIndex(s => s.angle === angle);
    setCurrentStep(stepIdx);
    setStatuses(p => ({ ...p, [angle]: 'pending' }));
    setDescriptors(p => ({ ...p, [angle]: null }));
  };

  const saveEnrollment = async () => {
    if (!descriptors.front || !descriptors.left || !descriptors.right) {
      showToast('Please capture all three angles first', 'error');
      return;
    }

    setSaving(true);
    try {
      const r = await fetch(`/api/employees/${employeeId}/face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptor_front: descriptors.front,
          descriptor_left:  descriptors.left,
          descriptor_right: descriptors.right,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.error);

      setEnrolled(true);
      stopCamera();
      showToast(`Face enrollment complete for ${employeeName}!`, 'success');
      onComplete?.();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Enrollment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const allCaptured = descriptors.front && descriptors.left && descriptors.right;

  if (enrolled) {
    return (
      <div className="text-center py-10">
        <CheckCircle className="text-green-400 mx-auto mb-3" size={52} />
        <div className="text-lg font-semibold text-slate-100 mb-1">Face Enrolled!</div>
        <div className="text-sm text-slate-400">{employeeName} can now use facial recognition to clock in.</div>
      </div>
    );
  }

  const step = STEPS[currentStep];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-xl">
        <User size={18} className="text-blue-400 flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-slate-200">Enrolling: {employeeName}</div>
          <div className="text-xs text-slate-400">Capture 3 face angles for accurate recognition</div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => {
          const st = statuses[s.angle];
          return (
            <div key={s.angle} className="flex-1">
              <div className={`p-2.5 rounded-xl border text-center transition-all ${
                i === currentStep
                  ? 'border-blue-500 bg-blue-900/20'
                  : st === 'done'
                  ? 'border-green-600/40 bg-green-900/20'
                  : st === 'error'
                  ? 'border-red-600/40 bg-red-900/20'
                  : 'border-[#2a3a52] bg-[#1e2d42]'
              }`}>
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-xs font-medium text-slate-300">{s.label}</div>
                <div className="text-[10px] mt-1 font-mono">
                  {st === 'done'    && <span className="text-green-400">✓ Done</span>}
                  {st === 'error'   && <span className="text-red-400">✗ Retry</span>}
                  {st === 'pending' && <span className="text-slate-500">Pending</span>}
                  {st === 'capturing' && <span className="text-blue-400">...</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Camera */}
      {!cameraOn ? (
        <div className="bg-[#0f1724] border-2 border-dashed border-[#2a3a52] rounded-xl h-48 flex flex-col items-center justify-center gap-3">
          <Camera size={36} className="text-slate-600" />
          <div className="text-sm text-slate-500">Camera not started</div>
          {!modelsLoaded
            ? <div className="text-xs text-blue-400 animate-pulse">Loading face recognition models…</div>
            : <button onClick={startCamera} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Camera size={14} /> Start Camera
              </button>
          }
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black border-2 border-[#2a3a52]" style={{ aspectRatio:'4/3' }}>
          {/*<video ref={videoRef} className="w-full h-full object-cover" muted playsInline style={{ transform:'scaleX(-1)' }} />*/}
          <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Face detection indicator */}
          <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono backdrop-blur-sm ${
            faceDetected ? 'bg-green-900/70 text-green-300 border border-green-600/40' : 'bg-red-900/70 text-red-300 border border-red-600/40'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${faceDetected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {faceDetected ? 'Face detected' : 'No face detected'}
          </div>

          {/* Corner brackets overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 relative">
              {[
                'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 ${cls} ${faceDetected ? 'border-green-400' : 'border-blue-400'} transition-colors`} />
              ))}
            </div>
          </div>

          {/* Current instruction */}
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <div className="inline-block bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
              <div className="text-xs text-slate-200">{step.instruction}</div>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {cameraOn && (
        <div className="flex gap-2">
          {statuses[step.angle] === 'error' || statuses[step.angle] === 'done' ? (
            <button
              onClick={() => retakeAngle(step.angle)}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1e2d42] border border-[#2a3a52] hover:bg-[#243548] text-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw size={14} /> Retake {step.label}
            </button>
          ) : (
            <button
              onClick={captureAngle}
              disabled={!faceDetected || capturing || !modelsLoaded}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Camera size={14} />
              {capturing ? 'Capturing…' : `Capture ${step.label}`}
            </button>
          )}
        </div>
      )}

      {/* Save enrollment */}
      {allCaptured && (
        <div className="pt-2 border-t border-[#2a3a52]">
          <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/30 rounded-xl mb-3">
            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            <span className="text-sm text-green-300">All 3 angles captured successfully</span>
          </div>
          <div className="flex gap-2">
            {onSkip && (
              <button onClick={onSkip} className="flex-1 bg-[#1e2d42] border border-[#2a3a52] hover:bg-[#243548] text-slate-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Skip for now
              </button>
            )}
            <button
              onClick={saveEnrollment}
              disabled={saving}
              className="flex-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : '✓ Save Face Enrollment'}
            </button>
          </div>
        </div>
      )}

      {onSkip && !allCaptured && (
        <button onClick={onSkip} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
          Skip face enrollment for now
        </button>
      )}
    </div>
  );
}

'use client';

// Liveness Detection Module
// Detects real faces vs photos/videos using:
// 1. Blink detection (eye aspect ratio change)
// 2. Head movement (landmark position change over time)
// 3. Micro-motion analysis (pixel variance between frames)

export type LivenessResult = {
  isLive: boolean;
  confidence: number; // 0-100
  method: string;
  message: string;
};

// Eye landmarks in face-api.js 68-point model:
// Left eye:  36-41  |  Right eye: 42-47
const LEFT_EYE_INDICES  = [36, 37, 38, 39, 40, 41];
const RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47];

interface Landmark { x: number; y: number; }

// Eye Aspect Ratio (EAR) — drops below ~0.2 during a blink
function eyeAspectRatio(eyePoints: Landmark[]): number {
  const [p1, p2, p3, p4, p5, p6] = eyePoints;
  const vert1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const vert2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horiz = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  return (vert1 + vert2) / (2.0 * horiz + 1e-6);
}

// Extract eye points from face-api.js landmark positions array
function getEyePoints(positions: Landmark[], indices: number[]): Landmark[] {
  return indices.map(i => positions[i]);
}

export class LivenessDetector {
  private earHistory:      number[] = [];
  private posHistory:      { x: number; y: number }[] = [];
  private blinkCount      = 0;
  private frameCount      = 0;
  private motionScore     = 0;
  private lastPositions:  Landmark[] | null = null;

  readonly MIN_BLINKS     = 1;   // require at least 1 blink
  readonly MIN_FRAMES     = 15;  // min frames before deciding
  readonly EAR_THRESHOLD  = 0.22;
  readonly MOTION_THRESH  = 2.0; // pixels of landmark movement

  reset() {
    this.earHistory    = [];
    this.posHistory    = [];
    this.blinkCount    = 0;
    this.frameCount    = 0;
    this.motionScore   = 0;
    this.lastPositions = null;
  }

  // Call this for every video frame with face landmarks
  processFrame(positions: Landmark[]): {
    ear: number;
    isBlink: boolean;
    blinkCount: number;
    motion: number;
    frameCount: number;
  } {
    this.frameCount++;

    // Eye aspect ratios
    const leftEAR  = eyeAspectRatio(getEyePoints(positions, LEFT_EYE_INDICES));
    const rightEAR = eyeAspectRatio(getEyePoints(positions, RIGHT_EYE_INDICES));
    const ear      = (leftEAR + rightEAR) / 2;

    this.earHistory.push(ear);
    if (this.earHistory.length > 30) this.earHistory.shift();

    // Detect blink: EAR drops then recovers
    const isBlink = ear < this.EAR_THRESHOLD &&
      (this.earHistory[this.earHistory.length - 2] ?? 1) > this.EAR_THRESHOLD;
    if (isBlink) this.blinkCount++;

    // Motion: average landmark movement between frames
    let motion = 0;
    if (this.lastPositions) {
      const diffs = positions.map((p, i) => {
        const prev = this.lastPositions![i];
        return Math.hypot(p.x - prev.x, p.y - prev.y);
      });
      motion = diffs.reduce((s, d) => s + d, 0) / diffs.length;
      this.motionScore = this.motionScore * 0.8 + motion * 0.2; // EWMA
    }
    this.lastPositions = positions;

    // Nose tip position for head movement
    const nose = positions[30];
    this.posHistory.push({ x: nose.x, y: nose.y });
    if (this.posHistory.length > 30) this.posHistory.shift();

    return { ear, isBlink, blinkCount: this.blinkCount, motion, frameCount: this.frameCount };
  }

  // Final liveness verdict
  getResult(): LivenessResult {
    if (this.frameCount < this.MIN_FRAMES) {
      return { isLive: false, confidence: 0, method: 'processing', message: 'Analysing...' };
    }

    const hasMotion = this.motionScore > this.MOTION_THRESH;
    const hasBlink  = this.blinkCount >= this.MIN_BLINKS;

    // Check head movement variance
    let headMovement = 0;
    if (this.posHistory.length >= 10) {
      const xs = this.posHistory.map(p => p.x);
      const ys = this.posHistory.map(p => p.y);
      const xVar = Math.max(...xs) - Math.min(...xs);
      const yVar = Math.max(...ys) - Math.min(...ys);
      headMovement = Math.max(xVar, yVar);
    }
    const hasHeadMovement = headMovement > 3;

    // Confidence score
    let confidence = 0;
    if (hasBlink)         confidence += 50;
    if (hasMotion)        confidence += 25;
    if (hasHeadMovement)  confidence += 25;

    const isLive = confidence >= 50; // blink alone is sufficient

    const message = !hasBlink
      ? `Please blink naturally (${this.blinkCount}/${this.MIN_BLINKS} detected)`
      : !hasMotion && !hasHeadMovement
      ? 'Hold still — verifying liveness'
      : 'Liveness verified ✓';

    return {
      isLive,
      confidence,
      method: hasBlink ? 'blink + motion' : hasMotion ? 'motion' : 'static',
      message,
    };
  }

  get progress(): number {
    return Math.min(100, Math.round((this.frameCount / this.MIN_FRAMES) * 100));
  }

  get blinkDetected(): boolean {
    return this.blinkCount >= this.MIN_BLINKS;
  }
}

// Canvas-based pixel variance for micro-motion (supplementary check)
export function computeFrameDiff(
  prev: ImageData,
  curr: ImageData,
  threshold = 15
): number {
  let diffPixels = 0;
  const len      = prev.data.length;
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(curr.data[i]     - prev.data[i]);
    const dg = Math.abs(curr.data[i + 1] - prev.data[i + 1]);
    const db = Math.abs(curr.data[i + 2] - prev.data[i + 2]);
    if (dr + dg + db > threshold) diffPixels++;
  }
  return (diffPixels / (len / 4)) * 100; // percentage of changed pixels
}

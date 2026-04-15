import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// This endpoint is public — called from the kiosk (no HR login needed)
// But we validate a kiosk device secret via header

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descriptor } = body; // 128-dim float array as JSON string

    if (!descriptor) {
      return NextResponse.json({ error: 'Face descriptor required' }, { status: 400 });
    }

    let inputArray: number[];
    try {
      inputArray = typeof descriptor === 'string' ? JSON.parse(descriptor) : descriptor;
      if (!Array.isArray(inputArray) || inputArray.length !== 128) {
        throw new Error('Invalid dimensions');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid face descriptor' }, { status: 400 });
    }

    // Fetch all enrolled employees with their face descriptors
    const res = await query<{
      id: string;
      first_name: string;
      last_name: string;
      employee_id: string;
      department: string;
      job_title: string;
      avatar_color: string;
      face_descriptor_front: string;
      face_descriptor_left: string;
      face_descriptor_right: string;
    }>(
      `SELECT id, first_name, last_name, employee_id, department, job_title, avatar_color,
              face_descriptor_front, face_descriptor_left, face_descriptor_right
       FROM employees
       WHERE face_enrolled = TRUE
         AND status = 'active'
         AND face_descriptor_front IS NOT NULL`
    );

    if (!res.rowCount || res.rowCount === 0) {
      return NextResponse.json({ error: 'No enrolled employees found' }, { status: 404 });
    }

    // Euclidean distance between two 128-dim descriptors
    const euclideanDistance = (a: number[], b: number[]): number => {
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        sum += (a[i] - b[i]) ** 2;
      }
      return Math.sqrt(sum);
    };

    // Match threshold — face-api.js recommends 0.6
    const THRESHOLD = 0.6;

    let bestMatch: typeof res.rows[0] | null = null;
    let bestDistance = Infinity;

    for (const emp of res.rows) {
      // Compare against all three stored angles, take the best match
      const descriptors = [
        emp.face_descriptor_front,
        emp.face_descriptor_left,
        emp.face_descriptor_right,
      ].filter(Boolean);

      for (const storedDescStr of descriptors) {
        try {
          const storedDesc: number[] = JSON.parse(storedDescStr);
          const dist = euclideanDistance(inputArray, storedDesc);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestMatch = emp;
          }
        } catch {
          // Skip malformed descriptor
          continue;
        }
      }
    }

    const confidence = Math.max(0, Math.round((1 - bestDistance / THRESHOLD) * 100));

    if (!bestMatch || bestDistance > THRESHOLD) {
      return NextResponse.json({
        matched: false,
        confidence: 0,
        message: 'No matching face found',
      });
    }

    // Check today's work session
    const sessionRes = await query<{
      id: string;
      check_in: string;
      check_out: string | null;
      status: string;
      duration_mins: number | null;
    }>(
      `SELECT id, check_in, check_out, status, duration_mins
       FROM work_sessions
       WHERE employee_id = $1 AND session_date = CURRENT_DATE`,
      [bestMatch.id]
    );

    const session = sessionRes.rows[0] ?? null;

    return NextResponse.json({
      matched: true,
      confidence,
      distance: Math.round(bestDistance * 1000) / 1000,
      employee: {
        id:           bestMatch.id,
        employee_id:  bestMatch.employee_id,
        first_name:   bestMatch.first_name,
        last_name:    bestMatch.last_name,
        department:   bestMatch.department,
        job_title:    bestMatch.job_title,
        avatar_color: bestMatch.avatar_color,
      },
      session,
    });
  } catch (err) {
    console.error('[Face Match]', err);
    return NextResponse.json({ error: 'Face matching failed' }, { status: 500 });
  }
}

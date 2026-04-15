import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET — fetch face enrollment status + descriptors
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    const res = await query<{
      face_enrolled: boolean;
      face_descriptor_front: string | null;
      face_descriptor_left: string | null;
      face_descriptor_right: string | null;
    }>(
      `SELECT face_enrolled, face_descriptor_front, face_descriptor_left, face_descriptor_right
       FROM employees WHERE id = $1`,
      [id]
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ data: res.rows[0] });
  } catch (err) {
    console.error('[Face GET]', err);
    return NextResponse.json({ error: 'Failed to fetch face data' }, { status: 500 });
  }
}

// POST — save face descriptors (front, left, right)
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await req.json();
    const { descriptor_front, descriptor_left, descriptor_right } = body;

    if (!descriptor_front || !descriptor_left || !descriptor_right) {
      return NextResponse.json(
        { error: 'All three face angles (front, left, right) are required' },
        { status: 400 }
      );
    }

    // Validate descriptors are valid float arrays (128-dim face-api.js output)
    const validateDescriptor = (d: unknown): boolean => {
      try {
        const arr = JSON.parse(d as string);
        return Array.isArray(arr) && arr.length === 128;
      } catch {
        return false;
      }
    };

    if (
      !validateDescriptor(descriptor_front) ||
      !validateDescriptor(descriptor_left) ||
      !validateDescriptor(descriptor_right)
    ) {
      return NextResponse.json(
        { error: 'Invalid face descriptor format. Must be 128-dim float array.' },
        { status: 400 }
      );
    }

    const res = await query(
      `UPDATE employees
       SET face_descriptor_front = $1,
           face_descriptor_left  = $2,
           face_descriptor_right = $3,
           face_enrolled         = TRUE,
           updated_at            = NOW()
       WHERE id = $4
       RETURNING id, first_name, last_name, face_enrolled`,
      [descriptor_front, descriptor_left, descriptor_right, id]
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Face enrolled successfully',
      data: res.rows[0],
    });
  } catch (err) {
    console.error('[Face POST]', err);
    return NextResponse.json({ error: 'Failed to enroll face' }, { status: 500 });
  }
}

// DELETE — remove face enrollment
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { id } = await params;

  try {
    await query(
      `UPDATE employees
       SET face_descriptor_front = NULL,
           face_descriptor_left  = NULL,
           face_descriptor_right = NULL,
           face_enrolled         = FALSE,
           updated_at            = NOW()
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ message: 'Face enrollment removed' });
  } catch (err) {
    console.error('[Face DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove face enrollment' }, { status: 500 });
  }
}

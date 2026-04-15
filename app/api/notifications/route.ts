import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

// GET — fetch unread + recent notifications for logged-in admin
export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const res = await query<{
      id: string; type: string; title: string; message: string;
      link: string | null; is_read: boolean; created_at: string;
    }>(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [user!.id]
    );

    const unread = res.rows.filter(n => !n.is_read).length;
    return NextResponse.json({ data: res.rows, unread });
  } catch (err) {
    console.error('[Notifs GET]', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST — create notification (internal use by other API routes)
export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { user_id, type, title, message, link } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    }

    const res = await query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [user_id || user!.id, type || 'info', title, message, link || null]
    );

    return NextResponse.json({ data: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Notifs POST]', err);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PATCH — mark as read
export async function PATCH(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, mark_all } = body;

    if (mark_all) {
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [user!.id]
      );
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (!id) return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });

    await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [id, user!.id]
    );

    return NextResponse.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('[Notifs PATCH]', err);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

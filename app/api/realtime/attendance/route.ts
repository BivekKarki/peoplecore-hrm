import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SSE — streams live attendance stats every 10 seconds
// Client connects with: const es = new EventSource('/api/realtime/attendance')
export async function GET(req: NextRequest) {
  // Auth check via cookie
  const cookie = req.cookies.get('pc_session')?.value;
  if (!cookie) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      // Send initial data immediately
      const fetchAndSend = async () => {
        try {
          const [attRes, sessionRes] = await Promise.all([
            query<{
              present: number; absent: number; late: number;
              wfh: number; on_leave: number; total_active: number;
            }>(`
              SELECT
                COUNT(*) FILTER (WHERE a.status='present')::int     AS present,
                COUNT(*) FILTER (WHERE a.status='absent')::int      AS absent,
                COUNT(*) FILTER (WHERE a.status='late')::int        AS late,
                COUNT(*) FILTER (WHERE a.status='work_from_home')::int AS wfh,
                (SELECT COUNT(*)::int FROM employees WHERE status='on_leave') AS on_leave,
                (SELECT COUNT(*)::int FROM employees WHERE status='active')   AS total_active
              FROM attendance a
              WHERE a.date = CURRENT_DATE
            `),
            query<{
              employee_name: string; check_in: string; avatar_color: string;
            }>(`
              SELECT
                e.first_name || ' ' || e.last_name AS employee_name,
                ws.check_in,
                e.avatar_color
              FROM work_sessions ws
              JOIN employees e ON e.id = ws.employee_id
              WHERE ws.session_date = CURRENT_DATE
                AND ws.check_in >= NOW() - INTERVAL '5 minutes'
              ORDER BY ws.check_in DESC
              LIMIT 5
            `),
          ]);

          send('attendance', {
            stats:          attRes.rows[0] ?? {},
            recent_checkins: sessionRes.rows,
            timestamp:      new Date().toISOString(),
          });
        } catch (err) {
          console.error('[SSE Error]', err);
          send('error', { message: 'Data fetch failed' });
        }
      };

      // Send immediately
      await fetchAndSend();

      // Then every 10 seconds
      const interval = setInterval(fetchAndSend, 10000);

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(interval);
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

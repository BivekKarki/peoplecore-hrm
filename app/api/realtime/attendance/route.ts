import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SSE — streams live attendance stats every 10 seconds
// Client connects with: const es = new EventSource('/api/realtime/attendance')
export async function GET(req: NextRequest) {
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
        } catch { /* client disconnected */ }
      };

      const fetchAndSend = async () => {
        try {
          const [attRes, recentRes, activeRes] = await Promise.all([
            // 1. Daily stats
            query<{
              present: number; absent: number; late: number;
              wfh: number; on_leave: number; total_active: number;
            }>(`
              SELECT
                COUNT(*) FILTER (WHERE a.status='present')::int          AS present,
                COUNT(*) FILTER (WHERE a.status='absent')::int           AS absent,
                COUNT(*) FILTER (WHERE a.status='late')::int             AS late,
                COUNT(*) FILTER (WHERE a.status='work_from_home')::int   AS wfh,
                (SELECT COUNT(*)::int FROM employees WHERE status='on_leave') AS on_leave,
                (SELECT COUNT(*)::int FROM employees WHERE status='active')   AS total_active
              FROM attendance a
              WHERE a.date = CURRENT_DATE
            `),

            // 2. Recent check-ins (last 5 minutes — feeds the pulse toasts)
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

            // 3. ALL currently-on-shift employees (clocked in today, no checkout yet)
            query<{
              employee_id: string;
              employee_name: string;
              department: string;
              job_title: string;
              avatar_color: string;
              check_in: string;
              method: string;
              minutes_active: number;
            }>(`
              SELECT
                e.id   AS employee_id,
                e.first_name || ' ' || e.last_name AS employee_name,
                e.department,
                e.job_title,
                e.avatar_color,
                ws.check_in,
                COALESCE(a.method, 'kiosk') AS method,
                EXTRACT(EPOCH FROM (NOW() - ws.check_in))::int / 60 AS minutes_active
              FROM work_sessions ws
              JOIN employees e ON e.id = ws.employee_id
              LEFT JOIN attendance a
                ON a.employee_id = ws.employee_id
               AND a.date = ws.session_date
              WHERE ws.session_date = CURRENT_DATE
                AND ws.check_out IS NULL
              ORDER BY ws.check_in ASC
            `),
          ]);

          send('attendance', {
            stats:            attRes.rows[0] ?? {},
            recent_checkins:  recentRes.rows,
            currently_active: activeRes.rows,
            timestamp:        new Date().toISOString(),
          });
        } catch (err) {
          console.error('[SSE Error]', err);
          send('error', { message: 'Data fetch failed' });
        }
      };

      // Send immediately, then every 10 seconds
      await fetchAndSend();
      const interval  = setInterval(fetchAndSend, 10000);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')); }
        catch { clearInterval(interval); clearInterval(heartbeat); }
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
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { to } = body;

        if (!to) return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });

        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'RESEND_API_KEY not set in .env.local',
            }, { status: 400 });
        }

        const resend = new Resend(process.env.RESEND_API_KEY);

        const { data, error } = await resend.emails.send({
            from:    process.env.RESEND_FROM ?? 'PeopleCore HRM <onboarding@resend.dev>',
            to,
            subject: '✅ PeopleCore Email Test — Resend Working',
            html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
          <div style="background:#0f1724;padding:24px 32px;">
            <span style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:inline-block;color:white;font-weight:700;font-size:18px;text-align:center;line-height:36px;">P</span>
            <span style="color:white;font-size:16px;font-weight:600;margin-left:10px;vertical-align:middle;">PeopleCore HRM</span>
          </div>
          <div style="padding:32px;">
            <h1 style="color:#111827;font-size:20px;margin:0 0 12px;">✅ Resend is Working!</h1>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              Your email system is configured correctly via <strong>Resend</strong>.
              PeopleCore HRM will use this to send leave notifications, payslips, and welcome emails.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:16px;font-size:13px;color:#166534;">
              <strong>Sent at:</strong> ${new Date().toLocaleString('en-AU')}<br>
              <strong>To:</strong> ${to}
            </div>
          </div>
          <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
            This is an automated test from PeopleCore HRM.
          </div>
        </div>
      `,
        });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Test email sent via Resend!',
            id: data?.id,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    const configured = !!process.env.RESEND_API_KEY;
    return NextResponse.json({
        configured,
        mode:        configured ? 'resend' : 'not configured',
        resend_from: process.env.RESEND_FROM ?? null,
        hr_email:    process.env.HR_ADMIN_EMAIL ?? null,
    });
}
import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { Resend } from 'resend';

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = process.env.RESEND_FROM ?? 'PeopleCore HRM <onboarding@resend.dev>';
const APP_YEAR = new Date().getFullYear();

export async function POST(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { to, name, subject, message } = body;

        if (!to)      return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });
        if (!subject) return NextResponse.json({ error: 'Subject is required' },      { status: 400 });
        if (!message) return NextResponse.json({ error: 'Message is required' },      { status: 400 });

        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json(
                { error: 'RESEND_API_KEY not configured in .env.local' },
                { status: 500 }
            );
        }

        const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
        <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
          <div style="background:#0f1724;padding:24px 32px;">
            <span style="width:36px;height:36px;background:#2563eb;border-radius:8px;display:inline-block;color:white;font-weight:700;font-size:18px;text-align:center;line-height:36px;">P</span>
            <span style="color:white;font-size:16px;font-weight:600;margin-left:10px;vertical-align:middle;">PeopleCore HRM</span>
          </div>
          <div style="padding:32px;">
            ${name ? `<p style="font-size:14px;color:#4b5563;margin:0 0 20px;">Hi <strong>${name}</strong>,</p>` : ''}
            <div style="font-size:14px;color:#374151;line-height:1.8;">${message.replace(/\n/g, '<br>')}</div>
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <p style="font-size:13px;color:#6b7280;margin:0;">
                This message was sent by your HR team via PeopleCore HRM.<br>
                Please do not reply to this email — contact HR directly if needed.
              </p>
            </div>
          </div>
          <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
            © ${APP_YEAR} PeopleCore HRM. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

        const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

        if (error) {
            console.error('[Email Send Error]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log('[Email] Sent to', to, '| ID:', data?.id);
        return NextResponse.json({ success: true, id: data?.id });

    } catch (err) {
        console.error('[Email Send]', err);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
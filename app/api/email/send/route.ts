import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import nodemailer from 'nodemailer';

const APP_YEAR = new Date().getFullYear();

function getTransporter() {
    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_PORT   === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

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

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            return NextResponse.json(
                { error: 'SMTP_USER and SMTP_PASS not configured in .env.local' },
                { status: 500 }
            );
        }

        const FROM = process.env.SMTP_FROM ?? `PeopleCore HRM <${process.env.SMTP_USER}>`;

        const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
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

        const transporter = getTransporter();
        const info = await transporter.sendMail({ from: FROM, to, subject, html });

        console.log('[Email] Sent to', to, '| ID:', info.messageId);
        return NextResponse.json({ success: true, id: info.messageId });

    } catch (err) {
        console.error('[Email Send]', err);
        const msg = err instanceof Error ? err.message : 'Failed to send email';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
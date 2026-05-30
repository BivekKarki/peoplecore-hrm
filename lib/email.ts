import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = process.env.RESEND_FROM    ?? 'PeopleCore HRM <onboarding@resend.dev>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export interface EmailResult { success: boolean; id?: string; error?: string; }

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('[Email] No RESEND_API_KEY — skipping send');
      console.log('[Email] To:', to, '| Subject:', subject);
      return { success: true, id: 'skipped' };
    }
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[Resend Error]', error);
      return { success: false, error: error.message };
    }
    console.log('[Email] Sent:', data?.id, '→', to);
    return { success: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email Error]', msg);
    return { success: false, error: msg };
  }
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { background: #0f1724; padding: 24px 32px; }
  .logo-box { width: 36px; height: 36px; background: #2563eb; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px; }
  .logo-text { color: white; font-size: 16px; font-weight: 600; vertical-align: middle; margin-left: 10px; }
  .body { padding: 32px; }
  h1 { font-size: 20px; color: #111827; margin: 0 0 12px; font-weight: 600; }
  p { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px; }
  .card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; margin: 16px 0; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .row:last-child { border-bottom: none; }
  .label { color: #6b7280; }
  .value { color: #111827; font-weight: 500; }
  .btn { display: inline-block; background: #2563eb; color: white !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; margin: 8px 0; }
  .btn-green { background: #16a34a; }
  .btn-red   { background: #dc2626; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red   { background: #fee2e2; color: #7f1d1d; }
  .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="logo-box">P</span>
    <span class="logo-text">PeopleCore HRM</span>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    This is an automated message from PeopleCore HRM. Do not reply directly to this email.<br>
    © ${new Date().getFullYear()} PeopleCore. All rights reserved.
  </div>
</div>
</body>
</html>`;
}

// ── Welcome email ─────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(opts: {
  to: string; firstName: string; lastName: string;
  employeeId: string; department: string; startDate: string;
}): Promise<EmailResult> {
  return send(opts.to, `Welcome to the team, ${opts.firstName}! — PeopleCore`, baseTemplate(`
    <h1>Welcome to the team, ${opts.firstName}! 👋</h1>
    <p>Your employment profile has been created in PeopleCore HRM.</p>
    <div class="card">
      <div class="row"><span class="label">Employee ID</span><span class="value">${opts.employeeId}</span></div>
      <div class="row"><span class="label">Full Name</span><span class="value">${opts.firstName} ${opts.lastName}</span></div>
      <div class="row"><span class="label">Department</span><span class="value">${opts.department}</span></div>
      <div class="row"><span class="label">Start Date</span><span class="value">${opts.startDate}</span></div>
    </div>
    <p>You can clock in and out using the facial recognition kiosk at the office entrance.</p>
    <a href="${APP_URL}/kiosk" class="btn">Open Attendance Kiosk</a>
  `));
}

// ── Payslip email ─────────────────────────────────────────────────────────────
export async function sendPayslipEmail(opts: {
  to: string; firstName: string; period: string;
  grossSalary: number; netPay: number; taxWithheld: number; superannuation: number;
}): Promise<EmailResult> {
  const fmt = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
  return send(opts.to, `Payslip Ready — ${opts.period} | PeopleCore`, baseTemplate(`
    <h1>Your Payslip is Ready</h1>
    <p>Hi ${opts.firstName}, your payslip for <strong>${opts.period}</strong> has been processed.</p>
    <div class="card">
      <div class="row"><span class="label">Pay Period</span><span class="value">${opts.period}</span></div>
      <div class="row"><span class="label">Gross Salary</span><span class="value">${fmt(opts.grossSalary)}</span></div>
      <div class="row"><span class="label">PAYG Tax</span><span class="value" style="color:#dc2626">${fmt(opts.taxWithheld)}</span></div>
      <div class="row"><span class="label">Superannuation</span><span class="value" style="color:#7c3aed">${fmt(opts.superannuation)}</span></div>
      <div class="row"><span class="label">Net Pay</span><span class="value" style="color:#16a34a;font-size:15px">${fmt(opts.netPay)}</span></div>
    </div>
    <a href="${APP_URL}/payroll" class="btn btn-green">View Payslip</a>
  `));
}

// ── Leave request confirmation ────────────────────────────────────────────────
export async function sendLeaveRequestEmail(opts: {
  to: string; firstName: string; leaveType: string;
  startDate: string; endDate: string; days: number;
}): Promise<EmailResult> {
  return send(opts.to, `Leave Request Submitted — PeopleCore`, baseTemplate(`
    <h1>Leave Request Submitted</h1>
    <p>Hi ${opts.firstName}, your leave request is pending approval.</p>
    <div class="card">
      <div class="row"><span class="label">Leave Type</span><span class="value">${opts.leaveType}</span></div>
      <div class="row"><span class="label">From</span><span class="value">${opts.startDate}</span></div>
      <div class="row"><span class="label">To</span><span class="value">${opts.endDate}</span></div>
      <div class="row"><span class="label">Duration</span><span class="value">${opts.days} working day${opts.days !== 1 ? 's' : ''}</span></div>
      <div class="row"><span class="label">Status</span><span class="value"><span class="badge badge-amber">Pending Approval</span></span></div>
    </div>
    <p>You will receive an email once HR has reviewed your request.</p>
  `));
}

// ── Leave decision ────────────────────────────────────────────────────────────
export async function sendLeaveDecisionEmail(opts: {
  to: string; firstName: string; leaveType: string;
  startDate: string; endDate: string; days: number;
  approved: boolean; reason?: string;
}): Promise<EmailResult> {
  const status = opts.approved ? 'Approved' : 'Denied';
  return send(opts.to, `Leave ${status} — PeopleCore`, baseTemplate(`
    <h1>Leave Request ${status}</h1>
    <p>Hi ${opts.firstName}, your leave request has been <strong>${status.toLowerCase()}</strong>.</p>
    <div class="card">
      <div class="row"><span class="label">Leave Type</span><span class="value">${opts.leaveType}</span></div>
      <div class="row"><span class="label">From</span><span class="value">${opts.startDate}</span></div>
      <div class="row"><span class="label">To</span><span class="value">${opts.endDate}</span></div>
      <div class="row"><span class="label">Duration</span><span class="value">${opts.days} day${opts.days !== 1 ? 's' : ''}</span></div>
      <div class="row"><span class="label">Status</span><span class="value">
        <span class="badge ${opts.approved ? 'badge-green' : 'badge-red'}">${status}</span>
      </span></div>
      ${opts.reason ? `<div class="row"><span class="label">Note</span><span class="value">${opts.reason}</span></div>` : ''}
    </div>
    ${opts.approved
      ? '<p>Please ensure your work is handed over before your leave starts. Enjoy your time off! 🎉</p>'
      : '<p>If you have questions, please contact your HR team.</p>'
  }
    <a href="${APP_URL}/leave" class="btn ${opts.approved ? 'btn-green' : ''}">View Leave Details</a>
  `));
}

// ── Leave approval alert to HR ────────────────────────────────────────────────
export async function sendLeaveApprovalAlert(opts: {
  to: string; employeeName: string; leaveType: string;
  startDate: string; endDate: string; days: number; leaveId: string;
}): Promise<EmailResult> {
  return send(opts.to, `Leave Approval Needed: ${opts.employeeName} — PeopleCore`, baseTemplate(`
    <h1>Leave Approval Required</h1>
    <p>A new leave request requires your attention.</p>
    <div class="card">
      <div class="row"><span class="label">Employee</span><span class="value">${opts.employeeName}</span></div>
      <div class="row"><span class="label">Leave Type</span><span class="value">${opts.leaveType}</span></div>
      <div class="row"><span class="label">From</span><span class="value">${opts.startDate}</span></div>
      <div class="row"><span class="label">To</span><span class="value">${opts.endDate}</span></div>
      <div class="row"><span class="label">Duration</span><span class="value">${opts.days} day${opts.days !== 1 ? 's' : ''}</span></div>
    </div>
    <a href="${APP_URL}/leave" class="btn">Review Request →</a>
  `));
}

// ── Check-in confirmation ─────────────────────────────────────────────────────
export async function sendCheckInEmail(opts: {
  to: string; firstName: string; checkInTime: string; date: string;
}): Promise<EmailResult> {
  return send(opts.to, `Check-In Confirmed — ${opts.date} | PeopleCore`, baseTemplate(`
    <h1>Check-In Confirmed ✓</h1>
    <p>Hi ${opts.firstName}, your attendance has been recorded.</p>
    <div class="card">
      <div class="row"><span class="label">Date</span><span class="value">${opts.date}</span></div>
      <div class="row"><span class="label">Check-In Time</span><span class="value" style="color:#16a34a;font-weight:600">${opts.checkInTime}</span></div>
      <div class="row"><span class="label">Method</span><span class="value">Facial Recognition</span></div>
      <div class="row"><span class="label">Status</span><span class="value"><span class="badge badge-green">Present</span></span></div>
    </div>
    <p>Have a productive day! 🚀</p>
  `));
}

// ── Performance review ────────────────────────────────────────────────────────
export async function sendPerformanceReviewEmail(opts: {
  to: string; firstName: string; period: string;
  rating: number; kpi: number; reviewer: string;
}): Promise<EmailResult> {
  const stars  = '★'.repeat(opts.rating) + '☆'.repeat(5 - opts.rating);
  const labels = ['', 'Very Poor', 'Below Expectations', 'Meets Expectations', 'Good', 'Excellent'];
  return send(opts.to, `Performance Review Complete — ${opts.period} | PeopleCore`, baseTemplate(`
    <h1>Performance Review — ${opts.period}</h1>
    <p>Hi ${opts.firstName}, your performance review has been completed.</p>
    <div class="card">
      <div class="row"><span class="label">Period</span><span class="value">${opts.period}</span></div>
      <div class="row"><span class="label">Rating</span><span class="value" style="color:#d97706">${stars} ${labels[opts.rating]}</span></div>
      <div class="row"><span class="label">KPI Achievement</span><span class="value">${opts.kpi}%</span></div>
      <div class="row"><span class="label">Reviewed By</span><span class="value">${opts.reviewer}</span></div>
    </div>
    <a href="${APP_URL}/performance" class="btn">View Full Review</a>
  `));
}
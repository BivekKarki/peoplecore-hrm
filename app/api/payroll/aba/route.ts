import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { payslipsToABA } from '@/lib/aba';

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const {
      payroll_run_id,
      company_bsb     = process.env.COMPANY_BSB     ?? '063-000',
      company_account = process.env.COMPANY_ACCOUNT ?? '12345678',
      company_name    = process.env.APP_NAME        ?? 'PeopleCore Pty Ltd',
      bank_code       = process.env.COMPANY_BANK    ?? 'CBA',
      apca_number     = process.env.APCA_NUMBER     ?? '000000',
      pay_date,
    } = body;

    if (!payroll_run_id) {
      return NextResponse.json({ error: 'payroll_run_id required' }, { status: 400 });
    }

    // Fetch payslips with employee bank details
    const res = await query<{
      employee_name: string;
      bank_bsb: string | null;
      bank_account: string | null;
      net_pay: number;
      employee_id: string;
      pay_date: string;
      period_start: string;
      period_end: string;
    }>(
      `SELECT
         e.first_name || ' ' || e.last_name AS employee_name,
         e.bank_bsb,
         e.bank_account,
         p.net_pay,
         p.employee_id,
         pr.pay_date,
         pr.period_start,
         pr.period_end
       FROM payslips p
       JOIN employees e ON e.id = p.employee_id
       JOIN payroll_runs pr ON pr.id = p.payroll_run_id
       WHERE p.payroll_run_id = $1
       ORDER BY e.last_name, e.first_name`,
      [payroll_run_id]
    );

    if (!res.rowCount) {
      return NextResponse.json({ error: 'No payslips found for this run' }, { status: 404 });
    }

    const run = res.rows[0];
    const periodLabel = new Date(run.period_start).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }).toUpperCase();

    const { file, total, count, errors } = payslipsToABA({
      payslips: res.rows.map(r => ({
        employee_name: r.employee_name,
        bank_bsb:      r.bank_bsb ?? '',
        bank_account:  r.bank_account ?? '',
        net_pay:       Number(r.net_pay),
        employee_id:   r.employee_id,
      })),
      company_bsb,
      company_account,
      company_name,
      bank_code,
      apca_number,
      pay_period:  periodLabel,
      pay_date:    pay_date ? new Date(pay_date) : new Date(run.pay_date),
    });

    // Mark payroll run as processed
    await query(
      `UPDATE payroll_runs SET status = 'processed', processed_at = NOW(), processed_by = $1 WHERE id = $2`,
      [user!.id, payroll_run_id]
    );

    // Return as downloadable file
    const filename = `payroll_${periodLabel.replace(' ', '_')}_${Date.now()}.aba`;

    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Record-Count':      String(count),
        'X-Total-Amount':      String(total.toFixed(2)),
        'X-Errors':            JSON.stringify(errors),
      },
    });
  } catch (err) {
    console.error('[ABA Export]', err);
    return NextResponse.json({ error: 'Failed to generate ABA file' }, { status: 500 });
  }
}

// GET — preview ABA details before downloading
export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const payroll_run_id = searchParams.get('payroll_run_id');

  if (!payroll_run_id) {
    return NextResponse.json({ error: 'payroll_run_id required' }, { status: 400 });
  }

  try {
    const res = await query<{
      employee_name: string; net_pay: number;
      has_bsb: boolean; has_account: boolean;
      total_employees: number;
    }>(
      `SELECT
         e.first_name || ' ' || e.last_name AS employee_name,
         p.net_pay,
         (e.bank_bsb IS NOT NULL)     AS has_bsb,
         (e.bank_account IS NOT NULL) AS has_account,
         COUNT(*) OVER()::int         AS total_employees
       FROM payslips p
       JOIN employees e ON e.id = p.employee_id
       WHERE p.payroll_run_id = $1
       ORDER BY e.last_name`,
      [payroll_run_id]
    );

    const missing    = res.rows.filter(r => !r.has_bsb || !r.has_account);
    const readyCount = res.rows.length - missing.length;
    const totalNet   = res.rows.reduce((s, r) => s + Number(r.net_pay), 0);

    return NextResponse.json({
      total_employees: res.rows[0]?.total_employees ?? 0,
      ready_for_aba:   readyCount,
      missing_banking: missing.map(r => r.employee_name),
      total_net_pay:   totalNet,
    });
  } catch (err) {
    console.error('[ABA GET]', err);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { PayrollRun } from '@/types';
import { calculateTax, calculateSuper } from '@/lib/utils';
import { PoolClient } from 'pg';

export async function GET(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const res = await query<PayrollRun>(
      `SELECT * FROM payroll_runs ORDER BY created_at DESC LIMIT 12`
    );
    return NextResponse.json({ data: res.rows });
  } catch (err) {
    console.error('[Payroll GET]', err);
    return NextResponse.json({ error: 'Failed to fetch payroll runs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { period_start, period_end, pay_date, pay_period } = body;

    if (!period_start || !period_end || !pay_date) {
      return NextResponse.json({ error: 'Period start, end and pay date are required' }, { status: 400 });
    }

    const result = await transaction(async (client: PoolClient) => {
      // Get all active employees
      const emps = await client.query<{
        id: string; salary: number; employment_type: string;
      }>(
        `SELECT id, salary, employment_type FROM employees WHERE status = 'active'`
      );

      const divisor = pay_period === 'weekly' ? 52
        : pay_period === 'fortnightly' ? 26
        : 12;

      let totalGross = 0, totalTax = 0, totalSuper = 0, totalNet = 0;

      // Create payroll run
      const runRes = await client.query<PayrollRun>(
        `INSERT INTO payroll_runs (period_start, period_end, pay_date, status, employee_count)
         VALUES ($1, $2, $3, 'draft', $4) RETURNING *`,
        [period_start, period_end, pay_date, emps.rowCount ?? 0]
      );
      const run = runRes.rows[0];

      // Generate payslips
      for (const emp of emps.rows) {
        const gross = Math.round((emp.salary / divisor) * 100) / 100;
        const annualTax = calculateTax(emp.salary);
        const tax = Math.round((annualTax / divisor) * 100) / 100;
        const superAmt = calculateSuper(gross);
        const net = gross - tax - superAmt;

        totalGross += gross; totalTax += tax;
        totalSuper += superAmt; totalNet += net;

        // YTD (simplified: current month * periods elapsed)
        const ytdGross = gross * 3;
        const ytdTax = tax * 3;
        const ytdSuper = superAmt * 3;

        await client.query(
          `INSERT INTO payslips
             (payroll_run_id, employee_id, gross_salary, tax_withheld, superannuation,
              net_pay, ytd_gross, ytd_tax, ytd_super)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (payroll_run_id, employee_id) DO NOTHING`,
          [run.id, emp.id, gross, tax, superAmt, net, ytdGross, ytdTax, ytdSuper]
        );
      }

      // Update totals
      await client.query(
        `UPDATE payroll_runs
         SET total_gross=$1, total_tax=$2, total_super=$3, total_net=$4
         WHERE id=$5`,
        [totalGross, totalTax, totalSuper, totalNet, run.id]
      );

      return { ...run, total_gross: totalGross, total_tax: totalTax, total_super: totalSuper, total_net: totalNet };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error('[Payroll POST]', err);
    return NextResponse.json({ error: 'Failed to create payroll run' }, { status: 500 });
  }
}

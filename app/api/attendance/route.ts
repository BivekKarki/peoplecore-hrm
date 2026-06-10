import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';
import { AttendanceRecord } from '@/types';

// GET /api/attendance?date=YYYY-MM-DD&employee_id=...
export async function GET(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0];
    const employee_id = searchParams.get('employee_id');

    try {
        const conditions = ['a.date = $1'];
        const params: unknown[] = [date];
        let idx = 2;

        if (employee_id) {
            conditions.push(`a.employee_id = $${idx++}`);
            params.push(employee_id);
        }

        const res = await query<AttendanceRecord>(
            `SELECT a.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              e.department
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.check_in ASC NULLS LAST`,
            params
        );

        return NextResponse.json({ data: res.rows });
    } catch (err) {
        console.error('[Attendance GET]', err);
        return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }
}

// POST /api/attendance
export async function POST(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { employee_id, date, check_in, check_out, status, method, notes } = body;

        if (!employee_id) return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
        if (!date)        return NextResponse.json({ error: 'Date required' }, { status: 400 });
        if (!status)      return NextResponse.json({ error: 'Status required' }, { status: 400 });

        // Combine date + time into full timestamps
        // Form sends "09:00", DB needs "2026-06-10T09:00:00"
        const checkInISO  = check_in  ? `${date}T${check_in.length === 5  ? check_in  + ':00' : check_in}`  : null;
        const checkOutISO = check_out ? `${date}T${check_out.length === 5 ? check_out + ':00' : check_out}` : null;

        let hoursWorked: number | null = null;
        if (checkInISO && checkOutISO) {
            const diff = new Date(checkOutISO).getTime() - new Date(checkInISO).getTime();
            hoursWorked = Math.round((diff / 1000 / 60 / 60) * 100) / 100;
        }

        const res = await query<AttendanceRecord>(
            `INSERT INTO attendance (employee_id, date, check_in, check_out, hours_worked, status, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (employee_id, date) DO UPDATE
         SET check_in     = EXCLUDED.check_in,
             check_out    = EXCLUDED.check_out,
             hours_worked = EXCLUDED.hours_worked,
             status       = EXCLUDED.status,
             method       = EXCLUDED.method,
             notes        = EXCLUDED.notes
       RETURNING *`,
            [employee_id, date, checkInISO, checkOutISO, hoursWorked, status, method || 'manual', notes || null]
        );

        return NextResponse.json({ data: res.rows[0] }, { status: 201 });
    } catch (err) {
        console.error('[Attendance POST]', err);
        return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
    }
}
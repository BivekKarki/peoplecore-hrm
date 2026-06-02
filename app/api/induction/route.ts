import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession, requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const status      = searchParams.get('status');
    const employee_id = searchParams.get('employee_id');

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (status)      { conditions.push(`i.status = $${idx++}`);      params.push(status); }
    if (employee_id) { conditions.push(`i.employee_id = $${idx++}`); params.push(employee_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const res = await query(`
            SELECT
                i.*,
                e.first_name, e.last_name, e.department,
                e.job_title, e.email, e.avatar_color,
                e.employee_id AS employee_code
            FROM inductions i
                     JOIN employees e ON e.id = i.employee_id
                ${where}
            ORDER BY
                CASE i.status
                WHEN 'in_progress' THEN 1
                WHEN 'not_started' THEN 2
                WHEN 'completed'   THEN 3
            END,
        i.updated_at DESC
        `, params);

        const all         = res.rows;
        const not_started = all.filter(r => (r as {status:string}).status === 'not_started').length;
        const in_progress = all.filter(r => (r as {status:string}).status === 'in_progress').length;
        const completed   = all.filter(r => (r as {status:string}).status === 'completed').length;

        return NextResponse.json({
            data:  res.rows,
            stats: { total: all.length, not_started, in_progress, completed },
        });
    } catch (err) {
        console.error('[Inductions GET]', err);
        return NextResponse.json({ error: 'Failed to fetch inductions' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    try {
        const body = await req.json();
        const { employee_id } = body;

        if (!employee_id) {
            return NextResponse.json({ error: 'employee_id required' }, { status: 400 });
        }

        // Check if already exists
        const existing = await query(
            'SELECT id FROM inductions WHERE employee_id = $1',
            [employee_id]
        );
        if (existing.rowCount) {
            return NextResponse.json(
                { error: 'Induction already exists for this employee' },
                { status: 409 }
            );
        }

        const res = await query(
            `INSERT INTO inductions (employee_id, status, step)
             VALUES ($1, 'not_started', 1)
                 RETURNING *`,
            [employee_id]
        );

        return NextResponse.json({ data: res.rows[0] }, { status: 201 });
    } catch (err) {
        console.error('[Inductions POST]', err);
        return NextResponse.json({ error: 'Failed to create induction' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const user = await getSession();
    const authError = requireAuth(user);
    if (authError) return authError;

    try {
        const body = await req.json();
        const {
            id, step,
            personal_details_done, documents_done, training_done, it_setup_done,
            welcome_pack_sent, contract_signed, payroll_setup_done, team_intro_done,
            notes, status,
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Induction ID required' }, { status: 400 });
        }

        const allDone =
            personal_details_done && documents_done && training_done &&
            it_setup_done && welcome_pack_sent && contract_signed &&
            payroll_setup_done && team_intro_done;

        const derivedStatus = status ??
            (allDone ? 'completed' : (step && step > 1) ? 'in_progress' : 'not_started');

        const res = await query(
            `UPDATE inductions SET
                                   step                  = COALESCE($2::int,     step),
                                   personal_details_done = COALESCE($3::boolean, personal_details_done),
                                   documents_done        = COALESCE($4::boolean, documents_done),
                                   training_done         = COALESCE($5::boolean, training_done),
                                   it_setup_done         = COALESCE($6::boolean, it_setup_done),
                                   welcome_pack_sent     = COALESCE($7::boolean, welcome_pack_sent),
                                   contract_signed       = COALESCE($8::boolean, contract_signed),
                                   payroll_setup_done    = COALESCE($9::boolean, payroll_setup_done),
                                   team_intro_done       = COALESCE($10::boolean, team_intro_done),
                                   notes                 = COALESCE($11::text,   notes),
                                   status                = $12::varchar,
    completed_at = CASE WHEN $12::varchar = 'completed' THEN NOW() ELSE completed_at END,
    updated_at   = NOW()
   WHERE id = $1
            RETURNING *`,
            [
                id,
                step                  ?? null,
                personal_details_done ?? null,
                documents_done        ?? null,
                training_done         ?? null,
                it_setup_done         ?? null,
                welcome_pack_sent     ?? null,
                contract_signed       ?? null,
                payroll_setup_done    ?? null,
                team_intro_done       ?? null,
                notes                 ?? null,
                derivedStatus,
            ]
        );

        if (!res.rowCount) {
            return NextResponse.json({ error: 'Induction not found' }, { status: 404 });
        }

        return NextResponse.json({ data: res.rows[0] });
    } catch (err) {
        console.error('[Inductions PATCH]', err);
        return NextResponse.json({ error: 'Failed to update induction' }, { status: 500 });
    }
}
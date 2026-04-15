import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireAuth } from '@/lib/auth';
import { generateJobDescription } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const user = await getSession();
  const authError = requireAuth(user);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { job_title, department, employment_type, salary_range, key_responsibilities } = body;

    if (!job_title)   return NextResponse.json({ error: 'Job title required' }, { status: 400 });
    if (!department)  return NextResponse.json({ error: 'Department required' }, { status: 400 });

    const description = await generateJobDescription({
      job_title,
      department,
      employment_type: employment_type ?? 'full-time',
      salary_range,
      key_responsibilities,
    });

    return NextResponse.json({ description });
  } catch (err) {
    console.error('[Job Description POST]', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}

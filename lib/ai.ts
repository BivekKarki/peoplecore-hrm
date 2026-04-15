// AI Service — uses Claude claude-sonnet-4-20250514 for HR intelligence
// All AI calls are server-side only

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';

interface Message { role: 'user' | 'assistant'; content: string; }

async function callClaude(
  systemPrompt: string,
  messages: Message[],
  maxTokens = 1000
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error: ${res.status} — ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ── 1. Attrition Risk Prediction ─────────────────────────────────────────────
export interface AttritionInput {
  employee_id: string;
  name: string;
  department: string;
  job_title: string;
  tenure_months: number;
  salary: number;
  avg_performance_rating: number | null;
  leave_days_taken: number;
  absent_days_last_30: number;
  late_days_last_30: number;
  last_raise_months_ago: number | null;
  last_review_months_ago: number | null;
  employment_type: string;
}

export interface AttritionResult {
  employee_id: string;
  risk_score: number;       // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  key_factors: string[];
  recommendations: string[];
}

export async function predictAttrition(employees: AttritionInput[]): Promise<AttritionResult[]> {
  const system = `You are an expert HR analytics AI specialising in employee attrition prediction.
Analyse the employee data provided and return ONLY a valid JSON array.
Each item must have: employee_id (string), risk_score (0-100 integer), risk_level ("low"|"medium"|"high"|"critical"), key_factors (string array, max 3), recommendations (string array, max 3).
Base risk on: tenure, performance, attendance, salary competitiveness, recency of review/raise.
High absence + low performance + long since raise = high risk. Be data-driven and concise.
Return ONLY the JSON array, no other text.`;

  const userMsg = `Analyse these ${employees.length} employees for attrition risk:\n${JSON.stringify(employees, null, 2)}`;

  try {
    const raw = await callClaude(system, [{ role: 'user', content: userMsg }], 2000);
    const clean = raw.replace(/```json|```/g, '').trim();
    const results = JSON.parse(clean) as AttritionResult[];
    return results.filter(r => r.employee_id && typeof r.risk_score === 'number');
  } catch (err) {
    console.error('[AI Attrition]', err);
    // Fallback: rule-based scoring
    return employees.map(e => {
      let score = 20;
      if (e.tenure_months < 6)   score += 25;
      if (e.tenure_months > 48)  score -= 10;
      if ((e.avg_performance_rating ?? 3) < 3) score += 20;
      if (e.absent_days_last_30 > 3) score += 15;
      if (e.late_days_last_30 > 5)   score += 10;
      if ((e.last_raise_months_ago ?? 12) > 18) score += 15;
      if ((e.last_review_months_ago ?? 12) > 12) score += 10;
      score = Math.min(100, Math.max(0, score));
      return {
        employee_id: e.employee_id,
        risk_score: score,
        risk_level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low',
        key_factors: ['Rule-based estimate — AI key unavailable'],
        recommendations: ['Configure ANTHROPIC_API_KEY for AI-powered insights'],
      };
    });
  }
}

// ── 2. Attendance Anomaly Detection ──────────────────────────────────────────
export interface AttendanceAnomaly {
  employee_id: string;
  employee_name: string;
  anomaly_type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  action: string;
}

export async function detectAttendanceAnomalies(data: {
  employee_id: string;
  employee_name: string;
  present_days: number;
  absent_days: number;
  late_days: number;
  attendance_rate: number;
  monday_absences: number;
  friday_absences: number;
}[]): Promise<AttendanceAnomaly[]> {
  const system = `You are an HR anomaly detection AI. Identify unusual attendance patterns.
Look for: chronic lateness, Monday/Friday absenteeism (potential buddy-punching signal), sudden attendance drops, 
consistent absence patterns. Return ONLY a valid JSON array of anomalies.
Each item: employee_id, employee_name, anomaly_type, description (1 sentence), severity ("low"|"medium"|"high"), action (recommended HR action).
Only flag genuine anomalies, not normal variation. Return empty array [] if nothing notable.`;

  try {
    const raw = await callClaude(system, [{
      role: 'user',
      content: `Detect anomalies in this attendance data:\n${JSON.stringify(data, null, 2)}`,
    }], 1500);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as AttendanceAnomaly[];
  } catch (err) {
    console.error('[AI Anomaly]', err);
    // Rule-based fallback
    return data
      .filter(e => e.attendance_rate < 70 || e.late_days > 8 || (e.monday_absences + e.friday_absences) > 6)
      .map(e => ({
        employee_id: e.employee_id,
        employee_name: e.employee_name,
        anomaly_type: e.attendance_rate < 70 ? 'Low Attendance' : e.late_days > 8 ? 'Chronic Lateness' : 'Weekend Boundary Absences',
        description: `Attendance rate ${e.attendance_rate}%, ${e.late_days} late days this month`,
        severity: e.attendance_rate < 60 ? 'high' : 'medium' as 'high' | 'medium',
        action: 'Schedule 1:1 meeting to understand underlying issues',
      }));
  }
}

// ── 3. HR Chatbot ─────────────────────────────────────────────────────────────
export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export async function hrChatbot(
  messages: ChatMessage[],
  context: {
    total_employees: number;
    pending_leaves: number;
    present_today: number;
    monthly_payroll: number;
    departments: string[];
  }
): Promise<string> {
  const system = `You are an intelligent HR assistant for PeopleCore HRM. You help HR managers with:
- Employee data queries and insights
- HR policy questions
- Leave management guidance
- Payroll and compliance questions (Australian context, Fair Work Act, NES)
- Performance management advice
- Recruitment and onboarding guidance

Current system context:
- Total employees: ${context.total_employees}
- Present today: ${context.present_today}
- Pending leave requests: ${context.pending_leaves}
- Monthly payroll: $${Math.round(context.monthly_payroll).toLocaleString()} AUD
- Departments: ${context.departments.join(', ')}

Be concise, professional and helpful. For legal advice, recommend consulting a lawyer.
If asked about specific employees, explain you need them to use the system UI for privacy.
Format responses clearly with bullet points when listing multiple items.`;

  try {
    return await callClaude(system, messages, 800);
  } catch (err) {
    console.error('[AI Chatbot]', err);
    return "I'm having trouble connecting to the AI service. Please ensure ANTHROPIC_API_KEY is configured correctly in your .env.local file.";
  }
}

// ── 4. Performance Review Insights ───────────────────────────────────────────
export async function generatePerformanceInsights(reviews: {
  employee_name: string;
  rating: number;
  kpi_achievement: number;
  comments: string;
  strengths?: string;
  improvements?: string;
}[]): Promise<{
  team_summary: string;
  top_performers: string[];
  needs_support: string[];
  recommended_actions: string[];
  team_morale_indicator: 'positive' | 'neutral' | 'concerning';
}> {
  const system = `You are an HR analytics expert. Analyse performance review data and return ONLY valid JSON.
Return: { team_summary (2 sentences), top_performers (string array of names), needs_support (string array), recommended_actions (string array max 4), team_morale_indicator ("positive"|"neutral"|"concerning") }`;

  try {
    const raw = await callClaude(system, [{
      role: 'user',
      content: `Analyse these performance reviews:\n${JSON.stringify(reviews, null, 2)}`,
    }], 1000);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return {
      team_summary: 'Performance analysis unavailable. Configure ANTHROPIC_API_KEY for AI insights.',
      top_performers: [],
      needs_support: [],
      recommended_actions: ['Configure AI key to enable automated performance insights'],
      team_morale_indicator: 'neutral',
    };
  }
}

// ── 5. Job Description Generator ─────────────────────────────────────────────
export async function generateJobDescription(opts: {
  job_title: string;
  department: string;
  employment_type: string;
  salary_range?: string;
  key_responsibilities?: string;
}): Promise<string> {
  const system = `You are an expert HR copywriter. Generate professional, engaging job descriptions.
Include: Overview (2-3 sentences), Key Responsibilities (5-7 bullets), Requirements (5-6 bullets), 
What We Offer (3-4 bullets). Use Australian English. Be specific and avoid generic filler.
Keep the tone professional but approachable.`;

  const prompt = `Generate a job description for:
Title: ${opts.job_title}
Department: ${opts.department}  
Type: ${opts.employment_type}
${opts.salary_range ? `Salary: ${opts.salary_range}` : ''}
${opts.key_responsibilities ? `Key focus areas: ${opts.key_responsibilities}` : ''}`;

  try {
    return await callClaude(system, [{ role: 'user', content: prompt }], 800);
  } catch {
    return `# ${opts.job_title}\n\nJob description generation requires ANTHROPIC_API_KEY to be configured.`;
  }
}

// ── 6. Payroll Anomaly Detection ──────────────────────────────────────────────
export async function detectPayrollAnomalies(payslips: {
  employee_name: string;
  gross_salary: number;
  tax_withheld: number;
  superannuation: number;
  net_pay: number;
  previous_gross?: number;
}[]): Promise<{ anomalies: string[]; risk_flags: string[] }> {
  const system = `You are a payroll audit AI. Identify calculation errors and risk flags.
Check: tax rate reasonableness (should be 15-45% for most Australian incomes), super at ~11.5%, 
unusual salary changes vs previous period, negative values, or mathematical inconsistencies.
Return ONLY JSON: { anomalies: string[], risk_flags: string[] }`;

  try {
    const raw = await callClaude(system, [{
      role: 'user',
      content: `Audit these payslips:\n${JSON.stringify(payslips, null, 2)}`,
    }], 600);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    // Simple rule-based check
    const anomalies: string[] = [];
    payslips.forEach(p => {
      const taxRate = p.tax_withheld / p.gross_salary;
      if (taxRate > 0.5)  anomalies.push(`${p.employee_name}: Tax rate ${(taxRate*100).toFixed(0)}% seems high`);
      if (taxRate < 0.05 && p.gross_salary > 20000) anomalies.push(`${p.employee_name}: Tax rate very low for income level`);
      const superRate = p.superannuation / p.gross_salary;
      if (superRate < 0.10 || superRate > 0.13) anomalies.push(`${p.employee_name}: Super rate ${(superRate*100).toFixed(1)}% outside expected range`);
    });
    return { anomalies, risk_flags: [] };
  }
}

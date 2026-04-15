// ABA (Australian Banking Association) file format generator
// Used by Australian banks for batch direct credit payments (payroll)
// Spec: https://www.cemtexaba.com/aba-format/cemtex-aba-file-format-details

export interface ABARecord {
  bsb: string;           // BSB XXX-XXX
  account_number: string;
  indicator: 'N' | 'W' | 'X' | 'Y'; // N=normal, W=withholding, X=pensioner, Y=savings
  transaction_code: '50' | '53'; // 50=credit, 53=debit
  amount: number;        // in cents
  account_name: string;  // max 32 chars
  lodgement_ref: string; // max 18 chars - appears on employee bank statement
  trace_bsb: string;     // company BSB
  trace_account: string; // company account
  remitter_name: string; // max 16 chars - company name
  tax_withholding: number; // cents (0 for credits)
}

export interface ABAOptions {
  // File header
  bsb: string;              // Company BSB
  account_number: string;   // Company account
  bank_code: string;        // 2-letter bank code (e.g. 'CBA', 'ANZ', 'WBC')
  user_name: string;        // max 26 chars
  apca_number: string;      // APCA user ID (from your bank)
  description: string;      // max 12 chars (e.g. 'PAYROLL APR')
  process_date: string;     // DDMMYY
  records: ABARecord[];
}

function pad(str: string | number, len: number, char = ' ', right = false): string {
  const s = String(str);
  if (s.length >= len) return s.slice(0, len);
  const padding = char.repeat(len - s.length);
  return right ? s + padding : padding + s;
}

function formatBSB(bsb: string): string {
  // Ensure BSB is in XXX-XXX format
  const clean = bsb.replace(/\D/g, '');
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

function formatAmount(cents: number): string {
  return pad(Math.abs(Math.round(cents)), 10, '0');
}

export function generateABAFile(opts: ABAOptions): string {
  const lines: string[] = [];

  // ── Descriptive record (type 0) ─────────────────────────────────────────────
  const header = [
    '0',                                          // Record type
    '                ',                           // Blank (17 chars)
    '01',                                         // Reel sequence
    pad(opts.bank_code, 3),                       // Financial institution
    '   ',                                        // Blank
    pad(opts.user_name, 26),                      // User preferred name
    pad(opts.apca_number, 6, '0'),                // APCA number
    pad(opts.description, 12),                    // Description
    opts.process_date,                            // Date (DDMMYY)
    ' '.repeat(40),                               // Padding to 120 chars
  ].join('');
  lines.push(header.slice(0, 120));

  // ── Detail records (type 1) ──────────────────────────────────────────────────
  let totalCredit = 0;
  let totalDebit  = 0;
  let recordCount = 0;

  for (const rec of opts.records) {
    const amtCents = Math.round(rec.amount);
    if (rec.transaction_code === '50') totalCredit += amtCents;
    else                               totalDebit  += amtCents;
    recordCount++;

    const detail = [
      '1',                                                    // Record type
      formatBSB(rec.bsb),                                     // BSB (XXX-XXX)
      pad(rec.account_number.replace(/\s/g,''), 9),           // Account number
      rec.indicator,                                          // Indicator
      rec.transaction_code,                                   // Transaction code
      formatAmount(amtCents),                                 // Amount (cents)
      pad(rec.account_name, 32),                              // Account title
      pad(rec.lodgement_ref, 18),                             // Lodgement ref
      formatBSB(rec.trace_bsb),                               // Trace BSB
      pad(rec.trace_account.replace(/\s/g,''), 9),            // Trace account
      pad(rec.remitter_name, 16),                             // Remitter name
      pad(rec.tax_withholding, 8, '0'),                       // Withholding tax
    ].join('');
    lines.push(detail.slice(0, 120));
  }

  // ── File total record (type 7) ───────────────────────────────────────────────
  const netTotal  = Math.abs(totalCredit - totalDebit);
  const trailer = [
    '7',                                          // Record type
    '999-999',                                    // BSB (always 999-999)
    ' '.repeat(12),                               // Blank
    formatAmount(netTotal),                        // Net total amount
    formatAmount(totalCredit),                     // Total credit amount
    formatAmount(totalDebit),                      // Total debit amount
    ' '.repeat(24),                               // Blank
    pad(recordCount, 6, '0'),                     // Record count
    ' '.repeat(40),                               // Padding
  ].join('');
  lines.push(trailer.slice(0, 120));

  return lines.join('\r\n') + '\r\n';
}

// ── Helper: generate ABA from payslips ───────────────────────────────────────
export interface PayslipForABA {
  employee_name: string;
  bank_bsb: string;
  bank_account: string;
  net_pay: number; // dollars (not cents)
  employee_id: string;
}

export function payslipsToABA(opts: {
  payslips: PayslipForABA[];
  company_bsb: string;
  company_account: string;
  company_name: string;
  bank_code: string;
  apca_number: string;
  pay_period: string; // e.g. 'APR 2025'
  pay_date: Date;
}): { file: string; total: number; count: number; errors: string[] } {
  const errors: string[] = [];
  const records: ABARecord[] = [];

  for (const slip of opts.payslips) {
    if (!slip.bank_bsb || !slip.bank_account) {
      errors.push(`${slip.employee_name}: Missing bank details — skipped`);
      continue;
    }

    const bsbClean = slip.bank_bsb.replace(/\D/g, '');
    if (bsbClean.length !== 6) {
      errors.push(`${slip.employee_name}: Invalid BSB "${slip.bank_bsb}" — skipped`);
      continue;
    }

    records.push({
      bsb:              slip.bank_bsb,
      account_number:   slip.bank_account,
      indicator:        'N',
      transaction_code: '50', // credit
      amount:           Math.round(slip.net_pay * 100), // convert to cents
      account_name:     slip.employee_name.slice(0, 32),
      lodgement_ref:    `SALARY ${opts.pay_period}`.slice(0, 18),
      trace_bsb:        opts.company_bsb,
      trace_account:    opts.company_account,
      remitter_name:    opts.company_name.slice(0, 16),
      tax_withholding:  0,
    });
  }

  const dd   = String(opts.pay_date.getDate()).padStart(2, '0');
  const mm   = String(opts.pay_date.getMonth() + 1).padStart(2, '0');
  const yy   = String(opts.pay_date.getFullYear()).slice(-2);

  const file = generateABAFile({
    bsb:            opts.company_bsb,
    account_number: opts.company_account,
    bank_code:      opts.bank_code,
    user_name:      opts.company_name,
    apca_number:    opts.apca_number,
    description:    opts.pay_period.slice(0, 12),
    process_date:   `${dd}${mm}${yy}`,
    records,
  });

  const total = records.reduce((s, r) => s + r.amount / 100, 0);

  return { file, total, count: records.length, errors };
}

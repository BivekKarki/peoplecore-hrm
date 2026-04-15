import { type ClassValue, clsx } from 'clsx';

// Simple class merger (no clsx dep needed, but pattern is same)
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter(Boolean)
    .map((c) => (typeof c === 'object' ? Object.entries(c as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k).join(' ') : c))
    .join(' ');
}

export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getInitials(firstName: string, lastName: string): string {
  return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
}

export function calculateTax(annualSalary: number): number {
  // Simplified Australian PAYG tax brackets 2024-25
  if (annualSalary <= 18200) return 0;
  if (annualSalary <= 45000) return Math.round((annualSalary - 18200) * 0.19);
  if (annualSalary <= 120000) return Math.round(5092 + (annualSalary - 45000) * 0.325);
  if (annualSalary <= 180000) return Math.round(29467 + (annualSalary - 120000) * 0.37);
  return Math.round(51667 + (annualSalary - 180000) * 0.45);
}

export function calculateSuper(grossSalary: number, rate = 0.115): number {
  return Math.round(grossSalary * rate);
}

export function generateEmployeeId(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `EMP${year}${rand}`;
}

export const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#0d9488', '#d97706',
  '#dc2626', '#16a34a', '#db2777', '#0891b2',
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function calculateLeaveDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    inactive: 'bg-red-100 text-red-800',
    on_leave: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    denied: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    processed: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    half_day: 'bg-orange-100 text-orange-800',
    work_from_home: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    not_started: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export function parseQueryParams(url: string): Record<string, string> {
  const u = new URL(url);
  const params: Record<string, string> = {};
  u.searchParams.forEach((value, key) => { params[key] = value; });
  return params;
}

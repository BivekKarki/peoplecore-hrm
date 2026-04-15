// Role-Based Access Control (RBAC) for PeopleCore HRM
// Roles: super_admin > hr_manager > hr_staff > employee (future)

export type Role = 'super_admin' | 'hr_manager' | 'hr_staff';

// ── Permission definitions ────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Employees
  'employees:read':         ['super_admin', 'hr_manager', 'hr_staff'],
  'employees:create':       ['super_admin', 'hr_manager'],
  'employees:update':       ['super_admin', 'hr_manager'],
  'employees:delete':       ['super_admin'],
  'employees:view_salary':  ['super_admin', 'hr_manager'],
  'employees:view_banking': ['super_admin', 'hr_manager'],

  // Payroll
  'payroll:read':           ['super_admin', 'hr_manager'],
  'payroll:create':         ['super_admin', 'hr_manager'],
  'payroll:process':        ['super_admin'],
  'payroll:export_aba':     ['super_admin'],

  // Leave
  'leave:read':             ['super_admin', 'hr_manager', 'hr_staff'],
  'leave:create':           ['super_admin', 'hr_manager', 'hr_staff'],
  'leave:approve':          ['super_admin', 'hr_manager'],
  'leave:deny':             ['super_admin', 'hr_manager'],

  // Attendance
  'attendance:read':        ['super_admin', 'hr_manager', 'hr_staff'],
  'attendance:write':       ['super_admin', 'hr_manager'],

  // Performance
  'performance:read':       ['super_admin', 'hr_manager', 'hr_staff'],
  'performance:write':      ['super_admin', 'hr_manager'],

  // Documents
  'documents:read':         ['super_admin', 'hr_manager', 'hr_staff'],
  'documents:write':        ['super_admin', 'hr_manager'],
  'documents:verify':       ['super_admin', 'hr_manager'],
  'documents:delete':       ['super_admin'],

  // Expenses
  'expenses:read':          ['super_admin', 'hr_manager', 'hr_staff'],
  'expenses:create':        ['super_admin', 'hr_manager', 'hr_staff'],
  'expenses:approve':       ['super_admin', 'hr_manager'],

  // Shifts
  'shifts:read':            ['super_admin', 'hr_manager', 'hr_staff'],
  'shifts:write':           ['super_admin', 'hr_manager'],

  // Reports
  'reports:read':           ['super_admin', 'hr_manager'],
  'reports:export':         ['super_admin'],

  // AI Features
  'ai:use':                 ['super_admin', 'hr_manager'],
  'ai:attrition':           ['super_admin'],

  // Settings & Admin
  'settings:read':          ['super_admin', 'hr_manager'],
  'settings:write':         ['super_admin'],
  'users:manage':           ['super_admin'],
  'audit:read':             ['super_admin'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ── Check permission ──────────────────────────────────────────────────────────
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

export function requirePermission(role: Role, permission: Permission): boolean {
  return hasPermission(role, permission);
}

// ── Role hierarchy check ──────────────────────────────────────────────────────
const ROLE_LEVEL: Record<Role, number> = {
  super_admin: 3,
  hr_manager:  2,
  hr_staff:    1,
};

export function isAtLeast(userRole: Role, minRole: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

// ── Get all permissions for a role ───────────────────────────────────────────
export function getPermissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(p => hasPermission(role, p));
}

// ── Role display info ────────────────────────────────────────────────────────
export const ROLE_INFO: Record<Role, { label: string; description: string; color: string }> = {
  super_admin: {
    label:       'Super Admin',
    description: 'Full system access — all features, settings, and user management',
    color:       'text-red-400 bg-red-900/30 border-red-700/40',
  },
  hr_manager: {
    label:       'HR Manager',
    description: 'Full HR operations — employees, payroll, leave, reports',
    color:       'text-blue-400 bg-blue-900/30 border-blue-700/40',
  },
  hr_staff: {
    label:       'HR Staff',
    description: 'Day-to-day operations — view employees, manage attendance and leave',
    color:       'text-green-400 bg-green-900/30 border-green-700/40',
  },
};

// ── Next.js API route permission guard ────────────────────────────────────────
import { NextResponse } from 'next/server';
import { AdminUser } from '@/types';

export function checkPermission(user: AdminUser | null, permission: Permission): NextResponse | null {
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(user.role as Role, permission)) {
    return NextResponse.json({
      error: `Insufficient permissions. Required: ${permission}. Your role: ${user.role}`,
    }, { status: 403 });
  }
  return null;
}

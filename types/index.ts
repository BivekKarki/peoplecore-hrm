// Employee Types
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'casual';
export type EmployeeStatus = 'active' | 'inactive' | 'pending' | 'on_leave';
export type Department = string;

export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department: Department;
  job_title: string;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  start_date: string;
  salary: number;
  manager_id?: string;
  address?: string;
  emergency_contact?: string;
  tax_file_number?: string;
  bank_bsb?: string;
  bank_account?: string;
  super_fund?: string;
  face_enrolled: boolean;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithManager extends Employee {
  manager_name?: string;
}

// Payroll Types
export type PayPeriod = 'weekly' | 'fortnightly' | 'monthly';
export type PayrollStatus = 'draft' | 'approved' | 'processed' | 'paid';

export interface PayrollRun {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: PayrollStatus;
  total_gross: number;
  total_tax: number;
  total_super: number;
  total_net: number;
  employee_count: number;
  created_at: string;
  processed_at?: string;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_salary: number;
  tax_withheld: number;
  superannuation: number;
  net_pay: number;
  allowances: number;
  deductions: number;
  ytd_gross: number;
  ytd_tax: number;
  ytd_super: number;
  created_at: string;
}

// Attendance Types
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'work_from_home';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  hours_worked?: number;
  status: AttendanceStatus;
  method?: string;
  notes?: string;
  employee_name?: string;
}

// Leave Types
export type LeaveType = 'annual' | 'sick' | 'parental' | 'unpaid' | 'compassionate' | 'long_service';
export type LeaveStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  employee_name?: string;
  approver_name?: string;
}

export interface LeaveBalance {
  employee_id: string;
  employee_name: string;
  annual_total: number;
  annual_used: number;
  annual_remaining: number;
  sick_total: number;
  sick_used: number;
  sick_remaining: number;
}

// Performance Types
export type PerformanceRating = 1 | 2 | 3 | 4 | 5;

export interface PerformanceReview {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_period: string;
  rating: PerformanceRating;
  kpi_achievement: number;
  goals_met: number;
  comments: string;
  strengths?: string;
  improvements?: string;
  next_review_date?: string;
  created_at: string;
  employee_name?: string;
  reviewer_name?: string;
}

// Induction Types
export type InductionStatus = 'not_started' | 'in_progress' | 'completed';

export interface InductionRecord {
  id: string;
  employee_id: string;
  status: InductionStatus;
  step: number;
  personal_details_done: boolean;
  documents_done: boolean;
  training_done: boolean;
  it_setup_done: boolean;
  completed_at?: string;
  created_at: string;
  employee_name?: string;
  department?: string;
}

// Auth Types
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'hr_manager' | 'hr_staff';
  created_at: string;
}

export interface AuthSession {
  user: AdminUser;
  token: string;
}

// Dashboard Types
export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  on_leave: number;
  pending_inductions: number;
  present_today: number;
  absent_today: number;
  monthly_payroll: number;
  pending_leaves: number;
  new_this_month: number;
}

export interface DepartmentCount {
  department: string;
  count: number;
  avg_salary: number;
}

// API Response
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
}

-- PeopleCore HRM - PostgreSQL Schema
-- Run: psql -U postgres -d peoplecore_hrm -f scripts/schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ─── ADMIN USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'hr_staff' CHECK (role IN ('super_admin','hr_manager','hr_staff')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EMPLOYEES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        VARCHAR(20) UNIQUE NOT NULL,
  first_name         VARCHAR(100) NOT NULL,
  last_name          VARCHAR(100) NOT NULL,
  email              VARCHAR(255) UNIQUE NOT NULL,
  phone              VARCHAR(30),
  department         VARCHAR(100) NOT NULL,
  job_title          VARCHAR(150) NOT NULL,
  employment_type    VARCHAR(20) NOT NULL DEFAULT 'full-time'
                       CHECK (employment_type IN ('full-time','part-time','contract','casual')),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('active','inactive','pending','on_leave')),
  start_date         DATE NOT NULL,
  end_date           DATE,
  salary             NUMERIC(12,2) NOT NULL DEFAULT 0,
  manager_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  address            TEXT,
  emergency_contact  TEXT,
  tax_file_number    VARCHAR(20),
  bank_bsb           VARCHAR(10),
  bank_account       VARCHAR(20),
  super_fund         VARCHAR(150),
  super_member_no    VARCHAR(30),
  face_enrolled      BOOLEAN NOT NULL DEFAULT FALSE,
  face_encoding      TEXT, -- base64 face descriptor (for real facial recognition)
  avatar_color       VARCHAR(10) NOT NULL DEFAULT '#2563eb',
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_search ON employees USING GIN (
  to_tsvector('english', first_name || ' ' || last_name || ' ' || email || ' ' || department)
);

-- ─── INDUCTION ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inductions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id            UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status                 VARCHAR(20) NOT NULL DEFAULT 'not_started'
                           CHECK (status IN ('not_started','in_progress','completed')),
  step                   INT NOT NULL DEFAULT 1,
  personal_details_done  BOOLEAN NOT NULL DEFAULT FALSE,
  documents_done         BOOLEAN NOT NULL DEFAULT FALSE,
  training_done          BOOLEAN NOT NULL DEFAULT FALSE,
  it_setup_done          BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_pack_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  contract_signed        BOOLEAN NOT NULL DEFAULT FALSE,
  payroll_setup_done     BOOLEAN NOT NULL DEFAULT FALSE,
  team_intro_done        BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at           TIMESTAMPTZ,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inductions_employee ON inductions(employee_id);
CREATE INDEX IF NOT EXISTS idx_inductions_status ON inductions(status);

-- ─── PAYROLL RUNS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  pay_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','processed','paid')),
  total_gross     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_tax       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_super     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net       NUMERIC(15,2) NOT NULL DEFAULT 0,
  employee_count  INT NOT NULL DEFAULT 0,
  processed_by    UUID REFERENCES admin_users(id),
  processed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PAYSLIPS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payslips (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_salary    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_withheld    NUMERIC(12,2) NOT NULL DEFAULT 0,
  superannuation  NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances      NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ytd_gross       NUMERIC(15,2) NOT NULL DEFAULT 0,
  ytd_tax         NUMERIC(15,2) NOT NULL DEFAULT 0,
  ytd_super       NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_emailed      BOOLEAN NOT NULL DEFAULT FALSE,
  emailed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(payroll_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payslips_unique ON payslips(payroll_run_id, employee_id);

-- ─── ATTENDANCE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  check_in      TIMESTAMPTZ,
  check_out     TIMESTAMPTZ,
  hours_worked  NUMERIC(4,2),
  status        VARCHAR(20) NOT NULL DEFAULT 'absent'
                  CHECK (status IN ('present','absent','late','half_day','work_from_home')),
  method        VARCHAR(20) DEFAULT 'manual' CHECK (method IN ('manual','facial','card','app')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- ─── LEAVE REQUESTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type     VARCHAR(30) NOT NULL
                   CHECK (leave_type IN ('annual','sick','parental','unpaid','compassionate','long_service')),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  days           INT NOT NULL DEFAULT 1,
  reason         TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','denied','cancelled')),
  approved_by    UUID REFERENCES admin_users(id),
  approved_at    TIMESTAMPTZ,
  denial_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON leave_requests(start_date, end_date);

-- ─── PERFORMANCE REVIEWS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id       UUID NOT NULL REFERENCES admin_users(id),
  review_period     VARCHAR(20) NOT NULL, -- e.g. 'Q1-2025', 'Annual-2024'
  rating            INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  kpi_achievement   INT NOT NULL DEFAULT 0 CHECK (kpi_achievement BETWEEN 0 AND 200),
  goals_met         INT NOT NULL DEFAULT 0 CHECK (goals_met BETWEEN 0 AND 100),
  comments          TEXT NOT NULL,
  strengths         TEXT,
  improvements      TEXT,
  next_review_date  DATE,
  salary_adjustment NUMERIC(5,2), -- percentage
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_period ON performance_reviews(review_period);

-- ─── FACIAL RECOGNITION LOGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facial_login_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  success     BOOLEAN NOT NULL DEFAULT FALSE,
  confidence  NUMERIC(5,2), -- match confidence 0-100
  ip_address  INET,
  user_agent  TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facial_employee ON facial_login_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_facial_time ON facial_login_logs(logged_at);

-- ─── AUDIT LOG ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admin_users','employees','inductions','payroll_runs','payslips','attendance','leave_requests','performance_reviews'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
       CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ─── SEED DATA ──────────────────────────────────────────────────────
-- Default admin (password: Admin@1234)
INSERT INTO admin_users (name, email, password_hash, role)
VALUES (
  'System Admin',
  'admin@peoplecore.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/KUn1nQeSO',
  'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- Sample departments / employees
INSERT INTO employees (employee_id, first_name, last_name, email, phone, department, job_title, employment_type, status, start_date, salary, avatar_color)
VALUES
  ('EMP2401', 'Sarah',  'Kim',    'sarah.kim@company.com',   '+61 412 111 222', 'Engineering', 'Lead Engineer',      'full-time', 'active',   '2021-03-15', 120000, '#2563eb'),
  ('EMP2402', 'James',  'Liu',    'james.liu@company.com',   '+61 413 222 333', 'Sales',       'Sales Manager',      'full-time', 'active',   '2022-07-01', 95000,  '#7c3aed'),
  ('EMP2403', 'Priya',  'Mehta',  'priya.m@company.com',     '+61 414 333 444', 'Marketing',   'Marketing Lead',     'full-time', 'on_leave', '2020-11-20', 88000,  '#0d9488'),
  ('EMP2404', 'David',  'Chen',   'david.c@company.com',     '+61 415 444 555', 'Finance',     'Financial Analyst',  'full-time', 'active',   '2023-01-10', 75000,  '#d97706'),
  ('EMP2405', 'Emma',   'Walsh',  'emma.w@company.com',      '+61 416 555 666', 'HR',          'HR Coordinator',     'part-time', 'inactive', '2022-04-05', 68000,  '#dc2626'),
  ('EMP2406', 'Lucas',  'Pham',   'lucas.p@company.com',     '+61 417 666 777', 'Engineering', 'Frontend Developer', 'full-time', 'active',   '2023-08-14', 85000,  '#16a34a'),
  ('EMP2407', 'Zoe',    'Nguyen', 'zoe.n@company.com',       '+61 418 777 888', 'Operations',  'Ops Analyst',        'contract',  'pending',  '2024-02-01', 72000,  '#7c3aed'),
  ('EMP2408', 'Marcus', 'Brooks', 'marcus.b@company.com',    '+61 419 888 999', 'Engineering', 'Backend Developer',  'full-time', 'active',   '2023-05-22', 92000,  '#0891b2')
ON CONFLICT (employee_id) DO NOTHING;

-- Inductions for pending employees
INSERT INTO inductions (employee_id, status, step, personal_details_done, documents_done)
SELECT id, 'in_progress', 2, TRUE, FALSE FROM employees WHERE employee_id IN ('EMP2407','EMP2408')
ON CONFLICT DO NOTHING;

INSERT INTO inductions (employee_id, status, step, personal_details_done)
SELECT id, 'not_started', 1, FALSE FROM employees WHERE employee_id = 'EMP2405'
ON CONFLICT DO NOTHING;

-- Sample leave requests
INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status)
SELECT id, 'annual', CURRENT_DATE + 7, CURRENT_DATE + 11, 5, 'Family holiday', 'pending'
FROM employees WHERE employee_id = 'EMP2403'
ON CONFLICT DO NOTHING;

INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status)
SELECT id, 'sick', CURRENT_DATE - 1, CURRENT_DATE, 2, 'Unwell', 'approved'
FROM employees WHERE employee_id = 'EMP2402'
ON CONFLICT DO NOTHING;

-- Today's attendance
INSERT INTO attendance (employee_id, date, check_in, status)
SELECT id, CURRENT_DATE, NOW() - INTERVAL '2 hours', 'present'
FROM employees WHERE employee_id IN ('EMP2401','EMP2404','EMP2406','EMP2408')
ON CONFLICT DO NOTHING;

INSERT INTO attendance (employee_id, date, check_in, status)
SELECT id, CURRENT_DATE, NOW() - INTERVAL '30 minutes', 'late'
FROM employees WHERE employee_id = 'EMP2402'
ON CONFLICT DO NOTHING;

COMMIT;

-- ─── V2: FACE RECOGNITION & WORK SESSIONS ──────────────────────────────────

-- Add face descriptor columns to employees (safe to run multiple times)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS face_descriptor_front  TEXT,
  ADD COLUMN IF NOT EXISTS face_descriptor_left   TEXT,
  ADD COLUMN IF NOT EXISTS face_descriptor_right  TEXT;

-- Update face_enrolled default (already exists, just ensure it's there)
ALTER TABLE employees ALTER COLUMN face_enrolled SET DEFAULT FALSE;

-- Work / shift sessions
CREATE TABLE IF NOT EXISTS work_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in        TIMESTAMPTZ,
  check_out       TIMESTAMPTZ,
  duration_mins   NUMERIC(8,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','absent')),
  check_in_photo  TEXT,
  device_id       VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_sessions_employee ON work_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date     ON work_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status   ON work_sessions(status);

-- Mobile push tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    VARCHAR(10) DEFAULT 'expo' CHECK (platform IN ('expo','fcm','apns')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, token)
);

-- Trigger for work_sessions updated_at
DROP TRIGGER IF EXISTS trg_work_sessions_updated_at ON work_sessions;
CREATE TRIGGER trg_work_sessions_updated_at
  BEFORE UPDATE ON work_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


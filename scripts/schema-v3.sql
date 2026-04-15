-- ─── V3: SHIFT SCHEDULING, DOCUMENTS, NOTIFICATIONS ──────────────────────

-- Shift templates
CREATE TABLE IF NOT EXISTS shift_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  break_mins  INT NOT NULL DEFAULT 30,
  color       VARCHAR(10) NOT NULL DEFAULT '#2563eb',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly roster / shift assignments
CREATE TABLE IF NOT EXISTS shifts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  shift_date        DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  break_mins        INT NOT NULL DEFAULT 30,
  location          VARCHAR(100),
  notes             TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  created_by        UUID REFERENCES admin_users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_employee ON shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date     ON shifts(shift_date);

-- Employee documents
CREATE TABLE IF NOT EXISTS employee_documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type     VARCHAR(50) NOT NULL
                 CHECK (doc_type IN ('contract','id','passport','visa','tax','certificate',
                                     'qualification','medical','other')),
  title        VARCHAR(200) NOT NULL,
  file_name    VARCHAR(255),
  file_size    INT,
  file_url     TEXT,
  mime_type    VARCHAR(100),
  expiry_date  DATE,
  is_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by  UUID REFERENCES admin_users(id),
  notes        TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_employee   ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_docs_expiry     ON employee_documents(expiry_date);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  message     TEXT NOT NULL,
  link        VARCHAR(300),
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifs_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(user_id, is_read);

-- Expense claims
CREATE TABLE IF NOT EXISTS expense_claims (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  category    VARCHAR(50) NOT NULL
                CHECK (category IN ('travel','meals','accommodation','equipment','training','other')),
  claim_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  notes       TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expense_claims(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status   ON expense_claims(status);

-- Announcements / company news
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,
  priority    VARCHAR(10) NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low','normal','high','urgent')),
  target_dept VARCHAR(100),   -- NULL = all departments
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES admin_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training modules
CREATE TABLE IF NOT EXISTS training_modules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  duration_mins INT NOT NULL DEFAULT 30,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  category     VARCHAR(50) NOT NULL DEFAULT 'compliance',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employee training completions
CREATE TABLE IF NOT EXISTS training_completions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score       INT CHECK (score BETWEEN 0 AND 100),
  UNIQUE(employee_id, module_id)
);

-- Default shift templates
INSERT INTO shift_templates (name, start_time, end_time, break_mins, color) VALUES
  ('Morning Shift',   '07:00', '15:00', 30, '#2563eb'),
  ('Day Shift',       '09:00', '17:00', 60, '#16a34a'),
  ('Afternoon Shift', '13:00', '21:00', 30, '#d97706'),
  ('Night Shift',     '22:00', '06:00', 30, '#7c3aed'),
  ('Half Day AM',     '08:00', '12:00',  0, '#0d9488'),
  ('Half Day PM',     '13:00', '17:00',  0, '#db2777')
ON CONFLICT DO NOTHING;

-- Default training modules
INSERT INTO training_modules (title, description, duration_mins, is_mandatory, category) VALUES
  ('WHS & Workplace Safety',        'Work health and safety induction',           30, TRUE,  'compliance'),
  ('Code of Conduct',               'Company policies and expected behaviour',    20, TRUE,  'compliance'),
  ('IT Security Awareness',         'Password hygiene, phishing, data handling',  15, TRUE,  'compliance'),
  ('Anti-Discrimination & EEO',     'Equal employment opportunity principles',    25, TRUE,  'compliance'),
  ('Privacy & Data Protection',     'Handling personal and sensitive data',       20, TRUE,  'compliance'),
  ('Emergency Evacuation Procedure','Fire drills and evacuation routes',          10, TRUE,  'safety'),
  ('Customer Service Excellence',   'Service standards and communication',        45, FALSE, 'professional'),
  ('Leadership Fundamentals',       'Managing teams effectively',                 60, FALSE, 'leadership')
ON CONFLICT DO NOTHING;

-- Triggers
DROP TRIGGER IF EXISTS trg_shifts_updated_at ON shifts;
CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expense_claims;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expense_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

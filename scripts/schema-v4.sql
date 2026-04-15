-- ─── V4: RBAC & ADMIN ENHANCEMENTS ────────────────────────────────────────────

-- Add updated_at to admin_users if missing
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure admin_users trigger exists
DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add company settings table for ABA export config
CREATE TABLE IF NOT EXISTS company_settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO company_settings (key, value) VALUES
  ('company_name',    'PeopleCore Pty Ltd'),
  ('abn',             '12 345 678 901'),
  ('company_bsb',     '063-000'),
  ('company_account', '12345678'),
  ('bank_code',       'CBA'),
  ('apca_number',     '000000'),
  ('payroll_cycle',   'monthly'),
  ('super_rate',      '11.5'),
  ('hr_email',        'hr@peoplecore.com.au')
ON CONFLICT (key) DO NOTHING;

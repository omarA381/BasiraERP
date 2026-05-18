-- ============================================================
-- NEXTERP Foundation Module — Initial Schema
-- Migration: 001_foundation_schema
-- ============================================================

BEGIN;

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Custom ENUMs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE calendar_type_enum AS ENUM ('gregorian', 'hijri');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(20)  NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  legal_name    VARCHAR(300),
  tax_number    VARCHAR(50),
  address       TEXT,
  phone         VARCHAR(30),
  email         VARCHAR(150),
  logo_url      TEXT,
  base_currency VARCHAR(3)   NOT NULL DEFAULT 'USD',
  fiscal_year_start DATE,
  calendar_type calendar_type_enum NOT NULL DEFAULT 'gregorian',
  default_language VARCHAR(10) NOT NULL DEFAULT 'en',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. branches
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            VARCHAR(20)  NOT NULL,
  name            VARCHAR(200) NOT NULL,
  address         TEXT,
  phone           VARCHAR(30),
  is_head_office  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, code)
);

-- ============================================================
-- 3. roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_name      VARCHAR(100) NOT NULL,
  description    TEXT,
  is_system_role BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, role_name)
);

-- ============================================================
-- 4. permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_code VARCHAR(50)  NOT NULL,
  action_code VARCHAR(20)  NOT NULL CHECK (action_code IN ('VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE')),
  description VARCHAR(200),

  UNIQUE (module_code, action_code)
);

-- ============================================================
-- 5. role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 6. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id           UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id            UUID         REFERENCES branches(id) ON DELETE SET NULL,
  username             VARCHAR(50)  NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  full_name            VARCHAR(200) NOT NULL,
  email                VARCHAR(150),
  phone                VARCHAR(30),
  role_id              UUID         NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login           TIMESTAMPTZ,
  created_by           UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, username)
);

-- ============================================================
-- 7. audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  company_id  UUID,
  user_id     UUID,
  action      VARCHAR(50)  NOT NULL,
  table_name  VARCHAR(100),
  record_id   VARCHAR(50),
  old_values  JSONB,
  new_values  JSONB,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. app_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key   VARCHAR(100) NOT NULL,
  setting_value JSONB       NOT NULL DEFAULT '{}',
  updated_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, setting_key)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_company_created
  ON audit_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id
  ON audit_log (user_id);

CREATE INDEX IF NOT EXISTS idx_users_company_username
  ON users (company_id, username);

CREATE INDEX IF NOT EXISTS idx_users_role_id
  ON users (role_id);

CREATE INDEX IF NOT EXISTS idx_branches_company_id
  ON branches (company_id);

CREATE INDEX IF NOT EXISTS idx_roles_company_id
  ON roles (company_id);

CREATE INDEX IF NOT EXISTS idx_app_settings_company_key
  ON app_settings (company_id, setting_key);

-- ============================================================
-- Updated-at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['companies', 'branches', 'users', 'app_settings'])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

COMMIT;
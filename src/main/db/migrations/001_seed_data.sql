-- ============================================================
-- NEXTERP Foundation Module — Seed Data
-- Seed: 001_seed_data
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Default System Company
-- ============================================================
INSERT INTO companies (id, code, name, legal_name, base_currency, default_language, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SYSTEM',
  'NEXTERP System',
  'NEXTERP System',
  'USD',
  'en',
  TRUE
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Foundation Module Permissions
-- ============================================================
INSERT INTO permissions (id, module_code, action_code, description) VALUES
  -- Companies
  (uuid_generate_v4(), 'companies', 'VIEW',     'View company information'),
  (uuid_generate_v4(), 'companies', 'CREATE',   'Create new companies'),
  (uuid_generate_v4(), 'companies', 'EDIT',     'Edit company information'),
  (uuid_generate_v4(), 'companies', 'DELETE',   'Delete companies'),

  -- Branches
  (uuid_generate_v4(), 'branches',  'VIEW',     'View branches'),
  (uuid_generate_v4(), 'branches',  'CREATE',   'Create new branches'),
  (uuid_generate_v4(), 'branches',  'EDIT',     'Edit branch information'),
  (uuid_generate_v4(), 'branches',  'DELETE',   'Delete branches'),

  -- Roles
  (uuid_generate_v4(), 'roles',     'VIEW',     'View roles'),
  (uuid_generate_v4(), 'roles',     'CREATE',   'Create new roles'),
  (uuid_generate_v4(), 'roles',     'EDIT',     'Edit role information'),
  (uuid_generate_v4(), 'roles',     'DELETE',   'Delete roles'),

  -- Permissions
  (uuid_generate_v4(), 'permissions', 'VIEW',   'View permissions'),

  -- Users
  (uuid_generate_v4(), 'users',     'VIEW',     'View users'),
  (uuid_generate_v4(), 'users',     'CREATE',   'Create new users'),
  (uuid_generate_v4(), 'users',     'EDIT',     'Edit user information'),
  (uuid_generate_v4(), 'users',     'DELETE',   'Delete users'),

  -- Audit Log
  (uuid_generate_v4(), 'audit_log', 'VIEW',     'View audit logs'),

  -- App Settings
  (uuid_generate_v4(), 'app_settings', 'VIEW',  'View application settings'),
  (uuid_generate_v4(), 'app_settings', 'EDIT',  'Edit application settings'),

  -- Approval Workflows
  (uuid_generate_v4(), 'workflows', 'VIEW',     'View approval workflows'),
  (uuid_generate_v4(), 'workflows', 'CREATE',   'Create approval workflows'),
  (uuid_generate_v4(), 'workflows', 'EDIT',     'Edit approval workflows'),
  (uuid_generate_v4(), 'workflows', 'DELETE',   'Delete approval workflows'),
  (uuid_generate_v4(), 'workflows', 'APPROVE',  'Approve workflow requests')
ON CONFLICT (module_code, action_code) DO NOTHING;

-- ============================================================
-- 3. Default System Administrator Role
-- ============================================================
INSERT INTO roles (id, company_id, role_name, description, is_system_role)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'System Administrator',
  'Built-in system administrator with full access to all modules',
  TRUE
)
ON CONFLICT (company_id, role_name) DO NOTHING;

-- ============================================================
-- 4. Assign All Permissions to System Administrator Role
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT
  '00000000-0000-0000-0000-000000000010',
  id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- 5. Default Admin User
-- ============================================================
INSERT INTO users (
  id,
  company_id,
  username,
  password_hash,
  full_name,
  email,
  role_id,
  is_active,
  must_change_password
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2b$10$jE.XPmYIkFumxCHJB1ESd.SKab9b65cDLLzsaizvhQ1w.jHix5eum',
  'System Administrator',
  'admin@nexterp.local',
  '00000000-0000-0000-0000-000000000010',
  TRUE,
  TRUE
)
ON CONFLICT (company_id, username) DO NOTHING;

COMMIT;
-- ============================================================
-- NEXTERP Workflow Engine — Workflow Steps Table
-- Migration: 002_workflow_steps
-- ============================================================

BEGIN;

-- ============================================================
-- workflow_steps: stores approval workflow definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  module        VARCHAR(50)  NOT NULL,
  trigger       VARCHAR(100),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  conditions    JSONB        NOT NULL DEFAULT '[]',
  steps         JSONB        NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_steps_company_module
  ON workflow_steps (company_id, module);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_active
  ON workflow_steps (company_id, is_active);

-- Updated-at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_workflow_steps_updated_at'
  ) THEN
    CREATE TRIGGER trg_workflow_steps_updated_at
      BEFORE UPDATE ON workflow_steps
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
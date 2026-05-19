-- ============================================================
-- NEXTERP Foundation Module — Fiscal Periods, Currencies & Exchange Rates
-- Migration: 003_fiscal_currencies
-- ============================================================

BEGIN;

-- ============================================================
-- 1. fiscal_periods
-- ============================================================
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_name   VARCHAR(100) NOT NULL,
  start_date    DATE         NOT NULL,
  end_date      DATE         NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'future'
                CHECK (status IN ('open', 'closed', 'future')),
  fiscal_year   INTEGER      NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, period_name)
);

-- ============================================================
-- 2. currencies
-- ============================================================
CREATE TABLE IF NOT EXISTS currencies (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id       UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  currency_code    VARCHAR(3)   NOT NULL,
  currency_name    VARCHAR(100) NOT NULL,
  symbol           VARCHAR(10),
  decimal_places   INTEGER      NOT NULL DEFAULT 2,
  is_base_currency BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (company_id, currency_code)
);

-- ============================================================
-- 3. exchange_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_currency   VARCHAR(3)   NOT NULL,
  to_currency     VARCHAR(3)   NOT NULL,
  rate            DECIMAL(18,8) NOT NULL,
  effective_date  DATE         NOT NULL,
  source          VARCHAR(20)  DEFAULT 'manual',
  created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Add profile columns to companies
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trade_name      VARCHAR(200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry        VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type    VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS foundation_date DATE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS date_format     VARCHAR(20)  DEFAULT 'DD/MM/YYYY';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS time_zone       VARCHAR(50)  DEFAULT 'Africa/Cairo';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS number_format   VARCHAR(20)  DEFAULT '1,234.56';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website         VARCHAR(200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fax             VARCHAR(30);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city            VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state_province  VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code     VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country         VARCHAR(100);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_company_year
  ON fiscal_periods (company_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status
  ON fiscal_periods (company_id, status);
CREATE INDEX IF NOT EXISTS idx_currencies_company
  ON currencies (company_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair
  ON exchange_rates (company_id, from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date
  ON exchange_rates (effective_date DESC);

COMMIT;
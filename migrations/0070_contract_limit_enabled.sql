ALTER TABLE prices ADD COLUMN IF NOT EXISTS contract_limit_enabled boolean DEFAULT true;

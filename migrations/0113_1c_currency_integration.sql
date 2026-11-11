BEGIN;

ALTER TABLE currencies
  ADD COLUMN IF NOT EXISTS id_1c uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;

ALTER TABLE exchange_rates
  ADD COLUMN IF NOT EXISTS id_1c uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;

CREATE UNIQUE INDEX IF NOT EXISTS currencies_id_1c_unique
  ON currencies (id_1c) WHERE id_1c IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exchange_rates_id_1c_unique
  ON exchange_rates (id_1c) WHERE id_1c IS NOT NULL;

COMMIT;

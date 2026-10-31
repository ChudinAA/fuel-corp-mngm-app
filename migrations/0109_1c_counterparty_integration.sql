BEGIN;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS id_1c text,
  ADD COLUMN IF NOT EXISTS integration_status text,
  ADD COLUMN IF NOT EXISTS integration_pending_review boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_id_1c_unique
  ON suppliers (id_1c) WHERE id_1c IS NOT NULL;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS id_1c text,
  ADD COLUMN IF NOT EXISTS integration_status text,
  ADD COLUMN IF NOT EXISTS integration_pending_review boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS customers_id_1c_unique
  ON customers (id_1c) WHERE id_1c IS NOT NULL;

ALTER TABLE logistics_carriers
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS id_1c text,
  ADD COLUMN IF NOT EXISTS integration_status text,
  ADD COLUMN IF NOT EXISTS integration_pending_review boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS logistics_carriers_id_1c_unique
  ON logistics_carriers (id_1c) WHERE id_1c IS NOT NULL;

CREATE TABLE IF NOT EXISTS integration_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL DEFAULT '1c',
  label text NOT NULL DEFAULT '1С',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  created_by_id uuid,
  revoked_at timestamp,
  revoked_by_id uuid
);
CREATE INDEX IF NOT EXISTS integration_api_keys_integration_idx
  ON integration_api_keys (integration);
CREATE UNIQUE INDEX IF NOT EXISTS integration_api_keys_one_active_per_integration
  ON integration_api_keys (integration) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS integration_settings (
  id integer PRIMARY KEY DEFAULT 1,
  counterparty_master_data_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by_id uuid
);

CREATE TABLE IF NOT EXISTS integration_request_logs (
  id serial PRIMARY KEY,
  integration text NOT NULL DEFAULT '1c',
  request_id uuid NOT NULL,
  api_key_id uuid,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer NOT NULL,
  item_count integer,
  error_code text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_request_logs_created_idx
  ON integration_request_logs (created_at);
CREATE INDEX IF NOT EXISTS integration_request_logs_request_idx
  ON integration_request_logs (request_id);

CREATE TABLE IF NOT EXISTS integration_change_logs (
  id serial PRIMARY KEY,
  integration text NOT NULL DEFAULT '1c',
  request_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  id_1c text NOT NULL,
  operation text NOT NULL,
  outcome text NOT NULL,
  incoming_data jsonb,
  old_data jsonb,
  new_data jsonb,
  error_code text,
  error_message text,
  reviewed_at timestamp,
  reviewed_by_id uuid,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_change_logs_request_idx
  ON integration_change_logs (request_id);
CREATE INDEX IF NOT EXISTS integration_change_logs_review_idx
  ON integration_change_logs (reviewed_at, created_at);
CREATE INDEX IF NOT EXISTS integration_change_logs_entity_idx
  ON integration_change_logs (entity_type, entity_id);

COMMIT;

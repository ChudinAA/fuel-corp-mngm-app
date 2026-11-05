BEGIN;

DO $$
DECLARE
  table_name text;
  invalid_ids boolean;
  duplicate_ids boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'counterparty_contracts',
    'nomenclature_types',
    'units_of_measure',
    'nomenclature'
  ] LOOP
    EXECUTE format(
      'SELECT EXISTS (
        SELECT 1 FROM %I
        WHERE id_1c IS NOT NULL
          AND id_1c !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$''
      )',
      table_name
    ) INTO invalid_ids;
    IF invalid_ids THEN
      RAISE EXCEPTION 'Migration stopped: %.id_1c contains non-UUID values; resolve them before retrying.', table_name;
    END IF;
    EXECUTE format(
      'SELECT EXISTS (
        SELECT id_1c FROM %I
        WHERE id_1c IS NOT NULL
        GROUP BY id_1c HAVING count(*) > 1
      )',
      table_name
    ) INTO duplicate_ids;
    IF duplicate_ids THEN
      RAISE EXCEPTION 'Migration stopped: %.id_1c contains duplicates; resolve them before retrying.', table_name;
    END IF;
  END LOOP;
END $$;

ALTER TABLE counterparty_contracts
  ALTER COLUMN id_1c TYPE uuid USING id_1c::uuid,
  ADD COLUMN IF NOT EXISTS counterparty_id_1c uuid,
  ADD COLUMN IF NOT EXISTS counterparty_type text,
  ADD COLUMN IF NOT EXISTS parent_id_1c uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;
ALTER TABLE nomenclature_types
  ALTER COLUMN id_1c TYPE uuid USING id_1c::uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;
ALTER TABLE units_of_measure
  ALTER COLUMN id_1c TYPE uuid USING id_1c::uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;
ALTER TABLE nomenclature
  ALTER COLUMN id_1c TYPE uuid USING id_1c::uuid,
  ADD COLUMN IF NOT EXISTS integration_status text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counterparty_contracts_counterparty_1c_pair_check'
  ) THEN
    ALTER TABLE counterparty_contracts
      ADD CONSTRAINT counterparty_contracts_counterparty_1c_pair_check
      CHECK ((counterparty_id_1c IS NULL) = (counterparty_type IS NULL));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counterparty_contracts_counterparty_1c_type_check'
  ) THEN
    ALTER TABLE counterparty_contracts
      ADD CONSTRAINT counterparty_contracts_counterparty_1c_type_check
      CHECK (counterparty_type IS NULL OR counterparty_type IN ('supplier', 'customer', 'carrier'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS counterparty_contracts_id_1c_unique
  ON counterparty_contracts (id_1c) WHERE id_1c IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nomenclature_types_id_1c_unique
  ON nomenclature_types (id_1c) WHERE id_1c IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS units_of_measure_id_1c_unique
  ON units_of_measure (id_1c) WHERE id_1c IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nomenclature_id_1c_unique
  ON nomenclature (id_1c) WHERE id_1c IS NOT NULL;

COMMIT;

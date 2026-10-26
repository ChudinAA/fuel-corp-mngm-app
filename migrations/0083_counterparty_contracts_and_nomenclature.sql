-- Counterparty contracts: one contract/appendix row belongs to exactly one
-- concrete counterparty table so all links remain protected by foreign keys.
CREATE TABLE IF NOT EXISTS counterparty_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_1c text,
  contract_name text NOT NULL,
  contract_number text NOT NULL,
  contract_date date NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  buyer_id uuid REFERENCES customers(id),
  carrier_id uuid REFERENCES logistics_carriers(id),
  parent_contract_id uuid,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id),
  CONSTRAINT counterparty_contracts_one_counterparty_check
    CHECK (num_nonnulls(supplier_id, buyer_id, carrier_id) = 1),
  CONSTRAINT counterparty_contracts_parent_fk
    FOREIGN KEY (parent_contract_id) REFERENCES counterparty_contracts(id)
);
CREATE INDEX IF NOT EXISTS counterparty_contracts_supplier_idx ON counterparty_contracts(supplier_id);
CREATE INDEX IF NOT EXISTS counterparty_contracts_buyer_idx ON counterparty_contracts(buyer_id);
CREATE INDEX IF NOT EXISTS counterparty_contracts_carrier_idx ON counterparty_contracts(carrier_id);
CREATE INDEX IF NOT EXISTS counterparty_contracts_parent_idx ON counterparty_contracts(parent_contract_id);

CREATE TABLE IF NOT EXISTS nomenclature_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_1c text,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS nomenclature_types_name_idx ON nomenclature_types(name);

CREATE TABLE IF NOT EXISTS units_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_1c text,
  short_name text NOT NULL,
  full_name text NOT NULL,
  conversion_factor numeric(18,6),
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS units_of_measure_short_name_idx ON units_of_measure(short_name);

CREATE TABLE IF NOT EXISTS nomenclature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_1c text,
  nomenclature_type_id uuid NOT NULL REFERENCES nomenclature_types(id),
  name text NOT NULL,
  unit_id uuid NOT NULL REFERENCES units_of_measure(id),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS nomenclature_type_idx ON nomenclature(nomenclature_type_id);
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS reference_nomenclature_id uuid REFERENCES nomenclature(id);
CREATE INDEX IF NOT EXISTS nomenclature_unit_idx ON nomenclature(unit_id);
CREATE UNIQUE INDEX IF NOT EXISTS nomenclature_one_default_per_type_idx
  ON nomenclature(nomenclature_type_id)
  WHERE is_default = true AND deleted_at IS NULL;

-- Keep historical prices and deals valid. New records are validated by the API.
ALTER TABLE prices ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES counterparty_contracts(id);
ALTER TABLE prices ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
ALTER TABLE opt ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
ALTER TABLE movement ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
ALTER TABLE transportation ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
ALTER TABLE refueling_abroad ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
CREATE INDEX IF NOT EXISTS prices_contract_idx ON prices(contract_id);
CREATE INDEX IF NOT EXISTS prices_nomenclature_idx ON prices(nomenclature_id);

-- These codes link product kinds to the application's existing productType values.
INSERT INTO nomenclature_types (code, name)
VALUES
  ('kerosene', 'Керосин'),
  ('pvkj', 'ПВКЖ'),
  ('service', 'Услуга')
ON CONFLICT (code) DO NOTHING;

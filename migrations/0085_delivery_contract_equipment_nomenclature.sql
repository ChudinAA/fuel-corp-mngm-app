BEGIN;

ALTER TABLE delivery_cost
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES counterparty_contracts(id);
CREATE INDEX IF NOT EXISTS delivery_cost_contract_idx ON delivery_cost(contract_id);

ALTER TABLE equipment_movement
  ADD COLUMN IF NOT EXISTS nomenclature_id uuid REFERENCES nomenclature(id);
CREATE INDEX IF NOT EXISTS equipment_movement_nomenclature_idx ON equipment_movement(nomenclature_id);

-- Integration kinds are independent of the application's product types.
-- Retain historical kind links; never guess a mapping for existing records.
INSERT INTO nomenclature_types (code, name)
VALUES ('goods', 'Товар'), ('service', 'Услуга')
ON CONFLICT (code) DO NOTHING;

COMMIT;

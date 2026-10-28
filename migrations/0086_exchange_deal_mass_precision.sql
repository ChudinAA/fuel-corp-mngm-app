BEGIN;

-- Preserve the existing integer range while increasing tonne precision to five places.
ALTER TABLE exchange_deals
  ALTER COLUMN weight_ton TYPE numeric(17, 5) USING weight_ton::numeric(17, 5),
  ALTER COLUMN actual_weight_ton TYPE numeric(17, 5) USING actual_weight_ton::numeric(17, 5);

COMMIT;

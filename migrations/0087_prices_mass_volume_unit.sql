BEGIN;

-- Keep existing values in kilograms, but record that unit independently from price_unit.
ALTER TABLE prices
  ADD COLUMN IF NOT EXISTS volume_unit text NOT NULL DEFAULT 'kg';

-- Five decimal places are required once these mass values are stored in tonnes.
ALTER TABLE prices
  ALTER COLUMN volume TYPE numeric(18, 5) USING volume::numeric(18, 5),
  ALTER COLUMN sold_volume TYPE numeric(18, 5) USING sold_volume::numeric(18, 5);

COMMENT ON COLUMN prices.volume_unit IS
  'Unit shared by volume and sold_volume; price_unit only describes the quoted rate.';

COMMIT;

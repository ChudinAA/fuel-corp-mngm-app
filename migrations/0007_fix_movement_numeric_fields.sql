
-- Convert text fields to numeric in movement table
ALTER TABLE movement 
  ALTER COLUMN quantity_liters TYPE numeric(15,2) USING NULLIF(quantity_liters, '')::numeric(15,2),
  ALTER COLUMN density TYPE numeric(6,4) USING NULLIF(density, '')::numeric(6,4),
  ALTER COLUMN quantity_kg TYPE numeric(15,2) USING quantity_kg::numeric(15,2);

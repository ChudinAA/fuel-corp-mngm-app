
-- Add session table to schema to prevent deletion warning
-- This will be handled in schema.ts

-- Fix aircraft_refueling: change refueling_date from DATE to TIMESTAMP
ALTER TABLE aircraft_refueling 
  ALTER COLUMN refueling_date TYPE TIMESTAMP USING refueling_date::TIMESTAMP;

-- Copy created_at to refueling_date for existing records
UPDATE aircraft_refueling 
  SET refueling_date = created_at 
  WHERE refueling_date::date = created_at::date OR refueling_date IS NULL;

-- Fix exchange: change deal_date from any type to TIMESTAMP (already exists but ensure type)
-- The field already exists from previous migration, just ensure it's TIMESTAMP
ALTER TABLE exchange 
  ALTER COLUMN deal_date TYPE TIMESTAMP USING 
    CASE 
      WHEN deal_date IS NULL THEN created_at
      ELSE deal_date
    END;

-- Fix movement: change movement_date from DATE to TIMESTAMP
ALTER TABLE movement 
  ALTER COLUMN movement_date TYPE TIMESTAMP USING movement_date::TIMESTAMP;

-- Copy created_at to movement_date for existing records
UPDATE movement 
  SET movement_date = created_at 
  WHERE movement_date::date = created_at::date OR movement_date IS NULL;

-- Fix movement: ensure deal_date is TIMESTAMP (already added in previous migration)
-- Just ensure existing records have data
UPDATE movement 
  SET deal_date = created_at 
  WHERE deal_date IS NULL OR deal_date = NOW();

-- Fix opt: ensure deal_date is TIMESTAMP (already added in previous migration)
-- Just ensure existing records have data
UPDATE opt 
  SET deal_date = created_at 
  WHERE deal_date IS NULL OR deal_date = NOW();

-- Remove default NOW() from all deal_date fields as they should be explicitly set
ALTER TABLE opt ALTER COLUMN deal_date DROP DEFAULT;
ALTER TABLE aircraft_refueling ALTER COLUMN deal_date DROP DEFAULT;
ALTER TABLE movement ALTER COLUMN deal_date DROP DEFAULT;
ALTER TABLE exchange ALTER COLUMN deal_date DROP DEFAULT;

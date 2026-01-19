
-- Add updated_by_id field
ALTER TABLE "opt" ADD COLUMN IF NOT EXISTS "updated_by_id" UUID REFERENCES users(id);

-- Remove unused fields
ALTER TABLE "opt" DROP COLUMN IF EXISTS "cumulative_profit";
ALTER TABLE "opt" DROP COLUMN IF EXISTS "vehicle_number";
ALTER TABLE "opt" DROP COLUMN IF EXISTS "trailer_number";
ALTER TABLE "opt" DROP COLUMN IF EXISTS "driver_name";

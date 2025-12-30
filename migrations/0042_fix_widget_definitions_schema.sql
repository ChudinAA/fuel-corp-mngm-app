

-- Fix widget_definitions schema
-- 1. Change required_permissions from text[] to jsonb
ALTER TABLE "widget_definitions" 
  ALTER COLUMN "required_permissions" TYPE jsonb USING to_jsonb("required_permissions");

-- 2. Add back config_schema field
ALTER TABLE "widget_definitions" 
  ADD COLUMN IF NOT EXISTS "config_schema" jsonb;

-- 3. Add updated_at timestamp
ALTER TABLE "widget_definitions" 
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp;

-- Update existing records to have proper jsonb format for required_permissions
UPDATE "widget_definitions"
SET "required_permissions" = 
  CASE 
    WHEN "required_permissions" IS NULL THEN '[]'::jsonb
    ELSE "required_permissions"
  END
WHERE "required_permissions" IS NULL OR jsonb_typeof("required_permissions") != 'array';

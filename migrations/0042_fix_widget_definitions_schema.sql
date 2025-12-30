
-- Fix widget_definitions schema
-- Step 1: Drop the default constraint first
ALTER TABLE "widget_definitions" 
  ALTER COLUMN "required_permissions" DROP DEFAULT;

-- Step 2: Convert text[] to jsonb properly
ALTER TABLE "widget_definitions" 
  ALTER COLUMN "required_permissions" TYPE jsonb 
  USING CASE 
    WHEN "required_permissions" IS NULL THEN '[]'::jsonb
    ELSE to_jsonb("required_permissions")
  END;

-- Step 3: Set new default
ALTER TABLE "widget_definitions" 
  ALTER COLUMN "required_permissions" SET DEFAULT '[]'::jsonb;

-- Step 4: Add config_schema if it doesn't exist (skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'widget_definitions' AND column_name = 'config_schema'
  ) THEN
    ALTER TABLE "widget_definitions" ADD COLUMN "config_schema" jsonb;
  END IF;
END $$;

-- Step 5: Add updated_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'widget_definitions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE "widget_definitions" ADD COLUMN "updated_at" timestamp;
  END IF;
END $$;

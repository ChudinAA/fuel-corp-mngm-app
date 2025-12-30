
-- Create export_configurations table
CREATE TABLE IF NOT EXISTS "export_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id"),
  "module_name" TEXT NOT NULL,
  "config_name" TEXT NOT NULL,
  "selected_columns" JSONB NOT NULL,
  "filters" JSONB,
  "is_default" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_export_configs_user_id" ON "export_configurations"("user_id");
CREATE INDEX IF NOT EXISTS "idx_export_configs_module_name" ON "export_configurations"("module_name");
CREATE INDEX IF NOT EXISTS "idx_export_configs_user_module" ON "export_configurations"("user_id", "module_name");

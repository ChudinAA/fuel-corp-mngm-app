
-- Create management_reports table
CREATE TABLE IF NOT EXISTS "management_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_name" text NOT NULL,
  "description" text,
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "report_data" jsonb NOT NULL,
  "visualization_config" jsonb,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by_id" uuid NOT NULL,
  "updated_by_id" uuid,
  "deleted_at" timestamp,
  "deleted_by_id" uuid
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "management_reports_period_start_idx" ON "management_reports" ("period_start");
CREATE INDEX IF NOT EXISTS "management_reports_period_end_idx" ON "management_reports" ("period_end");
CREATE INDEX IF NOT EXISTS "management_reports_created_by_idx" ON "management_reports" ("created_by_id");

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "management_reports" ADD CONSTRAINT "management_reports_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

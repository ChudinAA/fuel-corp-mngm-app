
-- Create saved_reports table
CREATE TABLE IF NOT EXISTS "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" text NOT NULL,
	"report_name" text NOT NULL,
	"description" text,
	"filters" jsonb NOT NULL,
	"columns" jsonb,
	"chart_config" jsonb,
	"is_public" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);

-- Create registry_templates table
CREATE TABLE IF NOT EXISTS "registry_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_name" text NOT NULL,
	"template_type" text NOT NULL,
	"customer_type" text,
	"structure" jsonb NOT NULL,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);

-- Create monthly_plans table
CREATE TABLE IF NOT EXISTS "monthly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_month" timestamp NOT NULL,
	"plan_type" text NOT NULL,
	"base_id" uuid,
	"product_type" text,
	"planned_volume" text,
	"planned_revenue" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);

-- Create government_contracts table
CREATE TABLE IF NOT EXISTS "government_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" text NOT NULL,
	"contract_name" text NOT NULL,
	"customer_id" uuid,
	"contract_date" timestamp NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_amount" text,
	"current_amount" text,
	"remaining_amount" text,
	"product_type" text,
	"planned_volume" text,
	"actual_volume" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);

-- Create budget_income_expense table
CREATE TABLE IF NOT EXISTS "budget_income_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_month" timestamp NOT NULL,
	"sales_volume" text,
	"sales_revenue" text,
	"marginality" text,
	"operating_expenses" text,
	"personnel_expenses" text,
	"logistics_expenses" text,
	"other_expenses" text,
	"total_expenses" text,
	"net_profit" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid NOT NULL,
	"updated_by_id" uuid,
	"deleted_at" timestamp,
	"deleted_by_id" uuid
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "registry_templates" ADD CONSTRAINT "registry_templates_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "budget_income_expense" ADD CONSTRAINT "budget_income_expense_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "saved_reports_report_type_idx" ON "saved_reports" ("report_type");
CREATE INDEX IF NOT EXISTS "saved_reports_created_by_idx" ON "saved_reports" ("created_by_id");
CREATE INDEX IF NOT EXISTS "saved_reports_created_at_idx" ON "saved_reports" ("created_at");

CREATE INDEX IF NOT EXISTS "registry_templates_template_type_idx" ON "registry_templates" ("template_type");
CREATE INDEX IF NOT EXISTS "registry_templates_is_active_idx" ON "registry_templates" ("is_active");

CREATE INDEX IF NOT EXISTS "monthly_plans_plan_month_idx" ON "monthly_plans" ("plan_month");
CREATE INDEX IF NOT EXISTS "monthly_plans_plan_type_idx" ON "monthly_plans" ("plan_type");
CREATE INDEX IF NOT EXISTS "monthly_plans_base_id_idx" ON "monthly_plans" ("base_id");

CREATE INDEX IF NOT EXISTS "government_contracts_contract_number_idx" ON "government_contracts" ("contract_number");
CREATE INDEX IF NOT EXISTS "government_contracts_status_idx" ON "government_contracts" ("status");
CREATE INDEX IF NOT EXISTS "government_contracts_start_date_idx" ON "government_contracts" ("start_date");
CREATE INDEX IF NOT EXISTS "government_contracts_end_date_idx" ON "government_contracts" ("end_date");

CREATE INDEX IF NOT EXISTS "budget_income_expense_budget_month_idx" ON "budget_income_expense" ("budget_month");

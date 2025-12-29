
-- Indexes for monthly_plans
CREATE INDEX IF NOT EXISTS "monthly_plans_month_idx" ON "monthly_plans"("month");
CREATE INDEX IF NOT EXISTS "monthly_plans_base_month_idx" ON "monthly_plans"("base_id", "month");

-- Indexes for government_contracts
CREATE INDEX IF NOT EXISTS "gov_contracts_customer_idx" ON "government_contracts"("customer_id");
CREATE INDEX IF NOT EXISTS "gov_contracts_dates_idx" ON "government_contracts"("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "gov_contracts_status_idx" ON "government_contracts"("status");

-- Indexes for budgets
CREATE INDEX IF NOT EXISTS "budgets_month_idx" ON "budgets"("month");
CREATE INDEX IF NOT EXISTS "budgets_base_month_idx" ON "budgets"("base_id", "month");

-- Indexes for registries
CREATE INDEX IF NOT EXISTS "registries_template_idx" ON "registries"("template_type");
CREATE INDEX IF NOT EXISTS "registries_period_idx" ON "registries"("period_start", "period_end");
CREATE INDEX IF NOT EXISTS "registries_base_customer_idx" ON "registries"("base_id", "customer_id");

-- Composite indexes for better query performance
CREATE INDEX IF NOT EXISTS "opt_customer_date_idx" ON "opt"("customer_id", "deal_date") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "aircraft_refueling_date_idx" ON "aircraft_refueling"("refueling_date") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "cashflow_date_category_idx" ON "cashflow_transactions"("transaction_date", "category") WHERE "deleted_at" IS NULL;

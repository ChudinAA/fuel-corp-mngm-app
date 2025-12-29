
-- Create cashflow_transactions table
CREATE TABLE "cashflow_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_date" timestamp NOT NULL,
  "category" text NOT NULL,
  "subcategory" text,
  "amount" numeric(15, 2) NOT NULL,
  "currency" text DEFAULT 'RUB' NOT NULL,
  "description" text,
  "counterparty" text,
  "payment_method" text,
  "reference_type" text,
  "reference_id" uuid,
  "is_planned" boolean DEFAULT false,
  "notes" text,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Create indexes for cashflow_transactions
CREATE INDEX "cashflow_date_idx" ON "cashflow_transactions"("transaction_date");
CREATE INDEX "cashflow_category_idx" ON "cashflow_transactions"("category");
CREATE INDEX "cashflow_reference_idx" ON "cashflow_transactions"("reference_type", "reference_id");

-- Create payment_calendar table
CREATE TABLE "payment_calendar" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "due_date" date NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "amount" numeric(15, 2) NOT NULL,
  "currency" text DEFAULT 'RUB' NOT NULL,
  "category" text NOT NULL,
  "counterparty" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "paid_date" date,
  "paid_amount" numeric(15, 2),
  "reference_type" text,
  "reference_id" uuid,
  "is_recurring" boolean DEFAULT false,
  "recurring_pattern" jsonb,
  "notes" text,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Create indexes for payment_calendar
CREATE INDEX "payment_due_date_idx" ON "payment_calendar"("due_date");
CREATE INDEX "payment_status_idx" ON "payment_calendar"("status");
CREATE INDEX "payment_category_idx" ON "payment_calendar"("category");

-- Create price_calculations table
CREATE TABLE "price_calculations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "product_type" text NOT NULL,
  "purchase_price" numeric(15, 2),
  "delivery_cost" numeric(15, 2),
  "storage_cost" numeric(15, 2),
  "service_fee" numeric(15, 2),
  "agent_fee" numeric(15, 2),
  "other_costs" numeric(15, 2),
  "markup_type" text DEFAULT 'percentage',
  "markup_value" numeric(15, 2),
  "total_cost" numeric(15, 2),
  "selling_price" numeric(15, 2),
  "margin" numeric(15, 2),
  "margin_percentage" numeric(5, 2),
  "is_template" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT NOW() NOT NULL,
  "updated_at" timestamp,
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Create indexes for price_calculations
CREATE INDEX "price_calc_product_type_idx" ON "price_calculations"("product_type");
CREATE INDEX "price_calc_active_idx" ON "price_calculations"("is_active");

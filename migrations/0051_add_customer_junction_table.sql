-- Create customer_bases junction table
CREATE TABLE IF NOT EXISTS "customer_bases" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "base_id" uuid NOT NULL REFERENCES "bases"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now()
);

-- Create unique index to prevent duplicate supplier-base pairs
CREATE UNIQUE INDEX IF NOT EXISTS "unique_customer_base_idx" ON "customer_bases"("customer_id", "base_id");

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_customer_bases_customer_id" ON "customer_bases"("customer_id");
CREATE INDEX IF NOT EXISTS "idx_customer_bases_base_id" ON "customer_bases"("base_id");

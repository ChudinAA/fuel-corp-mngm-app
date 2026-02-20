ALTER TABLE "equipment_movement" 
ADD COLUMN IF NOT EXISTS "input_mode" text,
ADD COLUMN IF NOT EXISTS "cost_per_kg" numeric(19, 5),
ADD COLUMN IF NOT EXISTS "total_cost" numeric(15, 2),
ADD COLUMN IF NOT EXISTS "basis" text,
ADD COLUMN IF NOT EXISTS "basis_id" uuid REFERENCES "bases"("id"),
ADD COLUMN IF NOT EXISTS "transaction_id" uuid REFERENCES "equipment_transactions"("id"),
ADD COLUMN IF NOT EXISTS "source_transaction_id" uuid REFERENCES "equipment_transactions"("id"),
ADD COLUMN IF NOT EXISTS "is_draft" boolean DEFAULT false;

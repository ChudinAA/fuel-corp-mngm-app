
-- Add foreign key constraint for customer_id in government_contracts
DO $$ BEGIN
 ALTER TABLE "government_contracts" ADD CONSTRAINT "government_contracts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint for base_id in monthly_plans
DO $$ BEGIN
 ALTER TABLE "monthly_plans" ADD CONSTRAINT "monthly_plans_base_id_bases_id_fk" FOREIGN KEY ("base_id") REFERENCES "bases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

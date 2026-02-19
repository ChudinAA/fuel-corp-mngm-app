-- Migration to add equipment_type to warehouses and create equipment tables

-- 1. Add equipment_type to warehouses
ALTER TABLE "warehouses" ADD COLUMN "equipment_type" text DEFAULT 'common' NOT NULL;

-- 2. Create equipments table
CREATE TABLE IF NOT EXISTS "equipments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "current_balance" numeric(15, 2) DEFAULT '0',
        "average_cost" numeric(12, 4) DEFAULT '0',
        "is_active" text DEFAULT 'true',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp,
        "created_by_id" uuid,
        "updated_by_id" uuid,
        "deleted_at" timestamp,
        "deleted_by_id" uuid
);

-- 3. Create equipment_transactions table
CREATE TABLE IF NOT EXISTS "equipment_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "equipment_id" uuid NOT NULL,
        "transaction_type" text NOT NULL,
        "quantity" numeric(15, 2) NOT NULL,
        "balance_before" numeric(15, 2),
        "balance_after" numeric(15, 2),
        "average_cost_before" numeric(12, 4),
        "average_cost_after" numeric(12, 4),
        "transaction_date" timestamp,
        "source_warehouse_id" uuid,
        "created_at" timestamp DEFAULT now(),
        "created_by_id" uuid,
        "deleted_at" timestamp,
        "deleted_by_id" uuid
);

-- 4. Create warehouses_equipment junction table
CREATE TABLE IF NOT EXISTS "warehouses_equipment" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "equipment_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- 5. Add Foreign Key constraints
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "equipments" ADD CONSTRAINT "equipments_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "equipment_transactions" ADD CONSTRAINT "equipment_transactions_equipment_id_equipments_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "equipment_transactions" ADD CONSTRAINT "equipment_transactions_source_warehouse_id_warehouses_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "equipment_transactions" ADD CONSTRAINT "equipment_transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "warehouses_equipment" ADD CONSTRAINT "warehouses_equipment_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "warehouses_equipment" ADD CONSTRAINT "warehouses_equipment_equipment_id_equipments_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "equipments"("id") ON DELETE cascade ON UPDATE no action;

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS "equipments_name_idx" ON "equipments" ("name");
CREATE INDEX IF NOT EXISTS "equipment_transactions_equipment_id_idx" ON "equipment_transactions" ("equipment_id");
CREATE INDEX IF NOT EXISTS "equipment_transactions_date_idx" ON "equipment_transactions" ("transaction_date");
CREATE INDEX IF NOT EXISTS "unique_warehouse_equipment_idx" ON "warehouses_equipment" ("warehouse_id", "equipment_id");

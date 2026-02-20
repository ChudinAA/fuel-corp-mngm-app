CREATE TABLE IF NOT EXISTS "equipment_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_date" timestamp NOT NULL,
	"product_type" text NOT NULL,
	"from_warehouse_id" uuid REFERENCES "warehouses"("id"),
	"to_warehouse_id" uuid REFERENCES "warehouses"("id"),
	"from_equipment_id" uuid REFERENCES "equipments"("id"),
	"to_equipment_id" uuid REFERENCES "equipments"("id"),
	"quantity_kg" numeric(15, 2) NOT NULL,
	"quantity_liters" numeric(15, 2),
	"density" numeric(6, 4),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by_id" uuid REFERENCES "users"("id"),
	"updated_by_id" uuid REFERENCES "users"("id"),
	"deleted_at" timestamp,
	"deleted_by_id" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "eq_movement_date_idx" ON "equipment_movement" ("movement_date");
CREATE INDEX IF NOT EXISTS "eq_movement_from_wh_idx" ON "equipment_movement" ("from_warehouse_id");
CREATE INDEX IF NOT EXISTS "eq_movement_to_wh_idx" ON "equipment_movement" ("to_warehouse_id");
CREATE INDEX IF NOT EXISTS "eq_movement_from_eq_idx" ON "equipment_movement" ("from_equipment_id");
CREATE INDEX IF NOT EXISTS "eq_movement_to_eq_idx" ON "equipment_movement" ("to_equipment_id");

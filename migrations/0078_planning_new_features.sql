-- Planning scenarios
CREATE TABLE IF NOT EXISTS "planning_scenarios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT false NOT NULL,
  "based_on_scenario_id" uuid,
  "created_at" timestamp DEFAULT now(),
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_at" timestamp,
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Top-level volumes (manager's high-level plan per supplier+warehouse)
CREATE TABLE IF NOT EXISTS "planning_top_level_volumes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supplier_id" uuid NOT NULL REFERENCES "suppliers"("id"),
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "period_from" timestamp NOT NULL,
  "period_to" timestamp NOT NULL,
  "type" text NOT NULL,
  "volume" decimal(15, 2) NOT NULL,
  "counterparty_id" uuid,
  "notes" text,
  "scenario_id" uuid REFERENCES "planning_scenarios"("id"),
  "created_at" timestamp DEFAULT now(),
  "created_by_id" uuid REFERENCES "users"("id"),
  "updated_at" timestamp,
  "updated_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Warehouse supply tags (delivery method labels)
CREATE TABLE IF NOT EXISTS "warehouse_supply_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "warehouse_id" uuid NOT NULL REFERENCES "warehouses"("id"),
  "label" text NOT NULL,
  "type" text NOT NULL,
  "supplier_id" uuid REFERENCES "suppliers"("id"),
  "color" text DEFAULT 'blue',
  "created_at" timestamp DEFAULT now(),
  "created_by_id" uuid REFERENCES "users"("id"),
  "deleted_at" timestamp,
  "deleted_by_id" uuid REFERENCES "users"("id")
);

-- Add scenario_id to plan_entries
ALTER TABLE "plan_entries" ADD COLUMN IF NOT EXISTS "scenario_id" uuid REFERENCES "planning_scenarios"("id");

-- Add scenario_id to supplier_allocated_volumes
ALTER TABLE "supplier_allocated_volumes" ADD COLUMN IF NOT EXISTS "scenario_id" uuid REFERENCES "planning_scenarios"("id");

-- Add scenario_id to free_volume_allocations
ALTER TABLE "free_volume_allocations" ADD COLUMN IF NOT EXISTS "scenario_id" uuid REFERENCES "planning_scenarios"("id");

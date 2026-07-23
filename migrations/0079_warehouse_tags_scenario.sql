ALTER TABLE warehouse_supply_tags ADD COLUMN IF NOT EXISTS scenario_id uuid REFERENCES planning_scenarios(id);
CREATE INDEX IF NOT EXISTS warehouse_supply_tags_scenario_idx ON warehouse_supply_tags(scenario_id);

ALTER TABLE planning_resources ADD COLUMN IF NOT EXISTS basis_id UUID REFERENCES bases(id);
ALTER TABLE plan_entries ADD COLUMN IF NOT EXISTS basis_id UUID REFERENCES bases(id);

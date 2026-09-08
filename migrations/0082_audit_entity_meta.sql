-- Add entity_meta column to audit_log for storing denormalized FK entity names
-- e.g. { "3fa85f64-...": "ООО Газпром" } keyed by UUID for both old and new FK values
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_meta jsonb;

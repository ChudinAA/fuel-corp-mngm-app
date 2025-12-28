
-- Add rolled_back_at field to track when an audit entry was rolled back
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMP;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS rolled_back_by_id UUID REFERENCES users(id);

-- Create index for efficient querying of non-rolled-back entries
CREATE INDEX IF NOT EXISTS audit_log_rolled_back_idx ON audit_log(rolled_back_at) WHERE rolled_back_at IS NULL;

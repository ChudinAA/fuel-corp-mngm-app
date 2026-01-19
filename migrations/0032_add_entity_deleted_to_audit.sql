
-- Add entity_deleted field to track if the entity was later deleted
ALTER TABLE audit_log ADD COLUMN entity_deleted timestamp;

-- Update existing audit entries where entity is deleted
UPDATE audit_log al
SET entity_deleted = (
  SELECT MIN(al2.created_at)
  FROM audit_log al2
  WHERE al2.entity_type = al.entity_type
    AND al2.entity_id = al.entity_id
    AND al2.operation = 'DELETE'
    AND al2.created_at > al.created_at
)
WHERE al.operation IN ('CREATE', 'UPDATE');

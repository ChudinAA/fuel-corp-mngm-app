
-- Create audit_log table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'opt', 'aircraft_refueling', 'movement', etc.
  entity_id UUID NOT NULL,
  operation TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'
  old_data JSONB, -- Previous state of the record
  new_data JSONB, -- New state of the record
  changed_fields TEXT[], -- Array of field names that changed
  user_id UUID REFERENCES users(id),
  user_name TEXT, -- Denormalized for history preservation
  user_email TEXT, -- Denormalized for history preservation
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_operation_idx ON audit_log(operation);
CREATE INDEX IF NOT EXISTS audit_log_entity_created_idx ON audit_log(entity_type, entity_id, created_at DESC);

-- Add soft delete support to main tables
ALTER TABLE opt ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE opt ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE movement ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE movement ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE exchange ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE exchange ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE prices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE prices ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE bases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE bases ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE opt ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE opt ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS deleted_by_id UUID REFERENCES users(id);

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS opt_deleted_at_idx ON opt(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS aircraft_refueling_deleted_at_idx ON aircraft_refueling(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS movement_deleted_at_idx ON movement(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS exchange_deleted_at_idx ON exchange(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS warehouses_deleted_at_idx ON warehouses(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS prices_deleted_at_idx ON prices(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS suppliers_deleted_at_idx ON suppliers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS customers_deleted_at_idx ON customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bases_deleted_at_idx ON bases(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS logistics_carriers_deleted_at_idx ON logistics_carriers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS logistics_delivery_locations_deleted_at_idx ON logistics_delivery_locations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS logistics_vehicles_deleted_at_idx ON logistics_vehicles(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS logistics_trailers_deleted_at_idx ON logistics_trailers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS logistics_drivers_deleted_at_idx ON logistics_drivers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS delivery_cost_deleted_at_idx ON delivery_cost(deleted_at) WHERE deleted_at IS NULL;

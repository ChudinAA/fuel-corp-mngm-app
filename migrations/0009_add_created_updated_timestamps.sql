
-- Add created_at and updated_at to roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to permissions
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to role_permissions
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to users (created_at already exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to wholesale_suppliers
ALTER TABLE wholesale_suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE wholesale_suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to wholesale_bases
ALTER TABLE wholesale_bases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE wholesale_bases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to refueling_providers
ALTER TABLE refueling_providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE refueling_providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to refueling_bases
ALTER TABLE refueling_bases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE refueling_bases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_carriers
ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_delivery_locations
ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_vehicles
ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_trailers
ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_drivers
ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to logistics_warehouses
ALTER TABLE logistics_warehouses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE logistics_warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to prices
ALTER TABLE prices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to delivery_cost
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add created_at and updated_at to warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to warehouse_transactions (created_at already exists)
ALTER TABLE warehouse_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to exchange (created_at already exists)
ALTER TABLE exchange ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to movement (created_at already exists)
ALTER TABLE movement ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to opt (created_at already exists)
ALTER TABLE opt ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_at to aircraft_refueling (created_at already exists)
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

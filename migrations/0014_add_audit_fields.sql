
-- Add created_by_id and updated_by_id to tables that don't have them

-- Roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Permissions
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Role Permissions
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Users (only updated_by_id, as created_by_id doesn't make sense for users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Wholesale Suppliers
ALTER TABLE wholesale_suppliers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE wholesale_suppliers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Wholesale Bases
ALTER TABLE wholesale_bases ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE wholesale_bases ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Refueling Providers
ALTER TABLE refueling_providers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE refueling_providers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Refueling Bases
ALTER TABLE refueling_bases ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE refueling_bases ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Logistics Carriers
ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE logistics_carriers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Logistics Delivery Locations
ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE logistics_delivery_locations ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Logistics Vehicles
ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE logistics_vehicles ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Logistics Trailers
ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE logistics_trailers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Logistics Drivers
ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE logistics_drivers ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Prices
ALTER TABLE prices ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE prices ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Delivery Cost
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Warehouse Transactions
ALTER TABLE warehouse_transactions ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id);
ALTER TABLE warehouse_transactions ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Movement (only updated_by_id, created_by_id already exists)
ALTER TABLE movement ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

-- Aircraft Refueling (only updated_by_id, created_by_id already exists)
ALTER TABLE aircraft_refueling ADD COLUMN IF NOT EXISTS updated_by_id UUID REFERENCES users(id);

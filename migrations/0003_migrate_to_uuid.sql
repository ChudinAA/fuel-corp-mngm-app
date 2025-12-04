
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to generate deterministic UUIDs from integers
CREATE OR REPLACE FUNCTION int_to_uuid(id INTEGER) RETURNS UUID AS $$
BEGIN
  RETURN uuid_generate_v5(uuid_ns_oid(), id::text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migrate roles table
ALTER TABLE roles ADD COLUMN new_id UUID;
UPDATE roles SET new_id = int_to_uuid(id);
ALTER TABLE roles DROP CONSTRAINT roles_pkey;
ALTER TABLE roles DROP COLUMN id;
ALTER TABLE roles RENAME COLUMN new_id TO id;
ALTER TABLE roles ALTER COLUMN id SET NOT NULL;
ALTER TABLE roles ADD PRIMARY KEY (id);

-- Migrate permissions table
ALTER TABLE permissions ADD COLUMN new_id UUID;
UPDATE permissions SET new_id = int_to_uuid(id);
ALTER TABLE permissions DROP CONSTRAINT permissions_pkey;
ALTER TABLE permissions DROP COLUMN id;
ALTER TABLE permissions RENAME COLUMN new_id TO id;
ALTER TABLE permissions ALTER COLUMN id SET NOT NULL;
ALTER TABLE permissions ADD PRIMARY KEY (id);

-- Migrate role_permissions table
ALTER TABLE role_permissions ADD COLUMN new_id UUID;
ALTER TABLE role_permissions ADD COLUMN new_role_id UUID;
ALTER TABLE role_permissions ADD COLUMN new_permission_id UUID;
UPDATE role_permissions SET new_id = gen_random_uuid();
UPDATE role_permissions SET new_role_id = int_to_uuid(role_id);
UPDATE role_permissions SET new_permission_id = int_to_uuid(permission_id);
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey;
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_role_id_roles_id_fk;
ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_permission_id_permissions_id_fk;
ALTER TABLE role_permissions DROP COLUMN id, DROP COLUMN role_id, DROP COLUMN permission_id;
ALTER TABLE role_permissions RENAME COLUMN new_id TO id;
ALTER TABLE role_permissions RENAME COLUMN new_role_id TO role_id;
ALTER TABLE role_permissions RENAME COLUMN new_permission_id TO permission_id;
ALTER TABLE role_permissions ALTER COLUMN id SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN permission_id SET NOT NULL;
ALTER TABLE role_permissions ADD PRIMARY KEY (id);
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_roles_id_fk 
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_permission_id_permissions_id_fk 
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- Migrate users table
ALTER TABLE users ADD COLUMN new_id UUID;
ALTER TABLE users ADD COLUMN new_role_id UUID;
UPDATE users SET new_id = int_to_uuid(id);
UPDATE users SET new_role_id = int_to_uuid(role_id) WHERE role_id IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_pkey;
ALTER TABLE users DROP CONSTRAINT users_role_id_roles_id_fk;
ALTER TABLE users DROP COLUMN id, DROP COLUMN role_id;
ALTER TABLE users RENAME COLUMN new_id TO id;
ALTER TABLE users RENAME COLUMN new_role_id TO role_id;
ALTER TABLE users ALTER COLUMN id SET NOT NULL;
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE users ADD CONSTRAINT users_role_id_roles_id_fk 
  FOREIGN KEY (role_id) REFERENCES roles(id);

-- Migrate customers table
ALTER TABLE customers ADD COLUMN new_id UUID;
UPDATE customers SET new_id = int_to_uuid(id);
ALTER TABLE customers DROP CONSTRAINT customers_pkey;
ALTER TABLE customers DROP COLUMN id;
ALTER TABLE customers RENAME COLUMN new_id TO id;
ALTER TABLE customers ALTER COLUMN id SET NOT NULL;
ALTER TABLE customers ADD PRIMARY KEY (id);

-- Migrate wholesale_bases table
ALTER TABLE wholesale_bases ADD COLUMN new_id UUID;
UPDATE wholesale_bases SET new_id = int_to_uuid(id);
ALTER TABLE wholesale_bases DROP CONSTRAINT wholesale_bases_pkey;
ALTER TABLE wholesale_bases DROP COLUMN id;
ALTER TABLE wholesale_bases RENAME COLUMN new_id TO id;
ALTER TABLE wholesale_bases ALTER COLUMN id SET NOT NULL;
ALTER TABLE wholesale_bases ADD PRIMARY KEY (id);

-- Migrate wholesale_suppliers table
ALTER TABLE wholesale_suppliers ADD COLUMN new_id UUID;
ALTER TABLE wholesale_suppliers ADD COLUMN new_default_base_id UUID;
UPDATE wholesale_suppliers SET new_id = int_to_uuid(id);
UPDATE wholesale_suppliers SET new_default_base_id = int_to_uuid(default_base_id) WHERE default_base_id IS NOT NULL;
ALTER TABLE wholesale_suppliers DROP CONSTRAINT wholesale_suppliers_pkey;
ALTER TABLE wholesale_suppliers DROP COLUMN id, DROP COLUMN default_base_id;
ALTER TABLE wholesale_suppliers RENAME COLUMN new_id TO id;
ALTER TABLE wholesale_suppliers RENAME COLUMN new_default_base_id TO default_base_id;
ALTER TABLE wholesale_suppliers ALTER COLUMN id SET NOT NULL;
ALTER TABLE wholesale_suppliers ADD PRIMARY KEY (id);
ALTER TABLE wholesale_suppliers ADD CONSTRAINT wholesale_suppliers_default_base_id_fkey 
  FOREIGN KEY (default_base_id) REFERENCES wholesale_bases(id);

-- Migrate refueling_bases table
ALTER TABLE refueling_bases ADD COLUMN new_id UUID;
UPDATE refueling_bases SET new_id = int_to_uuid(id);
ALTER TABLE refueling_bases DROP CONSTRAINT refueling_bases_pkey;
ALTER TABLE refueling_bases DROP COLUMN id;
ALTER TABLE refueling_bases RENAME COLUMN new_id TO id;
ALTER TABLE refueling_bases ALTER COLUMN id SET NOT NULL;
ALTER TABLE refueling_bases ADD PRIMARY KEY (id);

-- Migrate refueling_providers table
ALTER TABLE refueling_providers ADD COLUMN new_id UUID;
ALTER TABLE refueling_providers ADD COLUMN new_default_base_id UUID;
UPDATE refueling_providers SET new_id = int_to_uuid(id);
UPDATE refueling_providers SET new_default_base_id = int_to_uuid(default_base_id) WHERE default_base_id IS NOT NULL;
ALTER TABLE refueling_providers DROP CONSTRAINT refueling_providers_pkey;
ALTER TABLE refueling_providers DROP COLUMN id, DROP COLUMN default_base_id;
ALTER TABLE refueling_providers RENAME COLUMN new_id TO id;
ALTER TABLE refueling_providers RENAME COLUMN new_default_base_id TO default_base_id;
ALTER TABLE refueling_providers ALTER COLUMN id SET NOT NULL;
ALTER TABLE refueling_providers ADD PRIMARY KEY (id);
ALTER TABLE refueling_providers ADD CONSTRAINT refueling_providers_default_base_id_fkey 
  FOREIGN KEY (default_base_id) REFERENCES refueling_bases(id);

-- Migrate logistics_carriers table
ALTER TABLE logistics_carriers ADD COLUMN new_id UUID;
UPDATE logistics_carriers SET new_id = int_to_uuid(id);
ALTER TABLE logistics_carriers DROP CONSTRAINT logistics_carriers_pkey;
ALTER TABLE logistics_carriers DROP COLUMN id;
ALTER TABLE logistics_carriers RENAME COLUMN new_id TO id;
ALTER TABLE logistics_carriers ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_carriers ADD PRIMARY KEY (id);

-- Migrate logistics_delivery_locations table
ALTER TABLE logistics_delivery_locations ADD COLUMN new_id UUID;
UPDATE logistics_delivery_locations SET new_id = int_to_uuid(id);
ALTER TABLE logistics_delivery_locations DROP CONSTRAINT logistics_delivery_locations_pkey;
ALTER TABLE logistics_delivery_locations DROP COLUMN id;
ALTER TABLE logistics_delivery_locations RENAME COLUMN new_id TO id;
ALTER TABLE logistics_delivery_locations ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_delivery_locations ADD PRIMARY KEY (id);

-- Migrate logistics_vehicles table
ALTER TABLE logistics_vehicles ADD COLUMN new_id UUID;
ALTER TABLE logistics_vehicles ADD COLUMN new_carrier_id UUID;
UPDATE logistics_vehicles SET new_id = int_to_uuid(id);
UPDATE logistics_vehicles SET new_carrier_id = int_to_uuid(carrier_id) WHERE carrier_id IS NOT NULL;
ALTER TABLE logistics_vehicles DROP CONSTRAINT logistics_vehicles_pkey;
ALTER TABLE logistics_vehicles DROP CONSTRAINT logistics_vehicles_carrier_id_logistics_carriers_id_fk;
ALTER TABLE logistics_vehicles DROP COLUMN id, DROP COLUMN carrier_id;
ALTER TABLE logistics_vehicles RENAME COLUMN new_id TO id;
ALTER TABLE logistics_vehicles RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE logistics_vehicles ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_vehicles ADD PRIMARY KEY (id);
ALTER TABLE logistics_vehicles ADD CONSTRAINT logistics_vehicles_carrier_id_logistics_carriers_id_fk 
  FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE SET NULL;

-- Migrate logistics_trailers table
ALTER TABLE logistics_trailers ADD COLUMN new_id UUID;
ALTER TABLE logistics_trailers ADD COLUMN new_carrier_id UUID;
UPDATE logistics_trailers SET new_id = int_to_uuid(id);
UPDATE logistics_trailers SET new_carrier_id = int_to_uuid(carrier_id) WHERE carrier_id IS NOT NULL;
ALTER TABLE logistics_trailers DROP CONSTRAINT logistics_trailers_pkey;
ALTER TABLE logistics_trailers DROP CONSTRAINT logistics_trailers_carrier_id_logistics_carriers_id_fk;
ALTER TABLE logistics_trailers DROP COLUMN id, DROP COLUMN carrier_id;
ALTER TABLE logistics_trailers RENAME COLUMN new_id TO id;
ALTER TABLE logistics_trailers RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE logistics_trailers ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_trailers ADD PRIMARY KEY (id);
ALTER TABLE logistics_trailers ADD CONSTRAINT logistics_trailers_carrier_id_logistics_carriers_id_fk 
  FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE SET NULL;

-- Migrate logistics_drivers table
ALTER TABLE logistics_drivers ADD COLUMN new_id UUID;
ALTER TABLE logistics_drivers ADD COLUMN new_carrier_id UUID;
UPDATE logistics_drivers SET new_id = int_to_uuid(id);
UPDATE logistics_drivers SET new_carrier_id = int_to_uuid(carrier_id) WHERE carrier_id IS NOT NULL;
ALTER TABLE logistics_drivers DROP CONSTRAINT logistics_drivers_pkey;
ALTER TABLE logistics_drivers DROP CONSTRAINT logistics_drivers_carrier_id_logistics_carriers_id_fk;
ALTER TABLE logistics_drivers DROP COLUMN id, DROP COLUMN carrier_id;
ALTER TABLE logistics_drivers RENAME COLUMN new_id TO id;
ALTER TABLE logistics_drivers RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE logistics_drivers ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_drivers ADD PRIMARY KEY (id);
ALTER TABLE logistics_drivers ADD CONSTRAINT logistics_drivers_carrier_id_logistics_carriers_id_fk 
  FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE SET NULL;

-- Migrate logistics_warehouses table
ALTER TABLE logistics_warehouses ADD COLUMN new_id UUID;
UPDATE logistics_warehouses SET new_id = int_to_uuid(id);
ALTER TABLE logistics_warehouses DROP CONSTRAINT logistics_warehouses_pkey;
ALTER TABLE logistics_warehouses DROP COLUMN id;
ALTER TABLE logistics_warehouses RENAME COLUMN new_id TO id;
ALTER TABLE logistics_warehouses ALTER COLUMN id SET NOT NULL;
ALTER TABLE logistics_warehouses ADD PRIMARY KEY (id);

-- Migrate warehouses table
ALTER TABLE warehouses ADD COLUMN new_id UUID;
UPDATE warehouses SET new_id = int_to_uuid(id);
ALTER TABLE warehouses DROP CONSTRAINT warehouses_pkey;
ALTER TABLE warehouses DROP COLUMN id;
ALTER TABLE warehouses RENAME COLUMN new_id TO id;
ALTER TABLE warehouses ALTER COLUMN id SET NOT NULL;
ALTER TABLE warehouses ADD PRIMARY KEY (id);

-- Migrate prices table
ALTER TABLE prices ADD COLUMN new_id UUID;
ALTER TABLE prices ADD COLUMN new_counterparty_id UUID;
UPDATE prices SET new_id = int_to_uuid(id);
UPDATE prices SET new_counterparty_id = int_to_uuid(counterparty_id);
ALTER TABLE prices DROP CONSTRAINT prices_pkey;
ALTER TABLE prices DROP COLUMN id, DROP COLUMN counterparty_id;
ALTER TABLE prices RENAME COLUMN new_id TO id;
ALTER TABLE prices RENAME COLUMN new_counterparty_id TO counterparty_id;
ALTER TABLE prices ALTER COLUMN id SET NOT NULL;
ALTER TABLE prices ALTER COLUMN counterparty_id SET NOT NULL;
ALTER TABLE prices ADD PRIMARY KEY (id);

-- Migrate delivery_cost table
ALTER TABLE delivery_cost ADD COLUMN new_id UUID;
ALTER TABLE delivery_cost ADD COLUMN new_carrier_id UUID;
ALTER TABLE delivery_cost ADD COLUMN new_delivery_location_id UUID;
UPDATE delivery_cost SET new_id = int_to_uuid(id);
UPDATE delivery_cost SET new_carrier_id = int_to_uuid(carrier_id);
UPDATE delivery_cost SET new_delivery_location_id = int_to_uuid(delivery_location_id);
ALTER TABLE delivery_cost DROP CONSTRAINT delivery_cost_pkey;
ALTER TABLE delivery_cost DROP COLUMN id, DROP COLUMN carrier_id, DROP COLUMN delivery_location_id;
ALTER TABLE delivery_cost RENAME COLUMN new_id TO id;
ALTER TABLE delivery_cost RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE delivery_cost RENAME COLUMN new_delivery_location_id TO delivery_location_id;
ALTER TABLE delivery_cost ALTER COLUMN id SET NOT NULL;
ALTER TABLE delivery_cost ALTER COLUMN carrier_id SET NOT NULL;
ALTER TABLE delivery_cost ALTER COLUMN delivery_location_id SET NOT NULL;
ALTER TABLE delivery_cost ADD PRIMARY KEY (id);

-- Migrate warehouse_transactions table
ALTER TABLE warehouse_transactions ADD COLUMN new_id UUID;
ALTER TABLE warehouse_transactions ADD COLUMN new_warehouse_id UUID;
ALTER TABLE warehouse_transactions ADD COLUMN new_source_id UUID;
UPDATE warehouse_transactions SET new_id = int_to_uuid(id);
UPDATE warehouse_transactions SET new_warehouse_id = int_to_uuid(warehouse_id);
UPDATE warehouse_transactions SET new_source_id = int_to_uuid(source_id) WHERE source_id IS NOT NULL;
ALTER TABLE warehouse_transactions DROP CONSTRAINT warehouse_transactions_pkey;
ALTER TABLE warehouse_transactions DROP CONSTRAINT warehouse_transactions_warehouse_id_warehouses_id_fk;
ALTER TABLE warehouse_transactions DROP COLUMN id, DROP COLUMN warehouse_id, DROP COLUMN source_id;
ALTER TABLE warehouse_transactions RENAME COLUMN new_id TO id;
ALTER TABLE warehouse_transactions RENAME COLUMN new_warehouse_id TO warehouse_id;
ALTER TABLE warehouse_transactions RENAME COLUMN new_source_id TO source_id;
ALTER TABLE warehouse_transactions ALTER COLUMN id SET NOT NULL;
ALTER TABLE warehouse_transactions ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE warehouse_transactions ADD PRIMARY KEY (id);
ALTER TABLE warehouse_transactions ADD CONSTRAINT warehouse_transactions_warehouse_id_warehouses_id_fk 
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);

-- Migrate exchange table
ALTER TABLE exchange ADD COLUMN new_id UUID;
ALTER TABLE exchange ADD COLUMN new_warehouse_id UUID;
ALTER TABLE exchange ADD COLUMN new_created_by_id UUID;
UPDATE exchange SET new_id = int_to_uuid(id);
UPDATE exchange SET new_warehouse_id = int_to_uuid(warehouse_id) WHERE warehouse_id IS NOT NULL;
UPDATE exchange SET new_created_by_id = int_to_uuid(created_by_id) WHERE created_by_id IS NOT NULL;
ALTER TABLE exchange DROP CONSTRAINT exchange_pkey;
ALTER TABLE exchange DROP CONSTRAINT exchange_warehouse_id_warehouses_id_fk;
ALTER TABLE exchange DROP CONSTRAINT exchange_created_by_id_users_id_fk;
ALTER TABLE exchange DROP COLUMN id, DROP COLUMN warehouse_id, DROP COLUMN created_by_id;
ALTER TABLE exchange RENAME COLUMN new_id TO id;
ALTER TABLE exchange RENAME COLUMN new_warehouse_id TO warehouse_id;
ALTER TABLE exchange RENAME COLUMN new_created_by_id TO created_by_id;
ALTER TABLE exchange ALTER COLUMN id SET NOT NULL;
ALTER TABLE exchange ADD PRIMARY KEY (id);
ALTER TABLE exchange ADD CONSTRAINT exchange_warehouse_id_warehouses_id_fk 
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);
ALTER TABLE exchange ADD CONSTRAINT exchange_created_by_id_users_id_fk 
  FOREIGN KEY (created_by_id) REFERENCES users(id);

-- Migrate movement table
ALTER TABLE movement ADD COLUMN new_id UUID;
ALTER TABLE movement ADD COLUMN new_supplier_id UUID;
ALTER TABLE movement ADD COLUMN new_from_warehouse_id UUID;
ALTER TABLE movement ADD COLUMN new_to_warehouse_id UUID;
ALTER TABLE movement ADD COLUMN new_carrier_id UUID;
ALTER TABLE movement ADD COLUMN new_created_by_id UUID;
UPDATE movement SET new_id = int_to_uuid(id);
UPDATE movement SET new_supplier_id = int_to_uuid(supplier_id) WHERE supplier_id IS NOT NULL;
UPDATE movement SET new_from_warehouse_id = int_to_uuid(from_warehouse_id) WHERE from_warehouse_id IS NOT NULL;
UPDATE movement SET new_to_warehouse_id = int_to_uuid(to_warehouse_id);
UPDATE movement SET new_carrier_id = int_to_uuid(carrier_id) WHERE carrier_id IS NOT NULL;
UPDATE movement SET new_created_by_id = int_to_uuid(created_by_id) WHERE created_by_id IS NOT NULL;
ALTER TABLE movement DROP CONSTRAINT movement_pkey;
ALTER TABLE movement DROP CONSTRAINT movement_from_warehouse_id_warehouses_id_fk;
ALTER TABLE movement DROP CONSTRAINT movement_to_warehouse_id_warehouses_id_fk;
ALTER TABLE movement DROP CONSTRAINT movement_created_by_id_users_id_fk;
ALTER TABLE movement DROP COLUMN id, DROP COLUMN supplier_id, DROP COLUMN from_warehouse_id, DROP COLUMN to_warehouse_id, DROP COLUMN carrier_id, DROP COLUMN created_by_id;
ALTER TABLE movement RENAME COLUMN new_id TO id;
ALTER TABLE movement RENAME COLUMN new_supplier_id TO supplier_id;
ALTER TABLE movement RENAME COLUMN new_from_warehouse_id TO from_warehouse_id;
ALTER TABLE movement RENAME COLUMN new_to_warehouse_id TO to_warehouse_id;
ALTER TABLE movement RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE movement RENAME COLUMN new_created_by_id TO created_by_id;
ALTER TABLE movement ALTER COLUMN id SET NOT NULL;
ALTER TABLE movement ALTER COLUMN to_warehouse_id SET NOT NULL;
ALTER TABLE movement ADD PRIMARY KEY (id);
ALTER TABLE movement ADD CONSTRAINT movement_from_warehouse_id_warehouses_id_fk 
  FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id);
ALTER TABLE movement ADD CONSTRAINT movement_to_warehouse_id_warehouses_id_fk 
  FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id);
ALTER TABLE movement ADD CONSTRAINT movement_created_by_id_users_id_fk 
  FOREIGN KEY (created_by_id) REFERENCES users(id);

-- Migrate opt table
ALTER TABLE opt ADD COLUMN new_id UUID;
ALTER TABLE opt ADD COLUMN new_supplier_id UUID;
ALTER TABLE opt ADD COLUMN new_buyer_id UUID;
ALTER TABLE opt ADD COLUMN new_purchase_price_id UUID;
ALTER TABLE opt ADD COLUMN new_sale_price_id UUID;
ALTER TABLE opt ADD COLUMN new_carrier_id UUID;
ALTER TABLE opt ADD COLUMN new_delivery_location_id UUID;
ALTER TABLE opt ADD COLUMN new_created_by_id UUID;
UPDATE opt SET new_id = int_to_uuid(id);
UPDATE opt SET new_supplier_id = int_to_uuid(supplier_id);
UPDATE opt SET new_buyer_id = int_to_uuid(buyer_id);
UPDATE opt SET new_purchase_price_id = int_to_uuid(purchase_price_id) WHERE purchase_price_id IS NOT NULL;
UPDATE opt SET new_sale_price_id = int_to_uuid(sale_price_id) WHERE sale_price_id IS NOT NULL;
UPDATE opt SET new_carrier_id = int_to_uuid(carrier_id) WHERE carrier_id IS NOT NULL;
UPDATE opt SET new_delivery_location_id = int_to_uuid(delivery_location_id) WHERE delivery_location_id IS NOT NULL;
UPDATE opt SET new_created_by_id = int_to_uuid(created_by_id) WHERE created_by_id IS NOT NULL;
ALTER TABLE opt DROP CONSTRAINT opt_pkey;
ALTER TABLE opt DROP CONSTRAINT opt_created_by_id_users_id_fk;
ALTER TABLE opt DROP COLUMN id, DROP COLUMN supplier_id, DROP COLUMN buyer_id, DROP COLUMN purchase_price_id, DROP COLUMN sale_price_id, DROP COLUMN carrier_id, DROP COLUMN delivery_location_id, DROP COLUMN created_by_id;
ALTER TABLE opt RENAME COLUMN new_id TO id;
ALTER TABLE opt RENAME COLUMN new_supplier_id TO supplier_id;
ALTER TABLE opt RENAME COLUMN new_buyer_id TO buyer_id;
ALTER TABLE opt RENAME COLUMN new_purchase_price_id TO purchase_price_id;
ALTER TABLE opt RENAME COLUMN new_sale_price_id TO sale_price_id;
ALTER TABLE opt RENAME COLUMN new_carrier_id TO carrier_id;
ALTER TABLE opt RENAME COLUMN new_delivery_location_id TO delivery_location_id;
ALTER TABLE opt RENAME COLUMN new_created_by_id TO created_by_id;
ALTER TABLE opt ALTER COLUMN id SET NOT NULL;
ALTER TABLE opt ALTER COLUMN supplier_id SET NOT NULL;
ALTER TABLE opt ALTER COLUMN buyer_id SET NOT NULL;
ALTER TABLE opt ADD PRIMARY KEY (id);
ALTER TABLE opt ADD CONSTRAINT opt_created_by_id_users_id_fk 
  FOREIGN KEY (created_by_id) REFERENCES users(id);

-- Migrate aircraft_refueling table
ALTER TABLE aircraft_refueling ADD COLUMN new_id UUID;
ALTER TABLE aircraft_refueling ADD COLUMN new_supplier_id UUID;
ALTER TABLE aircraft_refueling ADD COLUMN new_buyer_id UUID;
ALTER TABLE aircraft_refueling ADD COLUMN new_purchase_price_id UUID;
ALTER TABLE aircraft_refueling ADD COLUMN new_sale_price_id UUID;
ALTER TABLE aircraft_refueling ADD COLUMN new_created_by_id UUID;
UPDATE aircraft_refueling SET new_id = int_to_uuid(id);
UPDATE aircraft_refueling SET new_supplier_id = int_to_uuid(supplier_id);
UPDATE aircraft_refueling SET new_buyer_id = int_to_uuid(buyer_id);
UPDATE aircraft_refueling SET new_purchase_price_id = int_to_uuid(purchase_price_id) WHERE purchase_price_id IS NOT NULL;
UPDATE aircraft_refueling SET new_sale_price_id = int_to_uuid(sale_price_id) WHERE sale_price_id IS NOT NULL;
UPDATE aircraft_refueling SET new_created_by_id = int_to_uuid(created_by_id) WHERE created_by_id IS NOT NULL;
ALTER TABLE aircraft_refueling DROP CONSTRAINT aircraft_refueling_pkey;
ALTER TABLE aircraft_refueling DROP CONSTRAINT aircraft_refueling_created_by_id_users_id_fk;
ALTER TABLE aircraft_refueling DROP COLUMN id, DROP COLUMN supplier_id, DROP COLUMN buyer_id, DROP COLUMN purchase_price_id, DROP COLUMN sale_price_id, DROP COLUMN created_by_id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_id TO id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_supplier_id TO supplier_id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_buyer_id TO buyer_id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_purchase_price_id TO purchase_price_id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_sale_price_id TO sale_price_id;
ALTER TABLE aircraft_refueling RENAME COLUMN new_created_by_id TO created_by_id;
ALTER TABLE aircraft_refueling ALTER COLUMN id SET NOT NULL;
ALTER TABLE aircraft_refueling ALTER COLUMN supplier_id SET NOT NULL;
ALTER TABLE aircraft_refueling ALTER COLUMN buyer_id SET NOT NULL;
ALTER TABLE aircraft_refueling ADD PRIMARY KEY (id);
ALTER TABLE aircraft_refueling ADD CONSTRAINT aircraft_refueling_created_by_id_users_id_fk 
  FOREIGN KEY (created_by_id) REFERENCES users(id);

-- Drop the helper function
DROP FUNCTION int_to_uuid(INTEGER);

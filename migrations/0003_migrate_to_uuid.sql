
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a function to convert tables to UUID
-- We'll create new tables with UUID, migrate data, drop old tables, and rename new ones

-- Start with roles table
CREATE TABLE roles_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions text[],
  is_default boolean DEFAULT false,
  is_system boolean DEFAULT false
);

-- Migrate data (we'll use a mapping table for old ID to new UUID)
CREATE TEMP TABLE roles_id_map (old_id integer, new_id uuid);

INSERT INTO roles_new (name, description, permissions, is_default, is_system)
SELECT name, description, permissions, is_default, is_system FROM roles
RETURNING id, name INTO TEMP TABLE temp_roles;

INSERT INTO roles_id_map (old_id, new_id)
SELECT r.id as old_id, rn.id as new_id
FROM roles r
JOIN roles_new rn ON r.name = rn.name;

-- Similarly for permissions
CREATE TABLE permissions_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text
);

CREATE TEMP TABLE permissions_id_map (old_id integer, new_id uuid);

INSERT INTO permissions_new (module, action, description)
SELECT module, action, description FROM permissions;

INSERT INTO permissions_id_map (old_id, new_id)
SELECT p.id as old_id, pn.id as new_id
FROM permissions p
JOIN permissions_new pn ON p.module = pn.module AND p.action = pn.action;

-- Role permissions
CREATE TABLE role_permissions_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles_new(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions_new(id) ON DELETE CASCADE
);

INSERT INTO role_permissions_new (role_id, permission_id)
SELECT rim.new_id, pim.new_id
FROM role_permissions rp
JOIN roles_id_map rim ON rp.role_id = rim.old_id
JOIN permissions_id_map pim ON rp.permission_id = pim.old_id;

-- Users
CREATE TABLE users_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  patronymic text,
  role_id uuid REFERENCES roles_new(id),
  is_active boolean DEFAULT true,
  last_login_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TEMP TABLE users_id_map (old_id integer, new_id uuid);

INSERT INTO users_new (email, password, first_name, last_name, patronymic, role_id, is_active, last_login_at, created_at)
SELECT u.email, u.password, u.first_name, u.last_name, u.patronymic, rim.new_id, u.is_active, u.last_login_at, u.created_at
FROM users u
LEFT JOIN roles_id_map rim ON u.role_id = rim.old_id;

INSERT INTO users_id_map (old_id, new_id)
SELECT u.id as old_id, un.id as new_id
FROM users u
JOIN users_new un ON u.email = un.email;

-- Customers
CREATE TABLE customers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  inn text,
  contract_number text,
  contact_person text,
  phone text,
  email text,
  module text NOT NULL,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE customers_id_map (old_id integer, new_id uuid);

INSERT INTO customers_new (name, description, inn, contract_number, contact_person, phone, email, module, is_active)
SELECT name, description, inn, contract_number, contact_person, phone, email, module, is_active FROM customers;

INSERT INTO customers_id_map (old_id, new_id)
SELECT c.id as old_id, cn.id as new_id
FROM customers c
JOIN customers_new cn ON c.name = cn.name AND c.module = cn.module;

-- Wholesale bases
CREATE TABLE wholesale_bases_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE wholesale_bases_id_map (old_id integer, new_id uuid);

INSERT INTO wholesale_bases_new (name, location, is_active)
SELECT name, location, is_active FROM wholesale_bases;

INSERT INTO wholesale_bases_id_map (old_id, new_id)
SELECT wb.id as old_id, wbn.id as new_id
FROM wholesale_bases wb
JOIN wholesale_bases_new wbn ON wb.name = wbn.name;

-- Wholesale suppliers
CREATE TABLE wholesale_suppliers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_base_id uuid,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE wholesale_suppliers_id_map (old_id integer, new_id uuid);

INSERT INTO wholesale_suppliers_new (name, description, default_base_id, is_active)
SELECT ws.name, ws.description, wbm.new_id, ws.is_active
FROM wholesale_suppliers ws
LEFT JOIN wholesale_bases_id_map wbm ON ws.default_base_id = wbm.old_id;

INSERT INTO wholesale_suppliers_id_map (old_id, new_id)
SELECT ws.id as old_id, wsn.id as new_id
FROM wholesale_suppliers ws
JOIN wholesale_suppliers_new wsn ON ws.name = wsn.name;

-- Add foreign key constraint after data migration
ALTER TABLE wholesale_suppliers_new ADD CONSTRAINT wholesale_suppliers_new_default_base_id_fkey 
  FOREIGN KEY (default_base_id) REFERENCES wholesale_bases_new(id);

-- Refueling bases
CREATE TABLE refueling_bases_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE refueling_bases_id_map (old_id integer, new_id uuid);

INSERT INTO refueling_bases_new (name, location, is_active)
SELECT name, location, is_active FROM refueling_bases;

INSERT INTO refueling_bases_id_map (old_id, new_id)
SELECT rb.id as old_id, rbn.id as new_id
FROM refueling_bases rb
JOIN refueling_bases_new rbn ON rb.name = rbn.name;

-- Refueling providers
CREATE TABLE refueling_providers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_base_id uuid,
  service_price numeric(12, 2),
  pvkj_price numeric(12, 2),
  agent_fee numeric(12, 2),
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE refueling_providers_id_map (old_id integer, new_id uuid);

INSERT INTO refueling_providers_new (name, description, default_base_id, service_price, pvkj_price, agent_fee, is_active)
SELECT rp.name, rp.description, rbm.new_id, rp.service_price, rp.pvkj_price, rp.agent_fee, rp.is_active
FROM refueling_providers rp
LEFT JOIN refueling_bases_id_map rbm ON rp.default_base_id = rbm.old_id;

INSERT INTO refueling_providers_id_map (old_id, new_id)
SELECT rp.id as old_id, rpn.id as new_id
FROM refueling_providers rp
JOIN refueling_providers_new rpn ON rp.name = rpn.name;

ALTER TABLE refueling_providers_new ADD CONSTRAINT refueling_providers_new_default_base_id_fkey 
  FOREIGN KEY (default_base_id) REFERENCES refueling_bases_new(id);

-- Logistics carriers
CREATE TABLE logistics_carriers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  inn text,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE logistics_carriers_id_map (old_id integer, new_id uuid);

INSERT INTO logistics_carriers_new (name, description, inn, is_active)
SELECT name, description, inn, is_active FROM logistics_carriers;

INSERT INTO logistics_carriers_id_map (old_id, new_id)
SELECT lc.id as old_id, lcn.id as new_id
FROM logistics_carriers lc
JOIN logistics_carriers_new lcn ON lc.name = lcn.name;

-- Logistics delivery locations
CREATE TABLE logistics_delivery_locations_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  notes text,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE logistics_delivery_locations_id_map (old_id integer, new_id uuid);

INSERT INTO logistics_delivery_locations_new (name, address, notes, is_active)
SELECT name, address, notes, is_active FROM logistics_delivery_locations;

INSERT INTO logistics_delivery_locations_id_map (old_id, new_id)
SELECT ldl.id as old_id, ldln.id as new_id
FROM logistics_delivery_locations ldl
JOIN logistics_delivery_locations_new ldln ON ldl.name = ldln.name;

-- Logistics vehicles
CREATE TABLE logistics_vehicles_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES logistics_carriers_new(id) ON DELETE SET NULL,
  reg_number text NOT NULL,
  model text,
  capacity_kg numeric(12, 2),
  is_active boolean DEFAULT true
);

INSERT INTO logistics_vehicles_new (carrier_id, reg_number, model, capacity_kg, is_active)
SELECT lcm.new_id, lv.reg_number, lv.model, lv.capacity_kg, lv.is_active
FROM logistics_vehicles lv
LEFT JOIN logistics_carriers_id_map lcm ON lv.carrier_id = lcm.old_id;

-- Logistics trailers
CREATE TABLE logistics_trailers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES logistics_carriers_new(id) ON DELETE SET NULL,
  reg_number text NOT NULL,
  capacity_kg numeric(12, 2),
  is_active boolean DEFAULT true
);

INSERT INTO logistics_trailers_new (carrier_id, reg_number, capacity_kg, is_active)
SELECT lcm.new_id, lt.reg_number, lt.capacity_kg, lt.is_active
FROM logistics_trailers lt
LEFT JOIN logistics_carriers_id_map lcm ON lt.carrier_id = lcm.old_id;

-- Logistics drivers
CREATE TABLE logistics_drivers_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES logistics_carriers_new(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  license_number text,
  is_active boolean DEFAULT true
);

INSERT INTO logistics_drivers_new (carrier_id, full_name, phone, license_number, is_active)
SELECT lcm.new_id, ld.full_name, ld.phone, ld.license_number, ld.is_active
FROM logistics_drivers ld
LEFT JOIN logistics_carriers_id_map lcm ON ld.carrier_id = lcm.old_id;

-- Logistics warehouses
CREATE TABLE logistics_warehouses_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text,
  storage_cost numeric(12, 2),
  is_active boolean DEFAULT true
);

INSERT INTO logistics_warehouses_new (name, description, address, storage_cost, is_active)
SELECT name, description, address, storage_cost, is_active FROM logistics_warehouses;

-- Warehouses
CREATE TABLE warehouses_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  basis text,
  current_balance numeric(15, 2) DEFAULT '0',
  average_cost numeric(12, 4) DEFAULT '0',
  monthly_allocation numeric(15, 2),
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE warehouses_id_map (old_id integer, new_id uuid);

INSERT INTO warehouses_new (name, type, basis, current_balance, average_cost, monthly_allocation, is_active)
SELECT name, type, basis, current_balance, average_cost, monthly_allocation, is_active FROM warehouses;

INSERT INTO warehouses_id_map (old_id, new_id)
SELECT w.id as old_id, wn.id as new_id
FROM warehouses w
JOIN warehouses_new wn ON w.name = wn.name AND w.type = wn.type;

-- Prices
CREATE TABLE prices_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text NOT NULL,
  counterparty_id uuid NOT NULL,
  counterparty_type text NOT NULL,
  counterparty_role text NOT NULL,
  basis text NOT NULL,
  price_values text[],
  volume numeric(15, 2),
  date_from date NOT NULL,
  date_to date NOT NULL,
  contract_number text,
  contract_appendix text,
  sold_volume numeric(15, 2) DEFAULT '0',
  date_check_warning text,
  is_active boolean DEFAULT true
);

CREATE TEMP TABLE prices_id_map (old_id integer, new_id uuid);

INSERT INTO prices_new (product_type, counterparty_id, counterparty_type, counterparty_role, basis, price_values, volume, date_from, date_to, contract_number, contract_appendix, sold_volume, date_check_warning, is_active)
SELECT 
  p.product_type,
  CASE 
    WHEN p.counterparty_type = 'wholesale' AND p.counterparty_role = 'supplier' THEN wsm.new_id
    WHEN p.counterparty_type = 'refueling' AND p.counterparty_role = 'supplier' THEN rpm.new_id
    WHEN p.counterparty_role = 'buyer' THEN cm.new_id
    ELSE NULL
  END,
  p.counterparty_type,
  p.counterparty_role,
  p.basis,
  p.price_values,
  p.volume,
  p.date_from,
  p.date_to,
  p.contract_number,
  p.contract_appendix,
  p.sold_volume,
  p.date_check_warning,
  p.is_active
FROM prices p
LEFT JOIN wholesale_suppliers_id_map wsm ON p.counterparty_id = wsm.old_id AND p.counterparty_type = 'wholesale' AND p.counterparty_role = 'supplier'
LEFT JOIN refueling_providers_id_map rpm ON p.counterparty_id = rpm.old_id AND p.counterparty_type = 'refueling' AND p.counterparty_role = 'supplier'
LEFT JOIN customers_id_map cm ON p.counterparty_id = cm.old_id AND p.counterparty_role = 'buyer';

INSERT INTO prices_id_map (old_id, new_id)
SELECT p.id as old_id, pn.id as new_id
FROM prices p
JOIN prices_new pn ON p.date_from = pn.date_from AND p.basis = pn.basis AND p.counterparty_type = pn.counterparty_type;

-- Delivery cost
CREATE TABLE delivery_cost_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid NOT NULL,
  basis text NOT NULL,
  delivery_location_id uuid NOT NULL,
  tariff numeric(12, 4) NOT NULL,
  is_active boolean DEFAULT true
);

INSERT INTO delivery_cost_new (carrier_id, basis, delivery_location_id, tariff, is_active)
SELECT lcm.new_id, dc.basis, ldlm.new_id, dc.tariff, dc.is_active
FROM delivery_cost dc
LEFT JOIN logistics_carriers_id_map lcm ON dc.carrier_id = lcm.old_id
LEFT JOIN logistics_delivery_locations_id_map ldlm ON dc.delivery_location_id = ldlm.old_id;

-- Warehouse transactions
CREATE TABLE warehouse_transactions_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses_new(id),
  transaction_date date NOT NULL,
  transaction_type text NOT NULL,
  quantity numeric(15, 2) NOT NULL,
  price numeric(12, 4),
  total_amount numeric(15, 2),
  source_type text,
  source_id uuid,
  balance_after numeric(15, 2),
  average_cost_after numeric(12, 4)
);

INSERT INTO warehouse_transactions_new (warehouse_id, transaction_date, transaction_type, quantity, price, total_amount, source_type, source_id, balance_after, average_cost_after)
SELECT wm.new_id, wt.transaction_date, wt.transaction_type, wt.quantity, wt.price, wt.total_amount, wt.source_type, NULL, wt.balance_after, wt.average_cost_after
FROM warehouse_transactions wt
LEFT JOIN warehouses_id_map wm ON wt.warehouse_id = wm.old_id;

-- Exchange
CREATE TABLE exchange_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_date date NOT NULL,
  deal_number text,
  counterparty text NOT NULL,
  product_type text NOT NULL,
  quantity_kg numeric(15, 2) NOT NULL,
  price_per_kg numeric(12, 4) NOT NULL,
  total_amount numeric(15, 2) NOT NULL,
  warehouse_id uuid REFERENCES warehouses_new(id),
  notes text,
  created_at timestamp DEFAULT now(),
  created_by_id uuid REFERENCES users_new(id)
);

INSERT INTO exchange_new (deal_date, deal_number, counterparty, product_type, quantity_kg, price_per_kg, total_amount, warehouse_id, notes, created_at, created_by_id)
SELECT e.deal_date, e.deal_number, e.counterparty, e.product_type, e.quantity_kg, e.price_per_kg, e.total_amount, wm.new_id, e.notes, e.created_at, um.new_id
FROM exchange e
LEFT JOIN warehouses_id_map wm ON e.warehouse_id = wm.old_id
LEFT JOIN users_id_map um ON e.created_by_id = um.old_id;

-- Movement
CREATE TABLE movement_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date date NOT NULL,
  movement_type text NOT NULL,
  product_type text NOT NULL,
  supplier_id uuid,
  from_warehouse_id uuid REFERENCES warehouses_new(id),
  to_warehouse_id uuid NOT NULL REFERENCES warehouses_new(id),
  quantity_liters numeric(15, 2),
  density numeric(6, 4),
  quantity_kg numeric(15, 2) NOT NULL,
  purchase_price numeric(12, 4),
  delivery_price numeric(12, 4),
  delivery_cost numeric(15, 2),
  total_cost numeric(15, 2),
  cost_per_kg numeric(12, 4),
  carrier_id uuid,
  vehicle_number text,
  trailer_number text,
  driver_name text,
  notes text,
  created_at timestamp DEFAULT now(),
  created_by_id uuid REFERENCES users_new(id)
);

INSERT INTO movement_new (movement_date, movement_type, product_type, supplier_id, from_warehouse_id, to_warehouse_id, quantity_liters, density, quantity_kg, purchase_price, delivery_price, delivery_cost, total_cost, cost_per_kg, carrier_id, vehicle_number, trailer_number, driver_name, notes, created_at, created_by_id)
SELECT 
  m.movement_date, m.movement_type, m.product_type,
  CASE 
    WHEN m.supplier_id IS NOT NULL THEN COALESCE(wsm.new_id, rpm.new_id)
    ELSE NULL
  END,
  fwm.new_id, twm.new_id, m.quantity_liters, m.density, m.quantity_kg, m.purchase_price, m.delivery_price, m.delivery_cost, m.total_cost, m.cost_per_kg,
  lcm.new_id, m.vehicle_number, m.trailer_number, m.driver_name, m.notes, m.created_at, um.new_id
FROM movement m
LEFT JOIN wholesale_suppliers_id_map wsm ON m.supplier_id = wsm.old_id
LEFT JOIN refueling_providers_id_map rpm ON m.supplier_id = rpm.old_id
LEFT JOIN warehouses_id_map fwm ON m.from_warehouse_id = fwm.old_id
LEFT JOIN warehouses_id_map twm ON m.to_warehouse_id = twm.old_id
LEFT JOIN logistics_carriers_id_map lcm ON m.carrier_id = lcm.old_id
LEFT JOIN users_id_map um ON m.created_by_id = um.old_id;

-- Opt
CREATE TABLE opt_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_date date NOT NULL,
  supplier_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  basis text,
  quantity_liters numeric(15, 2),
  density numeric(6, 4),
  quantity_kg numeric(15, 2) NOT NULL,
  purchase_price numeric(12, 4),
  purchase_price_id uuid,
  sale_price numeric(12, 4),
  sale_price_id uuid,
  purchase_amount numeric(15, 2),
  sale_amount numeric(15, 2),
  carrier_id uuid,
  delivery_location_id uuid,
  delivery_tariff numeric(12, 4),
  delivery_cost numeric(15, 2),
  profit numeric(15, 2),
  cumulative_profit numeric(15, 2),
  vehicle_number text,
  trailer_number text,
  driver_name text,
  contract_number text,
  notes text,
  is_approx_volume boolean DEFAULT false,
  warehouse_status text,
  price_status text,
  created_at timestamp DEFAULT now(),
  created_by_id uuid REFERENCES users_new(id)
);

INSERT INTO opt_new (deal_date, supplier_id, buyer_id, basis, quantity_liters, density, quantity_kg, purchase_price, purchase_price_id, sale_price, sale_price_id, purchase_amount, sale_amount, carrier_id, delivery_location_id, delivery_tariff, delivery_cost, profit, cumulative_profit, vehicle_number, trailer_number, driver_name, contract_number, notes, is_approx_volume, warehouse_status, price_status, created_at, created_by_id)
SELECT 
  o.deal_date, wsm.new_id, cm.new_id, o.basis, o.quantity_liters, o.density, o.quantity_kg, o.purchase_price, ppm.new_id, o.sale_price, spm.new_id, o.purchase_amount, o.sale_amount,
  lcm.new_id, ldlm.new_id, o.delivery_tariff, o.delivery_cost, o.profit, o.cumulative_profit, o.vehicle_number, o.trailer_number, o.driver_name, o.contract_number, o.notes, o.is_approx_volume, o.warehouse_status, o.price_status, o.created_at, um.new_id
FROM opt o
LEFT JOIN wholesale_suppliers_id_map wsm ON o.supplier_id = wsm.old_id
LEFT JOIN customers_id_map cm ON o.buyer_id = cm.old_id
LEFT JOIN prices_id_map ppm ON o.purchase_price_id = ppm.old_id
LEFT JOIN prices_id_map spm ON o.sale_price_id = spm.old_id
LEFT JOIN logistics_carriers_id_map lcm ON o.carrier_id = lcm.old_id
LEFT JOIN logistics_delivery_locations_id_map ldlm ON o.delivery_location_id = ldlm.old_id
LEFT JOIN users_id_map um ON o.created_by_id = um.old_id;

-- Aircraft refueling
CREATE TABLE aircraft_refueling_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refueling_date date NOT NULL,
  product_type text NOT NULL,
  aircraft_number text,
  order_number text,
  supplier_id uuid NOT NULL,
  basis text,
  buyer_id uuid NOT NULL,
  quantity_liters numeric(15, 2),
  density numeric(6, 4),
  quantity_kg numeric(15, 2) NOT NULL,
  purchase_price numeric(12, 4),
  purchase_price_id uuid,
  sale_price numeric(12, 4),
  sale_price_id uuid,
  purchase_amount numeric(15, 2),
  sale_amount numeric(15, 2),
  profit numeric(15, 2),
  cumulative_profit numeric(15, 2),
  contract_number text,
  notes text,
  is_approx_volume boolean DEFAULT false,
  warehouse_status text,
  price_status text,
  created_at timestamp DEFAULT now(),
  created_by_id uuid REFERENCES users_new(id)
);

INSERT INTO aircraft_refueling_new (refueling_date, product_type, aircraft_number, order_number, supplier_id, basis, buyer_id, quantity_liters, density, quantity_kg, purchase_price, purchase_price_id, sale_price, sale_price_id, purchase_amount, sale_amount, profit, cumulative_profit, contract_number, notes, is_approx_volume, warehouse_status, price_status, created_at, created_by_id)
SELECT 
  ar.refueling_date, ar.product_type, ar.aircraft_number, ar.order_number, rpm.new_id, ar.basis, cm.new_id, ar.quantity_liters, ar.density, ar.quantity_kg, ar.purchase_price, ppm.new_id, ar.sale_price, spm.new_id, ar.purchase_amount, ar.sale_amount, ar.profit, ar.cumulative_profit, ar.contract_number, ar.notes, ar.is_approx_volume, ar.warehouse_status, ar.price_status, ar.created_at, um.new_id
FROM aircraft_refueling ar
LEFT JOIN refueling_providers_id_map rpm ON ar.supplier_id = rpm.old_id
LEFT JOIN customers_id_map cm ON ar.buyer_id = cm.old_id
LEFT JOIN prices_id_map ppm ON ar.purchase_price_id = ppm.old_id
LEFT JOIN prices_id_map spm ON ar.sale_price_id = spm.old_id
LEFT JOIN users_id_map um ON ar.created_by_id = um.old_id;

-- Drop old tables and rename new ones
DROP TABLE IF EXISTS aircraft_refueling CASCADE;
DROP TABLE IF EXISTS opt CASCADE;
DROP TABLE IF EXISTS movement CASCADE;
DROP TABLE IF EXISTS exchange CASCADE;
DROP TABLE IF EXISTS warehouse_transactions CASCADE;
DROP TABLE IF EXISTS delivery_cost CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS logistics_warehouses CASCADE;
DROP TABLE IF EXISTS logistics_drivers CASCADE;
DROP TABLE IF EXISTS logistics_trailers CASCADE;
DROP TABLE IF EXISTS logistics_vehicles CASCADE;
DROP TABLE IF EXISTS logistics_delivery_locations CASCADE;
DROP TABLE IF EXISTS logistics_carriers CASCADE;
DROP TABLE IF EXISTS refueling_providers CASCADE;
DROP TABLE IF EXISTS refueling_bases CASCADE;
DROP TABLE IF EXISTS wholesale_suppliers CASCADE;
DROP TABLE IF EXISTS wholesale_bases CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

ALTER TABLE roles_new RENAME TO roles;
ALTER TABLE permissions_new RENAME TO permissions;
ALTER TABLE role_permissions_new RENAME TO role_permissions;
ALTER TABLE users_new RENAME TO users;
ALTER TABLE customers_new RENAME TO customers;
ALTER TABLE wholesale_bases_new RENAME TO wholesale_bases;
ALTER TABLE wholesale_suppliers_new RENAME TO wholesale_suppliers;
ALTER TABLE refueling_bases_new RENAME TO refueling_bases;
ALTER TABLE refueling_providers_new RENAME TO refueling_providers;
ALTER TABLE logistics_carriers_new RENAME TO logistics_carriers;
ALTER TABLE logistics_delivery_locations_new RENAME TO logistics_delivery_locations;
ALTER TABLE logistics_vehicles_new RENAME TO logistics_vehicles;
ALTER TABLE logistics_trailers_new RENAME TO logistics_trailers;
ALTER TABLE logistics_drivers_new RENAME TO logistics_drivers;
ALTER TABLE logistics_warehouses_new RENAME TO logistics_warehouses;
ALTER TABLE warehouses_new RENAME TO warehouses;
ALTER TABLE prices_new RENAME TO prices;
ALTER TABLE delivery_cost_new RENAME TO delivery_cost;
ALTER TABLE warehouse_transactions_new RENAME TO warehouse_transactions;
ALTER TABLE exchange_new RENAME TO exchange;
ALTER TABLE movement_new RENAME TO movement;
ALTER TABLE opt_new RENAME TO opt;
ALTER TABLE aircraft_refueling_new RENAME TO aircraft_refueling;

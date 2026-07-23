-- Migration: Logistics Plan Module
-- Adds: transit_days + priority to delivery_cost
-- Adds: logistics_transport_units, logistics_driver_schedule, logistics_vehicle_availability
-- Adds: logistics_plan_routes, logistics_plan_comments, logistics_monthly_syncs, logistics_plan_notifications

-- 1. Extend delivery_cost with transit_days and priority
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS transit_days integer;
ALTER TABLE delivery_cost ADD COLUMN IF NOT EXISTS priority integer;

-- 2. Transport Units (связка перевозчик + тягач + прицеп + водитель)
CREATE TABLE IF NOT EXISTS logistics_transport_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_id uuid REFERENCES logistics_carriers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES logistics_vehicles(id) ON DELETE SET NULL,
  trailer_id uuid REFERENCES logistics_trailers(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES logistics_drivers(id) ON DELETE SET NULL,
  trailer_capacity_m3 decimal(10,2),
  current_location_entity_type text,
  current_location_entity_id uuid,
  current_location_name text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ltu_carrier_idx ON logistics_transport_units(carrier_id);
CREATE INDEX IF NOT EXISTS ltu_vehicle_idx ON logistics_transport_units(vehicle_id);
CREATE INDEX IF NOT EXISTS ltu_is_active_idx ON logistics_transport_units(is_active);

-- 3. Driver Schedule (табель водителей)
CREATE TABLE IF NOT EXISTS logistics_driver_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES logistics_drivers(id) ON DELETE CASCADE,
  type text NOT NULL,
  date_from timestamp NOT NULL,
  date_to timestamp NOT NULL,
  reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS lds_driver_idx ON logistics_driver_schedule(driver_id);
CREATE INDEX IF NOT EXISTS lds_date_from_idx ON logistics_driver_schedule(date_from);
CREATE INDEX IF NOT EXISTS lds_date_to_idx ON logistics_driver_schedule(date_to);

-- 4. Vehicle Availability (доступность транспорта)
CREATE TABLE IF NOT EXISTS logistics_vehicle_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES logistics_vehicles(id) ON DELETE CASCADE,
  type text NOT NULL,
  date_from timestamp NOT NULL,
  date_to timestamp NOT NULL,
  reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS lva_vehicle_idx ON logistics_vehicle_availability(vehicle_id);
CREATE INDEX IF NOT EXISTS lva_date_from_idx ON logistics_vehicle_availability(date_from);

-- 5. Plan Routes (плановые маршруты)
CREATE TABLE IF NOT EXISTS logistics_plan_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_unit_id uuid REFERENCES logistics_transport_units(id) ON DELETE SET NULL,
  scenario_id uuid REFERENCES planning_scenarios(id) ON DELETE SET NULL,
  sync_id uuid,
  plan_entry_id uuid,
  delivery_cost_id uuid REFERENCES delivery_cost(id) ON DELETE SET NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'manual',
  from_entity_type text,
  from_entity_id uuid,
  from_entity_name text,
  to_entity_type text,
  to_entity_id uuid,
  to_entity_name text,
  date_start timestamp,
  date_end timestamp,
  priority integer,
  is_deadline boolean DEFAULT false,
  is_unplanned boolean DEFAULT false,
  is_optimal boolean DEFAULT true,
  is_late boolean DEFAULT false,
  unavailability_reason text,
  notes text,
  period_from timestamp,
  period_to timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id),
  updated_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS lpr_transport_unit_idx ON logistics_plan_routes(transport_unit_id);
CREATE INDEX IF NOT EXISTS lpr_scenario_idx ON logistics_plan_routes(scenario_id);
CREATE INDEX IF NOT EXISTS lpr_date_start_idx ON logistics_plan_routes(date_start);
CREATE INDEX IF NOT EXISTS lpr_period_idx ON logistics_plan_routes(period_from, period_to);

-- 6. Plan Comments (комментарии к маршрутам)
CREATE TABLE IF NOT EXISTS logistics_plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid REFERENCES logistics_plan_routes(id) ON DELETE CASCADE,
  comment text NOT NULL,
  is_admin boolean DEFAULT false,
  is_read boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  created_by_id uuid REFERENCES users(id),
  deleted_at timestamp,
  deleted_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS lpc_route_idx ON logistics_plan_comments(route_id);
CREATE INDEX IF NOT EXISTS lpc_is_read_idx ON logistics_plan_comments(is_read);

-- 7. Monthly Syncs (синхронизация с ежемесячным планом)
CREATE TABLE IF NOT EXISTS logistics_monthly_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid REFERENCES planning_scenarios(id) ON DELETE SET NULL,
  period_from timestamp,
  period_to timestamp,
  status text NOT NULL DEFAULT 'active',
  snapshot_data jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp,
  created_by_id uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS lms_scenario_idx ON logistics_monthly_syncs(scenario_id);
CREATE INDEX IF NOT EXISTS lms_period_idx ON logistics_monthly_syncs(period_from, period_to);

-- 8. Notifications (уведомления)
CREATE TABLE IF NOT EXISTS logistics_plan_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id uuid REFERENCES logistics_monthly_syncs(id) ON DELETE CASCADE,
  route_id uuid,
  type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  is_read boolean DEFAULT false,
  period_from timestamp,
  period_to timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lpn_sync_idx ON logistics_plan_notifications(sync_id);
CREATE INDEX IF NOT EXISTS lpn_is_read_idx ON logistics_plan_notifications(is_read);
CREATE INDEX IF NOT EXISTS lpn_period_idx ON logistics_plan_notifications(period_from, period_to);

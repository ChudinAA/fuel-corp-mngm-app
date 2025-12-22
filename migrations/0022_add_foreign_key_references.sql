
-- Add foreign key constraints to opt table
ALTER TABLE opt 
  DROP CONSTRAINT IF EXISTS opt_supplier_id_suppliers_id_fk,
  ADD CONSTRAINT opt_supplier_id_suppliers_id_fk 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE opt 
  DROP CONSTRAINT IF EXISTS opt_buyer_id_customers_id_fk,
  ADD CONSTRAINT opt_buyer_id_customers_id_fk 
    FOREIGN KEY (buyer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE opt 
  DROP CONSTRAINT IF EXISTS opt_carrier_id_logistics_carriers_id_fk,
  ADD CONSTRAINT opt_carrier_id_logistics_carriers_id_fk 
    FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE opt 
  DROP CONSTRAINT IF EXISTS opt_delivery_location_id_logistics_delivery_locations_id_fk,
  ADD CONSTRAINT opt_delivery_location_id_logistics_delivery_locations_id_fk 
    FOREIGN KEY (delivery_location_id) REFERENCES logistics_delivery_locations(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints to aircraft_refueling table
ALTER TABLE aircraft_refueling 
  DROP CONSTRAINT IF EXISTS aircraft_refueling_supplier_id_suppliers_id_fk,
  ADD CONSTRAINT aircraft_refueling_supplier_id_suppliers_id_fk 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE aircraft_refueling 
  DROP CONSTRAINT IF EXISTS aircraft_refueling_buyer_id_customers_id_fk,
  ADD CONSTRAINT aircraft_refueling_buyer_id_customers_id_fk 
    FOREIGN KEY (buyer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key constraints to movement table
ALTER TABLE movement 
  DROP CONSTRAINT IF EXISTS movement_supplier_id_suppliers_id_fk,
  ADD CONSTRAINT movement_supplier_id_suppliers_id_fk 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE movement 
  DROP CONSTRAINT IF EXISTS movement_carrier_id_logistics_carriers_id_fk,
  ADD CONSTRAINT movement_carrier_id_logistics_carriers_id_fk 
    FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints to delivery_cost table
ALTER TABLE delivery_cost 
  DROP CONSTRAINT IF EXISTS delivery_cost_carrier_id_logistics_carriers_id_fk,
  ADD CONSTRAINT delivery_cost_carrier_id_logistics_carriers_id_fk 
    FOREIGN KEY (carrier_id) REFERENCES logistics_carriers(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_opt_supplier_id ON opt(supplier_id);
CREATE INDEX IF NOT EXISTS idx_opt_buyer_id ON opt(buyer_id);
CREATE INDEX IF NOT EXISTS idx_opt_warehouse_id ON opt(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_opt_carrier_id ON opt(carrier_id);
CREATE INDEX IF NOT EXISTS idx_opt_delivery_location_id ON opt(delivery_location_id);
CREATE INDEX IF NOT EXISTS idx_opt_deal_date ON opt(deal_date);

CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_supplier_id ON aircraft_refueling(supplier_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_buyer_id ON aircraft_refueling(buyer_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_warehouse_id ON aircraft_refueling(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_aircraft_refueling_deal_date ON aircraft_refueling(deal_date);

CREATE INDEX IF NOT EXISTS idx_movement_supplier_id ON movement(supplier_id);
CREATE INDEX IF NOT EXISTS idx_movement_from_warehouse_id ON movement(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movement_to_warehouse_id ON movement(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movement_carrier_id ON movement(carrier_id);
CREATE INDEX IF NOT EXISTS idx_movement_deal_date ON movement(deal_date);

CREATE INDEX IF NOT EXISTS idx_exchange_warehouse_id ON exchange(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_exchange_deal_date ON exchange(deal_date);

CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_warehouse_id ON warehouse_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_source ON warehouse_transactions(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_delivery_cost_carrier_id ON delivery_cost(carrier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cost_from_entity ON delivery_cost(from_entity_type, from_entity_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cost_to_entity ON delivery_cost(to_entity_type, to_entity_id);

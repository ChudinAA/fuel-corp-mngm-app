
-- Indexes for customers (wholesale)
CREATE INDEX IF NOT EXISTS idx_customers_type ON directory_wholesale(type);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON directory_wholesale(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_basis ON directory_wholesale(basis);

-- Indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON directory_wholesale(type) WHERE type IN ('supplier', 'both');
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active_type ON directory_wholesale(is_active, type);

-- Indexes for bases
CREATE INDEX IF NOT EXISTS idx_bases_type ON directory_refueling(type);
CREATE INDEX IF NOT EXISTS idx_bases_is_active ON directory_refueling(is_active);
CREATE INDEX IF NOT EXISTS idx_bases_basis ON directory_refueling(basis);

-- Indexes for logistics
CREATE INDEX IF NOT EXISTS idx_logistics_type ON directory_logistics(type);
CREATE INDEX IF NOT EXISTS idx_logistics_is_active ON directory_logistics(is_active);
CREATE INDEX IF NOT EXISTS idx_logistics_carrier_id ON directory_logistics(carrier_id);

-- Indexes for opt
CREATE INDEX IF NOT EXISTS idx_opt_supplier_id ON opt(supplier_id);
CREATE INDEX IF NOT EXISTS idx_opt_buyer_id ON opt(buyer_id);
CREATE INDEX IF NOT EXISTS idx_opt_carrier_id ON opt(carrier_id);
CREATE INDEX IF NOT EXISTS idx_opt_delivery_location_id ON opt(delivery_location_id);
CREATE INDEX IF NOT EXISTS idx_opt_deal_date ON opt(deal_date);
CREATE INDEX IF NOT EXISTS idx_opt_purchase_price_id ON opt(purchase_price_id);
CREATE INDEX IF NOT EXISTS idx_opt_sale_price_id ON opt(sale_price_id);
CREATE INDEX IF NOT EXISTS idx_opt_created_by_id ON opt(created_by_id);
CREATE INDEX IF NOT EXISTS idx_opt_updated_by_id ON opt(updated_by_id);

-- Indexes for aircraft_refueling
CREATE INDEX IF NOT EXISTS idx_refueling_supplier_id ON aircraft_refueling(supplier_id);
CREATE INDEX IF NOT EXISTS idx_refueling_buyer_id ON aircraft_refueling(buyer_id);
CREATE INDEX IF NOT EXISTS idx_refueling_deal_date ON aircraft_refueling(refueling_date);
CREATE INDEX IF NOT EXISTS idx_refueling_purchase_price_id ON aircraft_refueling(purchase_price_id);
CREATE INDEX IF NOT EXISTS idx_refueling_sale_price_id ON aircraft_refueling(sale_price_id);
CREATE INDEX IF NOT EXISTS idx_refueling_created_by_id ON aircraft_refueling(created_by_id);
CREATE INDEX IF NOT EXISTS idx_refueling_updated_by_id ON aircraft_refueling(updated_by_id);
CREATE INDEX IF NOT EXISTS idx_refueling_product_type ON aircraft_refueling(product_type);

-- Indexes for movement
CREATE INDEX IF NOT EXISTS idx_movement_supplier_id ON movement(supplier_id);
CREATE INDEX IF NOT EXISTS idx_movement_from_warehouse_id ON movement(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movement_to_warehouse_id ON movement(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movement_carrier_id ON movement(carrier_id);
CREATE INDEX IF NOT EXISTS idx_movement_movement_date ON movement(movement_date);
CREATE INDEX IF NOT EXISTS idx_movement_created_by_id ON movement(created_by_id);
CREATE INDEX IF NOT EXISTS idx_movement_updated_by_id ON movement(updated_by_id);
CREATE INDEX IF NOT EXISTS idx_movement_product_type ON movement(product_type);
CREATE INDEX IF NOT EXISTS idx_movement_movement_type ON movement(movement_type);

-- Indexes for exchange
CREATE INDEX IF NOT EXISTS idx_exchange_warehouse_id ON exchange(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_exchange_deal_date ON exchange(deal_date);
CREATE INDEX IF NOT EXISTS idx_exchange_created_by_id ON exchange(created_by_id);
CREATE INDEX IF NOT EXISTS idx_exchange_updated_by_id ON exchange(updated_by_id);
CREATE INDEX IF NOT EXISTS idx_exchange_product_type ON exchange(product_type);

-- Indexes for warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_type ON warehouses(type);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON warehouses(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouses_basis ON warehouses(basis);

-- Indexes for warehouse_transactions
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_warehouse_id ON warehouse_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_transaction_date ON warehouse_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_source ON warehouse_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_transactions_transaction_type ON warehouse_transactions(transaction_type);

-- Indexes for prices
CREATE INDEX IF NOT EXISTS idx_prices_counterparty ON prices(counterparty_id, counterparty_type);
CREATE INDEX IF NOT EXISTS idx_prices_product_type ON prices(product_type);
CREATE INDEX IF NOT EXISTS idx_prices_basis ON prices(basis);
CREATE INDEX IF NOT EXISTS idx_prices_is_active ON prices(is_active);
CREATE INDEX IF NOT EXISTS idx_prices_dates ON prices(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_prices_counterparty_role ON prices(counterparty_role);

-- Indexes for delivery_cost
CREATE INDEX IF NOT EXISTS idx_delivery_cost_carrier_id ON delivery_cost(carrier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cost_delivery_location_id ON delivery_cost(delivery_location_id);
CREATE INDEX IF NOT EXISTS idx_delivery_cost_basis ON delivery_cost(basis);
CREATE INDEX IF NOT EXISTS idx_delivery_cost_is_active ON delivery_cost(is_active);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_opt_supplier_date ON opt(supplier_id, deal_date);
CREATE INDEX IF NOT EXISTS idx_opt_buyer_date ON opt(buyer_id, deal_date);
CREATE INDEX IF NOT EXISTS idx_refueling_supplier_date ON aircraft_refueling(supplier_id, refueling_date);
CREATE INDEX IF NOT EXISTS idx_refueling_buyer_date ON aircraft_refueling(buyer_id, refueling_date);
CREATE INDEX IF NOT EXISTS idx_movement_warehouse_date ON movement(to_warehouse_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_exchange_warehouse_date ON exchange(warehouse_id, deal_date);
CREATE INDEX IF NOT EXISTS idx_prices_active_dates ON prices(is_active, date_from, date_to) WHERE is_active = true;

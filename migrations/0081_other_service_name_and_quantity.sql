-- Add otherServiceName and otherServiceQuantity to supplier_basis_prices
ALTER TABLE supplier_basis_prices 
  ADD COLUMN IF NOT EXISTS other_service_name text,
  ADD COLUMN IF NOT EXISTS other_service_quantity decimal(15, 6);

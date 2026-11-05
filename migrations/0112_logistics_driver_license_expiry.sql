ALTER TABLE logistics_drivers
  ADD COLUMN IF NOT EXISTS license_expiry date;

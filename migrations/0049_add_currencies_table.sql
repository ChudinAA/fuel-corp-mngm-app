-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  created_by_id UUID REFERENCES users(id),
  updated_by_id UUID REFERENCES users(id),
  deleted_at TIMESTAMP,
  deleted_by_id UUID REFERENCES users(id)
);

-- Add indexes
CREATE INDEX currencies_code_idx ON currencies(code);
CREATE INDEX currencies_is_active_idx ON currencies(is_active);

-- Add target_currency column to exchange_rates (default to RUB for existing records)
ALTER TABLE exchange_rates ADD COLUMN IF NOT EXISTS target_currency TEXT DEFAULT 'RUB';

-- Update existing records to have explicit target_currency
UPDATE exchange_rates SET target_currency = 'RUB' WHERE target_currency IS NULL;

-- Make target_currency NOT NULL after setting defaults
ALTER TABLE exchange_rates ALTER COLUMN target_currency SET NOT NULL;

-- Add index for currency pair lookups
CREATE INDEX IF NOT EXISTS exchange_rates_currency_pair_idx ON exchange_rates(currency, target_currency);

-- Seed initial currencies
INSERT INTO currencies (code, name, symbol, is_active) VALUES
  ('RUB', 'Российский рубль', '₽', true),
  ('USD', 'Доллар США', '$', true),
  ('EUR', 'Евро', '€', true),
  ('CNY', 'Китайский юань', '¥', true),
  ('AED', 'Дирхам ОАЭ', 'د.إ', true),
  ('TRY', 'Турецкая лира', '₺', true),
  ('KZT', 'Казахстанский тенге', '₸', true),
  ('BYN', 'Белорусский рубль', 'Br', true),
  ('GBP', 'Фунт стерлингов', '£', true)
ON CONFLICT (code) DO NOTHING;

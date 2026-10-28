BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  matching_rows integer;
BEGIN
  IF to_regclass('public.prices') IS NULL THEN
    RAISE EXCEPTION 'Required table public.prices is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prices'
      AND column_name = 'price_unit'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prices'
      AND column_name = 'price_values'
  ) THEN
    RAISE EXCEPTION 'Required price unit columns are missing';
  END IF;

  SELECT COUNT(*)::integer
  INTO matching_rows
  FROM public.prices
  WHERE price_unit = 'kg'
    AND price_values IS NOT NULL
    AND cardinality(price_values) = 1
    AND btrim(price_values[1]) = '75';

  IF matching_rows > 1 THEN
    RAISE EXCEPTION
      'Expected at most one protected scalar rate with the exact legacy value 75; found %',
      matching_rows;
  END IF;

  IF matching_rows = 1 THEN
    UPDATE public.prices
    SET price_values = ARRAY[jsonb_build_object('price', 75000)::text],
        price_unit = 'tonne'
    WHERE price_unit = 'kg'
      AND price_values IS NOT NULL
      AND cardinality(price_values) = 1
      AND btrim(price_values[1]) = '75';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.prices
    WHERE price_unit = 'kg'
      AND price_values IS NOT NULL
      AND cardinality(price_values) = 1
      AND btrim(price_values[1]) = '75'
  ) THEN
    RAISE EXCEPTION 'Known scalar per-kilogram rate was not normalized';
  END IF;
END $$;

COMMIT;

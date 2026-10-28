BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';

DO $$
BEGIN
  IF to_regclass('public.prices') IS NULL THEN
    RAISE EXCEPTION 'prices table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM prices
    WHERE volume_unit IS NULL
       OR volume_unit NOT IN ('kg', 'tonne')
       OR price_unit IS NULL
       OR price_unit NOT IN ('kg', 'tonne', 'liter')
       OR limit_type IS NULL
       OR limit_type NOT IN ('volume', 'amount')
  ) THEN
    RAISE EXCEPTION 'prices contains an unknown unit or limit type';
  END IF;
END
$$;

-- volume_unit independently describes both limit and consumed mass.
-- Amount limits live in max_deal_amount; their volume field is not converted.
UPDATE prices
SET volume = CASE
      WHEN limit_type = 'volume' THEN volume / 1000
      ELSE volume
    END,
    sold_volume = sold_volume / 1000,
    volume_unit = 'tonne'
WHERE volume_unit = 'kg';

-- Convert only complete, numeric rate arrays. A malformed/raw-number element
-- keeps its entire row in kg so its unit is never silently changed.
UPDATE prices AS price
SET price_values = ARRAY(
      SELECT jsonb_set(
        element.value::jsonb,
        '{price}',
        CASE
          WHEN jsonb_typeof(element.value::jsonb -> 'price') = 'string'
            THEN to_jsonb(
              ((element.value::jsonb ->> 'price')::numeric * 1000)::text
            )
          ELSE to_jsonb(
            (element.value::jsonb ->> 'price')::numeric * 1000
          )
        END,
        false
      )::text
      FROM unnest(price.price_values) WITH ORDINALITY AS element(value, position)
      ORDER BY element.position
    ),
    price_unit = 'tonne'
WHERE price.price_unit = 'kg'
  AND price.price_values IS NOT NULL
  AND cardinality(price.price_values) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM unnest(price.price_values) AS element(value)
    WHERE jsonb_typeof(element.value::jsonb) IS DISTINCT FROM 'object'
       OR NOT (element.value::jsonb ? 'price')
       OR jsonb_typeof(element.value::jsonb -> 'price')
            NOT IN ('number', 'string')
       OR btrim(element.value::jsonb ->> 'price')
            !~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$'
  );

COMMIT;

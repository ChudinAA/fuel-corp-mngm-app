BEGIN;

-- Keep tonne volume columns nullable during the expand/backfill release.
-- Apply NOT NULL only in a later schema release after production verification.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'plan_entries',
    'free_volume_allocations',
    'supplier_allocated_volumes',
    'planning_top_level_volumes'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION 'Required planning table public.% is missing', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'volume'
    ) THEN
      RAISE EXCEPTION 'Required legacy kg column public.%.volume is missing', target_table;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.plan_entries WHERE volume IS NULL)
    OR EXISTS (SELECT 1 FROM public.free_volume_allocations WHERE volume IS NULL)
    OR EXISTS (SELECT 1 FROM public.supplier_allocated_volumes WHERE volume IS NULL)
    OR EXISTS (SELECT 1 FROM public.planning_top_level_volumes WHERE volume IS NULL)
  THEN
    RAISE EXCEPTION 'Cannot backfill planning tonnes from null kg values';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'plan_entries'
      AND column_name = 'balance_after'
  ) THEN
    RAISE EXCEPTION 'Required legacy column public.plan_entries.balance_after is missing';
  END IF;
END $$;

ALTER TABLE public.plan_entries
  ADD COLUMN IF NOT EXISTS volume_tonnes numeric(18,5),
  ADD COLUMN IF NOT EXISTS balance_after_tonnes numeric(18,5);

ALTER TABLE public.free_volume_allocations
  ADD COLUMN IF NOT EXISTS volume_tonnes numeric(18,5);

ALTER TABLE public.supplier_allocated_volumes
  ADD COLUMN IF NOT EXISTS volume_tonnes numeric(18,5);

ALTER TABLE public.planning_top_level_volumes
  ADD COLUMN IF NOT EXISTS volume_tonnes numeric(18,5);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.plan_entries
    WHERE volume_tonnes IS NOT NULL
      AND volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) OR EXISTS (
    SELECT 1 FROM public.free_volume_allocations
    WHERE volume_tonnes IS NOT NULL
      AND volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) OR EXISTS (
    SELECT 1 FROM public.supplier_allocated_volumes
    WHERE volume_tonnes IS NOT NULL
      AND volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) OR EXISTS (
    SELECT 1 FROM public.planning_top_level_volumes
    WHERE volume_tonnes IS NOT NULL
      AND volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) THEN
    RAISE EXCEPTION 'Existing planning tonnes disagree with saved kg values';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.plan_entries
    WHERE balance_after_tonnes IS NOT NULL
      AND balance_after_tonnes IS DISTINCT FROM
        CASE
          WHEN balance_after IS NULL THEN NULL
          ELSE ROUND(balance_after::numeric / 1000, 5)
        END
  ) THEN
    RAISE EXCEPTION 'Existing planning tonne balances disagree with saved kg balances';
  END IF;
END $$;

UPDATE public.plan_entries
SET
  volume_tonnes = COALESCE(volume_tonnes, ROUND(volume::numeric / 1000, 5)),
  balance_after_tonnes = COALESCE(
    balance_after_tonnes,
    CASE
      WHEN balance_after IS NULL THEN NULL
      ELSE ROUND(balance_after::numeric / 1000, 5)
    END
  );

UPDATE public.free_volume_allocations
SET volume_tonnes = COALESCE(volume_tonnes, ROUND(volume::numeric / 1000, 5));

UPDATE public.supplier_allocated_volumes
SET volume_tonnes = COALESCE(volume_tonnes, ROUND(volume::numeric / 1000, 5));

UPDATE public.planning_top_level_volumes
SET volume_tonnes = COALESCE(volume_tonnes, ROUND(volume::numeric / 1000, 5));

COMMENT ON COLUMN public.plan_entries.volume_tonnes IS
  'Authoritative planned volume in metric tonnes; volume remains a synchronized kg compatibility mirror.';
COMMENT ON COLUMN public.plan_entries.balance_after_tonnes IS
  'Planned warehouse balance in metric tonnes; balance_after remains a synchronized kg compatibility mirror.';
COMMENT ON COLUMN public.free_volume_allocations.volume_tonnes IS
  'Authoritative allocation volume in metric tonnes; volume remains a synchronized kg compatibility mirror.';
COMMENT ON COLUMN public.supplier_allocated_volumes.volume_tonnes IS
  'Authoritative allocated volume in metric tonnes; volume remains a synchronized kg compatibility mirror.';
COMMENT ON COLUMN public.planning_top_level_volumes.volume_tonnes IS
  'Authoritative top-level plan volume in metric tonnes; volume remains a synchronized kg compatibility mirror.';

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'plan_entries',
    'free_volume_allocations',
    'supplier_allocated_volumes',
    'planning_top_level_volumes'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'volume_tonnes'
        AND (
          data_type <> 'numeric'
          OR numeric_precision <> 18
          OR numeric_scale <> 5
          OR is_nullable <> 'YES'
        )
    ) THEN
      RAISE EXCEPTION 'Planning tonne volume schema validation failed for public.%', target_table;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.plan_entries
    WHERE volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
      OR (
        balance_after IS NULL AND balance_after_tonnes IS NOT NULL
      )
      OR (
        balance_after IS NOT NULL
        AND balance_after_tonnes IS DISTINCT FROM ROUND(balance_after::numeric / 1000, 5)
      )
  ) OR EXISTS (
    SELECT 1 FROM public.free_volume_allocations
    WHERE volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) OR EXISTS (
    SELECT 1 FROM public.supplier_allocated_volumes
    WHERE volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) OR EXISTS (
    SELECT 1 FROM public.planning_top_level_volumes
    WHERE volume_tonnes IS DISTINCT FROM ROUND(volume::numeric / 1000, 5)
  ) THEN
    RAISE EXCEPTION 'Planning mass backfill verification failed';
  END IF;
END $$;

COMMIT;

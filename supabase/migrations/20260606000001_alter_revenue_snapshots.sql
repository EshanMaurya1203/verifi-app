-- Migration: Alter Revenue Snapshots for Subscription Metrics
-- Adds MRR/ARR/MoM columns and a daily uniqueness constraint.
--
-- ACTUAL production schema (verified from migration history):
--   id (uuid PK), startup_id (bigint FK), total_revenue (numeric),
--   provider_breakdown (jsonb), created_at (timestamptz), provider (text)
--
-- This migration does NOT reference user_id or processor — those columns
-- do not exist in the production table.

-- 1. Add new metric columns + snapshot_date
ALTER TABLE public.revenue_snapshots
  ADD COLUMN IF NOT EXISTS mrr_inr numeric,
  ADD COLUMN IF NOT EXISTS arr_inr numeric,
  ADD COLUMN IF NOT EXISTS mom_growth_pct numeric,
  ADD COLUMN IF NOT EXISTS snapshot_date date;

-- 2. Backfill snapshot_date from existing data (preserves all production rows)
--    mrr_inr, arr_inr, and mom_growth_pct are left NULL until populated
--    by future subscription sync logic.
UPDATE public.revenue_snapshots
SET
    snapshot_date = COALESCE(created_at::date, CURRENT_DATE)
WHERE snapshot_date IS NULL;

-- 3. Backfill NULL providers to 'combined' (matches app convention in revenue-aggregation.ts)
UPDATE public.revenue_snapshots
SET provider = 'combined'
WHERE provider IS NULL;

-- 4. Enforce NOT NULL on snapshot_date (required for uniqueness constraint)
ALTER TABLE public.revenue_snapshots
  ALTER COLUMN snapshot_date SET NOT NULL;

-- 5. Deduplicate: if multiple snapshots exist for the same
--    (startup_id, provider, snapshot_date), keep only the most recent one.
DELETE FROM public.revenue_snapshots r1
WHERE EXISTS (
    SELECT 1 FROM public.revenue_snapshots r2
    WHERE r1.startup_id = r2.startup_id
      AND COALESCE(r1.provider, '') = COALESCE(r2.provider, '')
      AND r1.snapshot_date = r2.snapshot_date
      AND r1.created_at < r2.created_at
);

-- 6. Add unique constraint to prevent duplicate daily snapshots per startup+provider
ALTER TABLE public.revenue_snapshots
  DROP CONSTRAINT IF EXISTS unique_startup_provider_snapshot_date;

ALTER TABLE public.revenue_snapshots
  ADD CONSTRAINT unique_startup_provider_snapshot_date
  UNIQUE (startup_id, provider, snapshot_date);

-- 7. Performance indices
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_startup
  ON public.revenue_snapshots(startup_id);
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_date
  ON public.revenue_snapshots(snapshot_date);

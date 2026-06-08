-- Rollback script for Subscription Foundation database modifications

-- 1. Drop trigger and audit function
DROP TRIGGER IF EXISTS trg_audit_subscriptions ON public.subscriptions;
DROP FUNCTION IF EXISTS public.audit_subscription_changes();

-- 2. Drop subscription-related tables (cascading drops dependencies like RLS policies and indices)
DROP TABLE IF EXISTS public.billing_audit_logs CASCADE;
DROP TABLE IF EXISTS public.subscription_events CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.feature_access CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- 3. Restore public.revenue_snapshots to its pre-migration structure
ALTER TABLE public.revenue_snapshots
  DROP CONSTRAINT IF EXISTS unique_startup_provider_snapshot_date;

ALTER TABLE public.revenue_snapshots
  DROP COLUMN IF EXISTS mrr_inr,
  DROP COLUMN IF EXISTS arr_inr,
  DROP COLUMN IF EXISTS mom_growth_pct,
  DROP COLUMN IF EXISTS snapshot_date;

-- 4. Drop newly created indices on revenue_snapshots
DROP INDEX IF EXISTS idx_revenue_snapshots_startup;
DROP INDEX IF EXISTS idx_revenue_snapshots_date;

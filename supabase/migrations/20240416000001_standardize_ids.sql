-- Standardize database ID types to BIGINT for consistency across relations
-- This migration ensures related tables match the startup_submissions.id type (bigint)

-- 1. revenue_snapshots table
ALTER TABLE IF EXISTS public.revenue_snapshots 
  ALTER COLUMN startup_id TYPE bigint USING startup_id::bigint;

-- 2. payment_connections table
ALTER TABLE IF EXISTS public.payment_connections 
  ALTER COLUMN startup_id TYPE bigint USING startup_id::bigint;

-- 3. Ensure indices are correct for the new types
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_startup_id ON public.revenue_snapshots(startup_id);
CREATE INDEX IF NOT EXISTS idx_payment_connections_startup_id ON public.payment_connections(startup_id);

-- Note: No changes to startup_submissions.id as it's already bigserial (bigint).

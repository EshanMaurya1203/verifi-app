-- Migration: VRF-007 Harden Authoritative Revenue RLS & Privilege Boundary
-- File: supabase/migrations/20260825000000_harden_authoritative_revenue_rls.sql

BEGIN;

-- 1. Enable Row Level Security on all authoritative revenue and audit tables
ALTER TABLE public.revenue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop historical permissive policy and any stale policy names
DROP POLICY IF EXISTS "Service role can manage revenue_snapshots" ON public.revenue_snapshots;
DROP POLICY IF EXISTS "revenue_snapshots_service_role" ON public.revenue_snapshots;
DROP POLICY IF EXISTS "revenue_snapshots_deny_public" ON public.revenue_snapshots;

DROP POLICY IF EXISTS "revenue_transactions_service_role" ON public.revenue_transactions;
DROP POLICY IF EXISTS "revenue_transactions_deny_public" ON public.revenue_transactions;

DROP POLICY IF EXISTS "verification_logs_service_role" ON public.verification_logs;
DROP POLICY IF EXISTS "verification_logs_deny_public" ON public.verification_logs;

-- 3. Explicitly revoke table privileges from untrusted roles
REVOKE ALL ON TABLE
  public.revenue_snapshots,
  public.revenue_transactions,
  public.verification_logs
FROM PUBLIC;

REVOKE ALL ON TABLE
  public.revenue_snapshots,
  public.revenue_transactions,
  public.verification_logs
FROM anon;

REVOKE ALL ON TABLE
  public.revenue_snapshots,
  public.revenue_transactions,
  public.verification_logs
FROM authenticated;

-- 4. Explicitly grant full table privileges to service_role for backend operations
GRANT ALL ON TABLE
  public.revenue_snapshots,
  public.revenue_transactions,
  public.verification_logs
TO service_role;

COMMIT;

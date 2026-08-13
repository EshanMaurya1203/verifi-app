-- Migration: Add provider_account_id to provider_connections for trusted webhook identity
-- File: supabase/migrations/20260812160000_add_provider_account_id.sql

-- 1. Add provider_account_id column to provider_connections
ALTER TABLE public.provider_connections
ADD COLUMN IF NOT EXISTS provider_account_id text;

-- 2. Create unique index to enforce 1 provider account -> 1 Verifii startup (WHERE NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_connections_provider_account
ON public.provider_connections(provider, provider_account_id)
WHERE provider_account_id IS NOT NULL;

-- 3. Backfill existing Stripe Connect accounts where account_id starts with 'acct_'
UPDATE public.provider_connections
SET provider_account_id = account_id
WHERE provider = 'stripe'
  AND account_id LIKE 'acct_%'
  AND provider_account_id IS NULL;

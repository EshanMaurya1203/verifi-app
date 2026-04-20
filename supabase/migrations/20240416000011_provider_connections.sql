-- Migration: Refactor to multiple payment providers

-- 1. Create the new provider_connections table
CREATE TABLE IF NOT EXISTS public.provider_connections (
    id uuid primary key default gen_random_uuid(),
    startup_id bigint references public.startup_submissions(id) on delete cascade,
    provider text not null check (provider in ('stripe', 'razorpay')),
    account_id text, -- Used for Razorpay key_id or Stripe account id
    api_key_encrypted text not null, -- Replaces access_token
    status text default 'connected' check (status in ('connected', 'failed')),
    latest_revenue numeric default 0,
    last_synced_at timestamptz default now(),
    created_at timestamptz default now(),
    unique(startup_id, provider) -- Allows one of each type per startup, or can be relaxed if they have multiple stripes
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_provider_connections_startup ON public.provider_connections(startup_id);

-- 2. Migrate existing data from payment_connections
INSERT INTO public.provider_connections (id, startup_id, provider, account_id, api_key_encrypted, status, created_at)
SELECT 
    id, 
    startup_id, 
    provider, 
    account_id, 
    access_token as api_key_encrypted, 
    case when is_active then 'connected' else 'failed' end as status,
    created_at
FROM public.payment_connections
ON CONFLICT (startup_id, provider) DO NOTHING;

-- 3. Add mrr_breakdown to startup_submissions to remove single-provider logic and store multi-provider info
ALTER TABLE public.startup_submissions 
ADD COLUMN IF NOT EXISTS mrr_breakdown jsonb default '{}'::jsonb;

-- Security: RLS for provider_connections
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Server only access"
  ON public.provider_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "No public access"
  ON public.provider_connections
  FOR ALL
  TO public
  USING (false);

-- Optionally drop the old table after migrating logic
-- DROP TABLE IF EXISTS public.payment_connections;

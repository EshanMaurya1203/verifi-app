-- Production-Grade Revenue Verification Schema

-- 1. Revenue snapshots (source of truth for deterministic auditing)
create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text check (provider in ('razorpay', 'stripe')),
  amount numeric not null, -- stored in base currency (INR/USD)
  currency text default 'INR',
  period_start date,
  period_end date,
  source text default 'api',
  external_id text unique, -- Provider transaction/bulk ID
  created_at timestamptz default now()
);

-- 2. Audit logs for monitoring sync operations
create table if not exists public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  event text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- 3. Update startup_submissions with audit metadata
alter table public.startup_submissions
add column if not exists trust_score integer default 0,
add column if not exists verification_status text default 'pending',
add column if not exists last_verified_at timestamptz,
add column if not exists mrr numeric default 0;

-- 4. Indices for high-speed leaderboard sorting
create index if not exists idx_startup_trust_score on public.startup_submissions(trust_score desc);
create index if not exists idx_revenue_lookup on public.revenue_snapshots(startup_id, created_at);

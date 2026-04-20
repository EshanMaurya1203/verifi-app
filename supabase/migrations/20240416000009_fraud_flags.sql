-- Create fraud_flags table for aggregated risk signals
create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  flags text[] default '{}',
  created_at timestamptz default now()
);

-- Indices
create index if not exists idx_fraud_flags_startup on public.fraud_flags(startup_id);

-- RLS
alter table public.fraud_flags enable row level security;
create policy "Server manage fraud flags"
  on public.fraud_flags
  for all
  to service_role
  using (true)
  with check (true);

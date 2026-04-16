-- Fraud Detection and Anomaly signals schema

-- Table to store detected fraud signals
create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  signal_type text not null, -- e.g., 'revenue_spike', 'micro_transactions'
  severity integer check (severity between 1 and 5), -- 1 (low) to 5 (critical)
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indices for reporting
create index if not exists idx_fraud_startup on public.fraud_signals(startup_id);
create index if not exists idx_fraud_severity on public.fraud_signals(severity desc);

-- Allow server role to manage fraud signals
alter table public.fraud_signals enable row level security;
create policy "Server manage fraud signals"
  on public.fraud_signals
  for all
  to service_role
  using (true)
  with check (true);

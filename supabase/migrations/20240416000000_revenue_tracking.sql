-- Extended Schema for Revenue Tracking

create table if not exists revenue_snapshots (
  id bigserial primary key,
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text not null, -- 'razorpay' or 'stripe'
  amount bigint not null, -- in smallest unit (paise/cents)
  currency text default 'INR',
  status text, -- captured / failed
  external_id text unique, -- payment id from provider
  created_at timestamptz default now()
);

-- Indices for performance
create index if not exists idx_revenue_startup on revenue_snapshots(startup_id);
create index if not exists idx_revenue_created on revenue_snapshots(created_at);

-- Payment connections table (used for storing API keys for automated audits)
create table if not exists payment_connections (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text not null,
  account_id text not null,
  access_token text not null, -- encrypted or secret key
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(startup_id, provider)
);

create index if not exists idx_payment_connections_startup on payment_connections(startup_id);

-- Update startup_submissions with persistent scoring and revenue fields
alter table startup_submissions add column if not exists trust_score int default 0;
alter table startup_submissions add column if not exists mrr bigint default 0; -- MRR in base currency
alter table startup_submissions add column if not exists payment_connected boolean default false;

-- Security: Row Level Security (RLS)
alter table payment_connections enable row level security;

-- Only authenticated service role (server) can manage these
create policy "Server only access"
  on payment_connections
  for all
  to service_role
  using (true)
  with check (true);

-- Deny all for other roles
create policy "No public access"
  on payment_connections
  for all
  to public
  using (false);

-- Add stripe_account_id to startup_submissions
alter table public.startup_submissions
add column if not exists stripe_account_id text;

-- Index for lookup during webhooks or retries
create index if not exists idx_startup_stripe_id on public.startup_submissions(stripe_account_id);

-- Trust Tier Schema Upgrade

-- Add trust_tier column for structured ranking
alter table public.startup_submissions 
add column if not exists trust_tier text default 'unverified'
check (trust_tier in ('verified', 'trusted', 'emerging', 'unverified', 'flagged'));

-- Update status constraints if necessary
alter table public.startup_submissions
drop constraint if exists startup_submissions_verification_status_check;

-- Create index for tier-based lookup/sorting
create index if not exists idx_startup_trust_tier on public.startup_submissions(trust_tier);

-- Global Stripe Support Integration
alter table public.startup_submissions
add column if not exists country text,
add column if not exists onboarding_complete boolean default false;

-- Add a comment for documentation
comment on column public.startup_submissions.country is 'ISO country code (US, IN, GB, etc.) for Stripe Express mapping';

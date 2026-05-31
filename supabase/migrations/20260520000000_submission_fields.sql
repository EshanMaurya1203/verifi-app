-- Fields required by startup submission API (first-customer alignment)
alter table public.startup_submissions
  add column if not exists proof_url text,
  add column if not exists verified_revenue numeric,
  add column if not exists verification_source text,
  add column if not exists notes text;

comment on column public.startup_submissions.proof_url is 'Founder-uploaded revenue proof screenshot URL';

-- Add confidence field to startup_submissions
alter table public.startup_submissions
add column if not exists confidence integer default 0 check (confidence between 0 and 100);

comment on column public.startup_submissions.confidence is 'Derived trust percentage based on verifiable signals';

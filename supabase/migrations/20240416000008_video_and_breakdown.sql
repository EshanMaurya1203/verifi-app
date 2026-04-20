-- Update startup_submissions with video_url and trust_breakdown
alter table public.startup_submissions
add column if not exists video_url text,
add column if not exists trust_breakdown jsonb default '{}'::jsonb;

-- Comment for clarity
comment on column public.startup_submissions.video_url is 'Founder verification video (Loom/YouTube)';
comment on column public.startup_submissions.trust_breakdown is 'Granular scores for website, payment, identity, etc.';

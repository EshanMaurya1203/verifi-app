-- Migration to add slug column and standardize routing
alter table public.startup_submissions add column if not exists slug text unique;

-- Generate initial slugs based on startup_name
update public.startup_submissions 
set slug = lower(regexp_replace(startup_name, '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

-- Ensure all future slugs are unique by appending ID if collision occurs (simplified for now)
update public.startup_submissions
set slug = slug || '-' || id::text
where slug in (
    select slug 
    from public.startup_submissions 
    group by slug 
    having count(*) > 1
);

create index if not exists idx_startup_slug on public.startup_submissions(slug);

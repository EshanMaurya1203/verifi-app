CREATE TABLE IF NOT EXISTS public.revenue_events (
    id uuid primary key default gen_random_uuid(),
    startup_id bigint references public.startup_submissions(id) on delete cascade,
    amount numeric not null,
    provider text not null,
    timestamp bigint not null default (extract(epoch from now()) * 1000)::bigint,
    created_at timestamptz default now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_revenue_events_startup_id ON public.revenue_events(startup_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_timestamp ON public.revenue_events(timestamp);

-- Enable RLS
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

-- Allow public read (matching existing pattern)
CREATE POLICY "Allow public read access" ON public.revenue_events FOR SELECT USING (true);

-- Ensure startup_submissions can be read by public for the leaderboard
ALTER TABLE IF EXISTS public.startup_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'startup_submissions' AND policyname = 'Allow public read access'
    ) THEN
        CREATE POLICY "Allow public read access"
        ON public.startup_submissions
        FOR SELECT
        TO public
        USING (true);
    END IF;
END
$$;

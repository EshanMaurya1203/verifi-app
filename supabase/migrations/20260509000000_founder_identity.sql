-- Add Founder Identity fields to startup_submissions
ALTER TABLE public.startup_submissions
ADD COLUMN founder_avatar TEXT,
ADD COLUMN startup_logo TEXT,
ADD COLUMN founder_bio TEXT;

COMMENT ON COLUMN public.startup_submissions.founder_avatar IS 'URL to the verified founder avatar';
COMMENT ON COLUMN public.startup_submissions.startup_logo IS 'URL to the startup logo';
COMMENT ON COLUMN public.startup_submissions.founder_bio IS 'Short biography of the founder for public profile';

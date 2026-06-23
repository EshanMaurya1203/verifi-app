-- 1. Add the column with a secure default
ALTER TABLE public.startup_submissions
ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- 2. Create index for visibility queries
CREATE INDEX idx_startup_submissions_public_active 
ON public.startup_submissions(is_public) 
WHERE is_public = true;

-- 3. Backfill ONLY startup ID 43 (verifii) to true
UPDATE public.startup_submissions
SET is_public = true
WHERE id = 43;

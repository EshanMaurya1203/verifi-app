BEGIN;

-- 1. Remove the legacy permissive public-read policy.
DROP POLICY IF EXISTS "Allow public read access"
ON public.startup_submissions;

-- 2. Ensure RLS remains enabled.
ALTER TABLE public.startup_submissions
ENABLE ROW LEVEL SECURITY;

-- 3. Reconcile/recreate the strict owner-only SELECT policy.
DROP POLICY IF EXISTS "Users can view their own startups"
ON public.startup_submissions;

CREATE POLICY "Users can view their own startups"
ON public.startup_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Preserve server-side service-role access.
GRANT ALL
ON public.startup_submissions
TO service_role;

COMMIT;

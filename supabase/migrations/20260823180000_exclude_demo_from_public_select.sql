BEGIN;

-- 1. Ensure RLS is enabled on startup_submissions
ALTER TABLE public.startup_submissions
ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy/permissive public SELECT policies that might exist
DROP POLICY IF EXISTS "Allow public read access" ON public.startup_submissions;
DROP POLICY IF EXISTS "startup_submissions_public_select" ON public.startup_submissions;
DROP POLICY IF EXISTS "startup_submissions_owner_select" ON public.startup_submissions;
DROP POLICY IF EXISTS "Users can view their own startups" ON public.startup_submissions;

-- 3. Create strict public-read SELECT policy excluding demo-prefixed user_ids
-- Allows public (anonymous and authenticated) to view public startups that are not demo profiles
CREATE POLICY "startup_submissions_public_select"
ON public.startup_submissions
FOR SELECT
TO public
USING (
  is_public = true
  AND (user_id IS NULL OR user_id::text NOT LIKE '00000000-0000-0000-0000-%')
);

-- 4. Create authenticated owner SELECT policy
-- Allows founders to view their own startups even if is_public is false
CREATE POLICY "Users can view their own startups"
ON public.startup_submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

-- 5. Preserve service_role access for backend server execution
GRANT ALL
ON public.startup_submissions
TO service_role;

COMMIT;

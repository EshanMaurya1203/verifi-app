-- Prevent duplicate active startups per user.
-- Rejected startups are excluded so founders can resubmit after rejection.
-- Uses IS DISTINCT FROM to safely handle NULL verification_status values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_startup_per_user
ON public.startup_submissions (user_id, lower(trim(startup_name)))
WHERE verification_status IS DISTINCT FROM 'rejected';

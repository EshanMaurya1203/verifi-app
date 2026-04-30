-- Add trust inertia and penalty persistence columns
ALTER TABLE startup_submissions 
ADD COLUMN IF NOT EXISTS last_penalty_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS penalty_count integer DEFAULT 0;

COMMENT ON COLUMN startup_submissions.last_penalty_at IS 'Timestamp of the last rate-limit or stability penalty';
COMMENT ON COLUMN startup_submissions.penalty_count IS 'Count of recent penalties, used to scale severity';

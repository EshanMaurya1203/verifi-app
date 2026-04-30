-- Add clean_events column for gradual trust recovery
ALTER TABLE startup_submissions 
ADD COLUMN IF NOT EXISTS clean_events integer DEFAULT 0;

COMMENT ON COLUMN startup_submissions.clean_events IS 'Count of consecutive clean transactions since the last penalty';

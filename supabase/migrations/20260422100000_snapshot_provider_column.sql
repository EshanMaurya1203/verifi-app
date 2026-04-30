-- Add provider column to revenue_snapshots for per-provider tracking
ALTER TABLE "public"."revenue_snapshots"
  ADD COLUMN IF NOT EXISTS "provider" text;

-- Index for fast lookups by startup + provider
CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_startup_provider
  ON "public"."revenue_snapshots" ("startup_id", "provider", "created_at" DESC);

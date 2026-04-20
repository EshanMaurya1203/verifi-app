-- 1. Rename existing table to revenue_transactions
ALTER TABLE IF EXISTS "revenue_snapshots" RENAME TO "revenue_transactions";

-- 2. Create the new historical snapshots table
CREATE TABLE "public"."revenue_snapshots" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "startup_id" bigint REFERENCES "public"."startup_submissions"("id") ON DELETE CASCADE,
    "total_revenue" numeric NOT NULL,
    "provider_breakdown" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE "public"."revenue_snapshots" ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role can manage revenue_snapshots" ON "public"."revenue_snapshots"
    USING (true)
    WITH CHECK (true);

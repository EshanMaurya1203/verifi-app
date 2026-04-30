-- Add payment_id column with unique constraint for idempotency
ALTER TABLE "public"."revenue_transactions"
  ADD COLUMN IF NOT EXISTS "payment_id" text UNIQUE;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_revenue_transactions_payment_id
  ON "public"."revenue_transactions"("payment_id");

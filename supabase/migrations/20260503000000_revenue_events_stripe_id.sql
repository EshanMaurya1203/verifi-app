-- Add stripe_payment_id for idempotent syncing
ALTER TABLE public.revenue_events
  ADD COLUMN IF NOT EXISTS stripe_payment_id text;

-- Unique constraint to prevent duplicate Stripe event ingestion
CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_events_stripe_payment_id
  ON public.revenue_events(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

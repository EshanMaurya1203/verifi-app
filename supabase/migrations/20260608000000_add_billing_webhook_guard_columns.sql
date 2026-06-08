-- Add minimal billing webhook metadata for Razorpay subscription sync.

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS razorpay_plan_id text,
ADD COLUMN IF NOT EXISTS last_billing_event_at timestamptz,
ADD COLUMN IF NOT EXISTS last_billing_event_id text;

CREATE INDEX IF NOT EXISTS idx_subscriptions_last_billing_event_at
ON public.subscriptions(last_billing_event_at);

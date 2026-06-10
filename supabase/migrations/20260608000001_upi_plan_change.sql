ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS replaces_razorpay_subscription_id text;

DROP INDEX IF EXISTS idx_active_subscription_unique;

CREATE UNIQUE INDEX idx_active_subscription_unique
ON public.subscriptions (user_id)
WHERE status IN ('active','trialing','grace_period')
AND replaces_razorpay_subscription_id IS NULL;

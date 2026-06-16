-- Lease Lock + Unique Index for Plan Change Concurrency Safety
-- Prevents duplicate plan changes from concurrent API requests and webhook races.

-- 1. Add Lease Lock Column
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS plan_change_lock_until timestamptz;

-- 2. Index for Lease Lock expiry queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_change_lock
ON public.subscriptions(plan_change_lock_until);

-- 3. Partial Unique Index: at most one pending UPI replacement per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_replacement_per_user
ON subscriptions(user_id)
WHERE status = 'trialing'
  AND replaces_razorpay_subscription_id IS NOT NULL;

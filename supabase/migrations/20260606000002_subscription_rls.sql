-- Migration: Subscription Row Level Security (RLS)
-- Secure the subscription tables using Row Level Security

-- 1. Enable RLS on all tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Policies for subscription_plans
DROP POLICY IF EXISTS "Allow public read access to active plans" ON public.subscription_plans;
CREATE POLICY "Allow public read access to active plans"
  ON public.subscription_plans
  FOR SELECT
  TO public
  USING (is_active = true);

-- 3. Policies for subscriptions
DROP POLICY IF EXISTS "Allow users to read their own subscriptions" ON public.subscriptions;
CREATE POLICY "Allow users to read their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Policies for subscription_events
DROP POLICY IF EXISTS "Allow users to read their own subscription events" ON public.subscription_events;
CREATE POLICY "Allow users to read their own subscription events"
  ON public.subscription_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Policies for feature_access
DROP POLICY IF EXISTS "Allow public read access to feature mappings" ON public.feature_access;
CREATE POLICY "Allow public read access to feature mappings"
  ON public.feature_access
  FOR SELECT
  TO public
  USING (true);

-- 6. Policies for billing_audit_logs
DROP POLICY IF EXISTS "Allow users to read their own billing audit logs" ON public.billing_audit_logs;
CREATE POLICY "Allow users to read their own billing audit logs"
  ON public.billing_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

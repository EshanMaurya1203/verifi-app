-- Migration: Subscription Foundation Schema
-- Create core tables for subscription management

-- 1. Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code text NOT NULL,
    plan_name text NOT NULL,
    billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
    price_inr numeric NOT NULL DEFAULT 0 CHECK (price_inr >= 0),
    features jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    -- Enforce unique plan + cycle combination
    CONSTRAINT unique_plan_cycle UNIQUE (plan_code, billing_cycle)
);

-- Index for plan lookup
CREATE INDEX IF NOT EXISTS idx_subscription_plans_code ON public.subscription_plans(plan_code);

-- 2. Insert initial plans
INSERT INTO public.subscription_plans (plan_code, plan_name, billing_cycle, price_inr, features) VALUES
('viewer', 'Viewer (Free)', 'monthly', 0, '{"verified_badge": false, "csv_export": false, "rest_api": false, "privacy_toggle": false, "advanced_filters": false}'),
('viewer', 'Viewer (Free)', 'annual', 0, '{"verified_badge": false, "csv_export": false, "rest_api": false, "privacy_toggle": false, "advanced_filters": false}'),
('founder', 'Verified Founder', 'monthly', 599, '{"verified_badge": true, "csv_export": false, "rest_api": false, "privacy_toggle": true, "advanced_filters": false}'),
('founder', 'Verified Founder', 'annual', 5748, '{"verified_badge": true, "csv_export": false, "rest_api": false, "privacy_toggle": true, "advanced_filters": false}'),
('pro', 'Pro', 'monthly', 1799, '{"verified_badge": true, "csv_export": true, "rest_api": true, "privacy_toggle": true, "advanced_filters": true}'),
('pro', 'Pro', 'annual', 17268, '{"verified_badge": true, "csv_export": true, "rest_api": true, "privacy_toggle": true, "advanced_filters": true}')
ON CONFLICT (plan_code, billing_cycle) DO NOTHING;

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_code text NOT NULL,
    billing_cycle text NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'trialing', 'grace_period', 'past_due', 'cancelled', 'expired')),
    razorpay_subscription_id text UNIQUE,
    stripe_subscription_id text UNIQUE,
    razorpay_customer_id text,
    stripe_customer_id text,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    trial_start timestamptz,
    trial_end timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure plan_code and billing_cycle match an existing record in subscription_plans
    FOREIGN KEY (plan_code, billing_cycle) REFERENCES public.subscription_plans(plan_code, billing_cycle) ON UPDATE CASCADE
);

-- Indices for subscription queries and provider syncing
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_sub ON public.subscriptions(razorpay_subscription_id);

-- Enforce active subscription uniqueness per user:
-- A user can have at most one subscription that is active, trialing, or in grace_period.
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_subscription_unique 
ON public.subscriptions (user_id) 
WHERE (status IN ('active', 'trialing', 'grace_period'));

-- 4. Create subscription_events table (Audit trail for upgrades/downgrades/webhooks)
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    previous_status text,
    new_status text,
    previous_plan_code text,
    new_plan_code text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Indices for analytics/diagnostics
CREATE INDEX IF NOT EXISTS idx_sub_events_sub_id ON public.subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_created ON public.subscription_events(created_at);

-- 5. Create feature_access table (Decoupled system permissions mapping)
CREATE TABLE IF NOT EXISTS public.feature_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code text NOT NULL,
    feature_name text NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE (plan_code, feature_name)
);

-- Insert default feature permissions
INSERT INTO public.feature_access (plan_code, feature_name, is_enabled) VALUES
('viewer', 'verified_badge', false),
('viewer', 'csv_export', false),
('viewer', 'rest_api', false),
('viewer', 'privacy_toggle', false),
('viewer', 'advanced_filters', false),

('founder', 'verified_badge', true),
('founder', 'csv_export', false),
('founder', 'rest_api', false),
('founder', 'privacy_toggle', true),
('founder', 'advanced_filters', false),

('pro', 'verified_badge', true),
('pro', 'csv_export', true),
('pro', 'rest_api', true),
('pro', 'privacy_toggle', true),
('pro', 'advanced_filters', true)
ON CONFLICT (plan_code, feature_name) DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

-- 6. Create billing_audit_logs table
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by text,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

-- Index on audit logs
CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_sub ON public.billing_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_created ON public.billing_audit_logs(created_at);

-- 7. Audit log database trigger and function
CREATE OR REPLACE FUNCTION public.audit_subscription_changes()
RETURNS TRIGGER AS $$
DECLARE
    current_user_email text;
BEGIN
    -- Extract active user details if running inside a JWT/authenticated API session
    BEGIN
        current_user_email := COALESCE(
            current_setting('request.jwt.claims', true)::jsonb->>'email',
            'system_service'
        );
    EXCEPTION WHEN OTHERS THEN
        current_user_email := 'system_service';
    END;

    INSERT INTO public.billing_audit_logs (
        subscription_id,
        user_id,
        action,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.user_id, OLD.user_id),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        current_user_email
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to subscriptions
DROP TRIGGER IF EXISTS trg_audit_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_changes();

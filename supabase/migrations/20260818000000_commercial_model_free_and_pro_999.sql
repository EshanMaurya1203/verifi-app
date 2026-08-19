-- Migration: Commercial Model Free Verification & Pro ₹999/mo (A4.1)
-- File: supabase/migrations/20260818000000_commercial_model_free_and_pro_999.sql

-- 1. Update Pro monthly price to ₹999 and ensure active
UPDATE public.subscription_plans
SET price_inr = 999,
    is_active = true,
    updated_at = NOW()
WHERE plan_code = 'pro' AND billing_cycle = 'monthly';

-- 2. Ensure Viewer monthly is ₹0 and active
UPDATE public.subscription_plans
SET price_inr = 0,
    is_active = true,
    updated_at = NOW()
WHERE plan_code = 'viewer' AND billing_cycle = 'monthly';

-- 3. Deactivate all annual plans and obsolete founder plans (kept for FK/history compatibility)
UPDATE public.subscription_plans
SET is_active = false,
    updated_at = NOW()
WHERE (plan_code = 'viewer' AND billing_cycle = 'annual')
   OR (plan_code = 'founder' AND billing_cycle = 'monthly')
   OR (plan_code = 'founder' AND billing_cycle = 'annual')
   OR (plan_code = 'pro' AND billing_cycle = 'annual');

-- 4. Update Feature Access Permissions for Free (viewer) Plan
UPDATE public.feature_access
SET is_enabled = true
WHERE plan_code = 'viewer' AND feature_name IN ('verified_badge', 'privacy_toggle');

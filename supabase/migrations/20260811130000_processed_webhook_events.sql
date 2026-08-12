-- Migration: Add Atomic Webhook Idempotency Registry & RPC Functions for Razorpay & Stripe
-- File: supabase/migrations/20260811130000_processed_webhook_events.sql

-- 1. Create processed_webhook_events table
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    provider text NOT NULL CHECK (provider IN ('razorpay', 'stripe')),
    event_id text NOT NULL,
    event_type text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, event_id)
);

-- Index for timestamp filtering and maintenance queries
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_created 
ON public.processed_webhook_events(created_at);

-- Enable RLS (Service role access only, deny anon/authenticated by default)
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- 2. Create RPC function for single-transaction Razorpay billing processing
CREATE OR REPLACE FUNCTION public.process_razorpay_billing_webhook(
    p_provider text,
    p_event_id text,
    p_event_type text,
    p_user_id uuid,
    p_plan_code text,
    p_billing_cycle text,
    p_status text,
    p_razorpay_subscription_id text,
    p_razorpay_customer_id text,
    p_razorpay_plan_id text,
    p_replaces_sub_id text,
    p_current_period_start timestamptz,
    p_current_period_end timestamptz,
    p_event_at timestamptz,
    p_trial_start timestamptz DEFAULT NULL,
    p_trial_end timestamptz DEFAULT NULL
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sub_id uuid;
    v_existing_event_at timestamptz;
    v_old_sub RECORD;
    v_should_cancel boolean := false;
BEGIN
    -- STEP 1: ATOMIC IDEMPOTENCY CLAIM
    BEGIN
        INSERT INTO public.processed_webhook_events (provider, event_id, event_type, created_at)
        VALUES (p_provider, p_event_id, p_event_type, NOW());
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'processed', false,
            'duplicate', true,
            'stale', false
        );
    END;

    -- STEP 2: STALE EVENT CHECK
    SELECT last_billing_event_at INTO v_existing_event_at
    FROM public.subscriptions
    WHERE razorpay_subscription_id = p_razorpay_subscription_id;

    IF v_existing_event_at IS NOT NULL AND p_event_at < v_existing_event_at THEN
        RETURN jsonb_build_object(
            'processed', false,
            'duplicate', false,
            'stale', true
        );
    END IF;

    -- STEP 3: ATOMIC SUBSCRIPTION UPSERT
    INSERT INTO public.subscriptions (
        user_id, plan_code, billing_cycle, status,
        razorpay_subscription_id, razorpay_customer_id, razorpay_plan_id,
        replaces_razorpay_subscription_id, current_period_start, current_period_end,
        last_billing_event_at, last_billing_event_id, trial_start, trial_end
    ) VALUES (
        p_user_id, p_plan_code, p_billing_cycle, p_status,
        p_razorpay_subscription_id, p_razorpay_customer_id, p_razorpay_plan_id,
        CASE WHEN p_status = 'active' THEN NULL ELSE p_replaces_sub_id END,
        p_current_period_start, p_current_period_end, p_event_at, p_event_id,
        p_trial_start, p_trial_end
    )
    ON CONFLICT (razorpay_subscription_id) DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        billing_cycle = EXCLUDED.billing_cycle,
        status = EXCLUDED.status,
        razorpay_customer_id = COALESCE(EXCLUDED.razorpay_customer_id, public.subscriptions.razorpay_customer_id),
        razorpay_plan_id = COALESCE(EXCLUDED.razorpay_plan_id, public.subscriptions.razorpay_plan_id),
        replaces_razorpay_subscription_id = EXCLUDED.replaces_razorpay_subscription_id,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        last_billing_event_at = EXCLUDED.last_billing_event_at,
        last_billing_event_id = EXCLUDED.last_billing_event_id,
        trial_start = COALESCE(EXCLUDED.trial_start, public.subscriptions.trial_start),
        trial_end = COALESCE(EXCLUDED.trial_end, public.subscriptions.trial_end),
        updated_at = NOW()
    RETURNING id INTO v_sub_id;

    -- STEP 4: WRITE SUBSCRIPTION EVENT
    INSERT INTO public.subscription_events (
        subscription_id, user_id, event_type, new_status, new_plan_code, metadata, created_at
    ) VALUES (
        v_sub_id, p_user_id, p_event_type, p_status, p_plan_code,
        jsonb_build_object(
            'razorpay_subscription_id', p_razorpay_subscription_id,
            'razorpay_plan_id', p_razorpay_plan_id,
            'billing_cycle', p_billing_cycle
        ),
        NOW()
    );

    -- STEP 5: HANDLE REPLACEMENT SUBSCRIPTION CANCELLATION STATE
    IF (p_event_type = 'subscription.activated' OR p_event_type = 'subscription.charged') AND p_replaces_sub_id IS NOT NULL THEN
        SELECT id, status INTO v_old_sub
        FROM public.subscriptions
        WHERE razorpay_subscription_id = p_replaces_sub_id;

        IF v_old_sub.id IS NOT NULL AND v_old_sub.status IN ('active', 'trialing', 'grace_period', 'past_due') THEN
            UPDATE public.subscriptions
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = v_old_sub.id;

            INSERT INTO public.subscription_events (
                subscription_id, user_id, event_type, new_status, metadata, created_at
            ) VALUES (
                v_old_sub.id, p_user_id, 'subscription.replaced', 'cancelled',
                jsonb_build_object('reason', 'replaced_by_upi_plan_change', 'new_subscription_id', p_razorpay_subscription_id),
                NOW()
            );

            v_should_cancel := true;
        END IF;
    END IF;

    -- AUTOMATIC POSTGRES TRIGGER trg_audit_subscriptions FIRES FOR ALL SUB UPDATES ABOVE

    RETURN jsonb_build_object(
        'processed', true,
        'duplicate', false,
        'stale', false,
        'status', p_status,
        'subscription_id', v_sub_id,
        'replaces_sub_id', p_replaces_sub_id,
        'should_cancel_replacement', v_should_cancel
    );
END;
$$;

-- 3. Create RPC function for single-transaction Stripe payment processing
CREATE OR REPLACE FUNCTION public.process_stripe_payment_webhook(
    p_provider text,
    p_event_id text,
    p_event_type text,
    p_startup_id bigint,
    p_amount numeric,
    p_payment_id text
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_tx uuid;
    v_startup RECORD;
    v_mrr_breakdown jsonb;
    v_current_stripe_mrr numeric;
    v_new_stripe_mrr numeric;
    v_total_mrr numeric;
    v_last_snapshot RECORD;
BEGIN
    -- STEP 1: ATOMIC IDEMPOTENCY CLAIM
    BEGIN
        INSERT INTO public.processed_webhook_events (provider, event_id, event_type, created_at)
        VALUES (p_provider, p_event_id, p_event_type, NOW());
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('processed', false, 'duplicate', true);
    END;

    -- STEP 2: CHECK PAYMENT TRANSACTION IDEMPOTENCY
    SELECT id INTO v_existing_tx
    FROM public.revenue_transactions
    WHERE payment_id = p_payment_id;

    IF v_existing_tx IS NOT NULL THEN
        RETURN jsonb_build_object('processed', true, 'duplicate', true);
    END IF;

    -- STEP 3: INSERT REVENUE TRANSACTION
    INSERT INTO public.revenue_transactions (startup_id, payment_id, amount, provider, created_at)
    VALUES (p_startup_id, p_payment_id, p_amount, 'stripe', NOW());

    -- STEP 4: FETCH STARTUP AND UPDATE MRR
    SELECT mrr_breakdown INTO v_startup
    FROM public.startup_submissions
    WHERE id = p_startup_id;

    v_mrr_breakdown := COALESCE(v_startup.mrr_breakdown, '{}'::jsonb);
    v_current_stripe_mrr := COALESCE((v_mrr_breakdown->>'stripe')::numeric, 0);
    v_new_stripe_mrr := v_current_stripe_mrr + p_amount;
    IF v_new_stripe_mrr < 0 THEN v_new_stripe_mrr := 0; END IF;

    v_mrr_breakdown := jsonb_set(v_mrr_breakdown, '{stripe}', to_jsonb(v_new_stripe_mrr));

    -- Calculate total MRR
    SELECT COALESCE(SUM((val.value)::numeric), 0) INTO v_total_mrr
    FROM jsonb_each_text(v_mrr_breakdown) AS val;

    -- STEP 5: REVENUE SNAPSHOT
    SELECT total_revenue INTO v_last_snapshot
    FROM public.revenue_snapshots
    WHERE startup_id = p_startup_id
    ORDER BY created_at DESC LIMIT 1;

    IF v_last_snapshot.total_revenue IS NULL OR v_last_snapshot.total_revenue <> v_total_mrr THEN
        INSERT INTO public.revenue_snapshots (startup_id, total_revenue, provider_breakdown, snapshot_date, created_at)
        VALUES (p_startup_id, v_total_mrr, v_mrr_breakdown, CURRENT_DATE, NOW());
    END IF;

    -- STEP 6: UPDATE STARTUP SUBMISSIONS
    UPDATE public.startup_submissions
    SET mrr = v_total_mrr,
        mrr_breakdown = v_mrr_breakdown
    WHERE id = p_startup_id;

    RETURN jsonb_build_object('processed', true, 'duplicate', false);
END;
$$;

-- 4. Create RPC function for single-transaction Stripe account onboarding
CREATE OR REPLACE FUNCTION public.process_stripe_account_webhook(
    p_provider text,
    p_event_id text,
    p_event_type text,
    p_startup_id bigint,
    p_account_id text,
    p_api_key_encrypted text
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
BEGIN
    -- STEP 1: ATOMIC IDEMPOTENCY CLAIM
    BEGIN
        INSERT INTO public.processed_webhook_events (provider, event_id, event_type, created_at)
        VALUES (p_provider, p_event_id, p_event_type, NOW());
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('processed', false, 'duplicate', true);
    END;

    -- STEP 2: UPSERT PROVIDER CONNECTION
    INSERT INTO public.provider_connections (
        startup_id, provider, account_id, api_key_encrypted, status, last_synced_at
    ) VALUES (
        p_startup_id, 'stripe', p_account_id, p_api_key_encrypted, 'connected', NOW()
    )
    ON CONFLICT (startup_id, provider) DO UPDATE SET
        account_id = EXCLUDED.account_id,
        api_key_encrypted = EXCLUDED.api_key_encrypted,
        status = EXCLUDED.status,
        last_synced_at = EXCLUDED.last_synced_at;

    -- STEP 3: UPDATE STARTUP SUBMISSION
    UPDATE public.startup_submissions
    SET stripe_account_id = p_account_id,
        payment_connected = true
    WHERE id = p_startup_id;

    UPDATE public.startup_submissions
    SET verification_status = 'stripe_connected'
    WHERE id = p_startup_id
      AND verification_status IN ('pending', 'syncing', 'unverified');

    RETURN jsonb_build_object('processed', true, 'duplicate', false);
END;
$$;

-- 5. Revoke execution from public/anon and grant to service_role only
REVOKE EXECUTE ON FUNCTION public.process_razorpay_billing_webhook FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_razorpay_billing_webhook TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_stripe_payment_webhook FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_payment_webhook TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_stripe_account_webhook FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_account_webhook TO service_role;

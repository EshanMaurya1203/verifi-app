-- Migration: Hardened RPC process_stripe_payment_webhook & process_stripe_account_webhook with mandatory ownership invariants
-- File: supabase/migrations/20260812170000_update_webhook_rpc_ownership.sql

-- 1. Explicitly DROP obsolete 6-argument RPC signature if it exists
DROP FUNCTION IF EXISTS public.process_stripe_payment_webhook(text, text, text, bigint, numeric, text);

-- 2. Create hardened 7-argument process_stripe_payment_webhook RPC with required p_account_id (NO DEFAULT)
CREATE OR REPLACE FUNCTION public.process_stripe_payment_webhook(
    p_provider text,
    p_event_id text,
    p_event_type text,
    p_startup_id bigint,
    p_amount numeric,
    p_payment_id text,
    p_account_id text
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
    v_conn_exists boolean;
BEGIN
    -- STEP 0: MANDATORY FAIL-CLOSED OWNERSHIP CHECK (NULL OR EMPTY p_account_id REJECTED IMMEDIATELY)
    IF p_account_id IS NULL OR trim(p_account_id) = '' THEN
        RETURN jsonb_build_object('processed', false, 'error', 'missing_provider_account');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.provider_connections
        WHERE startup_id = p_startup_id
          AND provider = 'stripe'
          AND provider_account_id = p_account_id
          AND status = 'connected'
    ) INTO v_conn_exists;

    IF NOT v_conn_exists THEN
        RETURN jsonb_build_object('processed', false, 'error', 'unmapped_provider_account');
    END IF;

    -- STEP 1: ATOMIC IDEMPOTENCY CLAIM
    BEGIN
        INSERT INTO public.processed_webhook_events (provider, event_id, event_type, created_at)
        VALUES (p_provider, p_event_id, p_event_type, NOW());
    EXCEPTION WHEN unique_violation THEN
        -- Event pre-claimed by HTTP handler; proceed to payment transaction check
        NULL;
    END;

    -- STEP 2: CHECK PAYMENT TRANSACTION IDEMPOTENCY
    SELECT id INTO v_existing_tx
    FROM public.revenue_transactions
    WHERE payment_id = p_payment_id;

    IF v_existing_tx IS NOT NULL THEN
        RETURN jsonb_build_object('processed', false, 'duplicate', true);
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

-- 3. Create process_stripe_account_webhook RPC with strict connection validation
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
DECLARE
    v_conn_exists boolean;
BEGIN
    -- STEP 0: MANDATORY FAIL-CLOSED OWNERSHIP CHECK (Must match existing authenticated connection)
    IF p_account_id IS NULL OR trim(p_account_id) = '' THEN
        RETURN jsonb_build_object('processed', false, 'error', 'missing_provider_account');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.provider_connections
        WHERE startup_id = p_startup_id
          AND provider = 'stripe'
          AND provider_account_id = p_account_id
          AND status = 'connected'
    ) INTO v_conn_exists;

    IF NOT v_conn_exists THEN
        RETURN jsonb_build_object('processed', false, 'error', 'unmapped_provider_account');
    END IF;

    -- STEP 1: ATOMIC IDEMPOTENCY CLAIM
    BEGIN
        INSERT INTO public.processed_webhook_events (provider, event_id, event_type, created_at)
        VALUES (p_provider, p_event_id, p_event_type, NOW());
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('processed', false, 'duplicate', true);
    END;

    -- STEP 2: UPDATE CONNECTION LAST SYNCED TIMESTAMP ONLY (NO ARBITRARY STARTUP UPSERTS)
    UPDATE public.provider_connections
    SET last_synced_at = NOW()
    WHERE startup_id = p_startup_id
      AND provider = 'stripe'
      AND provider_account_id = p_account_id;

    -- STEP 3: PROMOTE VERIFICATION STATUS FOR PRE-VERIFIED STATES
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

-- 4. Revoke/Grant permissions for service_role ONLY
REVOKE EXECUTE ON FUNCTION public.process_stripe_payment_webhook(text, text, text, bigint, numeric, text, text) FROM PUBLIC, anon, authenticated;
-- GRANT Table Privileges to service_role for Webhook routes
GRANT ALL ON public.processed_webhook_events TO service_role;
GRANT ALL ON public.provider_connections TO service_role;
GRANT ALL ON public.revenue_transactions TO service_role;
GRANT ALL ON public.revenue_snapshots TO service_role;
GRANT ALL ON public.startup_submissions TO service_role;

GRANT EXECUTE ON FUNCTION public.process_stripe_payment_webhook(text, text, text, bigint, numeric, text, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_stripe_account_webhook(text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_stripe_account_webhook(text, text, text, bigint, text, text) TO service_role;

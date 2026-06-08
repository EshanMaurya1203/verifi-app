-- Up Migration: Grandfather Existing Founders

DO $$
DECLARE
  v_user_id uuid;
  v_sub_id uuid;
  v_trial_end timestamptz := NOW() + INTERVAL '90 days';
BEGIN
  -- Iterate through every unique user_id that owns a startup
  FOR v_user_id IN
    SELECT DISTINCT user_id
    FROM public.startup_submissions
    WHERE user_id IS NOT NULL
      AND user_id NOT IN (SELECT user_id FROM public.subscriptions)
      -- Exclude sandbox/demo users which use the zeroed UUID prefix
      AND user_id::text NOT LIKE '00000000-0000-0000-0000-%' 
  LOOP
    v_sub_id := gen_random_uuid();
    
    -- Insert a 90-day trialing subscription
    INSERT INTO public.subscriptions (
      id, user_id, plan_code, billing_cycle, status, 
      current_period_start, current_period_end, 
      trial_start, trial_end, created_at, updated_at
    ) VALUES (
      v_sub_id, v_user_id, 'founder', 'monthly', 'trialing',
      NOW(), v_trial_end,
      NOW(), v_trial_end, NOW(), NOW()
    );

    -- Log the grandfathering event for audit trails
    INSERT INTO public.subscription_events (
      id, subscription_id, user_id, event_type, 
      new_status, new_plan_code, metadata, created_at
    ) VALUES (
      gen_random_uuid(), v_sub_id, v_user_id, 'subscription.grandfathered',
      'trialing', 'founder', '{"reason": "One-time migration for existing users", "trial_days": 90}'::jsonb, NOW()
    );
  END LOOP;
END $$;

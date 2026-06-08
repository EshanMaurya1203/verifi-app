-- Down Migration: Rollback Grandfathered Founders

-- Remove the events
DELETE FROM public.subscription_events 
WHERE metadata->>'reason' = 'One-time migration for existing users';

-- Remove the subscriptions that were created by the grandfathering script.
-- We identify these by finding trialing subscriptions that only have the grandfathered event.
DELETE FROM public.subscriptions 
WHERE status = 'trialing' 
  AND plan_code = 'founder' 
  AND id NOT IN (
    SELECT subscription_id 
    FROM public.subscription_events 
    WHERE event_type != 'subscription.grandfathered'
  );

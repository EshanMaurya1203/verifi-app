-- VRF-002 Revenue Trust Boundary Reconciliation Migration
-- Reconciles unverified api_verified flags for startups without active connected provider records.

UPDATE public.startup_submissions s
SET 
  verification_status = 'pending',
  payment_connected = false,
  verified_revenue = NULL,
  verification_source = NULL
WHERE s.verification_status = 'api_verified'
  AND NOT EXISTS (
    SELECT 1 FROM public.provider_connections pc 
    WHERE pc.startup_id = s.id AND pc.status = 'connected'
  );

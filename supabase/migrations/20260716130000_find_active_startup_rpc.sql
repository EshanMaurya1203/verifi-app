-- Migration: Find Active Startup RPC (Security Hardened)
-- File: supabase/migrations/20260716130000_find_active_startup_rpc.sql

CREATE OR REPLACE FUNCTION public.find_active_startup(p_user_id uuid, p_startup_name text)
RETURNS SETOF public.startup_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Verify authorization: Caller must be service_role OR matching authenticated user
    IF auth.role() <> 'service_role' AND (auth.uid() IS NULL OR p_user_id <> auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: unauthorized user or user mismatch'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT * FROM public.startup_submissions
    WHERE user_id = p_user_id
      AND lower(trim(startup_name)) = lower(trim(p_startup_name))
      AND verification_status IS DISTINCT FROM 'rejected'
    LIMIT 1;
END;
$$;

-- Restrict execution permissions to service_role only
REVOKE EXECUTE ON FUNCTION public.find_active_startup(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_active_startup(uuid, text) TO service_role;

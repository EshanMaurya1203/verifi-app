-- VRF-ONBOARD-001D.1 — Onboarding Analytics Foundation
-- Created: 2026-07-31
-- Status: PENDING (do NOT run until VRF-ONBOARD-001D.2)
--
-- This table stores anonymous onboarding funnel events for admin analytics.
-- No sensitive data (API keys, secrets, emails, proof URLs) may be stored in metadata.
--
-- startup_submissions.id is bigserial (bigint). All FK references use bigint.
-- RLS is enabled with zero client-side policies. Reads use service_role only.

CREATE TABLE onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users(id),

  startup_id bigint NULL REFERENCES startup_submissions(id) ON DELETE CASCADE,

  event_name text NOT NULL CHECK (event_name IN (
    'onboarding_started',
    'step_1_completed',
    'step_2_completed',
    'step_3_completed',
    'submission_completed',
    'submission_failed',
    'draft_restored',
    'draft_discarded'
  )),

  step integer NULL CHECK (step IS NULL OR (step >= 1 AND step <= 4)),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index: user-level event queries
CREATE INDEX idx_onboarding_events_user
ON onboarding_events(user_id);

-- Index: event-type aggregation
CREATE INDEX idx_onboarding_events_event
ON onboarding_events(event_name);

-- Index: time-range queries
CREATE INDEX idx_onboarding_events_created_at
ON onboarding_events(created_at);

-- RLS: admin-only (no client-side policies)
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

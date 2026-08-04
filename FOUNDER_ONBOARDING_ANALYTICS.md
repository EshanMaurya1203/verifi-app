# VRF-ONBOARD-001D — Admin Analytics

> **Phase**: D (Analytics Foundation)
> **Status**: Contract Frozen
> **Created**: 2026-07-31
> **Migration**: `supabase/migrations/20260731000000_create_onboarding_events.sql`
> **Contract**: `src/lib/analytics/onboarding.ts`

---

## Goals

- Measure onboarding funnel completion rates.
- Measure onboarding drop-offs per step.
- Measure submission failure reasons.
- Measure draft recovery and discard rates.

---

## Database Schema

```sql
CREATE TABLE onboarding_events (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id),
  startup_id     bigint       NULL REFERENCES startup_submissions(id) ON DELETE CASCADE,
  event_name     text         NOT NULL CHECK (event_name IN (
    'onboarding_started',
    'step_1_completed',
    'step_2_completed',
    'step_3_completed',
    'submission_completed',
    'submission_failed',
    'draft_restored',
    'draft_discarded'
  )),
  step           integer      NULL CHECK (step IS NULL OR (step >= 1 AND step <= 4)),
  metadata       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

-- RLS: Admin-only (no client-side policies created)
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
```

### Indexes

| Index Name | Column | Purpose |
|---|---|---|
| `idx_onboarding_events_user` | `user_id` | Per-user event queries |
| `idx_onboarding_events_event` | `event_name` | Event-type aggregation |
| `idx_onboarding_events_created_at` | `created_at` | Time-range queries |

---

## Events

| Event Name | Step | When Fired |
|---|---|---|
| `onboarding_started` | 1 | User loads the submit page |
| `step_1_completed` | 1 | User completes Step 1 (Identity) |
| `step_2_completed` | 2 | User completes Step 2 (Startup Info) |
| `step_3_completed` | 3 | User completes Step 3 (Revenue) |
| `submission_completed` | 4 | Startup successfully submitted |
| `submission_failed` | 4 | Submission fails (any reason) |
| `draft_restored` | — | User clicks "Restore Draft" |
| `draft_discarded` | — | User clicks "Discard" on draft banner |

---

## Rules

1. Analytics failures must **never** break onboarding.
2. Analytics is **admin-only** — founders cannot see analytics data.
3. Analytics must be **asynchronous** (fire-and-forget).
4. **No third-party analytics tools** (no Mixpanel, Amplitude, Segment, etc.).
5. **No sensitive data** in metadata.
6. **Authentication Scope**: Analytics tracks **only** authenticated founders. Unauthenticated requests to `/api/analytics/onboarding` return 401 Unauthorized.

---

## Client Deduplication & Debounce Specification

To prevent rapid duplicate events from accidental double-clicks or UI re-renders:

- **Deduplication Key**: `${event}:${step ?? ''}:${startupId ?? ''}`
- **Window**: 3,000 ms sliding window per key.
- **Engine Behavior**: Subsequent calls matching an active key within 3,000 ms are dropped silently.

---

## Metadata Schema

### Allowed Fields

```json
{
  "reason": "slug_conflict",
  "duration": 87,
  "draft_age_hours": 12,
  "provider": "razorpay"
}
```

| Field | Type | Used By | Description |
|---|---|---|---|
| `reason` | `SubmissionFailureReason` | `submission_failed` | Why the submission failed |
| `duration` | `number` | `submission_completed` | Seconds from start to submission |
| `draft_age_hours` | `number` | `draft_restored`, `draft_discarded` | Age of the draft in hours |
| `provider` | `PaymentProvider` | `submission_completed` | Payment provider selected |

### Forbidden Fields

> [!CAUTION]
> The following fields must **NEVER** appear in event metadata.
> Enforcement will be added in VRF-ONBOARD-001D.2.

```json
{
  "api_key": "...",
  "secret": "...",
  "proof_url": "...",
  "email": "...",
  "password": "...",
  "token": "..."
}
```

---

## Type Definitions

```typescript
export type OnboardingEvent =
  | "onboarding_started"
  | "step_1_completed"
  | "step_2_completed"
  | "step_3_completed"
  | "submission_completed"
  | "submission_failed"
  | "draft_restored"
  | "draft_discarded";

export interface TrackOnboardingEventInput {
  event: OnboardingEvent;
  step?: number;
  metadata?: Record<string, unknown>;
}

export type SubmissionFailureReason =
  | "validation_error"
  | "duplicate_submission"
  | "slug_conflict"
  | "upload_failed"
  | "network_error";

export type PaymentProvider =
  | "stripe"
  | "razorpay";
```

---

## Implementation Phases

| Phase | Task | Status |
|---|---|---|
| **D.1** | Create schema, contract, and documentation | ✅ Frozen |
| **D.2** | Implement `trackOnboardingEvent()` function | ⬜ Not started |
| **D.3** | Integrate tracking into onboarding flow | ⬜ Not started |
| **D.4** | Build admin analytics API routes | ⬜ Not started |
| **D.5** | Build admin analytics dashboard UI | ⬜ Not started |
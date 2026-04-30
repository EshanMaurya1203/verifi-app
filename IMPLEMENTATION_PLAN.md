# Verifi — Implementation Plan

> **Last audited:** 2026-04-27
> **Source of truth:** This document reflects the ACTUAL codebase, not aspirational features.

---

## 1. Current State

### ✅ Completed (Working Systems)

| System | Files | Status |
|---|---|---|
| **Startup Submission Form** | `src/app/submit/page.tsx` | Full form with validation, error states, success panel. Persists to `startup_submissions` via `src/app/api/startup-submissions/route.ts`. |
| **Supabase Integration** | `src/lib/supabase.ts`, `supabase-server.ts`, `supabase-admin.ts` | Three clients: browser (anon), server (service role via env), admin (service role direct). All functional. |
| **Leaderboard Page** | `src/app/leaderboard/page.tsx` | Server-rendered. Fetches all startups, displays rank, MRR, trust tier badges. Tier-based sorting with trust_score tiebreaker. |
| **Startup Detail Page** | `src/app/startup/[id]/page.tsx` | Server-rendered with dynamic routing. Shows MRR, trust tier, verification signals panel, and VerificationFlow component. |
| **Stripe API Key Verification** | `src/app/api/stripe/verify/route.ts` | Accepts `sk_live_*` key → fetches all PaymentIntents → filters last 30 days → calculates MRR → stores encrypted key in `payment_connections` → inserts `revenue_snapshots` → updates `startup_submissions.mrr` → triggers `computeTrustScore`. Includes spike detection with fraud signal logging. |
| **Razorpay API Key Verification** | `src/app/api/razorpay/verify/route.ts` | Accepts key_id + key_secret → validates via test API call → stores encrypted credentials → syncs initial payments to `revenue_snapshots` → calculates MRR → triggers `computeTrustScore`. |
| **Razorpay Revenue Sync** | `src/app/api/razorpay/sync/route.ts` | Full sync flow: decrypts stored keys → fetches 30-day payments → inserts aggregate snapshot → logs to `verification_logs` → runs consistency + fraud checks → updates trust score. |
| **Unified Revenue Verify** | `src/app/api/verify/revenue/route.ts` | Provider-agnostic endpoint. Resolves keys from request body OR database (decrypted) OR platform env vars. Calls `verifyStripeRevenue` / `verifyRazorpayRevenue` and records snapshots. |
| **Trust Scoring Engine** | `src/lib/scoring.ts` → `computeTrustScore()` | Deterministic, multi-signal scoring (0–100). Signals: payment connection (+30), revenue tiers (+5 to +20), consistent payments (+10), video (+20), website (+10), identity (+20). Fraud penalties up to -40. Persists score, tier, status, and breakdown to DB. Includes trust inertia (`last_penalty_at`), penalty persistence, and earned recovery (`clean_events`). |
| **Fraud Detection (Deep)** | `src/lib/fraud.ts` → `detectFraud()` | Queries `revenue_snapshots` history. Rules: revenue spike (>3x previous, severity 4), sudden drop (>50k→0, severity 3), micro-transaction spam (>50 micro payments, severity 5), inconsistent variance (stdDev > 2x mean, severity 3). Logs to `fraud_signals` + `verification_logs`. |
| **Fraud Detection (Lightweight)** | `src/lib/fraud-detection.ts` → `detectFraud()` | Pattern-based: spiky revenue (max > 10x min), high failure rate. Returns flag strings. Used in razorpay sync flow → inserts to `fraud_flags`. |
| **Revenue Consistency** | `src/lib/revenue-consistency.ts` → `calculateConsistency()` | Variance-based consistency score (0–1). Inverted volatility measure. |
| **Encryption** | `src/lib/encryption.ts` | AES-256-CTR encrypt/decrypt for API keys. Uses `ENCRYPTION_SECRET` env var. |
| **Cron Revenue Sync** | `src/app/api/cron/sync-revenue/route.ts` | Iterates ALL active `payment_connections`. For each: decrypts keys → fetches payments from Razorpay/Stripe → upserts to `revenue_snapshots` → recalculates MRR + trust score. Protected by `CRON_SECRET` in production. |
| **Stripe Webhook** | `src/app/api/stripe/webhook/route.ts` | Production-grade handler for `payment_intent.succeeded`. Automatically maps payments to startups via metadata or `provider_connections` fallback. Calls `updateRevenueAndSnapshot` for real-time MRR updates, snapshotting, and trust score recomputation. |
| **Razorpay Webhook** | `src/app/api/razorpay/webhook/route.ts` | Production-grade handler with HMAC-SHA256 signature verification. Processes `payment.captured` events and handles startup mapping via payment notes. |
| **Unified Webhook Handler** | `src/lib/webhook-handler.ts` | Centralized business logic for processing webhook events. Ensures atomic MRR updates, historical snapshot persistence with event-level deduplication (idempotency), and safe trust score recalculation. |
| **One-Off Verification API** | `src/app/api/verify/one-off/route.ts` | Special API for the submission form that verifies Stripe/Razorpay revenue *before* a startup record exists, allowing for verified signup. |
| **Database Schema** | `supabase/migrations/` (14 files) | Tables: `startup_submissions`, `provider_connections` (RLS), `revenue_snapshots`, `revenue_transactions`, `verification_logs`, `fraud_signals`. Corrected columns: `mrr_breakdown`, `trust_tier`, `trust_breakdown`, `payment_connected`. |

### ⚠️ Partial (Needs Improvement)

| Issue | Details | Impact |
|---|---|---|
| **Single-provider MRR in main table** | `startup_submissions.mrr` is overwritten by whichever provider verifies LAST. Stripe verify sets `mrr: Math.round(data.revenue)` directly. No cross-provider aggregation at the persistence layer. | MRR displayed on leaderboard may reflect only one provider's revenue, not the sum. |
| **Leaderboard ranking logic** | Primary sort: tier priority (verified > trusted > emerging > unverified > flagged). Secondary sort: `trust_score`. Revenue (MRR) is displayed but NOT used for ranking. | A startup with $50k MRR but lower trust score ranks below one with $1k MRR but higher trust score. |
| **Inconsistent snapshot schema** | Migration `000` defines `revenue_snapshots` with `amount bigint` (smallest unit). Migration `003` redefines it with `amount numeric` (base currency) + `period_start/end` fields. Both exist. Some routes insert individual transactions (external_id = payment ID), others insert aggregate period snapshots. | MRR calculation in `calculateMRR()` sums ALL snapshot amounts in last 30 days. If both individual txns AND aggregates are stored, revenue is double-counted. |
| **Duplicate scoring systems** | `src/lib/scoring.ts` (`computeTrustScore` — full DB integration, 149 lines) AND `src/lib/trust-score.ts` (`calculateTrustScore` — pure function, 50 lines) exist simultaneously. Different weights, different signals. `razorpay/sync` uses `calculateTrustScore`, while `stripe/verify` uses `computeTrustScore`. | Trust scores computed differently depending on which provider path was used. |
| **Stripe OAuth remnant** | `startup/[id]/page.tsx` contains Stripe Connect Express flow logic (checking `stripe_account_id`, `onboarding_complete`, calling `stripe.accounts.retrieve`). This coexists with the working API-key approach. | Dead code path. If a startup has a `stripe_account_id` from an old flow, the page tries to re-verify via OAuth on every load. |
| **Debug logging in production** | `scoring.ts` uses `require('fs').appendFileSync('debug_log.txt', ...)` — synchronous filesystem writes on every trust score computation. | Performance hit. Crashes in serverless environments that don't have writable filesystem. |
| **Fixed IV in encryption** | `encryption.ts` uses `Buffer.alloc(IV_LENGTH, 0)` — a zero-filled IV for all encryptions. The code comments acknowledge this is not ideal. | Same plaintext always produces same ciphertext. Reduces security of encrypted API keys. |
| **No authentication** | No login/signup system. Anyone can access admin page, modify any startup's data via VerificationFlow, or call verification APIs. | Critical security gap for production. |

### ❌ Missing (Critical Gaps)

| Gap | Why It Matters |
|---|---|
| **Time-series revenue snapshots** | Current snapshots are either raw transactions or ad-hoc aggregates. No standardized periodic snapshots (daily/weekly) designed for charting revenue over time or calculating growth rates. |
| **Growth rate calculations** | No MoM growth, ARR projection, or revenue velocity computed anywhere. Leaderboard shows static MRR only. |
| **Clear verification state machine** | Status values are ad-hoc strings. No enum constraint at DB level. |
| **Rate limiting on verification APIs** | `src/lib/rate-limit.ts` exists but is not imported or used by any API route. |

---

## 2. Architecture Corrections

### 2.1 Multi-Provider Aggregation

**Current:** Each provider verification route overwrites `startup_submissions.mrr` independently.
**Target:** Canonical MRR = SUM of latest verified revenue across ALL active `payment_connections`.

```
┌─────────────────────────────────────────────┐
│             startup_submissions             │
│  mrr = aggregated from all providers        │
│  mrr_breakdown = { stripe: X, razorpay: Y } │
└──────────────┬──────────────────────────────┘
               │ 1:N
┌──────────────▼──────────────────────────────┐
│          payment_connections                │
│  provider, encrypted keys, is_active        │
│  latest_revenue, last_synced_at (NEW)       │
└──────────────┬──────────────────────────────┘
               │ 1:N
┌──────────────▼──────────────────────────────┐
│          revenue_snapshots                  │
│  Standardized periodic aggregates           │
│  period_start, period_end, amount, provider │
└─────────────────────────────────────────────┘
```

**Required changes:**
- Add `latest_revenue` and `last_synced_at` columns to `payment_connections`
- Add `mrr_breakdown` (JSONB) to `startup_submissions`
- After each provider sync: update that connection's `latest_revenue` → then recalculate `startup_submissions.mrr` = SUM of all active connections' `latest_revenue`
- Remove direct MRR overwrites in individual verification routes

### 2.2 Revenue Snapshot Redesign

**Current:** Snapshots mix individual transactions and aggregate amounts inconsistently.
**Target:** Two distinct layers:

1. **Transaction log** (optional, for forensic audit): individual payments with `external_id`
2. **Period snapshots** (required, for charts): daily/weekly aggregate with `period_start`, `period_end`, `provider`, `total_amount`

The cron job should produce one period snapshot per provider per startup per day.

### 2.3 Leaderboard Ranking Fix

**Current:** Sorted by tier priority → trust_score.
**Target:** Clear separation:

| Concept | Purpose | Used For |
|---|---|---|
| **Revenue** (MRR) | Financial performance | Primary leaderboard rank |
| **Trust Score** | Credibility / verification depth | Secondary sort + badge display |

Leaderboard query should change to `ORDER BY mrr DESC, trust_score DESC` — with tier badges shown as visual indicators, not ranking factors.

### 2.4 Consolidate Scoring

**Action:** Merge `trust-score.ts` and `scoring.ts` into a single `scoring.ts` module.
- Keep the full `computeTrustScore()` implementation (DB-integrated, penalty-aware)
- Delete `calculateTrustScore()` pure function
- Update `razorpay/sync/route.ts` to use `computeTrustScore`
- Remove `fs.appendFileSync` debug calls

### 2.5 Clean Up Stripe Flow

**Action:** Remove OAuth/Connect remnants from `startup/[id]/page.tsx`:
- Delete `stripe_account_id` / `onboarding_complete` checks
- Standardize on API key verification (Phase 1)
- Remove `import Stripe from "stripe"` from the page component

---

## 3. Updated Build Roadmap

### Phase A — Fix Core Architecture (Week 1) `MANDATORY`

| # | Status | Task | Files | Acceptance Criteria |
|---|---|---|---|---|
| A1 | [x] | **Add `latest_revenue`, `last_synced_at` to `provider_connections`** | New migration | Columns exist, backfill from existing snapshots |
| A2 | [x] | **Add `mrr_breakdown` (JSONB) to `startup_submissions`** | New migration | Stores `{ stripe: number, razorpay: number }` |
| A3 | [x] | **Create `aggregateMRR(startup_id)` function** | `src/lib/revenue-aggregation.ts` | Unified engine created: `getAggregatedRevenue()`. Sums all active connections and updates DB. |
| A4 | [x] | **Refactor Stripe verify to call `aggregateMRR`** | `src/app/api/stripe/verify/route.ts` | Integrated. Delegates revenue calculation and persistence to the unified engine. |
| A5 | [x] | **Refactor Razorpay verify to call `aggregateMRR`** | `src/app/api/razorpay/verify/route.ts` | Integrated. Simplified flow by delegating metrics to the unified engine. |
| A6 | [x] | **Refactor cron sync to call `aggregateMRR`** | `src/app/api/cron/sync-revenue/route.ts` | Integrated. Multi-provider sync now uses the engine for canonical MRR persistence. |
| A7 | [x] | **Fix leaderboard ranking** | `src/app/leaderboard/page.tsx` | Order by MRR DESC, then growth DESC. |
| A8 | [x] | **Consolidate scoring modules** | `src/lib/scoring.ts` | Merged trust-score.ts into scoring.ts. Updated all callers. |
| A9 | [x] | **Remove Stripe OAuth remnants** | `src/app/startup/[id]/page.tsx` | Purged legacy Stripe initialization and onboarding code. |
| A10 | [x] | **Standardize verification status strings** | API Routes | Standardized on: `unverified`, `pending`, `api_verified`, `verified`, `flagged`. |
| A11 | [x] | **Implement Real-time Webhook Engine** | `src/lib/webhook-handler.ts` | Webhook events trigger immediate revenue updates and snapshots. |
| A12 | [x] | **Fix Verified Signup Flow** | `src/app/submit/page.tsx` | New startups can verify revenue via API during registration. |

### Phase B — Data Integrity Layer (Week 2)

| # | Status | Task | Files | Acceptance Criteria |
|---|---|---|---|---|
| B1 | [x] | **Standardize revenue snapshot schema** | New migration, update all sync routes | Single table with: `startup_id`, `provider`, `amount` (base currency), `period_start`, `period_end`, `snapshot_type` (`transaction` or `aggregate`). Drop conflicting duplicate table definition. |
| B2 | [x] | **Daily aggregate snapshot generation** | Update cron job | After syncing transactions, compute daily aggregate snapshot per provider per startup. |
| B3 | [x] | **Growth rate calculation** | `src/lib/growth.ts` | `calculateGrowthRate(startup_id)` → compares current period snapshot vs previous period. Returns MoM percentage. |
| B4 | [x] | **Trust Scoring Resilience** | `src/lib/scoring.ts`, `webhook-handler.ts` | Implemented trust inertia (`last_penalty_at`), penalty persistence (`penalty_count`), and earned trust recovery (`clean_events`) to deter rapid-fire and slow-oscillation abuse patterns. |
| B5 | [ ] | **Fix encryption IV** | `src/lib/encryption.ts` | Generate random IV per encryption, prepend to ciphertext. Update decrypt to extract IV. Migrate existing encrypted values. |
| B6 | [x] | **Wire rate limiting** | `src/lib/rate-limit.ts` → verification routes | Applied `checkRateLimit` helper to all non-cron API routes to enforce standard 429 responses. |
| B7 | [x] | **Deduplicate fraud detection** | `src/lib/fraud.ts` | Merged `fraud.ts` and `fraud-detection.ts`. Refactored all calling sites to use the unified, deterministic module. |

### Phase C — Product Layer (Week 3)

| # | Status | Task | Files | Acceptance Criteria |
|---|---|---|---|---|
| C1 | [ ] | **Persistent dashboard layout** | Refactor `VerificationFlow.tsx` | Replace modal-based verification with an always-visible dashboard section. Connected providers show inline with status, last sync time, and per-provider MRR. Actions are inline, not modals. |
| C2 | [ ] | **Provider connection status panel** | `src/components/startup/ConnectionStatus.tsx` | Card per provider: connection status, last synced, revenue amount, sync button. Color-coded (green/red/gray). |
| C3 | [ ] | **Revenue chart** | New component | Time-series chart using period snapshots. Show MRR over last 30/60/90 days. Use lightweight charting library (e.g., Recharts). |
| C4 | [x] | **Growth indicators on leaderboard** | `src/app/leaderboard/page.tsx` | Show MoM growth arrow and percentage next to MRR. |
| C5 | [ ] | **Verification state badges** | Refactor `TierBadge` component | Use standardized status enum. Show both trust tier AND verification status. |
| C6 | [ ] | **Admin dashboard improvements** | `src/app/admin/page.tsx` | Show provider connections, revenue breakdown, fraud signals history, snapshot timeline per startup. |

---

## 4. Deferred Features

> **Blocked until core data layer is correct.**
> These features depend on accurate multi-provider revenue, historical snapshots, and stable trust scoring.
> Do not build any of these until Phase A + B are complete.

| Feature | Reason for Deferral |
|---|---|
| **Ads / Sponsored Rankings** | Requires stable, trusted leaderboard ranking. Current ranking is broken (trust-based, not revenue-based). |
| **Marketplace** | No user authentication system. No billing infrastructure. |
| **Subscriptions / Billing** | Premature without auth. Revenue model undefined. |
| **Community Feed** | No user accounts or social graph. |
| **Multi-currency normalization** | Requires reliable exchange rate service and standardized snapshot amounts. Currently Stripe stores USD, Razorpay stores INR, no conversion. |
| **Investor View / Access Control** | Requires auth + role-based permissions. |
| **Additional Providers** (Cashfree, Paddle, Lemon Squeezy) | Architecture must support multi-provider first (Phase A). Then adding providers is additive. |

---

## 5. 🐞 Errors & Fixes (Today's Work)

### ✅ Fixed Today
- **Fraud Logic Unification (B7)**: Audited entire codebase and removed all manual spike/rate-limit checks. Standardized on `detectFraud()` in `src/lib/fraud.ts`.
- **Deterministic Fraud Analysis**: Refactored `detectFraud` to be fully deterministic (using injected timestamps) and handle edge cases for historical data length.
- **API Route Rate Limiting (B6)**: Integrated `checkRateLimit()` into all non-cron API routes with standardized 429 error responses.
- **Scoring Engine Hardening**: Refactored `scoring.ts` to use unified fraud signals, ensuring trust scores react consistently to abuse.
- **Automated Fraud Testing**: Created a suite of Node.js test scripts (`scripts/test-fraud-*`) to validate clean vs. suspicious behavior.

### 🔴 Next Up
- **Fix Encryption IV (B5)**: Replace static zero-filled IV with a unique random IV per encryption to prevent ciphertext patterns.
- **Provider Connection Status (C2)**: Build a live status panel for the startup detail page showing per-provider MRR and connection health.
- **Interactive Revenue Chart (C3)**: Visualize growth using historical snapshots.

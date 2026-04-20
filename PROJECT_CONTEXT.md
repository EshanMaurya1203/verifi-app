# Verifi — Project Context

> **Last updated:** 2026-04-20
> **Source of truth:** Reflects actual system state, after the Unified Revenue Engine refactor.

---

## 1. Product Definition

Verifi is a startup revenue verification platform that replaces self-reported financial claims with audit-backed data. Founders connect their payment processors (Stripe, Razorpay) via read-only API keys. The platform pulls real transaction data, computes verified MRR, assigns deterministic trust scores based on multiple verification signals, and ranks startups on a public leaderboard. 

Key differentiator: **Aggregation Engine**. Verifi supports multiple concurrent payment providers per startup, aggregating their revenue into a single "Source of Truth" MRR, while tracking detailed per-provider performance and sync history.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS (Dark mode, Glassmorphism, CSS Variables) |
| **Database** | Supabase (PostgreSQL + Row Level Security) |
| **Integrations** | Stripe API (Balance Transactions), Razorpay API (Payments) |
| **Security** | AES-256-CTR encryption for stored API keys |
| **Hosting** | Vercel-compatible (Cron via `CRON_SECRET`) |

---

## 3. Core System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Landing (page.tsx) │ Leaderboard │ Startup Detail │ Admin   │
│  VerificationFlow (Multi-provider connection UI)             │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                     SCORING LAYER                            │
│  computeTrustScore() — deterministic, multi-signal           │
│  0-100 score → tier (verified/trusted/emerging/flagged)      │
│  Includes Fraud penalties from fraud_signals table           │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                 UNIFIED AGGREGATION ENGINE                   │
│  getAggregatedRevenue() — THE single source of truth         │
│  Sums live revenue across ALL active provider_connections    │
│  Persists canonical MRR + breakdown back to submissions      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   PERSISTENCE LAYER                           │
│  revenue_snapshots — granular historical records             │
│  verification_logs — audit trail for all operations          │
│  fraud_signals — detected anomalies & risk levels            │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                  DATA INGESTION LAYER                         │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │  Stripe Verify  │    │  Razorpay Verify │                │
│  │  /stripe/verify │    │  /razorpay/verify│                │
│  └────────┬────────┘    └────────┬─────────┘                │
│           │                      │                           │
│  ┌────────▼──────────────────────▼─────────┐                │
│  │      Cron Jobs (Phase 1 & Phase 2)       │                │
│  │  1. Snapshot individual connections       │                │
│  │  2. Invoke Aggregate Engine per startup   │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────┐                │
│  │      provider_connections (RLS)         │                │
│  │  Encrypted keys & per-provider MRR       │                │
│  └─────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Layer Details

**Unified Aggregation Engine**
- `getAggregatedRevenue(startupId)`: Orchestrates live API calls to all connected providers, normalizes values to INR, aggregates the total, and updates both `provider_connections` and `startup_submissions` in one transaction.
- Standardized Response: Every fetcher (Stripe/Razorpay) returns a `ProviderRevenue` shape.

**Data Ingestion Layer**
- **Stripe**: Uses `balance_transactions` for precise realized revenue calculation.
- **Razorpay**: Uses `payments.all()` filtered for `captured` status.
- **Cron**: Two-phase sync. Standardized `/api/cron/sync-revenue` handles both transaction logging and global MRR aggregation.

---

## 4. Data Model (Updated)

### `startup_submissions` (primary entity)

| Column | Type | Purpose |
|---|---|---|
| `mrr` | numeric | **Aggregated MRR** from all verified providers. |
| `mrr_breakdown` | jsonb | `{ stripe: number, razorpay: number }` contribution map. |
| `trust_score` | integer | 0–100 deterministic score. |
| `trust_tier` | text | `verified` / `trusted` / `emerging` / `unverified` / `flagged`. |
| `verification_status`| text | `unverified`, `pending`, `api_verified`, `verified`, `flagged`. |
| `last_verified_at` | timestamptz | Timestamp of the last successful aggregation event. |

### `provider_connections` (Replaces payment_connections)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK | Connection identifier. |
| `startup_id` | bigint FK | References `startup_submissions(id)`. |
| `provider` | text | `stripe` / `razorpay`. |
| `account_id` | text | Provider identifier (e.g., Razorpay key_id). |
| `api_key_encrypted` | text| AES-256-CTR encrypted secret key. |
| `status` | text | `connected` / `failed`. |
| `latest_revenue` | numeric | Last synced MRR contribution from this provider. |
| `last_synced_at` | timestamptz | Timestamp of last provider-specific sync. |

### `revenue_snapshots` (Metrics Tracking)

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK | Snapshot identifier. |
| `startup_id` | bigint FK | References `startup_submissions(id)`. |
| `total_revenue` | numeric | The globally aggregated MRR at this point in time. |
| `provider_breakdown` | jsonb | Snapshot of which providers contributed. |
| `created_at` | timestamptz | When snapshot was recorded. |

### `revenue_transactions` (Legacy / Event ingestion)
Note: Formerly called `revenue_snapshots`. Tracks granular chronological `captured`/`succeeded` payment intents per provider to drive the fraud detection engine.

---

## 5. Trust Scoring Logic

Engine: `src/lib/scoring.ts` → `computeTrustScore(startup_id)`

### Positive Signals (Max 100)
- **Payment Gateway Connected (+30):** Any active connection in `provider_connections`.
- **Verified Revenue (Tiers):** +5 to +20 depending on MRR brackets.
- **Verification Sources:** Multi-provider connections provide higher reliability signals.
- **Social & Web (+20):** Website, LinkedIn, Twitter presence.
- **Verification Methods (+20):** Video verification, KYC.

---

## 6. Verification Philosophy

### The Aggregation First Approach
Verifi no longer treats providers as mutually exclusive. If a founder uses Razorpay for domestic (India) and Stripe for international (Global) sales, the system:
1. Connects both independently.
2. Normalizes Global (USD) revenue to local baseline (INR) if required.
3. Sums them into a single **Consolidated MRR**.
4. Flags inconsistencies across providers via the aggregation engine's audit trail.

---

## 7. API Route Map (Current)

| Route | Method | Purpose |
|---|---|---|
| `/api/verify/revenue` | POST | Unified portal for verifying any provider. Calls aggregation engine. |
| `/api/stripe/verify` | POST | Legacy-wrapped; delegates to Aggregation Engine. |
| `/api/razorpay/verify` | POST | Legacy-wrapped; delegates to Aggregation Engine. |
| `/api/cron/sync-revenue`| GET | Multi-phase cron for total platform reconciliation. |
| `/api/startup/[id]/connections` | GET | Returns connection list + aggregated totals for UI. |

---

## 8. Resolved Technical Debt (Recent)

- ✅ **Cross-provider aggregation:** Fixed. MRR is no longer "last-write-wins".
- ✅ **Stale References:** Purged `payment_connections`, `calculateMRR`, and `aggregateMRR` legacy code.
- ✅ **Next.js 16 Compatibility:** Fixed Promise-based `params` and `config` deprecations.
- ✅ **Type Safety:** Corrected multi-module type mismatches between fraud detection and sync routes.
- ✅ **Two competing `revenue_snapshots` schemas:** Resolved. Legacy table renamed to `revenue_transactions`. A new macro-level `revenue_snapshots` table strictly tracks aggregated MRR across time.
- ✅ **Scoring Consolidation:** Resolved. `trust-score.ts` logic merged into a unified `scoring.ts` engine. Removed all synchronous `fs` debug functions.
- ✅ **Leaderboard Bias:** Resolved. Leaderboard ranking completely decoupled from `trust_score`. Order is strictly dictated by Verified MRR and MoM Growth.
- ✅ **Error Suppression:** Resolved. Vague `{}` objects replaced with hardened full JSON stringified tracebacks globally in the revenue engine.

---

## 9. Remaining Technical Debt

1. **Encryption Security** — Fixed IV should be replaced with random per-encryption IV.
2. **Authentication** — Admin and Verification mutations are still technically unauthenticated.

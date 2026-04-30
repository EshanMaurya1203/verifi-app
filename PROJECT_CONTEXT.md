# Verifi — Project Context

> **Last updated:** 2026-04-22
> **Source of truth:** Reflects actual system state, after the Real-Time Webhook Engine deployment.

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
| **Integrations** | Stripe API, Razorpay API, HMAC-SHA256 Webhooks |
| **Security** | AES-256-CTR encryption for stored API keys |
| **Hosting** | Vercel-compatible (Cron via `CRON_SECRET`) |

---

## 3. Core System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Landing (page.tsx) │ Leaderboard │ Startup Detail │ Admin   │
│  VerificationFlow (Multi-provider connection UI)             │
│  Submit (Verified Signup support)                            │
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
│                   WEBHOOK ENGINE (NEW)                       │
│  Stripe / Razorpay Handlers → updateRevenueAndSnapshot()     │
│  Real-time MRR updates & deduplicated snapshots              │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   PERSISTENCE LAYER                           │
│  revenue_snapshots — granular historical records             │
│  revenue_transactions — payment-level log                    │
│  verification_logs — audit trail for all operations          │
│  fraud_signals — detected anomalies & risk levels            │
└──────────────────────────┬───────────────────────────────────┘
```

### Layer Details

**Unified Aggregation Engine**
- `getAggregatedRevenue(startupId)`: Orchestrates live API calls to all connected providers, normalizes values to INR, aggregates the total, and updates both `provider_connections` and `startup_submissions` in one transaction.

**Webhook Engine**
- **Stripe**: Handles `payment_intent.succeeded`. Maps via metadata or `provider_connections`.
- **Razorpay**: Handles `payment.captured`. Verified via HMAC signature.
- **Shared Handler**: `updateRevenueAndSnapshot()` ensures atomic updates and triggers trust score recomputation.

---

## 4. Data Model (Updated)

### `startup_submissions` (primary entity)

| Column | Type | Purpose |
|---|---|---|
| `mrr` | numeric | **Aggregated MRR** from all verified providers. |
| `mrr_breakdown` | jsonb | `{ stripe: number, razorpay: number }` contribution map. |
| `trust_score` | integer | 0–100 deterministic score. |
| `trust_tier` | text | `verified` / `trusted` / `emerging` / `unverified` / `flagged`. |
| `payment_connected`| boolean | True if at least one API source is connected. |
| `last_verified_at` | timestamptz | Timestamp of the last successful aggregation/webhook event. |
| `last_penalty_at` | timestamptz | Timestamp of the last trust score penalty (used for inertia). |
| `penalty_count` | integer | Number of recent violations. Scales penalty severity. |
| `clean_events` | integer | Consecutive valid transactions. Used for earned trust recovery. |

### `provider_connections`

| Column | Type | Purpose |
|---|---|---|
| `provider` | text | `stripe` / `razorpay`. |
| `key_id` | text | Provider identifier. |
| `key_secret` | text | Encrypted secret key. |
| `last_mrr` | numeric | Last synced MRR contribution from this provider. |

### `revenue_snapshots`

| Column | Type | Purpose |
|---|---|---|
| `total_revenue` | numeric | The globally aggregated MRR at this point in time. |
| `provider_breakdown` | jsonb | Snapshot of which providers contributed. |

---

## 5. Resolved Technical Debt (Recent)

- ✅ **Real-Time Updates**: Webhooks now update the platform instantly instead of waiting for cron.
- ✅ **Verified Signup**: Founders can verify revenue via API during the initial submission.
- ✅ **Multi-Provider UI**: Fixed dashboard logic to support concurrent Stripe + Razorpay.
- ✅ **Admin Sync**: Moderation actions now trigger instant trust score updates.
- ✅ **Schema Integrity**: All required columns for scoring and breakdown are now in production.
- ✅ **Crash-proof Metrics**: Standardized growth and ARR calculations to handle null states safely.
- ✅ **Trust Resilience**: Added penalty persistence, trust inertia, and earned recovery logic to prevent rapid-fire and slow-oscillation manipulation tactics.

---

## 6. Remaining Technical Debt

1. **Rate Limiting** — Middleware is present but needs to be wired to all API routes.
2. **Standardized Snapshotting** — Periodic daily aggregation snapshots for long-term charts.
3. **Authentication** — Admin and Verification mutations are still technically unauthenticated.

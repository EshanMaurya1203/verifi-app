# Verifi — Project Context

> **Last updated:** 2026-05-17
> **Source of truth:** Reflects actual system state, after the Production-Readiness Audit and Vercel Deployment Release.

---

## 1. Product Definition

Verifi is an investor-grade startup revenue verification platform that replaces self-reported financial claims with audit-backed data. Founders connect their payment processors (Stripe, Razorpay) via read-only API keys. The platform pulls real transaction data, computes verified MRR, assigns deterministic trust scores based on multiple verification signals, and ranks startups on a public leaderboard. 

Key differentiator: **Aggregation Engine**. Verifi supports multiple concurrent payment providers per startup, aggregating their revenue into a single "Source of Truth" MRR, while tracking detailed per-provider performance and sync history.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack Engine) |
| **Language** | TypeScript (Strict type checks) |
| **Styling** | Vanilla CSS, Glassmorphism, tailored HSL Dark Mode palettes |
| **Database** | Supabase (PostgreSQL + Row Level Security policies) |
| **Integrations** | Stripe API, Razorpay API, HMAC-SHA256 Signed Webhooks |
| **Security** | AES-256-CTR encryption with randomized dynamic IV hashes |
| **SEO & Discovery** | Dynamic sitemaps (`sitemap.ts`), `robots.ts`, OpenGraph card schemas |
| **Hosting** | Vercel (Optimized for edge runtime execution) |

---

## 3. Core System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  Landing (page.tsx) │ Leaderboard │ Startup Detail │ Admin   │
│  VerificationFlow (Multi-provider connection UI)             │
│  Submit (Verified Signup onboarding support)                 │
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
│                   WEBHOOK ENGINE                             │
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

## 4. Data Model (Verified & Stable)

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

## 5. Resolved Technical Debt & Quality Overhaul

- ✅ **Copy System Redesign**: Purged all futuristic, fake cyberpunk phrases ("Forensic Trust Computed", "Authenticity Alignment", etc.). Replaced with clean, professional financial copy ("Verification recalculation", "Revenue consistency", "Payment provider confidence", etc.) in the spirit of Plaid, Stripe, and Mercury.
- ✅ **Premium Indie Seeding**: Purged unrealistic company names and formatted spikes. Seeded 10 highly realistic startup profiles, categories (SaaS, AI, ecommerce, creator agencies), believable founder descriptions, social links, and public reasons for verification.
- ✅ **Robust Trust Badges**: Stabilized theme-switching vector SVG renders. Built dynamic loading states, fallbacks, dynamic `getBaseUrl()` resolvers using `NEXT_PUBLIC_APP_URL`, and production-ready embed HTML snippets.
- ✅ **Dashboard Spacing & Contrast system**: Upgraded globals.css with bespoke tailwind-free dark aesthetics (`#040406` bases, translucent white borders, glow highlights). Condensed ugly dynamic empty-state blocks into elegant inline notifications.
- ✅ **SEO & Sitemap Indexing**: Created dynamic dynamic `sitemap.ts` connecting Supabase slugs and crawling instructions under `/robots.txt` to fully index active startup profiles.
- ✅ **Security Hardening**: Enforced AES-256-CTR encryption with randomized Dynamic IV prefixes (`iv:ciphertext` mapping) with automatic legacy fixed-IV extraction fallbacks.
- ✅ **Rate Limiting**: Successfully wired standard rate limiting middlewares with client-identifier scopes across public verification routes.

---

## 6. Remaining Technical Debt

1. **Authentication Expansion** — Integrate robust OAuth identity constraints on administrative updates to protect dynamic dashboard mutations.
2. **Third-Party Providers** — Integrate secondary payment aggregation endpoints (e.g. Lemon Squeezy, Paddle, Cashfree) as standardized database extensions.


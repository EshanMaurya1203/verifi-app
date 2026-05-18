# Verifi — Implementation Plan

> **Last audited:** 2026-05-17
> **Source of truth:** This document reflects the ACTUAL codebase, not aspirational features.

---

## 0. Project Context

**1. One Line Idea**
A platform that programmatically verifies and publicly aggregates real-time startup revenue data (MRR) via direct, read-only API integrations with payment gateways like Stripe and Razorpay.

**2. Who It's For**
Indie hackers, bootstrapped founders, micro-SaaS creators, and early-stage startup builders who want to "build in public" and prove their traction to users, peers, or potential investors/acquirers.

**3. What Painful Problem It Solves**
The "fake it till you make it" culture on social media. Currently, anyone can claim inflated MRR numbers to farm engagement, sell courses, or build fake authority. This makes it impossible to distinguish legitimate, profitable businesses from vaporware and scams.

**4. Current Alternatives People Use**
- Self-reported text posts or screenshots on X/Twitter.
- Public analytics dashboards (e.g., Baremetrics "Open Startups").
- Generic self-reported startup leaderboards (e.g., IndieHackers).

**5. Why Existing Solutions Are Inadequate**
- Screenshots are trivially easy to forge or inspect-element.
- Tools like Baremetrics are expensive ($100+/mo) and built primarily for internal analytics, not lightweight public trust signaling.
- Traditional leaderboards rely entirely on the honor system, meaning they inevitably get overrun by bad actors inflating their numbers for clout, destroying the credibility of the entire list. Verifi introduces a cryptographic, API-backed layer of absolute truth.

---

## 1. Current State

### ✅ Completed (Working Systems)

| System | Files | Status |
|---|---|---|
| **Startup Submission Onboarding** | `src/app/submit/page.tsx` | Full multi-step onboarding with verified API revenue capabilities, file uploads, social metadata bindings, and slot progress bars. |
| **Supabase Integration** | `src/lib/supabase.ts`, `supabase-server.ts`, `supabase-client.ts` | Complete context boundaries for browser (anon), server-rendered async nodes (server role), and administrative operations. |
| **Premium Leaderboard** | `src/app/leaderboard/page.tsx` | Ordered by MRR DESC, growth DESC. Formats Indian currency naturally (k, L, Cr), showing live growth percentages and active badges. |
| **Startup Profile Detail** | `src/app/startup/[slug]/page.tsx` | Elegant, highly detailed dashboard. Highlights verified MRR breakdowns, consistent income timelines, website references, and founder stories. |
| **Stripe API Key Verification** | `src/app/api/stripe/verify/route.ts` | Encrypts keys dynamically → syncs past payments → parses 30-day MRR → builds snapshots → computes trust penalties instantly. |
| **Razorpay API Key Verification** | `src/app/api/razorpay/verify/route.ts` | Validates API credentials → syncs INR payments → inserts snapshots → triggers Unified Aggregation Engine. |
| **Unified Aggregation Engine** | `src/lib/revenue-aggregation.ts` | Sums live revenue across all active connected payment processors. Single source of truth. |
| **Dynamic Vector Badges** | `src/app/api/badge/[slug]/route.ts` | Computes dynamic font scaling to prevent overlaps, resolves light/dark themes, and handles skeleton loaders. |
| **Interactive Revenue Charts** | `src/components/startup/RevenueChart.tsx` | Implemented gorgeous Recharts curve charts visualizing time-series snapshot trends with interactive tooltip anchors. |
| **Encryption Engine** | `src/lib/encryption.ts` | Upgraded to dynamic AES-256-CTR with randomized 16-byte cryptographically secure IV hex prefixes, including legacy fixed-IV fallbacks. |
| **Rate Limiting Protection** | `src/lib/rate-limit.ts` | Wired standard rate-limit filters and 429 responders globally across public verification API nodes. |
| **Dynamic SEO discovery** | `src/app/sitemap.ts`, `robots.ts` | Real-time Supabase sitemap indexer linking `/sitemap.xml` with priority indices and crawlers directives under `/robots.txt`. |
| **Production Build Stability** | `next build` validation | Verified compilation successfully runs under Next.js Turbopack compiler. **Exit code: 0**. |

---

## 2. Updated Build Roadmap

### Phase A — Fix Core Architecture `COMPLETED`

| # | Status | Task | Files | Outcome |
|---|---|---|---|---|
| A1 | [x] | **Add `latest_revenue`, `last_synced_at` columns** | Migration | Database tables structured for multi-provider tracking. |
| A2 | [x] | **Add `mrr_breakdown` (JSONB) to submissions** | Migration | Stores individual provider contribution ratios dynamically. |
| A3 | [x] | **Create `aggregateMRR(startup_id)` function** | `src/lib/revenue-aggregation.ts` | Live aggregation engine successfully compiled. |
| A4 | [x] | **Refactor Stripe verify to use Unified Engine** | `src/app/api/stripe/verify/route.ts` | Fully operational. |
| A5 | [x] | **Refactor Razorpay verify to use Unified Engine** | `src/app/api/razorpay/verify/route.ts` | Fully operational. |
| A6 | [x] | **Refactor cron sync to use Unified Engine** | `src/app/api/cron/sync-revenue/route.ts` | Multi-provider database synchronization automated. |
| A7 | [x] | **Fix leaderboard ranking** | `src/app/leaderboard/page.tsx` | Ranked by MRR DESC and growth DESC. |
| A8 | [x] | **Consolidate scoring modules** | `src/lib/scoring.ts` | Merged and removed legacy pure function calls. |
| A9 | [x] | **Remove Stripe OAuth remnants** | `src/app/startup/[slug]/page.tsx` | Legacy stripe account references completely purged. |
| A10| [x] | **Standardize verification status strings** | API Routes | Converted all statuses to enum-compliant states. |

### Phase B — Data Integrity Layer `COMPLETED`

| # | Status | Task | Files | Outcome |
|---|---|---|---|---|
| B1 | [x] | **Standardize revenue snapshot schema** | Migrations & sync routes | Dual-table layout resolved. |
| B2 | [x] | **Daily aggregate snapshot generation** | Cron sync updates | Automatic daily interval snapshot aggregation active. |
| B3 | [x] | **Growth rate calculation** | `src/lib/growth.ts` | Tracks real MoM growth percentages for listing cards. |
| B4 | [x] | **Trust Scoring Resilience** | `src/lib/scoring.ts` | Penalty inertia, persistent recovery multipliers fully active. |
| B5 | [x] | **Fix encryption IV security** | `src/lib/encryption.ts` | Replaced fixed-IVs with dynamic 16-byte random cipher blocks. |
| B6 | [x] | **Wire rate limiting middlewares** | `src/lib/rate-limit.ts` | Active on all public verification endpoints (resilient against spam). |
| B7 | [x] | **Deduplicate fraud detection logic** | `src/lib/fraud.ts` | Unified pattern rules integrated. |

### Phase C — Visual & Product Layer `COMPLETED`

| # | Status | Task | Files | Outcome |
|---|---|---|---|---|
| C1 | [x] | **Connect Provider Inline Status Card** | Detail pages | Connections show inline health, MRR ratios, and status colors. |
| C2 | [x] | **Provider connection status panel** | `ConnectionStatus.tsx` | Visual feedback on last sync timings and provider errors active. |
| C3 | [x] | **Interactive Revenue Chart** | `RevenueChart.tsx` | High-fidelity Recharts visualizer active. |
| C4 | [x] | **Growth indicators on leaderboard** | `leaderboard/page.tsx` | Displays green/red MoM growth velocity indicators. |
| C5 | [x] | **Verification status badges** | `TierBadge.tsx` | Shows standard trust tiers in the UI. |

### Phase D — Copy, Transparency & SEO Overhaul `COMPLETED`

| # | Status | Task | Files | Outcome |
|---|---|---|---|---|
| D1 | [x] | **Cyberpunk Copy Clean-Up** | Global codebase | Replaced vague futuristic terms with plain, premium financial copy in the spirit of Stripe and Plaid. |
| D2 | [x] | **Indie Founders Seeding** | Database Seeds | Seeded 10 highly realistic indie startups (MRR from ₹12k to ₹8.7L) with genuine names, avatars, X/LinkedIn paths, and reasons for public verification. |
| D3 | [x] | **Trust Badge Stability** | `BadgeEmbedder.tsx` | Handled image rendering fallbacks, dynamically resolved absolute URLs using `NEXT_PUBLIC_APP_URL`, and added loading skeletons. |
| D4 | [x] | **Dashboard Density Tuning** | Detail pages | Condensed dynamic empty-state blocks into elegant inline blocks. |
| D5 | [x] | **SEO Discovery Framework** | Layout & Sitemap | Configured real-time dynamically generated sitemap (`sitemap.ts`), crawl configurations (`robots.ts`), and canonical link headers. |
| D6 | [x] | **Next.js Compile Clearances** | Build pipeline | Confirmed 100% type-safe compilation under Next.js Turbopack compiler. **Exit code: 0**. |

### Phase E — Refactoring To Confidence-Based Trust `COMPLETED`

| # | Status | Task | Files | Outcome |
|---|---|---|---|---|
| E1 | [x] | **Implement Confidence Tiers** | `verification-state.ts` | Refactored binary statuses into 4 distinct confidence tiers: `SELF_REPORTED`, `PAYMENT_CONNECTED`, `REVENUE_VERIFIED`, and `HIGH_CONFIDENCE`. |
| E2 | [x] | **Introduce Internal Anomaly Tracking** | `verification-state.ts` | Created `InternalAnomalyFlag` enum to silently track metrics like `RATE_LIMIT_TRIGGERED`, `REVENUE_SPIKE`, and `PROVIDER_STALE` without exposing "fraud" language. |
| E3 | [x] | **Upgrade Trust Score Calculation** | `scoring.ts` | Refactored `computeTrustScore` to output the new confidence tiers seamlessly, and fallback to `self_reported` securely. |
| E4 | [x] | **Dynamic UI Transparency Cards** | `VerificationTransparencyCard.tsx` | UI now dynamically alters color rings and progress tracker steps (1/4 to 4/4) based exclusively on the new `confidenceTier`. |
| E5 | [x] | **Purge "Moderation Queue" Legacy UI** | `RevenueConsistencyCard.tsx` | Replaced rigid approval states with "Refining" vs. "Consistent" wording to match the automated nature of confidence scoring. |
| E6 | [x] | **Backward-Compatible Leaderboard Badges** | `leaderboard/page.tsx` | Configured `TierBadge` maps to handle both legacy DB trust tiers and new confidence tiers concurrently, ensuring stable display of historical accounts. |
| E7 | [x] | **Update Dynamic OG Images & Badges** | `api/og/startup/[slug]/route.tsx`, `api/badge/[slug]/route.ts` | Upgraded dynamic label rendering in shareable embeds to display the new confidence tiers instead of binary tags. |
| E8 | [x] | **Admin Dashboard Compatibility** | `admin/page.tsx` | Filtered the admin views to ingest the new `verification_status` names, preventing UI errors for newly vetted startups. |
| E9 | [x] | **Eliminate `verificationStatus` mismatch errors** | `src/app/startup/[slug]/page.tsx` | Replaced legacy `verificationStatus === "VERIFIED"` checks with `confidenceTier` enum matching, guaranteeing type-safe Next.js compilation. |
| E10 | [x] | **Production Turbopack Clearance** | Global codebase | Full 0-error green CI/CD build successfully ran confirming type-safety of all refactored systems. |

---

## 3. Future Goals & Maintenance

1. **OAuth Founder Integration** — Build a formal onboarding login guard to restrict dashboard profile changes to verified owners.
2. **Standard API connectors** — Extend the dynamic Aggregation Engine to ingest other standard providers (Paddle, Lemon Squeezy, Cashfree).
3. **Advanced Analytics** — Feed historical revenue snapshots into predictive cohorts for investor telemetry analysis.

---

## 4. Outstanding Linting, Warnings & Fixes Required

To achieve a pristine **0-warning compilation pipeline** and enforce strict security checks, the following cleanups and refactoring steps are planned:

- [x] Fixed all UI-side `verificationStatus` mismatch errors by mapping old string states to new confidence tiers.
- [x] Refactored `verification-state.ts` to use a 4-tier confidence system: `SELF_REPORTED`, `PAYMENT_CONNECTED`, `REVENUE_VERIFIED`, `HIGH_CONFIDENCE`.
- [x] Standardized the `admin/page.tsx` UI to accept the new trust tiers seamlessly.
- [x] Standardized the `leaderboard/page.tsx` UI to map both legacy and new trust tiers seamlessly to UI badges.
- [x] Verified full production build success (`Exit code: 0`).

### 4.1 Unused Import & Variable Cleanups
- [ ] **Remove Unused Imports & Type Maps**:
  - Clean up `UnifiedVerificationStatus` defined but never used in [VerificationTransparencyCard.tsx](file:///c:/Users/eshan/Downloads/verifi-app/src/components/startup/VerificationTransparencyCard.tsx#L21).
  - Clean up `NormalizedPayment` defined but never used in [sync.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/providers/sync.ts#L5).
  - Clean up `getSupabaseServer` defined but never used in [revenue-verify.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/revenue-verify.ts#L1).
- [ ] **Remove Dormant/Legacy State Variables**:
  - Remove assigned but unused variables `rateLimitTriggered` and `isClean` in [sync.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/providers/sync.ts#L53-L54) remaining from historical testing.
  - Remove assigned but unused variable `sequenceDetected` in [scoring.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/scoring.ts#L71).

### 4.2 Strict Typing Overhaul (Eliminating `any`)
- [ ] **Define Strong Interfaces for External Integrations**:
  - Replace `any` castings with structured typings for payments and capture events in [razorpay.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/providers/razorpay.ts).
  - Define exact parameters and payload mappings to eradicate generic `any` casts in [stripe.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/providers/stripe.ts).
  - Implement dynamic typed structures for scoring functions and breakdown models in [scoring.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/scoring.ts) and [verification.ts](file:///c:/Users/eshan/Downloads/verifi-app/src/lib/verification.ts).

### 4.3 Deployment Safeguards & Security Auditing
- [ ] **Wired Variable Configurations**:
  - Ensure administrative environments enforce `ENCRYPTION_SECRET` check constraints so that API keys are never stored in plain text or using empty fallbacks.
  - Validate that webhook throttling limits set in `rate-limit.ts` do not interfere with Stripe/Razorpay high-throughput transactional traffic.



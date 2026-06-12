# Verifii — Implementation Plan

> **Last updated:** 2026-06-12 (SaaS Subscription Billing & Webhook Hardening)  
> **Source of truth:** Reflects the **actual** codebase after production-readiness, trust-system, payment-integration, database fixes, currency standardization audits, branding migration, and subscription billing system.

---

## 0. Project Context

**One-line idea:** Programmatically verify startup revenue (MRR) via read-only payment-provider APIs and publish tamper-resistant public profiles and leaderboards.

**Primary users:** Indie hackers and early-stage founders who want transparent, API-backed traction signals.

**Core flow:**
```
Sign in (Google) → /submit (create startup) → /startup/{slug}/verify (connect payment)
  → sync & score → /startup/{slug} (public profile) → share badge / OG
```

---

## 1. Current State — Completed Systems

### 1.1 Authentication & session (first-customer fix)

| Component | Path | Status |
|-----------|------|--------|
| Browser Supabase client | `src/lib/supabase.ts` | `createBrowserClient` from `@supabase/ssr` (cookie-backed session) |
| Session refresh middleware | `middleware.ts`, `src/lib/supabase/middleware.ts` | Refreshes auth cookies on every matched request |
| OAuth callback | `src/app/auth/callback/route.ts` | `exchangeCodeForSession`; supports `?next=` redirect |
| OAuth redirect helper | `src/lib/oauth-redirect.ts` | Uses `window.location.origin` in browser; falls back to `NEXT_PUBLIC_SITE_URL` |
| Server auth | `src/lib/auth-server.ts` | Bearer token or cookie session; `verifyStartupOwnership()` |
| Verify-page login | `src/components/auth/VerifyLoginPrompt.tsx` | Google sign-in when unauthenticated on `/verify` |
| Navbar state & Sign-Out | `src/components/layout/Navbar.tsx` | Dynamic user session parsing, initials avatar display, dropdown access, and functional sign-out flow |
| Safe login click handlers | `src/app/page.tsx` | Directly retrieves active session on user action to prevent premature redirects |
| Auth routing guards & redirects | `src/app/startup/[slug]/verify/page.tsx`, `src/app/startup/[slug]/edit/page.tsx` | Redirects unauthenticated page views to `/submit?next=...` instead of lock screens |
| Google OAuth redirect parameters | `src/app/submit/page.tsx` | Extracts `next` query parameter and forwards to Google OAuth callback to return users to their original routes |

**OAuth entry points:** Navbar, homepage CTA, `/submit`, `/admin`, verify page — all redirect through `/auth/callback?next=...`.

**Deploy requirement:** Add `https://<domain>/auth/callback` to Supabase Auth redirect URLs; set `NEXT_PUBLIC_SITE_URL`.

---

### 1.2 Onboarding & startup creation

| Feature | Path | Notes |
|---------|------|-------|
| Multi-step submit form | `src/app/submit/page.tsx` | Steps: founder → startup → verification method → location |
| Authenticated POST | `src/app/api/startup-submissions/route.ts` | Requires `getAuthenticatedUser()`; validates payload |
| Post-submit redirect | `submit/page.tsx` | On success → `/startup/{slug}/verify` (returns `startup_id` + `slug`) |
| Proof upload | `submit/page.tsx` | Supabase Storage `proofs` bucket; strictly required when method = proof |
| One-off API verify (submit) | `src/app/api/verify/one-off/route.ts` | Pre-submit Stripe/Razorpay key check (auth required) |
| Slug generation | `startup-submissions/route.ts` | `slugify(name)-random`; retries on unique violation (5 attempts) |
| Public listing GET | `startup-submissions/route.ts` | **Allowlisted columns only** — strips `email` and `name` from public response to protect PII |
| DB alignment | `supabase/migrations/20260520000000_submission_fields.sql` | `proof_url`, `verified_revenue`, `verification_source`, `notes` |
| Insert fields | `startup-submissions/route.ts` | Uses `trust_score`, `confidence` (type-aligned to actual DB schema, deprecating legacy properties) |

**Verification methods on submit:** `manual`, `social`, `proof`, `api`.

---

### 1.3 Payment connection & sync

| Provider | Connect / verify | Sync | Webhook |
|----------|------------------|------|---------|
| **Stripe** | `src/lib/stripe-connect.ts`, `/api/stripe/connect`, `/api/stripe/callback` | `src/lib/stripe-sync.ts`, `/api/sync/stripe`, `/api/stripe/verify` | `/api/stripe/webhook` |
| **Razorpay** | Manual keys on verify flow | `src/lib/razorpay-sync.ts`, `/api/sync/razorpay`, `/api/razorpay/verify` | `/api/razorpay/webhook` |

**Founder verification UI:** `src/components/startup/FounderVerificationFlow.tsx` on `/startup/[slug]/verify` — manual Stripe secret key or Razorpay key pair → `POST /api/sync/stripe` or `/api/sync/razorpay` → overview → auto-redirect to public profile.

**Stripe Connect OAuth:** Implemented server-side (`/api/stripe/connect`, `/api/stripe/callback`). Callback errors redirect to verify/submit (not JSON 400). Supports fetching last 30-day transactions using the platform client via `stripeAccount: stripeAccountId` (Connect Client ID mode).

**Credential storage:** AES-256-CTR with dynamically hashed random IV vectors in `src/lib/encryption.ts`; `provider_connections` table. Includes automatic fallback decryptors for legacy static IVs.

**Razorpay webhooks:** Require `notes.startup_id` on payments (no "latest connection" fallback).

**Plan-gated sync:** Manual sync via `/api/verify/revenue` enforces subscription check — `viewer` plan users are blocked from triggering sync (403).

---

### 1.4 Verification engine (data-derived trust)

| Module | Path | Role |
|--------|------|------|
| Tier resolution | `src/lib/verification-state.ts` | **3 public tiers** (see below) |
| Confidence score | `src/lib/verification-confidence.ts` | 0–100 from transactions, sync, consistency, fraud |
| Consistency | `src/lib/revenue-consistency.ts` | Pattern analysis on transaction history |
| Trust score | `src/lib/scoring.ts` | Deterministic 0–100 with fraud penalties |
| Batch compute | `src/lib/verification-data.ts` | Leaderboard / profile batch state |
| Tier labels (UI) | `src/lib/verification-config.ts` | `TrustBadge` copy and colors |

**Public confidence tiers:**

| Tier | Criteria (observable data only) |
|------|--------------------------------|
| `SELF_REPORTED` | No connected payment provider, or manual/social-only submission |
| `PAYMENT_CONNECTED` | Provider linked; pending sync, insufficient history, or stale data |
| `REVENUE_VERIFIED` | Provider linked + ≥3 transactions + revenue > 0 + synced within last 7 days |

**Removed / deprecated:** Simulated synthetic `HIGH_CONFIDENCE` tier, hardcoded priorities, and arbitrary `verification_type === "api"` default score boosters.

**Evidence-gated "verified" UI:** `hasVerificationEvidence` is true **only** for `REVENUE_VERIFIED`. All public badges, leaderboards, shares, embeds, and meta tags gate their "Verified" visual claims behind this evidence-based flag.

**Trust metadata surfaced in UI:**
- Data source (`dataSourceLabel` from actual active connection state)
- Last sync (`lastSyncAt`, `formatLastSyncRelative`)
- Verification method (`verificationMethodLabel` mapping type of submission)
- Verification confidence (`verificationConfidence` %)
- Detailed provider contribution breakdown (dynamic percentages and raw MRR values)

**Components:** `VerificationMetadata.tsx`, `FreshnessIndicator.tsx`, `VerificationTransparencyCard.tsx`, `RevenueConsistencyCard.tsx`, `RevenueCompositionCard.tsx`.

**Demo / sandbox:** Profiles with `user_id` prefix `00000000-0000-0000-0000-` forced to `SELF_REPORTED` fallback results; `TrustBadge` shows "Sample Data" to distinguish from live customer accounts.

---

### 1.5 Public profile, sharing & embeds

| Feature | Path | Notes |
|---------|------|-------|
| Public profile | `src/app/startup/[slug]/page.tsx` | Server-rendered; slug decode; unified `computeVerificationState` |
| Founder verify | `src/app/startup/[slug]/verify/page.tsx` | Ownership check; `FounderVerificationFlow` |
| Owner overview API | `src/app/api/startup/[id]/overview/route.ts` | **Auth + ownership**; returns `verification` + `authenticity` for post-sync UI |
| Share | `src/components/startup/ShareVerificationButton.tsx` | Copy, X, LinkedIn; tier-aware dynamic share copy |
| Badge SVG | `src/app/api/badge/[slug]/route.ts` | Tier label from database-backed `confidenceTier` |
| OG image | `src/app/api/og/startup/[slug]/route.tsx` | Edge-runtime dynamic OG card rendering evidence-gated badge |
| Badge embed | `src/components/startup/BadgeEmbedder.tsx` | Same-origin preview; absolute HTML URL via `getSiteUrl()` |
| Canonical URLs | `src/lib/site-url.ts` | Production uses **`NEXT_PUBLIC_SITE_URL` only** (no hardcoded domain) |

**Metadata:** OG/Twitter titles on profile only claim "Revenue Verified" when `hasVerificationEvidence` is true.

---

### 1.6 Protected Founder Dashboard

| Feature | Path | Notes |
|---------|------|-------|
| Protected Dashboard | `src/app/dashboard/page.tsx` | Secure route rendering all startups owned by the logged-in founder |
| Owned Startup Queries | `src/app/dashboard/page.tsx` | Dynamically fetches database listings for the authenticated `user_id` |
| Startup Operations Grid | `src/app/dashboard/page.tsx` | Provides quick links to manage credentials, sync connections, and view public pages |

---

### 1.7 Aggregation, webhooks & data layer

| System | Path | Notes |
|--------|------|-------|
| Unified MRR aggregation | `src/lib/revenue-aggregation.ts` | Normalizes and aggregates multi-currency provider revenues (Stripe USD to INR via static exchange rate `83.50`, Razorpay INR) |
| Provider currency display | `src/app/startup/[slug]/page.tsx` | Converts normalized database INR values back to provider-native currency (USD/INR) for public compositions display |
| Revenue snapshots / transactions | `revenue_snapshots`, `revenue_transactions` tables | Stores aggregated revenue history and granular payment events |
| Provider connections | `supabase/migrations/20240416000011_provider_connections.sql` | Stores connected provider meta, credentials, sync status, and `latest_revenue` (aligned from `last_mrr`) |
| Fraud signals | `src/lib/fraud.ts`, `fraud_signals` table | Analyzes anomalies and penalizes trust scores |
| Verification logs | `verification_logs` table | System audit trail logs |
| Rate limiting | `src/lib/rate-limit.ts` | In-memory API access limits (serverless caveat) |
| Safe client fetch | `src/lib/safe-network.ts` | Network request helper with 8s timeouts |

---

### 1.8 SaaS Subscription Billing (Razorpay)

| System | Path | Notes |
|--------|------|-------|
| Subscription plans table | `supabase/migrations/20260606000000_subscription_foundation.sql` | `subscription_plans` with Viewer/Founder/Pro tiers; monthly + annual cycles |
| Subscriptions table | `20260606000000_subscription_foundation.sql` | `subscriptions` table with `status` enum (`active`, `trialing`, `grace_period`, `past_due`, `cancelled`, `expired`); foreign key to `subscription_plans` |
| Feature access matrix | `20260606000000_subscription_foundation.sql` | `feature_access` table — decoupled plan→feature permissions (`verified_badge`, `csv_export`, `rest_api`, `privacy_toggle`, `advanced_filters`) |
| Subscription events audit | `20260606000000_subscription_foundation.sql` | `subscription_events` table + `billing_audit_logs` with DB trigger `trg_audit_subscriptions` |
| Active subscription uniqueness | `20260608000001_upi_plan_change.sql` | Partial unique index on `(user_id) WHERE status IN ('active','trialing','grace_period') AND replaces_razorpay_subscription_id IS NULL` |
| Billing webhook guard | `20260608000000_add_billing_webhook_guard_columns.sql` | `razorpay_plan_id`, `last_billing_event_at`, `last_billing_event_id` columns for deduplication and ordering |
| UPI plan change support | `20260608000001_upi_plan_change.sql` | `replaces_razorpay_subscription_id` column; relaxed unique index to allow replacement subs |
| RLS policies | `supabase/migrations/20260606000002_subscription_rls.sql` | Row-level security for subscriptions and related tables |
| Subscription lib | `src/lib/subscriptions.ts` | `getUserPlan()` (local DB read, free `viewer` fallback), `hasFeatureAccess()`, `enforcePlanAccess()` |
| Checkout API | `src/app/api/billing/checkout/route.ts` | Creates Razorpay subscription; auth + rate limiting; duplicate subscription guard |
| Cancel API | `src/app/api/billing/cancel/route.ts` | Cancels at period end via Razorpay API; updates local status immediately |
| Change Plan API | `src/app/api/billing/change-plan/route.ts` | Handles upgrades, downgrades, and billing cycle changes; detects UPI/emandate payment methods and creates deferred replacement subscriptions; card subs update immediately with proration |
| Billing webhook | `src/app/api/billing/webhook/razorpay/route.ts` | HMAC-verified; handles `subscription.created/authenticated/activated/charged/halted/cancelled/completed/updated`; upserts to `subscriptions`; writes audit events; automatically cancels replaced subscriptions on activation |
| Pricing page | `src/app/pricing/page.tsx` | Server-rendered; fetches current user plan for state-aware CTA text |
| Pricing table | `src/components/billing/PricingTable.tsx` | Monthly/annual toggle; 3-tier card grid; checkout/change-plan/cancel flows; cancel confirmation modal |
| Upgrade modal | `src/components/billing/UpgradeModal.tsx` | Full-screen overlay reusing `PricingTable` in modal mode |
| Subscription status indicator | `src/components/billing/SubscriptionStatusIndicator.tsx` | Navbar badge showing plan, trial countdown, or payment failure state |
| Trial countdown banner | `src/components/billing/TrialCountdownBanner.tsx` | Page-level banner with days remaining in trial |
| Grace period warning | `src/components/billing/GracePeriodWarning.tsx` | Payment failure banner with CTA to update payment method |

**Pricing tiers (INR):**

| Plan | Monthly | Annual (20% off) | Trial |
|------|---------|-------------------|-------|
| Viewer | ₹0 (free forever) | ₹0 | — |
| Verified Founder | ₹599/mo | ₹5,748/yr (₹479/mo) | 14-day free trial |
| Pro | ₹1,799/mo | ₹17,268/yr (₹1,439/mo) | — |

**Razorpay plan ID mapping:** Configured via environment variables (`RAZORPAY_PLAN_FOUNDER_MONTHLY`, etc.) resolved at runtime in checkout, change-plan, and webhook routes.

**UPI/emandate plan change architecture:** Since Razorpay does not support `update()` on UPI/emandate subscriptions, the system creates a new subscription with `start_at` set to the current period end and `notes.replaces_subscription_id` pointing to the old subscription. The billing webhook handler automatically cancels the old subscription when the replacement activates.

**Webhook deduplication:** Uses `last_billing_event_id` and `last_billing_event_at` to reject duplicate and stale webhook events.

**Unpaid replacement guard:** Cancelled replacement subscriptions with `paid_count === 0` are transitioned to `expired` instead of `cancelled` to prevent accidental access grants.

---

### 1.9 Marketing & discovery pages

| Page | Path |
|------|------|
| Home | `src/app/page.tsx` |
| Leaderboard | `src/app/leaderboard/page.tsx` — uses `computeVerificationStatesForStartups` for evidence-gated row styling |
| Pricing | `src/app/pricing/page.tsx` — plan-aware pricing cards with checkout integration |
| Privacy | `src/app/privacy/page.tsx` |
| Terms | `src/app/terms/page.tsx` |
| Sitemap | `src/app/sitemap.ts` |
| Robots | `src/app/robots.ts` |
| Admin queue | `src/app/admin/page.tsx` — requires signed-in `isAdmin()` email validation; column filter limits PII leakage |

---

## 2. API route map

```
POST   /api/startup-submissions          Create listing (auth required)
GET    /api/startup-submissions          Public leaderboard fields (allowlisted fields only, no PII)
GET    /api/startup-submissions/count    Public count

POST   /api/verify/one-off               Pre-submit key verify (auth required)
POST   /api/verify/revenue               Unified revenue sync trigger (auth + ownership + plan check)
POST   /api/sync/stripe                  Manual key or resync (auth + ownership)
POST   /api/sync/razorpay                Manual keys or resync (auth + ownership)
GET    /api/stripe/connect               Start Stripe Connect OAuth
GET    /api/stripe/callback              OAuth callback → verify page
POST   /api/stripe/verify                Manual verify helper
POST   /api/stripe/webhook               Platform webhooks (verification)

POST   /api/razorpay/verify              Razorpay verify helper
POST   /api/razorpay/sync                Razorpay sync alias
POST   /api/razorpay/webhook             Razorpay webhooks — verification (HMAC verification)

POST   /api/billing/checkout             Create Razorpay subscription (auth + rate limit)
POST   /api/billing/cancel               Cancel subscription at period end (auth)
POST   /api/billing/change-plan          Upgrade/downgrade/cycle change (auth + UPI handling)
POST   /api/billing/webhook/razorpay     SaaS billing webhooks (HMAC verification, isolated from verification webhooks)

GET    /api/startup/[id]/overview        Owner-only dashboard aggregate
GET    /api/startup/[id]/connections     Provider connection summary
POST   /api/startup/[id]/sync            Multi-provider sync trigger
POST   /api/trust/calculate              Recalculate trust score

GET    /api/badge/[slug]                 SVG embed badge
GET    /api/og/startup/[slug]            Dynamic OG image (edge)

GET    /auth/callback                    Supabase OAuth session exchange
```

---

## 3. Completed implementation phases (historical + recent)

### Phase A — Core architecture ✅
Multi-provider `provider_connections`, `mrr_breakdown`, unified `revenue-aggregation.ts`, leaderboard sort by MRR/growth.

### Phase B — Data integrity ✅
Snapshot schema, growth calculation, trust scoring with penalties, dynamic encryption IVs, rate limits, unified fraud rules.

### Phase C — Product UI ✅
Revenue charts, provider status, tier badges, founder-centric profile layout.

### Phase D — SEO & copy ✅
Sitemap, robots, OG routes, premium copy pass (eliminated sci-fi cyberpunk terminology for clean Plaid-like tone), demo startup seeding.

### Phase E — Confidence-based trust (refined) ✅
- Migrated from binary "verified" to **3 data-derived tiers**.
- Internal anomaly flags (`PROVIDER_STALE`, `RATE_LIMIT_TRIGGERED`, etc.).
- `VerificationTransparencyCard`, `VerificationMetadata`, leaderboard/profile consumers updated.

### Phase F — Production integration fixes ✅
| # | Task | Files | Outcome |
|---|------|-------|---------|
| F1 | Fix profile/badge 404s | `site-url.ts`, `badge/[slug]/route.ts`, `BadgeEmbedder.tsx` | Slug decode; `metadataBase` from env; no error SVG fallback |
| F2 | Stripe Connect + sync module | `stripe-connect.ts`, `stripe-sync.ts`, connect/callback/verify routes | OAuth, manual sync, webhooks on platform client |
| F3 | Razorpay sync module | `razorpay-sync.ts`, verify/sync/webhook routes | Paginated 30-day captures; `startup_id` in webhook notes |
| F4 | Remove simulated verification | `verification-state.ts`, `verification.ts`, `FounderVerificationFlow.tsx` | Tiers and scores from pipeline data only |
| F5 | Trust transparency | `verification-state.ts`, `VerificationMetadata.tsx`, profile page | Source, sync, method, confidence; evidence-gated verified UI |

### Phase G — First-customer critical fixes ✅
| # | Task | Files | Outcome |
|---|------|-------|---------|
| G1 | Supabase SSR auth | `supabase.ts`, `middleware.ts`, `auth/callback/route.ts` | Cookie sessions work with API routes and server pages |
| G2 | OAuth redirect consistency | `oauth-redirect.ts`, Navbar, submit, page.tsx, verify | All flows use `/auth/callback?next=` |
| G3 | Onboarding redirect | `submit/page.tsx`, `startup-submissions/route.ts` | Success → `/startup/{slug}/verify`; returns `slug` + `startup_id` |
| G4 | API security | `startup-submissions` GET, `overview` route | No PII leak; overview owner-only with full verification payload |
| G5 | Insert schema alignment | `startup-submissions/route.ts`, migration `20260520000000_*` | `trust_score` / `confidence`; slug retry on duplicate constraints |
| G6 | Verify auth UX | `VerifyLoginPrompt.tsx`, `verify/page.tsx` | Sign-in on verify when logged out |
| G7 | Stripe callback UX | `stripe/callback/route.ts` | Errors redirect to verify/submit |
| G8 | Admin gate | `admin/page.tsx` | Requires `isAdmin()` session; limited select columns |
| G9 | Proof validation | `submit/page.tsx` | Proof file required when verification type = proof |

### Phase H — Authentication & Dashboard Integration ✅ (2026-05-31)
| # | Task | Files | Outcome |
|---|------|-------|---------|
| H1 | Navbar session dropdown | `Navbar.tsx` | Dynamic user profile visualization (emails + avatar) with structured access controls |
| H2 | Dynamic sign-out flow | `Navbar.tsx` | Implemented secure Supabase Auth signOut handler |
| H3 | Protected founder dashboard | `dashboard/page.tsx` | Created a protected route that maps database items precisely to owner `user_id` |
| H4 | Pre-emptive login guards | `page.tsx`, `Navbar.tsx` | Checked active Supabase sessions inside click handlers directly, preventing redundant Google redirect loops |
| H5 | Onboarding UX fixes | `submit/page.tsx`, `page.tsx` | Handled custom routing queries (`action=verify`) to return logged-in users straight to their startup configurations |

### Phase I — Database Alignment, Authentication Robustness & Currency Normalization ✅ (2026-06-02)
| # | Task | Files | Outcome |
|---|------|-------|---------|
| I1 | Fix database schema mismatch | `verification-data.ts`, `overview/route.ts` | Changed queries from deprecated/non-existent `last_mrr` to `latest_revenue` on `provider_connections` table |
| I2 | Build-time env resilience | `supabase.ts`, `auth-server.ts`, `supabase-server.ts` | Configured fallback placeholders to prevent Next.js build-time errors when env variables are not present |
| I3 | Auth routing & OAuth callback parameters | `verify/page.tsx`, `edit/page.tsx`, `submit/page.tsx` | Unauthenticated users redirect to `/submit?next=...` and get returned to their original destination after login |
| I4 | Multi-currency revenue normalization | `revenue-aggregation.ts` | Introduced static conversion factor (`USD_TO_INR = 83.50`) and normalized provider revenues to INR in database/scoring while tracking `originalRevenue`/`originalCurrency` |
| I5 | Public profile display currency | `startup/[slug]/page.tsx` | Decoupled normalized database currency from UI; converted breakdown displays back to native provider currencies (USD for Stripe) |

### Phase J — Branding Migration ✅ (2026-06-06)
Replaced all user-facing instances of "Verifi" with "Verifii" across the application while preserving backend references.

| # | Task | Files | Outcome |
|---|------|-------|---------|
| J1 | App-wide rebranding | Navbar, Footer, Page content, Meta tags | Updated "Verifi" to "Verifii" in all user-facing text, logos, terms of service, and privacy policy |
| J2 | Infrastructure preservation | API routes, DB schema, Env vars | Maintained original `verifi` references in database schemas, environment variables, API endpoints, and support email addresses |

### Phase K — SaaS Subscription Billing Architecture ✅ (2026-06-08)
Full Razorpay-powered subscription billing system for monetizing the Verifii platform itself.

| # | Task | Files | Outcome |
|---|------|-------|---------|
| K1 | Database foundation | `20260606000000_subscription_foundation.sql` | Created `subscription_plans`, `subscriptions`, `subscription_events`, `feature_access`, `billing_audit_logs` tables with triggers and indices |
| K2 | Subscription RLS | `20260606000002_subscription_rls.sql` | Row-level security policies for subscription tables |
| K3 | Revenue snapshot alignment | `20260606000001_alter_revenue_snapshots.sql` | Schema adjustments for revenue snapshot compatibility |
| K4 | Subscription library | `src/lib/subscriptions.ts` | `getUserPlan()` with free-tier fallback, `hasFeatureAccess()` for DB-driven feature gates, `enforcePlanAccess()` utility |
| K5 | Checkout API | `src/app/api/billing/checkout/route.ts` | Razorpay subscription creation with plan mapping, rate limiting, and duplicate subscription guard |
| K6 | Cancel API | `src/app/api/billing/cancel/route.ts` | End-of-period cancellation via Razorpay API with immediate local status update |
| K7 | Billing webhook handler | `src/app/api/billing/webhook/razorpay/route.ts` | HMAC-verified webhook for all subscription lifecycle events; upserts local state; writes audit trail |
| K8 | Pricing page & table | `src/app/pricing/page.tsx`, `src/components/billing/PricingTable.tsx` | Server-rendered pricing page; monthly/annual toggle; plan-aware CTAs; cancel confirmation modal |
| K9 | Billing UI components | `SubscriptionStatusIndicator.tsx`, `TrialCountdownBanner.tsx`, `GracePeriodWarning.tsx`, `UpgradeModal.tsx` | Navbar status badges, trial banners, payment failure warnings, and upgrade overlay |
| K10 | Plan-gated features | `src/app/api/verify/revenue/route.ts` | Manual sync blocked for `viewer` plan users (403); enforced via `getUserPlan()` |
| K11 | Razorpay env variables | `.env.local` | Fixed Razorpay environment variable naming for billing plan IDs |
| K12 | Razorpay status mapping | Webhook route | Correct mapping of Razorpay subscription statuses to local enum values |

### Phase L — UPI Plan Change & Webhook Hardening ✅ (2026-06-12)
Resolved critical issues with Razorpay subscription changes for UPI/emandate payment methods and hardened webhook processing.

| # | Task | Files | Outcome |
|---|------|-------|---------|
| L1 | UPI plan change architecture | `src/app/api/billing/change-plan/route.ts`, `20260608000001_upi_plan_change.sql` | Since Razorpay blocks `update()` on UPI subscriptions, implemented deferred replacement: creates new subscription with `start_at = current_period_end` and `notes.replaces_subscription_id` |
| L2 | Replace subscription column | `20260608000001_upi_plan_change.sql` | Added `replaces_razorpay_subscription_id` column; relaxed active-subscription unique index to exclude replacement rows |
| L3 | Webhook guard columns | `20260608000000_add_billing_webhook_guard_columns.sql` | Added `razorpay_plan_id`, `last_billing_event_at`, `last_billing_event_id` for event deduplication and chronological ordering |
| L4 | Webhook deduplication | `src/app/api/billing/webhook/razorpay/route.ts` | Rejects duplicate events by `event_id` match; rejects stale events by timestamp comparison |
| L5 | Auto-cancel replaced subscriptions | `src/app/api/billing/webhook/razorpay/route.ts` | On `subscription.activated` or `subscription.charged`, if `replaces_subscription_id` is present, cancels old subscription via Razorpay API and marks local record as cancelled |
| L6 | Unpaid replacement guard | `src/app/api/billing/webhook/razorpay/route.ts` | Cancelled replacement subscriptions with `paid_count === 0` transition to `expired` (not `cancelled`) to prevent false access grants |
| L7 | Cancelled subscription resume | `src/app/api/billing/change-plan/route.ts` | Allow plan changes for cancelled-but-unexpired subscriptions by querying them alongside active/trialing statuses |
| L8 | Pending change deduplication | `src/app/api/billing/change-plan/route.ts` | Prevents multiple pending replacement subscriptions by checking for existing `trialing` rows with non-null `replaces_razorpay_subscription_id` |
| L9 | `getUserPlan()` replacement-aware query | `src/lib/subscriptions.ts` | Authorization query excludes trialing subscriptions that have a `replaces_razorpay_subscription_id` (deferred replacements) to prevent premature plan upgrades |
| L10 | Subscription cancellation & free plan downgrade | `PricingTable.tsx`, `cancel/route.ts` | Viewer card acts as "Cancel Subscription" CTA with confirmation modal; cancel API sends Razorpay `cancel_at_cycle_end` |

---

## 4. Database schema additions (Phase K–L)

### `subscription_plans`
| Column | Type | Purpose |
|--------|------|---------|
| `plan_code` | text | `viewer` / `founder` / `pro` |
| `billing_cycle` | text | `monthly` / `annual` |
| `price_inr` | numeric | Price in INR |
| `features` | jsonb | Feature flags per plan |
| `is_active` | boolean | Active/retired flag |
| **Constraint** | UNIQUE | `(plan_code, billing_cycle)` |

### `subscriptions`
| Column | Type | Purpose |
|--------|------|---------|
| `user_id` | uuid | FK → `auth.users` |
| `plan_code` | text | Current plan |
| `billing_cycle` | text | `monthly` / `annual` |
| `status` | text | `active` / `trialing` / `grace_period` / `past_due` / `cancelled` / `expired` |
| `razorpay_subscription_id` | text | Razorpay sub ID (UNIQUE) |
| `razorpay_customer_id` | text | Razorpay customer ID |
| `razorpay_plan_id` | text | Razorpay plan ID for webhook resolution |
| `replaces_razorpay_subscription_id` | text | Points to old sub when this is a deferred replacement (UPI plan change) |
| `current_period_start` | timestamptz | Billing period start |
| `current_period_end` | timestamptz | Billing period end |
| `trial_start` | timestamptz | Trial start timestamp |
| `trial_end` | timestamptz | Trial end timestamp |
| `last_billing_event_at` | timestamptz | For stale event rejection |
| `last_billing_event_id` | text | For duplicate event rejection |

### `subscription_events`
Audit trail for all billing state changes — stores `event_type`, `previous_status`, `new_status`, `metadata` JSONB payload.

### `feature_access`
Decoupled plan→feature permissions — `(plan_code, feature_name, is_enabled)`.

### `billing_audit_logs`
Auto-populated via PostgreSQL trigger `trg_audit_subscriptions` on every INSERT/UPDATE/DELETE to `subscriptions`. Captures old/new row data and actor identity.

---

## 5. Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server anon client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side DB writes |
| `NEXT_PUBLIC_SITE_URL` | **Yes (prod)** | OAuth, OG, badges, sitemap, Stripe callback base |
| `ENCRYPTION_SECRET` | Yes | Provider credential encryption |
| `STRIPE_SECRET_KEY` | Yes | Stripe API + Connect token exchange |
| `STRIPE_CLIENT_ID` | For Connect OAuth | Stripe Connect app client ID |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signature (verification) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes | Server-side Razorpay client (billing + verification) |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay verification webhook HMAC |
| `RAZORPAY_BILLING_WEBHOOK_SECRET` | Yes | Razorpay billing webhook HMAC (separate from verification) |
| `RAZORPAY_PLAN_FOUNDER_MONTHLY` | Yes | Razorpay Plan ID for Founder monthly |
| `RAZORPAY_PLAN_FOUNDER_ANNUAL` | Yes | Razorpay Plan ID for Founder annual |
| `RAZORPAY_PLAN_PRO_MONTHLY` | Yes | Razorpay Plan ID for Pro monthly |
| `RAZORPAY_PLAN_PRO_ANNUAL` | Yes | Razorpay Plan ID for Pro annual |

**Supabase dashboard:** Enable Google provider; redirect URLs must include `/auth/callback` and `/submit` origins.

---

## 6. Known gaps & medium-priority backlog

| Area | Gap | Suggested next step |
|------|-----|---------------------|
| **Stripe Connect UI** | OAuth routes exist; founder flow uses manual keys only | Add "Connect with Stripe" on `FounderVerificationFlow`; handle `?stripe=` query params |
| **Payment methods** | Submit lists Cashfree/Paddle/Lemon Squeezy | Restrict UI to `stripe` / `razorpay` until implemented |
| **Legal** | Privacy/terms lack entity block, subprocessors, jurisdiction | Counsel review + submit-time terms checkbox |
| **Admin** | Client-side gate only; RLS still allows public SELECT on submissions | Server-side admin API; tighten RLS |
| **Connections API** | `GET /api/startup/[id]/connections` is public | Add ownership check or redact |
| **Rate limits** | In-memory per instance | Upstash/Redis for production |
| **Proof storage** | Public URLs possible | Private bucket + signed URLs |
| **`.env.example`** | Missing | Add documented template |
| **OG currency** | OG route may show ₹ for all | Use provider currency from breakdown |
| **Dead code** | `VerificationFlow.tsx` unused | Remove or consolidate |
| **Billing dashboard page** | `/dashboard/billing` not yet implemented | Build billing management page with plan details, cancel, and payment history |
| **Billing receipt emails** | No email notifications for billing events | Integrate transactional email for receipts, trial expiry reminders |
| **Razorpay checkout UX** | Checkout redirects to Razorpay hosted page | Consider Razorpay Checkout.js modal for in-app experience |
| **Webhook retry resilience** | Single-attempt handler | Add idempotency keys and retry-safe processing |

---

## 7. Future goals

1. **Stripe Connect as default** — Primary onboarding button; manual keys as fallback.
2. **Additional providers** — Paddle, Lemon Squeezy, Cashfree behind real sync implementations.
3. **Async verification jobs** — Long syncs via queue + polling (avoid 8s `safeFetch` timeout).
4. **Legal & compliance** — Entity disclosures, DPA/subprocessors, cookie consent if analytics added.
5. **Investor analytics** — Cohort views from `revenue_snapshots` history.
6. **Billing dashboard** — Dedicated `/dashboard/billing` page with subscription management, payment history, and invoices.
7. **Email notifications** — Transactional emails for trial expiry, payment failures, and subscription changes.

---

## 8. Build & deploy status

- **Compiler:** Next.js 16.2 (Turbopack) — `npm run build` succeeds.
- **Middleware:** Active (`ƒ Proxy` in build output).
- **Routes:** `/auth/callback` registered.
- **Dependencies:** `razorpay@2.9.6` added for server-side Razorpay SDK operations.

**Pre-launch checklist:**

1. Set all env vars (especially `NEXT_PUBLIC_SITE_URL` and all `RAZORPAY_PLAN_*` IDs).
2. Run Supabase migrations including `20260606000000_subscription_foundation.sql` through `20260608000001_upi_plan_change.sql`.
3. Configure Supabase Auth redirect URLs for production (and preview) origins.
4. Create `proofs` storage bucket with appropriate RLS.
5. Register Stripe/Razorpay **verification** webhooks pointing to `/api/stripe/webhook` and `/api/razorpay/webhook`.
6. Register Razorpay **billing** webhook pointing to `/api/billing/webhook/razorpay` with **separate** webhook secret.
7. Create Razorpay Plans in dashboard and set plan IDs in env vars.
8. E2E test: Google login → subscribe (Founder trial) → submit → verify (Stripe or Razorpay) → public profile → share.
9. E2E test: Plan change (Founder → Pro), cancel, and UPI replacement flow.

---

## 9. Linting & code quality (ongoing)

- [x] Confidence tier type-safety across profile, leaderboard, OG, badge.
- [x] Remove duplicate `supabase-client.ts` (merged into `src/lib/supabase.ts`).
- [x] Razorpay env variable naming alignment.
- [x] Razorpay subscription status mapping correctness.
- [ ] Remove unused imports (`VerificationTransparencyCard`, `sync.ts`, etc.).
- [ ] Replace `any` in provider integrations with typed payloads.
- [ ] Distributed rate limiting for production traffic.
- [ ] Remove unused `VerificationFlow.tsx` component.

---

*This document should be updated whenever a phase ships or a production audit changes behavior.*

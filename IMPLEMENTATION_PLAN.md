# Verifi — Implementation Plan

> **Last updated:** 2026-05-31  
> **Source of truth:** Reflects the **actual** codebase after production-readiness, trust-system, payment-integration, and first-customer audits.

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

**Razorpay webhooks:** Require `notes.startup_id` on payments (no “latest connection” fallback).

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

**Evidence-gated “verified” UI:** `hasVerificationEvidence` is true **only** for `REVENUE_VERIFIED`. All public badges, leaderboards, shares, embeds, and meta tags gate their "Verified" visual claims behind this evidence-based flag.

**Trust metadata surfaced in UI:**
- Data source (`dataSourceLabel` from actual active connection state)
- Last sync (`lastSyncAt`, `formatLastSyncRelative`)
- Verification method (`verificationMethodLabel` mapping type of submission)
- Verification confidence (`verificationConfidence` %)
- Detailed provider contribution breakdown (dynamic percentages and raw MRR values)

**Components:** `VerificationMetadata.tsx`, `FreshnessIndicator.tsx`, `VerificationTransparencyCard.tsx`, `RevenueConsistencyCard.tsx`, `RevenueCompositionCard.tsx`.

**Demo / sandbox:** Profiles with `user_id` prefix `00000000-0000-0000-0000-` forced to `SELF_REPORTED` fallback results; `TrustBadge` shows “Sample Data” to distinguish from live customer accounts.

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

**Metadata:** OG/Twitter titles on profile only claim “Revenue Verified” when `hasVerificationEvidence` is true.

---

### 1.6 Aggregation, webhooks & data layer

| System | Path |
|--------|------|
| Unified MRR aggregation | `src/lib/revenue-aggregation.ts` |
| Revenue snapshots / transactions | `revenue_snapshots`, `revenue_transactions` tables |
| Provider connections | `supabase/migrations/20240416000011_provider_connections.sql` |
| Fraud signals | `src/lib/fraud.ts`, `fraud_signals` table |
| Verification logs | `verification_logs` table |
| Rate limiting | `src/lib/rate-limit.ts` (in-memory; serverless caveat) |
| Safe client fetch | `src/lib/safe-network.ts` (8s timeout) |

---

### 1.7 Marketing & discovery pages

| Page | Path |
|------|------|
| Home | `src/app/page.tsx` |
| Leaderboard | `src/app/leaderboard/page.tsx` — uses `computeVerificationStatesForStartups` for evidence-gated row styling |
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
POST   /api/sync/stripe                  Manual key or resync (auth + ownership)
POST   /api/sync/razorpay                Manual keys or resync (auth + ownership)
GET    /api/stripe/connect               Start Stripe Connect OAuth
GET    /api/stripe/callback              OAuth callback → verify page
POST   /api/stripe/verify                Manual verify helper
POST   /api/stripe/webhook               Platform webhooks

POST   /api/razorpay/verify              Razorpay verify helper
POST   /api/razorpay/sync                Razorpay sync alias
POST   /api/razorpay/webhook             Razorpay webhooks (HMAC verification)

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
- Migrated from binary “verified” to **3 data-derived tiers**.
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

---

## 4. Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser + server anon client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side DB writes |
| `NEXT_PUBLIC_SITE_URL` | **Yes (prod)** | OAuth, OG, badges, sitemap, Stripe callback base |
| `ENCRYPTION_SECRET` | Yes | Provider credential encryption |
| `STRIPE_SECRET_KEY` | Yes | Stripe API + Connect token exchange |
| `STRIPE_CLIENT_ID` | For Connect OAuth | Stripe Connect app client ID |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signature |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | For Razorpay ops | Server-side Razorpay client |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay webhook HMAC |

**Supabase dashboard:** Enable Google provider; redirect URLs must include `/auth/callback` and `/submit` origins.

---

## 5. Known gaps & medium-priority backlog

| Area | Gap | Suggested next step |
|------|-----|---------------------|
| **Stripe Connect UI** | OAuth routes exist; founder flow uses manual keys only | Add “Connect with Stripe” on `FounderVerificationFlow`; handle `?stripe=` query params |
| **Payment methods** | Submit lists Cashfree/Paddle/Lemon Squeezy | Restrict UI to `stripe` / `razorpay` until implemented |
| **Legal** | Privacy/terms lack entity block, subprocessors, jurisdiction | Counsel review + submit-time terms checkbox |
| **Admin** | Client-side gate only; RLS still allows public SELECT on submissions | Server-side admin API; tighten RLS |
| **Connections API** | `GET /api/startup/[id]/connections` is public | Add ownership check or redact |
| **Rate limits** | In-memory per instance | Upstash/Redis for production |
| **Proof storage** | Public URLs possible | Private bucket + signed URLs |
| **Logout** | No `signOut` in Navbar | Add sign-out control |
| **`.env.example`** | Missing | Add documented template |
| **OG currency** | OG route may show ₹ for all | Use provider currency from breakdown |
| **Dead code** | `VerificationFlow.tsx` unused | Remove or consolidate |

---

## 6. Future goals

1. **Stripe Connect as default** — Primary onboarding button; manual keys as fallback.
2. **Additional providers** — Paddle, Lemon Squeezy, Cashfree behind real sync implementations.
3. **Async verification jobs** — Long syncs via queue + polling (avoid 8s `safeFetch` timeout).
4. **Legal & compliance** — Entity disclosures, DPA/subprocessors, cookie consent if analytics added.
5. **Investor analytics** — Cohort views from `revenue_snapshots` history.

---

## 7. Build & deploy status

- **Compiler:** Next.js 16.2 (Turbopack) — `npm run build` succeeds.
- **Middleware:** Active (`ƒ Proxy` in build output).
- **Routes:** `/auth/callback` registered.

**Pre-launch checklist:**

1. Set all env vars (especially `NEXT_PUBLIC_SITE_URL`).
2. Run Supabase migrations including `20260520000000_submission_fields.sql`.
3. Configure Supabase Auth redirect URLs for production (and preview) origins.
4. Create `proofs` storage bucket with appropriate RLS.
5. Register Stripe/Razorpay webhooks pointing to production URLs.
6. E2E test: Google login → submit → verify (Stripe or Razorpay) → public profile → share.

---

## 8. Linting & code quality (ongoing)

- [x] Confidence tier type-safety across profile, leaderboard, OG, badge.
- [x] Remove duplicate `supabase-client.ts` (merged into `src/lib/supabase.ts`).
- [x] Escape unescaped entities in JSX files (resolved `react/no-unescaped-entities` error in `privacy/page.tsx`).
- [ ] Remove unused imports (`VerificationTransparencyCard`, `sync.ts`, etc.).
- [ ] Replace `any` in provider integrations with typed payloads.
- [ ] Distributed rate limiting for production traffic.

---

*This document should be updated whenever a phase ships or a production audit changes behavior.*

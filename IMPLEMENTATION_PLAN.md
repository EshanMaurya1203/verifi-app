# Verifi Implementation Plan

Track progress by checking each item.

## Phase 1 — Add Startup Form

- [x] **Create form route shell**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Page scaffold with `"use client"`, import `Navbar`, dark background, centered card layout.
  - **Expected outcome:** `/submit` route opens with branded structure.

- [x] **Define typed form state**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** `FormState` type + `useState` for all required fields.
  - **Expected outcome:** Controlled form state ready to bind inputs.

- [x] **Build Section 1: About you**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Full name, email, startup/business name, website inputs with shared styles.
  - **Expected outcome:** First section fully interactive.

- [x] **Build Section 2: Your business**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Business type select + MRR and ARR inputs.
  - **Expected outcome:** Business metrics captured.

- [x] **Build Section 3: Payment methods**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** API-verified method grid (Razorpay, Stripe, Cashfree, Paddle, Lemon Squeezy) with checked styling.
  - **Expected outcome:** At least one method can be selected.

- [x] **Build Section 4 + 5**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Social fields, city/country, notes textarea.
  - **Expected outcome:** Full form UI complete.

- [x] **Add validation and inline errors**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Required field checks + payment method minimum, red borders, field-level messages.
  - **Expected outcome:** Invalid submit blocked with clear guidance.

- [x] **Add loading/error/success submit states**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Submit spinner, error banner, success panel with member slot display.
  - **Expected outcome:** Complete UX for submit lifecycle.

- [x] **Wire all startup CTAs to submit page**
  - **Files:** `src/app/page.tsx`, `src/components/layout/Navbar.tsx`
  - **Write:** Set startup CTA links to `href="/submit"`.
  - **Expected outcome:** All primary CTAs land on submit flow.

## Phase 2 — Supabase Integration

- [x] **Create Supabase client**
  - **File:** `src/lib/supabase.ts`
  - **Write:** `createClient` with env checks for URL and anon key.
  - **Expected outcome:** Reusable Supabase client import across app.

- [x] **Set environment variables**
  - **File:** `.env.local`
  - **Write:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - **Expected outcome:** Local app can connect to Supabase.

- [x] **Add temporary waitlist POST API**
  - **File:** `src/app/api/startup-submissions/route.ts`
  - **Write:** Accept payload, log data, return `{ success: true, slot_number: 27 }`.
  - **Expected outcome:** Frontend submit works without DB yet.

- [x] **Add temporary waitlist count API**
  - **File:** `src/app/api/startup-submissions/count/route.ts`
  - **Write:** Return `{ count: 26 }`.
  - **Expected outcome:** Frontend can render dynamic claimed count.

- [x] **Connect submit page to waitlist APIs**
  - **File:** `src/app/submit/page.tsx`
  - **Write:** Fetch count on mount; submit mapped payload to `/api/startup-submissions`.
  - **Expected outcome:** Live count + API-backed submit.

- [x] **Switch POST API to Supabase insert**
  - **File:** `src/app/api/startup-submissions/route.ts`
  - **Write:** Insert into `startup_submissions`; return created slot/id.
  - **Expected outcome:** Submissions persist to DB.

- [x] **Switch count API to Supabase query**
  - **File:** `src/app/api/startup-submissions/count/route.ts`
  - **Write:** Query total rows and return real count.
  - **Expected outcome:** Claimed spots bar reflects real data.

- [x] **Add server-side payload guardrails**
  - **File:** `src/app/api/startup-submissions/route.ts`
  - **Write:** Validate required fields and allowlist payment methods.
  - **Expected outcome:** Invalid submissions rejected safely.

## Phase 3 — Leaderboard Page

- [x] **Create leaderboard route shell**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Client page scaffold, import `Navbar`, header section.
  - **Expected outcome:** `/leaderboard` route available.

- [x] **Implement filter + sort logic**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** `useState` + `useMemo` for category/country filtering and metric sorting.
  - **Expected outcome:** Rows update correctly with user selection.

- [x] **Render styled leaderboard rows**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Rank colors, startup meta, verification badge, founder, MRR, growth arrows.
  - **Expected outcome:** Production-style leaderboard table complete.

## Phase 4 — Startup Detail & Trust Dashboard

- [x] **Implement Dynamic Routing**
  - **File:** `src/app/startup/[id]/page.tsx`
  - **Write:** Server-side data fetching with Supabase service role.
  - **Expected outcome:** Each startup has a unique, SEO-friendly detail page.

- [x] **Build Profile Strength System**
  - **File:** `src/components/startup/VerificationFlow.tsx`
  - **Write:** Circular progress meter + strength categorization (Weak/Moderate/Strong).
  - **Expected outcome:** Gamified feedback loop for data completeness.

- [x] **Modular Verification Flow**
  - **File:** `src/components/startup/VerificationFlow.tsx`
  - **Write:** Focus modals for Website, KYC, and PaymentGateways.
  - **Expected outcome:** Founders can verify incrementally without full form resubmission.

## Phase 5 — Payment Gateway Integrations

- [x] **Stripe Connect Integration**
  - **File:** `src/app/api/stripe/connect/route.ts`
  - **Write:** Secure Express account creation and onboarding link generation.
  - **Expected outcome:** Founders can link real payment data for revenue verification.

- [x] **Razorpay Verification Flow**
  - **File:** `src/app/api/razorpay/create-account/route.ts`
  - **Write:** Contact creation API for identity-linking in the Razorpay ecosystem.
  - **Expected outcome:** Alternative verification path for regional markets.

## Optional Next

- [x] Add real-time revenue syncing (Stripe Webhooks)
  - **File:** `src/app/api/stripe/webhook/route.ts`
  - **Write:** Webhook handler for `account.updated` to automate verification tagging.
  - **Expected outcome:** Status updates automatically when onboarding completes.
- [x] Add founder video verification step
  - **File:** `src/components/startup/VerificationFlow.tsx`
  - **Write:** Video link input modal and trust score logic (+30 points).
  - **Expected outcome:** Founders can link a video explanation for higher trust.
- [x] Implement automated fraud detection (anomaly detection in revenue patterns)
  - **File:** `src/lib/fraud-detection.ts`, `src/app/api/startup-submissions/route.ts`
  - **Write:** Logic to flag MRR/ARR inconsistencies and high-risk manual entries.
  - **Expected outcome:** Submissions are automatically categorized by risk level.

## Phase 6 — Automated Revenue Audits & Security

- [x] **Secure Credential Storage**
  - **File:** `src/lib/encryption.ts`
  - **Write:** AES-256-CTR encryption/decryption utilities.
  - **Expected outcome:** sensitive API keys are never stored in raw text.

- [x] **Razorpay Verification Overhaul**
  - **File:** `src/app/api/razorpay/verify/route.ts`
  - **Write:** Credential testing + encrypted persistence logic.
  - **Expected outcome:** Immediate feedback on API key validity.

- [x] **Automated Revenue Sync (Cron)**
  - **File:** `src/app/api/cron/sync-revenue/route.ts`
  - **Write:** Idempotent snapshot fetcher with `upsert` logic.
  - **Expected outcome:** Daily/Hourly revenue updates without user intervention.

- [x] **Deterministic Trust Scoring**
  - **File:** `src/lib/trust.ts`
  - **Write:** Backend scoring engine (Payments: +50, Consensus: +20, Consistency: +20).
  - **Expected outcome:** Trust scores that can't be "gamed".

- [x] **Leaderboard UX Restoration**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Unfiltered sorting by `trust_score` + "Connected" status badges.
  - **Expected outcome:** Accurate, high-performance leaderboard rendering.

## Phase 7 — Forensic Integrity & Anomaly Detection

- [x] **Fraud Signal Schema**
  - **File:** `supabase/migrations/20240416000004_fraud_detection.sql`
  - **Write:** Severity-based anomaly tracking table (`fraud_signals`).
  - **Expected outcome:** Database ready to store suspicious patterns.

- [x] **Anomaly Detection Engine**
  - **File:** `src/lib/fraud.ts`
  - **Write:** Detection rules for Revenue Spikes, Sudden Drops, and Micro-transaction Spam.
  - **Expected outcome:** Automated identification of "gaming" attempts.

- [x] **Integrity Penalty System**
  - **File:** `src/lib/scoring.ts`
  - **Write:** Dynamic score deduction based on fraud severity (Up to -40 points).
  - **Expected outcome:** "Flagged" status for high-risk profiles.

- [x] **Diagnostic UI & Hardening**
  - **Files:** `src/app/startup/[id]/page.tsx`, `src/app/leaderboard/page.tsx`
  - **Write:** High-visibility fraud banners + Leaderboard filtering for flagged accounts.
  - **Expected outcome:** Clean, trusted platform experience.

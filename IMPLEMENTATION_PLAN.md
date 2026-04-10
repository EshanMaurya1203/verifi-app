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

- [x] **Add typed mock dataset**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Startup row type and seed list for rendering.
  - **Expected outcome:** Table has stable source data.

- [x] **Build filter controls**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Sort/category/country selects with dark custom styles.
  - **Expected outcome:** Controls visible and interactive.

- [x] **Implement filter + sort logic**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** `useState` + `useMemo` for category/country filtering and metric sorting.
  - **Expected outcome:** Rows update correctly with user selection.

- [x] **Render styled leaderboard rows**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Rank colors, startup meta, verification badge, founder, MRR, growth arrows.
  - **Expected outcome:** Production-style leaderboard table complete.

- [x] **Add responsive behavior**
  - **File:** `src/app/leaderboard/page.tsx`
  - **Write:** Mobile-friendly layout/scroll handling for table columns.
  - **Expected outcome:** Leaderboard usable on small screens.

- [x] **Move leaderboard to Supabase data**
  - **File:** `src/app/leaderboard/page.tsx` (or `src/app/api/leaderboard/route.ts`)
  - **Write:** Fetch verified startup rows from Supabase and map to UI.
  - **Expected outcome:** Live leaderboard backed by database.

## Optional Next

- [ ] Add Google OAuth gate before submit (`/submit`)
- [ ] Add payment provider API key connection step post-login
- [ ] Add admin moderation queue for verification review

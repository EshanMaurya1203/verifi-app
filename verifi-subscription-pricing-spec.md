# Verifi — Subscription Pricing Specification

> This document is a complete specification of the Verifi subscription pricing model, verification flow, plan features, and copy. Use it to generate a prompt for an AI IDE (Lovable, Cursor, v0, etc.) to implement this subscription system end-to-end.

---

## Platform overview

**Verifi** is a verified startup revenue database for Indian SaaS founders and indie hackers. The core concept: MRR, ARR, and MoM growth are pulled automatically from a founder's payment processor (Stripe or Razorpay) via read-only OAuth — not self-reported. This makes the data trustworthy and the verified badge meaningful.

**Live URL:** verifi-app-n3h8.vercel.app  
**Stack:** Next.js 15, Supabase, Tailwind CSS, Shadcn UI, Razorpay (for Verifi's own subscriptions)

---

## Core concept: payment processor verification

- Founder connects Stripe or Razorpay via **read-only OAuth**
- Verifi pulls: **MRR**, **ARR**, **MoM growth**
- Data auto-syncs on the **1st of every month**
- Verifi never stores card data, never initiates charges
- If a founder connects both Stripe + Razorpay, revenue is **merged and normalised to INR**
- If a founder disconnects, profile is marked **"last verified [date]"** but stays visible

---

## Pricing tiers

### Billing modes
- **Monthly** (default)
- **Annual** — 20% discount, shown as exact rupee savings

---

### Tier 1 — Viewer (Free)

| Field | Value |
|---|---|
| Price | ₹0 / forever |
| Target user | Anyone browsing Indian founder revenue data |
| Processor required | No |

**What they can do:**
- Browse all verified entries
- See MRR, ARR, and MoM growth for every founder
- View city and category leaderboards
- View founder profile pages

**What they cannot do:**
- Submit their own revenue
- Get a verified badge
- Export data or use the API

**CTA copy:** `Explore free`

---

### Tier 2 — Verified Founder (Core plan)

| Field | Value |
|---|---|
| Monthly price | ₹599/month |
| Annual price | ₹479/month (₹5,748/yr — save ₹1,440) |
| Target user | Indian SaaS founders and indie hackers |
| Processor required | Yes — Stripe or Razorpay (or both) |

**Auto-pulled from processor:**
- Live MRR — synced monthly
- ARR — calculated automatically
- MoM growth — auto updated
- 12-month MRR history chart on profile

**Credibility features:**
- Verified badge embed (HTML snippet, embeddable on any site)
- Public founder profile page
- Leaderboard ranking and city rank
- "Verified via Stripe / Verified via Razorpay" label on profile

**Not included:**
- No CSV export
- No API access

**CTA copy:** `Connect & get verified`

**Privacy toggle:** Founder can choose to show a revenue range (e.g. ₹5L–₹10L/mo) instead of the exact MRR figure. Badge still shows as verified.

---

### Tier 3 — Pro

| Field | Value |
|---|---|
| Monthly price | ₹1,799/month |
| Annual price | ₹1,439/month (₹17,268/yr — save ₹4,320) |
| Target user | Investors, VCs, accelerators, researchers, journalists |
| Processor required | No — pure data access tier |

**Everything in Verified Founder, plus:**
- CSV export of full dataset
- REST API with JSON responses
- Filter by city, category, processor
- 24-month historical snapshots
- Valuation comparable data
- Webhook alerts on MRR milestones
- Team seats — up to 3 users

**CTA copy:** `Get Pro access`

---

## Verification flow (UX steps)

| Step | Label | Subtitle |
|---|---|---|
| 1 | Sign up | Create your account |
| 2 | Connect processor | OAuth read-only |
| 3 | Verifi pulls data | MRR, ARR, MoM |
| 4 | Badge goes live | Embed on your site |
| 5 | Auto-syncs | Every 1st of month |

---

## Common founder concerns (FAQ for pricing page)

### "Is my revenue data safe?"
Read-only OAuth — Verifi can only read transaction totals. We never see card details, customer PII, or initiate any charges.

### "Can I disconnect anytime?"
Yes. Disconnect from your settings and your data stops syncing instantly. Your profile stays but is marked "last verified [date]".

### "I use both Stripe and Razorpay."
Connect both. Verifi normalises all revenue to INR and shows a combined MRR with a breakdown by processor on your profile.

### "Can I hide my exact MRR?"
Yes — toggle to show a revenue range (e.g. ₹5L–₹10L/mo) instead of the exact figure. Badge still shows as verified.

---

## Pricing page copy

**Hero headline:** Revenue you can trust.

**Hero subheadline:** MRR, ARR and MoM growth pulled directly from Stripe or Razorpay — not self-reported.

**Viewer plan tagline:** Browse verified revenue data. No account needed.

**Verified Founder plan tagline:** Connect your processor. Get verified. Show the world.

**Pro plan tagline:** Full data access. For investors, researchers & funds.

---

## Database schema requirements (Supabase)

### `subscriptions` table
```sql
id uuid primary key
user_id uuid references auth.users
plan text -- 'viewer' | 'founder' | 'pro'
billing_cycle text -- 'monthly' | 'annual'
status text -- 'active' | 'cancelled' | 'past_due'
razorpay_subscription_id text
current_period_start timestamptz
current_period_end timestamptz
created_at timestamptz default now()
```

### `processor_connections` table
```sql
id uuid primary key
user_id uuid references auth.users
processor text -- 'stripe' | 'razorpay'
access_token text -- encrypted
scope text -- read-only
connected_at timestamptz
last_synced_at timestamptz
status text -- 'active' | 'disconnected'
```

### `revenue_snapshots` table
```sql
id uuid primary key
user_id uuid references auth.users
processor text
mrr_inr numeric
arr_inr numeric
mom_growth_pct numeric
snapshot_date date
created_at timestamptz default now()
```

### `founder_profiles` table
```sql
id uuid primary key
user_id uuid references auth.users
display_name text
product_name text
category text
city text
show_exact_mrr boolean default true
badge_public boolean default true
last_verified_at timestamptz
```

---

## Key business logic to implement

1. **OAuth connect flow** — Stripe OAuth and Razorpay OAuth, both read-only scopes, stored encrypted in Supabase
2. **Monthly sync job** — cron on 1st of every month, pulls MRR from connected processors, writes to `revenue_snapshots`, recalculates ARR and MoM, updates founder profile
3. **MRR calculation** — sum of active subscription charges in the last 30 days, normalised to INR using a fixed or live exchange rate
4. **MoM growth** — `((current_MRR - previous_MRR) / previous_MRR) * 100`
5. **ARR** — `current_MRR * 12`
6. **Multi-processor merge** — if founder has both Stripe + Razorpay, sum MRR from both after INR normalisation
7. **Badge embed** — public HTML snippet that fetches live MRR from a public Verifi endpoint and renders it as a verified badge
8. **Privacy toggle** — if `show_exact_mrr = false`, public profile shows revenue band (₹1L–₹5L, ₹5L–₹10L, ₹10L–₹25L, ₹25L–₹50L, ₹50L+) instead of exact figure
9. **Disconnect handling** — revoke OAuth token, set `status = disconnected`, show "last verified [date]" on public profile
10. **Plan gating** — Viewer can read all public data; Founder requires active subscription + connected processor; Pro requires active subscription, no processor needed
11. **Webhook alerts (Pro)** — fire webhook when a followed founder crosses a MRR milestone (₹1L, ₹5L, ₹10L, ₹25L, ₹50L, ₹1Cr)

---

## Razorpay subscription plan IDs to create

| Plan | Billing | Amount | Interval |
|---|---|---|---|
| Verified Founder Monthly | monthly | ₹599 | 1 month |
| Verified Founder Annual | annual | ₹5,748 | 12 months |
| Pro Monthly | monthly | ₹1,799 | 1 month |
| Pro Annual | annual | ₹17,268 | 12 months |

---

## API endpoints needed

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/founders` | List all verified founders (public) | None |
| GET | `/api/founders/[id]` | Single founder profile + MRR history | None |
| POST | `/api/connect/stripe` | Initiate Stripe OAuth | Founder |
| POST | `/api/connect/razorpay` | Initiate Razorpay OAuth | Founder |
| DELETE | `/api/connect/[processor]` | Disconnect processor | Founder |
| GET | `/api/sync` | Manually trigger MRR sync | Founder |
| GET | `/api/badge/[id]` | Public badge data endpoint | None |
| GET | `/api/export` | CSV export of full dataset | Pro |
| GET | `/api/v1/founders` | REST API for Pro subscribers | Pro |
| POST | `/api/webhooks/razorpay` | Razorpay subscription webhook | System |

---

## Notes for prompt generation

- The stack is **Next.js 15 (App Router)**, **Supabase** (auth + database + storage), **Tailwind CSS**, **Shadcn UI**
- Subscriptions are handled via **Razorpay Subscriptions** (not Stripe — Razorpay for Verifi's own billing)
- OAuth connections to **Stripe** and **Razorpay** are for reading the founder's revenue data
- Use **Supabase Row Level Security (RLS)** to gate plan features
- The cron job for monthly sync should be a **Supabase Edge Function** or a **Vercel Cron**
- Badge embed endpoint must be **public, CORS-enabled, and fast** (it loads on other people's websites)
- All currency display should be in **Indian number format** (₹1,23,456 not ₹123,456)

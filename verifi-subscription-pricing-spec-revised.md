# Verifi — Subscription Pricing & Architecture Specification (Revised)

> This document is a complete specification of the Verifi subscription pricing model, verification flow, plan features, architecture, and database requirements. Use it to implement the subscription system end-to-end.

---

## 1. Platform Overview

**Verifi** is a verified startup revenue database for Indian SaaS founders and indie hackers. The core concept: MRR, ARR, and MoM growth are pulled automatically from a founder's payment processor (Stripe or Razorpay) — not self-reported. This makes the data trustworthy and the verified badge meaningful.

**Live URL:** verifi-app-n3h8.vercel.app  
**Stack:** Next.js 15, Supabase, Tailwind CSS, Shadcn UI, Razorpay (for Verifi's own subscriptions)

---

## 2. Core Concept: Payment Processor Verification

- Founder connects **Stripe** via read-only OAuth or **Razorpay** via API Key + Secret.
- Verifi pulls: **MRR**, **ARR**, **MoM growth**.
- Data auto-syncs on the **1st of every month**.
- Verifi never stores card data, never initiates charges on the founder's processor.
- If a founder connects both Stripe + Razorpay, revenue is **merged and normalised to INR**.
- If a founder disconnects, profile is marked **"last verified [date]"** but stays visible.

---

## 3. Revised Pricing Tiers

### Billing Modes
- **Monthly** (default)
- **Annual** — 20% discount, shown as exact rupee savings.

### Tier 1 — Viewer (Free)
| Field | Value |
|---|---|
| Price | ₹0 / forever |
| Target user | Anyone browsing Indian founder revenue data |
| Processor required | No |

**Features:** Browse verified entries, view MRR/ARR/MoM, view leaderboards and founder profiles.
**Restrictions:** Cannot submit revenue, cannot get verified badge, no data exports or API access.

### Tier 2 — Verified Founder (Core Plan)
| Field | Value |
|---|---|
| **Trial** | **14-day free trial** |
| Monthly price | ₹599/month |
| Annual price | ₹479/month (₹5,748/yr) |
| Target user | Indian SaaS founders and indie hackers |
| Processor required | Yes — Stripe (OAuth) or Razorpay (API Keys) |

**Features:**
- Live MRR synced monthly, ARR and MoM growth calculated automatically.
- 12-month MRR history chart on profile.
- Verified badge embed (HTML snippet).
- Public founder profile page and leaderboard ranking.
- Privacy Toggle: Choose to show a revenue range (e.g., ₹5L–₹10L/mo) instead of exact MRR.

### Tier 3 — Pro
| Field | Value |
|---|---|
| Monthly price | ₹1,799/month |
| Annual price | ₹1,439/month (₹17,268/yr) |
| Target user | Investors, VCs, accelerators, researchers, journalists |
| Processor required | No |

**Pro Plan Behavior Without Processor:**
Pro users are not required to connect a payment processor to utilize the platform. Without a connected processor, they operate as a "pure data consumer," meaning they get unrestricted access to the Verifi dataset (CSV exports, API, advanced filters, historical snapshots) without having a public Verified Founder profile themselves.

**Features:** Everything in Verified Founder, plus CSV export, REST API, advanced filters, 24-month historical snapshots, valuation comparables, webhook alerts on MRR milestones, and team seats (up to 3 users).

---

## 4. Updated Architecture & Security

### Connection Flows & Encryption
- **Stripe:** Uses Read-Only OAuth.
- **Razorpay:** Uses API Key + Secret provided by the user.
- **AES-256-GCM Encryption:** All sensitive credentials must be strongly encrypted at rest using AES-256-GCM prior to database insertion. This explicitly includes:
  - Stripe refresh tokens
  - Razorpay secrets

### Sync Rate Limiting & Cooldown
- To prevent abuse and API rate limit exhaustion from upstream providers, manual sync triggers must enforce a strict **rate limit and cooldown period** (e.g., maximum 1 manual sync per 24 hours per startup).

---

## 5. Updated Business Rules

1. **MRR Calculation (REVISED):** Instead of calculating charges collected in the last 30 days, MRR is calculated as the **normalized monthly value of active subscriptions**. 
   - Example: A ₹12,000 annual subscription contributes ₹1,000 to the current MRR.
2. **MoM Growth Division-by-Zero:** The formula `((current_MRR - previous_MRR) / previous_MRR) * 100` must include fallback handling. If `previous_MRR` is 0 and `current_MRR` > 0, MoM growth should be defined explicitly (e.g., 100% or flagged as "New"). If both are 0, growth is 0%.
3. **ARR:** `current_MRR * 12`.
4. **Multi-processor merge:** Sum MRR from all connected processors after normalising to INR.
5. **Disconnect handling:** Revoke tokens/keys, set status to `disconnected`, update profile to "last verified [date]".
6. **14-day Founder Trial:** Verified Founder plan begins with a 14-day free trial before the first charge is captured.

---

## 6. Updated Database Requirements (Supabase)

### `subscriptions` table
*Note: Added `grace_period` to status.*
```sql
id uuid primary key
user_id uuid references auth.users
plan text -- 'viewer' | 'founder' | 'pro'
billing_cycle text -- 'monthly' | 'annual'
status text -- 'active' | 'cancelled' | 'past_due' | 'grace_period'
razorpay_subscription_id text
current_period_start timestamptz
current_period_end timestamptz
created_at timestamptz default now()
```

### `processor_connections` table
*Note: Must enforce AES-256-GCM encryption on token/secret columns.*
```sql
id uuid primary key
user_id uuid references auth.users
processor text -- 'stripe' | 'razorpay'
access_token text -- Encrypted AES-256-GCM (Stripe Refresh Token)
api_key text -- Razorpay Key ID
api_secret text -- Encrypted AES-256-GCM (Razorpay Secret)
scope text -- read-only
connected_at timestamptz
last_synced_at timestamptz
status text -- 'active' | 'disconnected'
```

### `revenue_snapshots` table
*Note: Enforce snapshot uniqueness.*
```sql
id uuid primary key
user_id uuid references auth.users
processor text
mrr_inr numeric
arr_inr numeric
mom_growth_pct numeric
snapshot_date date
created_at timestamptz default now()

-- UNIQUE CONSTRAINT required: (user_id, snapshot_date) to prevent duplicate snapshots in a given period.
```

---

## 7. Updated Webhook Requirements

The system must handle the following incoming webhook events from Razorpay (managing Verifi's own subscriptions):

*   `subscription.activated` — Triggered when a trial converts or a fresh subscription is paid. Provisions access.
*   `subscription.charged` — Triggered on successful recurring billing. Updates `current_period_end`.
*   `subscription.halted` — Triggered when retries are exhausted. Revokes access.
*   `subscription.cancelled` — Triggered when a user cancels. Access remains until `current_period_end`.
*   `payment.failed` — Triggered when a recurring payment fails. Transitions subscription status to `past_due` or `grace_period`.

---

## 8. API Endpoints

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | `/api/founders` | List all verified founders (public) | None |
| GET | `/api/founders/[id]` | Single founder profile + MRR history | None |
| POST | `/api/connect/stripe` | Initiate Stripe OAuth | Founder |
| POST | `/api/connect/razorpay` | Save Razorpay API Key + Secret | Founder |
| DELETE | `/api/connect/[processor]` | Disconnect processor | Founder |
| **POST** | `/api/sync` | Manually trigger MRR sync (w/ cooldown) | Founder |
| GET | `/api/badge/[id]` | Public badge data endpoint | None |
| GET | `/api/export` | CSV export of full dataset | Pro |
| GET | `/api/v1/founders` | REST API for Pro subscribers | Pro |
| POST | `/api/webhooks/razorpay` | Razorpay subscription webhook listener | System |

# Verifi – Project Context

## Overview
Verifi is a high-trust startup revenue verification platform that empowers founders to prove their credibility through automated audits and modular verification signals.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Modern Dark UI)
- **Backend:** Supabase (Auth, DB, Storage)
- **Integrations:** Stripe Connect, Razorpay API

## Core Features
- **Interactive Verification Flow:** Modular actions to link websites, verify identities (KYC), and connect payment sources.
- **Profile Strength System:** Gamified circular progress meter that maps verification depth to Weak, Moderate, or Strong status.
- **Dynamic Startup Rankings:** Leaderboard sorted by verified MRR and profile strength.
- **Modular Dashboard:** Individual startup pages served as a professional "Trust Profile" for investors.
- **Automated Trust Scoring:** Points-based system (+20 KYC, +50 Payments, +10 Website) that triggers real-time UI feedback.
- **Admin Moderation:** Panel for manual review of evidence and approval of "Verified" status.
- **Automated Revenue Audits:** Cron-based synchronization that pulls real transaction data and updates MRR/Trust scores.
- **End-to-End Encryption:** AES-256-CTR encryption for all third-party API keys stored in the database.
- **Forensic Integrity Suite:** AI-driven anomaly detection (Revenue spikes, micro-transaction spam) that automatically flags suspicious profiles.
- **Health Monitoring:** Detailed verification and fraud logs for administrative health tracking and data transparency.

## Database (Supabase)
Table: `public.startup_submissions`

New & Key Fields:
- `id`: BigInt (Primary Key)
- `startup_name`: Text
- `founder_name`: Text
- `website`: Text (Validated domain)
- `founder_linkedin`: Text (Social Signal)
- `founder_twitter`: Text (Social Signal)
- `mrr`: Numeric (Current Monthly Revenue)
- `verification_method`: Text (`api`, `razorpay`, `manual`, `proof`)
- `verification_status`: Text (`pending`, `approved`, `rejected`, `api_verified`)
- `trust_score`: Integer (0-100, deterministic)
- `mrr`: BigInt (Persistent verified MRR)
- `payment_connected`: Boolean (Live link status)
- `proof_url`: Text (Secure storage link)

Table: `public.payment_connections`
- `startup_id`: References startup_submissions
- `provider`: `razorpay` | `stripe`
- `access_token`: Encrypted secret key
- `account_id`: Public key ID

Table: `public.revenue_snapshots`
- `startup_id`: References startup_submissions
- `amount`: Transaction amount (Normalized currency)
- `external_id`: Unique provider-side ID
- `period_start/end`: Audit window tracking
- `created_at`: Sync timestamp

Table: `public.fraud_signals`
- `startup_id`: References startup_submissions
- `signal_type`: e.g., 'revenue_spike', 'micro_transactions'
- `severity`: 1-5 (Diagnostic weight)
- `metadata`: Pattern evidence (JSONB)

Table: `public.verification_logs`
- `startup_id`: Context
- `event`: e.g., 'razorpay_sync_success', 'fraud_detected'
- `metadata`: Telemetry

## Storage
- **Bucket:** `proofs`
- **Purpose:** Securely hosts manual revenue evidence (screenshots, PDFs).

## Primary API Routes
- `/api/startup-submissions` — Global submission handler.
- `/api/stripe/connect` — Initiates Stripe Express onboarding.
- `/api/razorpay/verify` — Validates and encrypts Razorpay credentials.
- `/api/verify/revenue` — Manual on-demand revenue refresh.
- `/api/cron/sync-revenue` — Background job for automated audits.
- `/api/admin/review` — Moderation endpoint.

## Verification Logic
Strength is calculated dynamically (`VerificationFlow.tsx`):
1. **Revenue Proof (+20)** — Uploaded document.
2. **Website (+10)** — Live, non-email domain.
3. **Identity (+20)** — Founder name and linked socials (+10 LinkedIn, +5 X).
4. **Payments (+50)** — Linked Stripe/Razorpay account.

## Current State
- ✅ Responsive Startup Submission
- ✅ Interactive Trust Dashboard
- ✅ Profile Strength Meter (0-100%)
- ✅ Stripe/Razorpay Connect Flows
- ✅ Social Signal Integration
- ✅ Mobile-Optimized Leaderboard
- ✅ Real-time DB Sync for Progress
- ✅ Razorpay Credential Verification & Encryption
- ✅ Automated Revenue Snapshot Syncing (Cron)
- ✅ Deterministic Trust Scoring Engine
- ✅ Multi-tier Leaderboard Status Badges
- ✅ Revenue Anomaly & Fraud Detection Engine
- ✅ Automated Status Flagging (Verified/Pending/Flagged)
- ✅ Public Transparency Banners for Suspicious Profiles

## Goal
Establish Verifi as the gold standard for startup proof-of-work, moving from "Self-Reported" to "Audit-Verified" data via deep financial gateway integrations.

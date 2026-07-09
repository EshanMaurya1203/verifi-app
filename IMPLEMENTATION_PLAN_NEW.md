# Verifii — Single Source of Truth & Implementation Plan

This document serves as the definitive architecture, roadmap, and product decision record for the Verifii platform. It reflects the exact state of the codebase.

---

## Architecture Decision Records (ADR)

### ADR-001: India-first Platform
**Date:** July 2026  
**Status:** Accepted  
**Context:** Verifii is built primarily for the Indian ecosystem, necessitating robust local payment support.  
**Decision:** Razorpay is prioritized as the primary verification provider. It supports INR, UPI, and provides the preferred experience for the target market.  
**Consequences:** Focuses development on Razorpay onboarding, ensuring the primary conversion funnel is optimized for India.

### ADR-002: Public Visibility Model
**Date:** July 2026  
**Status:** Accepted  
**Context:** Startups were previously visible by default, which leaked unverified and incomplete profiles.  
**Decision:** The `is_public` boolean flag in `startup_submissions` became the single, definitive visibility gate across the entire platform.  
**Consequences:** Requires all public endpoints (leaderboard, sitemap, profiles, OG images, badges, APIs) to explicitly filter by `is_public = true`.

### ADR-003: Verification Before Publication
**Date:** July 2026  
**Status:** Accepted  
**Context:** New startups shouldn't be publicly visible until their revenue claims are verified.  
**Decision:** Startups remain completely private until the verification flow is completed successfully.  
**Consequences:** Increases trust in the public leaderboard but adds friction to startup onboarding.

### ADR-004: Resume Verification Flow
**Date:** July 2026  
**Status:** Accepted  
**Context:** Verification requires sensitive API keys or OAuth connections, which founders might not have on hand during initial signup.  
**Decision:** Allow founders to save their startup as a private draft ("Verify Later") and resume the verification process at any time from their dashboard.  
**Consequences:** Prevents drop-off during onboarding and improves the conversion rate of startup submissions.

### ADR-005: Hidden Stripe OAuth
**Date:** July 2026  
**Status:** Accepted  
**Context:** Stripe OAuth was built and functional on the backend, but the UI flow confused founders who preferred or only had manual API keys.  
**Decision:** Stripe OAuth is hidden from the founder UI. The backend routes remain intact, but only "Stripe Verification" (manual secret keys) is exposed as a fallback to Razorpay.  
**Consequences:** Simplifies the verification UI and reduces cognitive load, while keeping the OAuth integration available for future enterprise/automated use.

### ADR-006: Trust-Based Publication
**Date:** July 2026  
**Status:** Accepted  
**Context:** Earning a spot on Verifii must be based on proven metrics.  
**Decision:** Publication is explicitly tied to verification success, not just form submission.  
**Consequences:** Ensures 100% of public startups have authenticated revenue data.

### ADR-007: Security Model
**Date:** July 2026  
**Status:** Accepted  
**Context:** Authentication failures from providers during verification shouldn't crash the app or throw 500 errors.  
**Decision:** Expected verification errors (e.g., 401 Unauthorized from Stripe/Razorpay) are handled gracefully and surfaced as UI state (banners). Unexpected exceptions (network corruption, impossible states) still throw to trigger error boundaries.  
**Consequences:** Vastly improves UX during failed verification attempts.

### ADR-008: Fraud & Trust Architecture
**Date:** July 2026  
**Status:** Accepted  
**Context:** We need a reliable way to differentiate between genuine revenue and suspicious spikes without conflating the two logic paths.  
**Decision:** Separated the architecture into distinct engines: 
- **Fraud Detection:** Detects suspicious transaction patterns (rate limits, spikes).
- **Trust Scoring:** Calculates a holistic score based on revenue consistency, growth, and fraud penalties.
- **Verification:** The act of fetching and asserting data.
- **Visibility:** The gate for publication.  
**Consequences:** Creates a modular, testable backend where fraud logic can evolve independently of trust scoring.

---

## FINAL Product Decisions

### Startup Visibility
- **New startups are PRIVATE.**
- Submitting a startup never makes it public.
- Only the founder can see an unverified startup.
- The following surfaces must **ONLY** expose startups where `is_public == true`:
  - Leaderboard
  - Public Profiles
  - Homepage
  - Public APIs
  - Sitemap
  - Badge API
  - OG Images
  - Search
- Verification is the action that unlocks publication.

### Founder Journey
The official founder lifecycle is strictly defined as:
1. Submit Startup
2. Startup Saved Successfully (Private)
3. Verification Decision Screen
4. Verify Now OR Verify Later
5. Dashboard
6. Resume Verification Anytime (if chosen Verify Later)

### Provider Priority
Verifii is an **India-first platform**.
Verification order is rigidly enforced in the UI:
1. **Razorpay (Primary)**: Recommended, supports INR/UPI, preferred experience.
2. **Stripe (Secondary/Fallback)**: Manual Secret Key verification only for international founders. Stripe OAuth exists internally but is deliberately removed from the founder UI until production-ready.

---

## Roadmap & Implementation Plan

### Phase 1: Core Foundation & Verification Engine

#### Goal
Establish the fundamental authentication, submission, and verification pipelines with strict privacy defaults.

#### Features
- Authentication
- Startup Submission
- Founder Dashboard
- Verification Flow
- Resume Verification
- Verification Decision Screen
- Private Startup Workflow
- Public Visibility Gate
- is_public implementation
- Owner-only startup visibility
- Public leaderboard filtering
- Public API filtering
- Sitemap filtering
- Badge filtering
- OG image filtering
- Profile filtering
- Verification error handling
- Razorpay-first UX
- Manual Stripe verification
- Removal of Stripe OAuth from founder UI
- Security improvements
- Fraud Engine
- Trust Engine
- Encryption
- Rate limiting
- Subscription fixes
- Dashboard improvements
- Verification Pending state
- Resume Verification button

#### Current Status
✅ Completed

#### Priority
Critical

#### Dependencies
Supabase, Next.js, Stripe SDK, Razorpay SDK

#### Risks
None (Completed)

#### Estimated Complexity
High

---

### Phase 2: Founder Experience & Analytics

#### P2.1 Founder Dashboard 2.0
**Goal:** Redesign the dashboard to focus on revenue trends and startup health.
**Problem Solved:** Current dashboard is a simple list; founders need actionable insights.
**UX Description:** High-level metric cards, sparklines for recent revenue, and quick actions.
**Current Status:** ⚪ Planned
**Priority:** High
**Dependencies:** Revenue aggregation pipeline, Charting library (Chart.js/Recharts).
**Risks:** Aggregation performance at scale.
**Estimated Complexity:** Medium
**Acceptance Criteria:** Founders can see a 30-day revenue sparkline and month-over-month growth.

#### P2.2 Verification Timeline
**Goal:** Display a visual history of verification attempts.
**Problem Solved:** Founders don't know when their last successful sync occurred.
**UX Description:** A timeline component on the startup detail page showing sync events and outcomes.
**Current Status:** ⚪ Planned
**Priority:** Medium
**Dependencies:** `verification_logs` table schema changes.
**Risks:** Data retention of logs ballooning storage.
**Estimated Complexity:** Low
**Acceptance Criteria:** Timeline renders chronological sync events with success/failure statuses.

#### P2.3 Trust Score Breakdown
**Goal:** Demystify the Trust Score for founders.
**Problem Solved:** Trust Score is a black box.
**UX Description:** A modal or dedicated page section explaining the calculation (consistency, growth, penalties).
**Current Status:** ⚪ Planned
**Priority:** Medium
**Dependencies:** Trust Engine output serialization.
**Risks:** Exposing too much detail might encourage gaming the system.
**Estimated Complexity:** Medium
**Acceptance Criteria:** UI clearly maps Trust Engine variables to the final score out of 100.

#### P2.4 Revenue Dashboard
**Goal:** Dedicated revenue analytics.
**Problem Solved:** Verifii has raw data but doesn't visualize it well for the founder.
**UX Description:** MRR charts, churn estimates, cohort analysis.
**Current Status:** ⚪ Planned
**Priority:** Medium
**Dependencies:** Advanced Supabase queries, caching layer.
**Risks:** Complex SQL aggregations causing timeouts.
**Estimated Complexity:** High
**Acceptance Criteria:** Renders accurate MRR over time using synchronized provider data.

#### P2.5 Verification History
**Goal:** Audit log for verification data.
**Problem Solved:** Need historical proof of verification for compliance and trust.
**UX Description:** Downloadable PDF or CSV of past verification certificates.
**Current Status:** ⚪ Planned
**Priority:** Low
**Dependencies:** PDF generation library.
**Risks:** PDF generation can be CPU intensive.
**Estimated Complexity:** Medium
**Acceptance Criteria:** Founder can export a signed certificate of verification for any past month.

#### P2.6 Startup Health
**Goal:** Actionable advice based on revenue and trust metrics.
**Problem Solved:** Founders want to know how to improve their score.
**UX Description:** "Health Score" with specific recommendations (e.g., "Reduce transaction spikes").
**Current Status:** ⚪ Planned
**Priority:** Low
**Dependencies:** Rules engine on top of Trust Engine.
**Risks:** Incorrect or unactionable advice hurting founder experience.
**Estimated Complexity:** Medium
**Acceptance Criteria:** Displays at least 3 contextual recommendations based on recent transaction variance.

#### P2.7 Notifications
**Goal:** Alert founders to critical events.
**Problem Solved:** Founders miss sync failures or subscription lapses.
**UX Description:** In-app bell icon and email digests.
**Current Status:** ⚪ Planned
**Priority:** High
**Dependencies:** Cron jobs, email provider (Resend/SendGrid).
**Risks:** Spamming users and getting domain blacklisted.
**Estimated Complexity:** Medium
**Acceptance Criteria:** User receives an email if a scheduled background sync fails due to invalid keys.

#### P2.8 Public Profile Improvements
**Goal:** Make verified profiles more impressive and shareable.
**Problem Solved:** Profiles lack visual punch and detailed public-facing metrics.
**UX Description:** Richer charts, enhanced Trust Badges, founder bios, and social links.
**Current Status:** ⚪ Planned
**Priority:** High
**Dependencies:** UI component library updates, dynamic OG image renderer.
**Risks:** Increased page load times if too many charts are added.
**Estimated Complexity:** Low
**Acceptance Criteria:** Profile includes shareable Twitter/LinkedIn cards and detailed social metadata.

---

### Phase 3: Growth & Discovery
#### Goal
Scale the platform, introduce robust billing, and drive discovery.
#### Features
- Subscriptions
- Analytics
- Marketing
- Founder Experience
- SEO
- Discovery

---

### Phase 4: Enterprise & Moderation
#### Goal
Support larger organizations, investors, and maintain platform integrity at scale.
#### Features
- Enterprise
- Admin
- Exports
- Investor Tools
- Advanced APIs
- Moderation
- Audit Logs

---

### Phase 5: AI & Automation
#### Goal
Leverage machine learning for predictive insights and automated trust scaling.
#### Features
- AI
- Automation
- Recommendations
- Insights
- Predictive Trust
- Smart Revenue Analysis

---

## Project Changelog

| Version | Date | Summary | Major Features | Breaking Changes | Notes |
|---------|------|---------|----------------|------------------|-------|
| v1.1.0  | July 2026 | UI Refinements & Security | Stripe OAuth removed from UI, exception handling improved | None | Cemented India-first approach with Razorpay |
| v1.0.0  | July 2026 | Private-by-Default Launch | `is_public` visibility gate, Resume Verification flow | Unverified startups no longer public | Defines the modern Verifii architecture |
| v0.9.0  | June 2026 | Core Verification Engine | Trust Engine, Fraud Engine, Razorpay/Stripe Sync | None | Baseline for revenue verification |
| v0.5.0  | May 2026  | Initial Foundation | Next.js setup, Supabase Auth, Basic Dashboard | None | MVP release |

# Verifii

Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.

---

## What is Verifii?

Verifii provides payment-backed revenue verification for software startups and SaaS founders. Instead of relying on unverified revenue screenshots, spreadsheets, or self-reported claims, Verifii connects directly to payment gateways to calculate, verify, and publish payment-backed revenue metrics.

## Problem Verifii Solves

In the startup ecosystem, self-reported revenue claims and dashboard screenshots are frequently questioned due to the ease of manual editing and synthetic metrics. Verifii solves this credibility gap by:

- Validating revenue directly against real payment transactions.
- Eliminating self-reported figures from verified public leaderboards.
- Providing embeddable verification badges backed by authenticated gateway connections.
- Giving founders a payment-backed way to substantiate revenue milestones with customers, investors, and communities.

## How Payment-Backed Verification Works

Verifii's verification pipeline operates in automated phases:

1. **Gateway Connection**: The founder connects a supported payment provider using restricted read-only credentials or OAuth.
2. **Data Ingestion**: The system retrieves completed payment and charge data directly from supported payment providers to calculate a payment-backed revenue baseline.
3. **Verification & Normalization**: Automated routines exclude non-captured or failed transactions where applicable, aggregate the trailing 30-day payment baseline, and derive displayed revenue metrics from that verified payment activity.
4. **Public Projections**: Verified metrics are mapped to public startup profiles, dynamic trust badges, and public leaderboard rankings.

## Supported Payment Providers

- **Stripe**: Verification of customer charges and payment transactions.
- **Razorpay**: Verification of captured payments and settlements with native INR currency support.

## Public Surfaces & Discovery

- **Public Verified Profiles**: Shareable startup pages displaying verified MRR, ARR, growth rates, and verification timestamps.
- **Public Leaderboard**: Public rankings of eligible startups based on verified payment-backed revenue metrics.
- **Verification Badges**: Dynamic, embeddable badges that founders can place on marketing sites and investor updates.

## Privacy & Security Boundary

> Sensitive payment and verification data remains protected server-side; public pages expose only intentional, sanitized verification projections.

- **Strict Read-Only Access**: Verifii only requests permissions necessary to read completed transactions. Verifii cannot move funds or modify payment settings.
- **Sanitized Public Projections**: Public pages expose only intentional, sanitized verification projections rather than customer payment details.

## Live Platform & Resources

- **Website**: [https://www.verifii.in](https://www.verifii.in)
- **What is Verifii**: [https://www.verifii.in/what-is-verifii](https://www.verifii.in/what-is-verifii)
- **Startup Revenue Verification Guide**: [https://www.verifii.in/startup-revenue-verification](https://www.verifii.in/startup-revenue-verification)
- **Verified MRR Guide**: [https://www.verifii.in/verified-mrr](https://www.verifii.in/verified-mrr)
- **Public Leaderboard**: [https://www.verifii.in/leaderboard](https://www.verifii.in/leaderboard)

## Tech Stack

- **Framework**: Next.js (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run type checks
npm run type-check

# Run production build
npm run build
```

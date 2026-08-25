# Verifii

Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.

## What Verifii does

Verifii helps founders turn payment-provider data into verifiable startup revenue metrics. Instead of relying only on self-reported revenue screenshots or manually entered figures, Verifii uses connected payment-provider data to calculate and verify revenue metrics such as Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR).

Verifii currently supports Stripe and Razorpay for revenue verification.

## Verification

The verification process uses provider data to:

- Connect a startup's supported payment provider
- Retrieve relevant payment and subscription data
- Process and normalize revenue information
- Calculate revenue metrics such as MRR and ARR
- Present eligible verified metrics through public startup profiles and the Verifii leaderboard

Verifii is designed to provide payment-backed evidence for startup revenue claims while keeping sensitive customer and payment information private.

## Website

https://www.verifii.in

Learn more about Verifii:

https://www.verifii.in/what-is-verifii

## Supported payment providers

- Stripe
- Razorpay

## Project

Verifii is built with Next.js and TypeScript and uses Supabase for its application data infrastructure.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

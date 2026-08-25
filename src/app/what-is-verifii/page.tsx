import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/home/Footer";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  ChevronDown,
  Layers,
  Zap,
  Eye,
  Database,
  Building2,
  Users,
  LineChart,
} from "lucide-react";

export const metadata: Metadata = {
  title: "What is Verifii? | Startup Revenue Verification",
  description:
    "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
  alternates: {
    canonical: "https://www.verifii.in/what-is-verifii",
  },
  openGraph: {
    title: "What is Verifii? | Startup Revenue Verification",
    description:
      "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
    url: "https://www.verifii.in/what-is-verifii",
    siteName: "Verifii",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What is Verifii? | Startup Revenue Verification",
    description:
      "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
  },
};

const faqItems = [
  {
    question: "What is Verifii?",
    answer:
      "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
  },
  {
    question: "What does Verifii verify?",
    answer:
      "Verifii verifies Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and Month-over-Month (MoM) revenue growth directly from authenticated payment gateway records.",
  },
  {
    question: "How does Verifii verify startup revenue?",
    answer:
      "Verifii connects to a startup's payment processor (Stripe or Razorpay) using restricted, read-only API access. It queries completed transaction records and active subscriptions to calculate accurate financial metrics automatically.",
  },
  {
    question: "Is Verifii free to use for startup revenue verification?",
    answer:
      "Yes, core revenue verification, public profile creation, and leaderboard listings on Verifii are free for founders.",
  },
  {
    question: "Does Verifii have access to customer data or bank accounts?",
    answer:
      "Verifii does not access or publish customer card numbers, bank account numbers, or other unnecessary sensitive financial data. Provider authentication credentials are securely handled for the purpose of connecting to the supported payment provider, and Verifii cannot move funds or modify payment settings.",
  },
  {
    question: "How is Verifii different from self-reported revenue leaderboards?",
    answer:
      "Traditional leaderboards rely on self-reported numbers or easily edited screenshots. Verifii validates data directly through automated payment provider API integrations, validating public revenue metrics against payment-provider data and applying verification rules before a startup is treated as revenue-verified.",
  },
  {
    question: "Which payment providers does Verifii support?",
    answer:
      "Verifii currently supports revenue verification through Stripe and Razorpay.",
  },
  {
    question: "Can founders keep their revenue profile private?",
    answer:
      "Yes. Founders can choose to toggle their profile to private or disconnect their payment provider at any time from their dashboard settings.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.verifii.in/what-is-verifii#webpage",
      "url": "https://www.verifii.in/what-is-verifii",
      "name": "What is Verifii? | Startup Revenue Verification",
      "description":
        "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.verifii.in/",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "What is Verifii?",
            "item": "https://www.verifii.in/what-is-verifii",
          },
        ],
      },
      "mainEntity": {
        "@type": "Organization",
        "@id": "https://www.verifii.in/#organization",
        "name": "Verifii",
        "url": "https://www.verifii.in",
        "description":
          "Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.verifii.in/what-is-verifii#faq",
      "mainEntity": faqItems.map((item) => ({
        "@type": "Question",
        "name": item.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": item.answer,
        },
      })),
    },
  ],
};

const flowSteps = [
  {
    step: "01",
    title: "Founder Connects Gateway",
    description:
      "Founder integrates Stripe or Razorpay via secure, restricted read-only credentials.",
  },
  {
    step: "02",
    title: "Automated Data Ingestion",
    description:
      "Verifii securely queries completed transactions and recurring subscriptions using provider access configured for revenue verification.",
  },
  {
    step: "03",
    title: "Algorithmic Verification",
    description:
      "Automated verification routines filter test-mode activity, anomalies, and synthetic charges.",
  },
  {
    step: "04",
    title: "Metric Normalization",
    description:
      "Calculates verified Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and growth momentum.",
  },
  {
    step: "05",
    title: "Public Trust Badge & Profile",
    description:
      "Generates a verified public profile and embeddable trust badge displayed on the leaderboard.",
  },
];

export default function WhatIsVerifiiPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white font-sans selection:bg-primary selection:text-[#080808]">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        {/* Navigation Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-10">
          <ol className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
            <li>
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true" className="text-neutral-700">
              /
            </li>
            <li className="text-primary" aria-current="page">
              What is Verifii
            </li>
          </ol>
        </nav>

        {/* Hero Section & Direct Answer */}
        <article className="space-y-16">
          <header className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Entity Definition & Overview</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-syne uppercase tracking-tight text-white">
              What is Verifii?
            </h1>

            {/* Immediate Direct Answer (40–60 words) */}
            <p className="text-lg sm:text-xl font-medium text-neutral-200 leading-relaxed">
              Verifii is a payment-backed startup revenue verification platform
              that helps founders verify MRR and ARR using connected
              payment-provider data from Stripe and Razorpay. It replaces
              unverifiable self-reported screenshots with direct, automated API
              verification to provide trusted, payment-backed revenue evidence for
              founders, investors, and the startup community.
            </p>

            {/* Self-Contained Answer Block (~134–167 words) */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />
              <h2 className="text-sm font-black uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Comprehensive Platform Definition
              </h2>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Verifii is a dedicated startup revenue verification platform
                designed for software founders, SaaS companies, and digital
                businesses who want transparent, independently verifiable
                financial credibility. Rather than relying on self-reported
                claims, static spreadsheets, or easily fabricated dashboard
                screenshots, Verifii connects directly to payment gateways
                including Stripe and Razorpay via secure, read-only API access.
                Through this automated connection, Verifii aggregates and verifies
                critical subscription and transactional
                metrics—principally Monthly Recurring Revenue (MRR) and Annual
                Recurring Revenue (ARR)—based on actual completed customer
                payments. The platform computes accurate, payment-backed financial
                snapshots while ensuring sensitive customer records, card
                numbers, and banking details remain completely untouched and
                private. By converting verified payment data into public trust
                profiles, verifiable badges, and open leaderboard rankings,
                Verifii establishes a dependable standard of revenue transparency
                for founders sharing their progress with customers, communities,
                and potential investors.
              </p>
            </div>
          </header>

          {/* Multi-Modal Accessible Verification Flow Diagram */}
          <section
            aria-labelledby="flow-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-primary" />
              <h2
                id="flow-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Verification Flow Architecture
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              How financial data moves securely from payment processors to public
              verification without compromising proprietary customer records:
            </p>

            <figure
              aria-label="Visual flowchart of the Verifii revenue verification process"
              className="rounded-3xl border border-white/[0.06] bg-[#09090b]/60 backdrop-blur-md p-6 sm:p-8"
            >
              <figcaption className="sr-only">
                Five-step verification flow: Founder connects gateway, automated
                data ingestion occurs, algorithmic verification validates charges,
                metric normalization calculates MRR and ARR, and public trust badge
                is generated.
              </figcaption>

              <ol className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
                {flowSteps.map((item, index) => (
                  <li
                    key={item.step}
                    className="relative flex flex-col justify-between rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 text-left group hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {item.step}
                        </span>
                        {index < flowSteps.length - 1 && (
                          <ArrowRight className="hidden md:block w-4 h-4 text-neutral-600 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <h3 className="font-syne text-sm font-bold text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 pt-4 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400 font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Strict Read-Only Enforcement
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  AES-256 Token Encryption
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Zero Cardholder Data Storage
                </span>
              </div>
            </figure>
          </section>

          {/* Section: What does Verifii verify? */}
          <section
            aria-labelledby="verify-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <LineChart className="w-5 h-5 text-primary" />
              <h2
                id="verify-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                What does Verifii verify?
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verifii focuses exclusively on verifiable, payment-backed financial
              metrics calculated from connected gateway transactions:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Monthly Recurring Revenue (MRR)
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Normalized recurring subscription income recognized during active
                  billing intervals from verified customer subscriptions.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Annual Recurring Revenue (ARR)
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Annualized recurring revenue calculated from active annual and
                  multi-month subscription plans.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Month-over-Month (MoM) Growth
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Percentage growth rate derived from trailing revenue periods
                  across completed payment cycles.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Active Payment Connection Status
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Indicates that the startup has an active connection to a supported
                  payment provider used for revenue verification.
                </p>
              </div>
            </div>
          </section>

          {/* Section: How does Verifii verify startup revenue? */}
          <section
            aria-labelledby="how-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <h2
                id="how-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                How does Verifii verify startup revenue?
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Revenue verification on Verifii follows a fully automated, four-phase
              pipeline designed to eliminate manual intervention and human error:
            </p>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Phase 1 — Read-Only Authentication
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  The founder connects their Stripe or Razorpay account via
                  restricted API keys or standard OAuth flows. These credentials
                  grant strictly read-only access to transaction and subscription
                  histories.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Phase 2 — Direct Transaction Sync
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verifii queries completed charges, recurring billing cycles, and
                  customer subscription objects directly from the payment provider
                  API. Manual numbers and user-submitted revenue claims are not
                  accepted on the platform.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Phase 3 — Anomaly and Test-Mode Filtering
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  The verification engine applies automated filters to exclude
                  test-mode sandbox transactions, failed authorizations, and
                  synthetic self-billing patterns before computing final scores.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Phase 4 — Profile & Badge Generation
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verified metrics are published on the founder’s public profile and
                  ranked on the public{" "}
                  <Link
                    href="/leaderboard"
                    className="text-primary underline hover:text-white transition-colors"
                  >
                    Verifii Leaderboard
                  </Link>
                  . Founders can also embed dynamic verification badges on their
                  websites and investor updates.
                </p>
              </div>
            </div>
          </section>

          {/* Section: How Stripe and Razorpay verification works */}
          <section
            aria-labelledby="providers-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-primary" />
              <h2
                id="providers-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                How Stripe and Razorpay verification works
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verifii supports two of the world’s most trusted payment gateways,
              utilizing isolated provider-specific integration protocols:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-syne text-base font-bold text-white">
                    Stripe Revenue Verification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verifii reads completed charges, active subscriptions, customer
                  invoices, and refund events via Stripe’s REST API. Restricted API
                  keys are limited strictly to reading charge and subscription
                  resources.
                </p>
                <ul className="text-xs text-neutral-400 space-y-1.5 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Read-only subscription & charge access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Automated multi-currency conversion</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Automated invoice and payment reconciliation</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-500" />
                  <h3 className="font-syne text-base font-bold text-white">
                    Razorpay Revenue Verification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verifii queries captured payments, active recurring plans, and
                  order settlements using Razorpay’s Key ID and Secret
                  authentication tokens in a non-modifying role.
                </p>
                <ul className="text-xs text-neutral-400 space-y-1.5 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Read-only payments & orders sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Support for Indian and international INR billing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Automated recurring subscription validation</span>
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Read our full security protocols in our{" "}
              <Link
                href="/privacy"
                className="text-primary underline hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/terms"
                className="text-primary underline hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
              .
            </p>
          </section>

          {/* Section: Verifii vs self-reported revenue */}
          <section
            aria-labelledby="comparison-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2
                id="comparison-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Verifii vs self-reported revenue
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Self-reported revenue claims and dashboard screenshots have become
              unreliable in the modern startup ecosystem. Verifii introduces a
              fundamental shift toward verifiable proof:
            </p>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#09090b]/40">
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">
                  Comparison between Verifii Payment-Backed Verification and
                  Self-Reported Screenshots
                </caption>
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th scope="col" className="p-4 font-syne font-bold text-white">
                      Verification Feature
                    </th>
                    <th scope="col" className="p-4 font-syne font-bold text-primary">
                      Verifii Verification
                    </th>
                    <th
                      scope="col"
                      className="p-4 font-syne font-bold text-neutral-400"
                    >
                      Self-Reported Claims
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-neutral-300">
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Data Source
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Live Stripe & Razorpay APIs
                    </td>
                    <td className="p-4 text-neutral-500">
                      Manual typing or editable images
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Tamper Resistance
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Payment-backed & automated
                    </td>
                    <td className="p-4 text-neutral-500">
                      Easily edited with browser tools
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Sync Frequency
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Automated background synchronization
                    </td>
                    <td className="p-4 text-neutral-500">
                      Static, outdated manual posts
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Auditability
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Algorithmic anomaly checks
                    </td>
                    <td className="p-4 text-neutral-500">
                      Zero independent validation
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Trust Value
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      High confidence for investors & buyers
                    </td>
                    <td className="p-4 text-neutral-500">
                      Subject to community skepticism
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Who is Verifii for? */}
          <section
            aria-labelledby="audience-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <h2
                id="audience-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Who is Verifii for?
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verifii serves key participants across the technology and startup
              landscape:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Building2 className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-base font-bold text-white">
                  SaaS & Software Founders
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Founders who want to build stronger credibility with users,
                  partners, and potential hires by sharing verified revenue
                  milestones.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Zap className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-base font-bold text-white">
                  Build-in-Public Creators
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Bootstrappers and indie hackers sharing their growth journeys who
                  want proof that distinguishes their business from fabricated
                  claims.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Eye className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-base font-bold text-white">
                  Investors & Acquirers
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Angel investors, venture funds, and micro-acquirers evaluating
                  early-stage startups with pre-verified financial metrics.
                </p>
              </div>
            </div>
          </section>

          {/* Section: What information does Verifii publish? */}
          <section
            aria-labelledby="publish-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <h2
                id="publish-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                What information does Verifii publish?
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verifii strictly separates public verification metrics from private
              operational data:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] p-6 space-y-3">
                <h3 className="font-syne text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Publicly Displayed Information
                </h3>
                <ul className="text-xs sm:text-sm text-neutral-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>Startup legal name, logo, category, and bio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>Verified Monthly Recurring Revenue (MRR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>Verified Annual Recurring Revenue (ARR)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>Month-over-Month (MoM) growth percentage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>Verification tier and last verified timestamp</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.02] p-6 space-y-3">
                <h3 className="font-syne text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Strictly Confidential / Never Published
                </h3>
                <ul className="text-xs sm:text-sm text-neutral-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Customer identities, names, and emails</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Credit card numbers and payment methods</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Individual invoice breakdowns and line items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>Bank account numbers and payout destinations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>API keys, secrets, and auth tokens</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section: Frequently asked questions */}
          <section
            aria-labelledby="faq-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2
                id="faq-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Frequently asked questions
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Common questions about Verifii, revenue verification methods, data
              security, and founder controls:
            </p>

            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <details
                  key={index}
                  className="group rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden transition-all duration-200"
                >
                  <summary className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 hover:bg-white/[0.02] cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 rounded-2xl list-none">
                    <span className="font-syne text-sm font-bold text-white">
                      {item.question}
                    </span>
                    <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 group-open:rotate-180 group-open:text-primary" />
                  </summary>
                  <div className="px-5 pb-4 pt-1 border-t border-white/[0.03] text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Call to Action Card */}
          <section className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 rounded-3xl p-8 sm:p-10 text-center space-y-6 relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
            <h2 className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white">
              Ready to verify your startup revenue?
            </h2>
            <p className="text-neutral-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Join founders who verify their MRR with Stripe and Razorpay. Core
              revenue verification, public profiles, and leaderboard listings
              are currently free for founders.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                href="/submit"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Add Your Startup
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Explore Leaderboard
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                View Pricing
              </Link>
            </div>
          </section>
        </article>

        {/* Footer */}
        <Footer />
      </main>
    </div>
  );
}

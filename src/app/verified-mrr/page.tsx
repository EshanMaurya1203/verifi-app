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
  Database,
  LineChart,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  FileText,
  Info,
} from "lucide-react";

export const metadata: Metadata = {
  title: "What is Verified MRR? | Verifii",
  description:
    "Learn what Verified MRR means on Verifii, how its payment-backed 30-day revenue baseline is calculated from connected Stripe and Razorpay data, and how it differs from self-reported MRR.",
  alternates: {
    canonical: "https://www.verifii.in/verified-mrr",
  },
  openGraph: {
    title: "What is Verified MRR? | Verifii",
    description:
      "Learn what Verified MRR means on Verifii, how its payment-backed 30-day revenue baseline is calculated from connected Stripe and Razorpay data, and how it differs from self-reported MRR.",
    url: "https://www.verifii.in/verified-mrr",
    siteName: "Verifii",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What is Verified MRR? | Verifii",
    description:
      "Learn what Verified MRR means on Verifii, how its payment-backed 30-day revenue baseline is calculated from connected Stripe and Razorpay data, and how it differs from self-reported MRR.",
  },
};

const faqItems = [
  {
    question: "What is Verified MRR?",
    answer:
      "On Verifii, Verified MRR is a payment-backed revenue baseline calculated from completed customer payments and captured charges across an authenticated trailing 30-day window from connected Stripe and Razorpay accounts. This is a Verifii-specific verification metric and should not be interpreted as an accounting-standard calculation of contractual recurring revenue.",
  },
  {
    question: "Is Verifii Verified MRR the same as accounting MRR?",
    answer:
      "No. Conventional accounting MRR measures normalized contractual subscription value. Verifii Verified MRR measures actual captured payment volume over the trailing 30 days from connected payment gateways. It does not perform accrual revenue recognition, contract proration, or GAAP accounting.",
  },
  {
    question: "How is Verified MRR calculated?",
    answer:
      "Verifii connects to supported payment providers (Stripe and Razorpay) via restricted read-only access, identifies completed and captured transactions in the trailing 30-day window, aggregates the total volume, normalizes the currency, and publishes the resulting baseline on the startup's verified profile.",
  },
  {
    question: "Does Verified MRR include one-time payments?",
    answer:
      "Yes. The current verification engine aggregates all successful, completed charges and captured payments occurring within the trailing 30-day window. It does not separate one-time payments from recurring subscription invoices.",
  },
  {
    question: "How does Verifii verify revenue from Stripe and Razorpay?",
    answer:
      "Verifii queries connected provider APIs using restricted, read-only credentials to read completed charges, captured payments, and transaction records. Verifii cannot move funds or modify payment provider settings.",
  },
  {
    question: "How is Verified MRR different from a screenshot of revenue?",
    answer:
      "Self-reported figures and screenshots can be visually edited or misrepresent gross volumes. Verified MRR is programmatically generated from direct, authenticated payment-provider data, providing objective evidence of recent captured transactions.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.verifii.in/verified-mrr#webpage",
      "url": "https://www.verifii.in/verified-mrr",
      "name": "What is Verified MRR? | Verifii",
      "description":
        "Learn what Verified MRR means on Verifii, how its payment-backed 30-day revenue baseline is calculated from connected Stripe and Razorpay data, and how it differs from self-reported MRR.",
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
            "name": "Verified MRR",
            "item": "https://www.verifii.in/verified-mrr",
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
      "@id": "https://www.verifii.in/verified-mrr#faq",
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

const calculationSteps = [
  {
    step: "01",
    title: "Connect Supported Payment Provider",
    description:
      "The founder establishes an authenticated connection to Stripe or Razorpay using restricted read-only credentials or standard OAuth permissions.",
  },
  {
    step: "02",
    title: "Retrieve Relevant Payment Records",
    description:
      "The verification engine queries recent transaction records, completed charges, and payment entries directly from the connected provider API.",
  },
  {
    step: "03",
    title: "Select Completed/Captured Transactions",
    description:
      "The system filters records to include only successful, captured charges and completed payment items, excluding failed authorizations and uncaptured transactions.",
  },
  {
    step: "04",
    title: "Aggregate the Trailing 30-Day Baseline",
    description:
      "Total captured transaction amounts within the trailing 30-day window are summed to establish the startup's current verified revenue volume.",
  },
  {
    step: "05",
    title: "Normalize and Publish Verified Metric",
    description:
      "Amounts are normalized into the platform's standard display currency and published to the startup's verified public profile and the leaderboard.",
  },
];

export default function VerifiedMRRPage() {
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
              Verified MRR
            </li>
          </ol>
        </nav>

        <article className="space-y-16">
          {/* Header & Direct Answer */}
          <header className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
              <LineChart className="w-3.5 h-3.5" />
              <span>Metric Definition & Standards</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-syne uppercase tracking-tight text-white">
              What is Verified MRR?
            </h1>

            {/* Immediate Direct Answer (40–60 words) */}
            <p className="text-lg sm:text-xl font-medium text-neutral-200 leading-relaxed">
              On Verifii, Verified MRR is a payment-backed revenue baseline calculated from completed customer payments and captured charges across an authenticated trailing 30-day window from connected Stripe and Razorpay accounts. This verification metric provides objective evidence of recent payment activity rather than relying on self-reported figures or manual screenshots.
            </p>

            {/* Prominent Clarification Callout */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-syne text-sm sm:text-base font-bold text-amber-300">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
                <span>Important Metric Clarification</span>
              </div>
              <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                Verified MRR on Verifii is a verification-specific metric reflecting a trailing 30-day payment baseline. It should not be interpreted as an accounting-standard calculation of contractual recurring revenue, a statutory financial audit, or a formal GAAP revenue recognition statement.
              </p>
            </div>

            {/* Self-Contained Answer Block (~134–167 words) */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />
              <h2 className="text-sm font-black uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                The Verified MRR Concept
              </h2>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                In software and technology ecosystems, founders frequently share revenue figures to establish commercial credibility. Traditional Monthly Recurring Revenue (MRR) is self-reported, leaving figures susceptible to manual errors, selective reporting, or unverified claims. Verified MRR addresses this by anchoring the metric to direct, authenticated payment processor records from supported providers like Stripe and Razorpay. Rather than evaluating self-submitted spreadsheets or dashboard screenshots, the verification engine queries completed customer transactions and captured charges across an active trailing 30-day window. This produces an evidence-backed financial baseline reflecting actual customer payments received during that period. By using restricted read-only permissions and keeping proprietary customer data private, Verified MRR gives founders a dependable way to share proof of recent revenue volume with prospective customers, partners, and the broader startup community.
              </p>
            </div>
          </header>

          {/* Section: What Verified MRR Means on Verifii */}
          <section
            aria-labelledby="meaning-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2
                id="meaning-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                What Verified MRR means on Verifii
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              When a startup displays a Verified MRR figure on Verifii, it represents an objective, automated summary of completed transaction activity:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Database className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Payment-Backed Data
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Extracted directly from connected payment providers via authenticated API connections.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <LineChart className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Trailing 30-Day Window
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Reflects completed payment volume received over the trailing 30 days.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Lock className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Read-Only Security
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Calculated without fund-transfer permissions or access to sensitive card details.
                </p>
              </div>
            </div>
          </section>

          {/* Section: How Verifii Calculates the Metric */}
          <section
            aria-labelledby="calc-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <h2
                id="calc-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                How Verifii calculates the metric
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              The calculation of Verified MRR follows an automated sequence based on live provider data:
            </p>

            <div className="space-y-4">
              {calculationSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-2 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                      Step {item.step}
                    </span>
                    <h3 className="font-syne text-base font-bold text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-0 sm:pl-12">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: What Is Included vs What Is NOT Normalized */}
          <section
            aria-labelledby="scope-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <h2
                id="scope-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Understanding the calculation scope
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              To evaluate Verified MRR accurately, it is essential to understand both what the current implementation includes and its structural boundaries:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* What is Included */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h3 className="font-syne text-base font-bold text-white">
                    What is Included
                  </h3>
                </div>
                <ul className="text-xs sm:text-sm text-neutral-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>Completed subscription payments collected in the 30-day window.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>One-time captured payments and charges occurring in the 30-day window.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>Multi-provider transaction aggregation across connected Stripe and Razorpay accounts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>Currency normalization into the platform&apos;s standard display format.</span>
                  </li>
                </ul>
              </div>

              {/* What is NOT Normalized */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <h3 className="font-syne text-base font-bold text-white">
                    What is NOT Normalized
                  </h3>
                </div>
                <ul className="text-xs sm:text-sm text-neutral-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Annual contracts are not divided into 12 monthly accrual portions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Billing intervals (quarterly, semi-annual) are not interval-normalized.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>One-time charges are not automatically separated from subscription invoices.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Subscription contract proration and mid-term upgrades are not calculated.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>Does not perform accrual accounting or formal GAAP revenue recognition.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section: Verified MRR vs Self-Reported MRR */}
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
                Verified MRR vs. Self-Reported MRR
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Self-reported revenue figures rely on manual disclosures, whereas Verified MRR relies on programmatic payment-provider data:
            </p>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#09090b]/40">
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">
                  Comparison between Verifii Verified MRR and Self-Reported MRR
                </caption>
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th scope="col" className="p-4 font-syne font-bold text-white">
                      Dimension
                    </th>
                    <th scope="col" className="p-4 font-syne font-bold text-primary">
                      Verifii Verified MRR
                    </th>
                    <th scope="col" className="p-4 font-syne font-bold text-neutral-400">
                      Self-Reported MRR
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-neutral-300">
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Evidence Source
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Connected payment-provider API records
                    </td>
                    <td className="p-4 text-neutral-500">
                      Self-submitted text or screenshots
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Payment Gateway Connection
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Authenticated read-only provider integration
                    </td>
                    <td className="p-4 text-neutral-500">
                      None required
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Transaction Provenance
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Derived from completed/captured transaction ledgers
                    </td>
                    <td className="p-4 text-neutral-500">
                      Unverified declaration
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      One-Time Payment Treatment
                    </th>
                    <td className="p-4 text-neutral-300">
                      Included in 30-day captured baseline
                    </td>
                    <td className="p-4 text-neutral-500">
                      Subject to author&apos;s manual definition
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Contract Normalization
                    </th>
                    <td className="p-4 text-neutral-300">
                      Trailing 30-day sum (not amortized)
                    </td>
                    <td className="p-4 text-neutral-500">
                      Manual spreadsheet normalization
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Accounting Status
                    </th>
                    <td className="p-4 text-neutral-300">
                      Payment verification metric (not GAAP audit)
                    </td>
                    <td className="p-4 text-neutral-500">
                      Uncertified disclosure
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Verified MRR, ARR, and Revenue Growth */}
          <section
            aria-labelledby="arr-growth-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2
                id="arr-growth-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Verified MRR, ARR, and Revenue Growth
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Verifii uses the verified revenue baseline to derive related secondary indicators:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Verified MRR
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  The primary baseline metric representing total captured payment revenue across the trailing 30 days.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Derived ARR
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Calculated as an annualization of the current 30-day baseline (Verified MRR × 12), rather than contractual ACV.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Snapshot Growth
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Calculated as a comparison between historical verified revenue snapshots from a stable baseline at least 24 hours old.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Supported Payment Providers: Stripe & Razorpay */}
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
                Supported payment providers: Stripe & Razorpay
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Verifii calculates Verified MRR through read-only integrations with Stripe and Razorpay:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Stripe Revenue Baseline
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Queries completed balance transactions and charges across the trailing 30-day period using restricted API permissions.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Razorpay Revenue Baseline
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Queries captured payments and completed transaction orders across the trailing 30-day period using restricted credentials.
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              To learn how the platform integrates with startup infrastructure, see{" "}
              <Link
                href="/what-is-verifii"
                className="text-primary underline hover:text-white transition-colors font-medium"
              >
                What is Verifii?
              </Link>
              . For a detailed walkthrough of the multi-step verification pipeline, read our comprehensive guide:{" "}
              <Link
                href="/startup-revenue-verification"
                className="text-primary underline hover:text-white transition-colors font-medium"
              >
                How to Verify Startup Revenue
              </Link>
              .
            </p>
          </section>

          {/* Section: Current Verifii Verification Eligibility */}
          <section
            aria-labelledby="eligibility-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-primary" />
              <h2
                id="eligibility-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Current Verifii verification eligibility
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              To be displayed as revenue-verified on Verifii profiles and the public leaderboard, a startup must satisfy current platform eligibility conditions:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-1.5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Condition 1</span>
                <h3 className="font-syne text-sm font-bold text-white">Active Payment Connection</h3>
                <p className="text-xs text-neutral-400">Startup must have a connected Stripe or Razorpay integration.</p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-1.5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Condition 2</span>
                <h3 className="font-syne text-sm font-bold text-white">Minimum Transaction Activity</h3>
                <p className="text-xs text-neutral-400">Requires at least 3 completed provider transactions.</p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-1.5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Condition 3</span>
                <h3 className="font-syne text-sm font-bold text-white">Positive Revenue Total</h3>
                <p className="text-xs text-neutral-400">Total captured volume in the 30-day window must be greater than zero.</p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-1.5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Condition 4</span>
                <h3 className="font-syne text-sm font-bold text-white">Sync Freshness Window</h3>
                <p className="text-xs text-neutral-400">Provider data must have synchronized within the past 7 days.</p>
              </div>
            </div>
          </section>

          {/* Section: Privacy and Security Boundaries */}
          <section
            aria-labelledby="privacy-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-primary" />
              <h2
                id="privacy-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Privacy and security boundaries
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Verifii calculates Verified MRR while maintaining strict data boundaries:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Restricted Read-Only Permissions
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Verification uses restricted read-only credentials. Verifii cannot move funds or modify payment settings.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  No Cardholder Information Access
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  The verification engine does not access or store customer credit card numbers, CVVs, or personal banking credentials.
                </p>
              </div>
            </div>
          </section>

          {/* Section: Frequently Asked Questions */}
          <section
            aria-labelledby="faq-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <ChevronDown className="w-5 h-5 text-primary" />
              <h2
                id="faq-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Frequently asked questions
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Common questions about Verified MRR, calculation rules, and data provenance:
            </p>

            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2"
                >
                  <h3 className="font-syne text-sm sm:text-base font-bold text-white">
                    {item.question}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA Card */}
          <section className="pt-8 border-t border-white/[0.05]">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-8 sm:p-12 text-center space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
              <h2 className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white">
                Verify Your Startup&apos;s Revenue
              </h2>
              <p className="text-neutral-300 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
                Connect your Stripe or Razorpay account to establish a payment-backed verified revenue baseline.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Link
                  href="/submit"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(185,255,75,0.2)]"
                >
                  Verify your startup
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-8 text-xs font-bold uppercase tracking-wider text-neutral-300 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98]"
                >
                  Explore Leaderboard
                </Link>
              </div>
            </div>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}

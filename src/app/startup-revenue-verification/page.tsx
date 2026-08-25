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
  Building2,
  LineChart,
  AlertCircle,
  Key,
  RefreshCw,
  EyeOff,
} from "lucide-react";

export const metadata: Metadata = {
  title: "How to Verify Startup Revenue | Verifii",
  description:
    "Learn how startup revenue verification works using connected payment-provider data, including how Verifii verifies MRR and ARR from Stripe and Razorpay.",
  alternates: {
    canonical: "https://www.verifii.in/startup-revenue-verification",
  },
  openGraph: {
    title: "How to Verify Startup Revenue | Verifii",
    description:
      "Learn how startup revenue verification works using connected payment-provider data, including how Verifii verifies MRR and ARR from Stripe and Razorpay.",
    url: "https://www.verifii.in/startup-revenue-verification",
    siteName: "Verifii",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Verify Startup Revenue | Verifii",
    description:
      "Learn how startup revenue verification works using connected payment-provider data, including how Verifii verifies MRR and ARR from Stripe and Razorpay.",
  },
};

const faqItems = [
  {
    question: "How do you verify startup revenue?",
    answer:
      "Startup revenue is verified by connecting a company's payment provider—such as Stripe or Razorpay—via restricted, read-only credentials to directly extract and analyze authenticated transaction records and subscription data. This programmatic process validates completed customer payments, filters out test transactions, and normalizes recurring revenue into verifiable MRR and ARR metrics without relying on screenshots.",
  },
  {
    question: "What data is used to verify startup revenue?",
    answer:
      "Revenue verification uses read-only transaction history, completed charges, invoice records, and active recurring subscription schedules. Verification systems do not access or store sensitive customer information, credit card numbers, or bank account credentials.",
  },
  {
    question: "How does payment-provider verification differ from screenshots?",
    answer:
      "Screenshots and self-reported figures can be easily edited or misrepresent gross volume as recurring revenue. Payment-provider verification programmatically queries connected payment-provider records, verifies completed transactions, and applies objective filtering rules to establish verifiable financial evidence.",
  },
  {
    question: "Which payment providers does Verifii support?",
    answer:
      "Verifii currently supports revenue verification through Stripe and Razorpay using restricted, read-only API access and secure authentication protocols.",
  },
  {
    question: "Can founders keep their revenue profile private?",
    answer:
      "Yes. Founders can control their profile visibility and can toggle their public profile to private or disconnect their payment provider from their dashboard settings.",
  },
  {
    question: "Does revenue verification give access to customer credit card numbers?",
    answer:
      "No. Payment-provider verification requires restricted, read-only access to relevant transaction and subscription data. The verification process does not require access to customer credit card numbers, CVVs, or personal banking credentials.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://www.verifii.in/startup-revenue-verification#webpage",
      "url": "https://www.verifii.in/startup-revenue-verification",
      "name": "How to Verify Startup Revenue | Verifii",
      "description":
        "Learn how startup revenue verification works using connected payment-provider data, including how Verifii verifies MRR and ARR from Stripe and Razorpay.",
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
            "name": "Startup Revenue Verification",
            "item": "https://www.verifii.in/startup-revenue-verification",
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
      "@id": "https://www.verifii.in/startup-revenue-verification#faq",
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

const verificationSteps = [
  {
    number: "01",
    title: "Connect the Payment Provider",
    description:
      "The founder connects their supported payment provider (Stripe or Razorpay) using restricted, read-only credentials or standard OAuth authorization. This establishes an authenticated data channel without granting fund-transfer or configuration-editing permissions.",
  },
  {
    number: "02",
    title: "Read Relevant Provider Records",
    description:
      "The verification engine queries raw transaction ledgers, completed customer charges, active subscription schedules, and billing frequencies directly from the payment processor.",
  },
  {
    number: "03",
    title: "Filter and Validate Data",
    description:
      "Automated verification routines inspect the retrieved records, filtering out sandbox/test-mode transactions, failed payment authorizations, refund adjustments, and non-recurring one-off charges.",
  },
  {
    number: "04",
    title: "Normalize Revenue Metrics",
    description:
      "Validated transaction streams are normalized into standard financial metrics, primarily Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and Month-over-Month (MoM) revenue growth.",
  },
  {
    number: "05",
    title: "Publish Eligible Verified Results",
    description:
      "Eligible startups receive a verified trust badge and can showcase their payment-backed revenue metrics on public profiles and the Verifii leaderboard with founder-controlled privacy settings.",
  },
];

export default function StartupRevenueVerificationPage() {
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
              Startup Revenue Verification
            </li>
          </ol>
        </nav>

        {/* Header & Direct Answer */}
        <article className="space-y-16">
          <header className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Methodology & Category Guide</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-syne uppercase tracking-tight text-white">
              How to Verify Startup Revenue
            </h1>

            {/* Immediate Direct Answer (40–60 words) */}
            <p className="text-lg sm:text-xl font-medium text-neutral-200 leading-relaxed">
              Startup revenue is verified by connecting a company&apos;s payment provider—such as Stripe or Razorpay—via restricted, read-only credentials to directly extract and analyze authenticated transaction records and subscription data. This programmatic process validates completed customer payments, filters out test transactions, and normalizes recurring revenue into verifiable MRR and ARR metrics without relying on screenshots.
            </p>

            {/* Self-Contained Comprehensive Answer Block (~134–167 words) */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />
              <h2 className="text-sm font-black uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                The Payment-Backed Verification Methodology
              </h2>
              <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                Startup revenue verification is an automated, evidence-based methodology used to verify a software company&apos;s financial metrics using authenticated payment-provider records. Instead of accepting self-reported revenue claims, unverified spreadsheets, or editable dashboard screenshots, verification systems connect directly to payment gateways like Stripe and Razorpay using restricted, read-only access permissions. Through this secure connection, the system extracts completed customer payments, active subscription schedules, and billing cycles while excluding test charges, synthetic activity, and failed transactions. Financial calculations then programmatically normalize raw transaction volumes into standardized recurring revenue indicators, including Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and Month-over-Month (MoM) revenue growth. By restricting access to relevant financial metadata and preventing fund movement or account modifications, payment-backed verification provides founders, investors, and prospective acquirers with revenue evidence while limiting exposure of sensitive customer and payment information.
              </p>
            </div>
          </header>

          {/* Section: What is Startup Revenue Verification? */}
          <section
            aria-labelledby="what-is-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-primary" />
              <h2
                id="what-is-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                What is startup revenue verification?
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              In software, SaaS, and digital business ecosystems, founders frequently share revenue figures to build credibility with customers, recruit team members, and attract capital. Traditionally, these milestones have been shared through manual social posts, self-reported directories, and static screenshots of payment dashboards.
            </p>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              <strong>Startup revenue verification</strong> is the discipline of validating financial claims against direct, authenticated payment-provider data rather than relying on self-reported representations. By connecting directly to payment processors via automated APIs, revenue verification provides independent evidence that reported figures reflect actual completed customer transactions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <LineChart className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Standardized Metrics
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Converts diverse payment intervals into normalized MRR and ARR using standardized calculation models.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <RefreshCw className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Automated Synchronization
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Periodically synchronizes transaction records to maintain current verified revenue indicators over time.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <Lock className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-syne text-sm font-bold text-white uppercase tracking-wider">
                  Privacy-Safe Verification
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Validates aggregate numbers without exposing customer identities, card details, or banking information.
                </p>
              </div>
            </div>
          </section>

          {/* Section: The Step-by-Step Verification Process */}
          <section
            aria-labelledby="process-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <h2
                id="process-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                The 5-step revenue verification process
              </h2>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Programmatic revenue verification follows a structured sequence designed to process raw transactional records into verified metrics:
            </p>

            <div className="space-y-4">
              {verificationSteps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-2 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                      Step {step.number}
                    </span>
                    <h3 className="font-syne text-base font-bold text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed pl-0 sm:pl-12">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Limitations of Self-Reported Revenue & Screenshots */}
          <section
            aria-labelledby="limitations-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h2
                id="limitations-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Limitations of self-reported revenue and screenshots
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              While screenshots of payment dashboards remain common in the build-in-public community, they carry significant inherent limitations when evaluated as financial evidence:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Editable DOM & Visual Artifacts
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Browser developer tools allow any number on a web dashboard to be visually modified in seconds before capturing an image, making static screenshots unreliable as proof.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Gross Volume vs. Recurring Revenue
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Dashboard charts often display total gross transaction volume (GMV), which includes one-time charges, refunds, and pass-through payments that do not represent actual SaaS MRR.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Unaccounted Refunds & Failed Charges
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  A screenshot taken immediately after an invoice is created does not reflect subsequent payment failures, chargebacks, or customer refunds that occur afterward.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <h3 className="font-syne text-sm font-bold text-white">
                  Test and Synthetic Transactions
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Without automated filtering, sandbox payments, internal founder self-billing, or artificial transaction spikes can artificially inflate reported revenue.
                </p>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#09090b]/40 mt-6">
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">
                  Comparison between Payment-Backed Revenue Verification and Self-Reported Screenshots
                </caption>
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th scope="col" className="p-4 font-syne font-bold text-white">
                      Dimension
                    </th>
                    <th scope="col" className="p-4 font-syne font-bold text-primary">
                      Payment-Backed Verification
                    </th>
                    <th scope="col" className="p-4 font-syne font-bold text-neutral-400">
                      Self-Reported Screenshots
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-neutral-300">
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Data Provenance
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Direct payment-provider API records
                    </td>
                    <td className="p-4 text-neutral-500">
                      Static images or manual text entries
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Data Integrity
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Algorithmic anomaly & test-mode filtering
                    </td>
                    <td className="p-4 text-neutral-500">
                      Vulnerable to client-side DOM edits
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Metric Consistency
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Standardized MRR / ARR calculation rules
                    </td>
                    <td className="p-4 text-neutral-500">
                      Variable definitions (e.g., gross volume vs MRR)
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="p-4 font-medium text-white">
                      Currency Normalization
                    </th>
                    <td className="p-4 text-emerald-400 font-medium">
                      Automated multi-currency reconciliation
                    </td>
                    <td className="p-4 text-neutral-500">
                      Unverified currency conversions
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Supported Payment Providers */}
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
              Revenue verification requires tight integration with established payment processors to read transaction ledgers and active customer subscriptions:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <h3 className="font-syne text-base font-bold text-white">
                    Stripe Revenue Verification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verification connects to Stripe using restricted read-only credentials. The system inspects completed customer charges, active subscription schedules, invoice items, and refund records to compute verified MRR and ARR across supported currencies.
                </p>
                <ul className="text-xs text-neutral-400 space-y-1.5 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Read-only subscription & charge access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Automated multi-currency calculation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Reconciliation of recurring invoice cycles</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <h3 className="font-syne text-base font-bold text-white">
                    Razorpay Revenue Verification
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Verification connects to Razorpay using restricted read-only credentials. The system reads captured payments, active recurring plans, and settled orders to establish verified revenue figures for businesses operating in India and international markets.
                </p>
                <ul className="text-xs text-neutral-400 space-y-1.5 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Read-only payments & orders sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Support for INR and international payment plans</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Recurring subscription plan validation</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section: Privacy and Security Boundaries */}
          <section
            aria-labelledby="privacy-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-primary" />
              <h2
                id="privacy-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                Privacy, credentials, and security boundaries
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Revenue verification is designed with strict boundaries to ensure that financial validation does not compromise proprietary customer records or payment infrastructure:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h3 className="font-syne text-sm font-bold text-white">
                    Restricted Read-Only Access
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Verification requires only read permissions for charges, subscriptions, and invoices. The system cannot initiate transfers, move funds, create charges, or modify gateway settings.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <EyeOff className="w-4 h-4" />
                  <h3 className="font-syne text-sm font-bold text-white">
                    No Cardholder Data Access
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  The verification process does not access, store, or handle customer credit card numbers, CVVs, or personal banking information.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Lock className="w-4 h-4" />
                  <h3 className="font-syne text-sm font-bold text-white">
                    Encrypted Credentials
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Integration access tokens and API keys are encrypted at rest using industry-standard cryptographic protocols.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <h3 className="font-syne text-sm font-bold text-white">
                    Founder Visibility Controls
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Founders retain complete control over their profile visibility and can toggle public visibility off or disconnect provider integrations at any time.
                </p>
              </div>
            </div>
          </section>

          {/* Section: How Verifii Implements Revenue Verification */}
          <section
            aria-labelledby="verifii-impl-heading"
            className="space-y-6 pt-4 border-t border-white/[0.05]"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2
                id="verifii-impl-heading"
                className="text-2xl sm:text-3xl font-black font-syne uppercase tracking-tight text-white"
              >
                How Verifii implements revenue verification
              </h2>
            </div>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              Verifii is a payment-backed startup revenue verification platform that helps founders verify MRR and ARR using connected payment-provider data from Stripe and Razorpay.
            </p>
            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
              By connecting your payment gateway through Verifii, software companies can replace unverifiable screenshot claims with an automated, payment-backed trust profile. Verified founders can showcase their verified metrics, embed public trust badges, and rank on the open{" "}
              <Link
                href="/leaderboard"
                className="text-primary underline hover:text-white transition-colors"
              >
                Verifii Leaderboard
              </Link>
              .
            </p>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              To learn more about the platform entity and its architecture, read our comprehensive guide:{" "}
              <Link
                href="/what-is-verifii"
                className="text-primary underline hover:text-white transition-colors font-medium"
              >
                What is Verifii?
              </Link>
              .
            </p>
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
              Common questions about startup revenue verification methodology, security, and data access:
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
                Connect your Stripe or Razorpay account to establish payment-backed credibility for your startup.
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

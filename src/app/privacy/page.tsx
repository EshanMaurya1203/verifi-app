import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, Lock, CalendarDays, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Verifii protects, verifies, and secures your startup's financial data with read-only integrations.",
  alternates: {
    canonical: "https://www.verifii.in/privacy/",
  }
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.verifii.in/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Privacy Policy",
      "item": "https://www.verifii.in/privacy/"
    }
  ]
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white font-sans selection:bg-primary selection:text-[#080808]">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          Return to Platform
        </Link>

        {/* Hero Section */}
        <section className="relative mb-16">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Data Integrity Protocol</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-syne uppercase tracking-tight text-white mb-6">
            Privacy Policy
          </h1>
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Effective Date: May 19, 2026</span>
          </div>
        </section>

        {/* Introduction / Commitment Card */}
        <section className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-8 mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-[40px] rounded-full" />
          <h2 className="text-lg font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> The Verifii Commitment
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed mb-4">
            Verifii is built to bring ultimate clarity and trust to the startup ecosystem. To achieve this, security and privacy are native architectural features of our platform. We strictly access financial logs through secure, read-only authorized API channels and verify startup metrics with zero modification permissions.
          </p>
          <p className="text-neutral-400 text-xs font-semibold leading-relaxed">
            We never sell, rent, or distribute your transaction lists or proprietary revenue metrics to data brokers or third-party advertisers. All telemetry, credential handling, and audit parameters are encrypted at rest and in transit.
          </p>
        </section>

        {/* Core Content */}
        <div className="space-y-12">
          {/* Section 1 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">01.</span> Collected Information
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              When registering a startup profile on Verifii, we collect key metadata necessary to identify your business entity and establish verified records:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Founder Details:</strong> Full name, verified business email, social profile links (LinkedIn/Twitter), title, and biographic profile parameters.</li>
              <li><strong className="text-white">Startup Profile:</strong> Registered legal name, slug identifiers, category/industry classification, target city, and company logo uploads.</li>
              <li><strong className="text-white">Infrastructure Logs:</strong> Security logs, network telemetry, source IP mappings, browser metadata, and device configuration strings to prevent sybil listing attacks or spoofing.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">02.</span> Payment Provider Integrations
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              To verify startup revenue with zero synthetic bias, we integrate directly with standard payment processing gateways (Stripe, Razorpay) using secure API authorization tokens:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Read-Only Authority:</strong> Every payment credential connected to Verifii operates under isolated, strictly read-only execution roles. Verifii is architecturally blocked from creating charges, issuing refunds, modifying billing profiles, or moving customer balances.</li>
              <li><strong className="text-white">Encrypted Vault Storage:</strong> Connected gateway tokens are encrypted in our database using dynamic AES-256 encryption keys to safeguard against unauthorized database access.</li>
              <li><strong className="text-white">Dynamic Snapshot Engine:</strong> Transactions are synced silently in the background to calculate MRR (Monthly Recurring Revenue), growth momentum, and transaction authenticity statistics.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">03.</span> Verification Metrics Data
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              We process transaction metrics through localized verification routines to yield aggregated trust ratings (Self-Reported, Payment-Connected, Revenue-Verified, High-Confidence) visible on public startup profile pages. Raw individual customer names, card details, transaction descriptions, and proprietary payment tokens are never exposed on your public sharing cards. Only clean aggregated metrics (MRR, MoM Growth Rate, and Confidence Tiers) are rendered.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">04.</span> Information Retention & Vaulting
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              We retain account data and aggregated financial snapshots as long as your profile remains registered on the platform. If a founder decides to offboard, they can trigger an atomic credentials wipe. This wipes connected payment access tokens, historical raw transactions, and calculated snapshots from Verifii&apos;s database, leaving zero trailing residual logs.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">05.</span> Cookies & Analytics
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              We use strictly necessary browser cookies to authenticate founder sessions, persist user state, and safeguard against security anomalies. Additionally, we run lightweight, anonymous client-side telemetry to calculate leaderboard clickthrough rates and visitor patterns. These analytics do not capture identifiable proprietary information.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">06.</span> Founder & User Rights
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Under global data sovereignty standard practices, founders have comprehensive controls over their corporate data:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Access & Rectification:</strong> The right to audit, view, and manually edit founder descriptions, locations, and social connections from the settings panel.</li>
              <li><strong className="text-white">Connection Erasure:</strong> The right to delete payment gateways, recalculate metrics, or wipe the verification history completely at any point in time.</li>
              <li><strong className="text-white">Profile Revocation:</strong> The right to completely unlist the company profile from public directories and leaderboards.</li>
            </ul>
          </section>

          {/* Section 7 - Contact placeholder */}
          <section className="pt-8 border-t border-white/[0.03]">
            <div className="bg-[#09090b]/40 border border-white/[0.06] backdrop-blur-md p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Privacy Protocol Inquiries</h4>
                <p className="text-neutral-500 text-xs">For access key inquiries, cryptographic wipes, or data audits.</p>
              </div>
              <a 
                href="mailto:privacy@verifii.in" 
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-bold uppercase tracking-wider text-primary/80"
              >
                <Mail className="w-3.5 h-3.5" />
                privacy@verifii.in
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

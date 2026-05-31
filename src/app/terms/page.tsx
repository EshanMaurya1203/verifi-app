import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, Scale, CalendarDays, ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Verifi",
  description: "Terms of Service governing the use of Verifi's startup revenue verification platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#050507] text-white font-sans selection:bg-primary selection:text-[#080808]">
      <Navbar />

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
            <Scale className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Legal Operating Protocol</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-syne uppercase tracking-tight text-white mb-6">
            Terms of Service
          </h1>
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-bold uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Last Updated: May 19, 2026</span>
          </div>
        </section>

        {/* Agreement Card */}
        <section className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 backdrop-blur-md rounded-3xl p-8 mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-[40px] rounded-full" />
          <h2 className="text-lg font-black uppercase tracking-wider text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Agreement to Terms
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed mb-4">
            Welcome to Verifi. By creating a founder profile, submitting startup information, or connecting payment processor access keys, you agree to comply with and be bound by these Terms of Service. Please read them thoroughly before utilizing our metrics and trust protocol.
          </p>
          <p className="text-neutral-400 text-xs font-semibold leading-relaxed">
            If you do not agree to these terms, you are prohibited from utilizing the verification services, listing on public leaderboards, or distributing dynamic verification badges.
          </p>
        </section>

        {/* Core Content */}
        <div className="space-y-12">
          {/* Section 1 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">01.</span> Platform Usage & Credentials
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verifi provides a decentralized web platform designed to analyze, verify, and publicly audit startup financial metrics (such as Monthly Recurring Revenue and growth consistency). To use the platform:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Founder Accounts:</strong> You must be an authorized founder, officer, or legal representative of the startup to establish its profile and authorize integrations.</li>
              <li><strong className="text-white">Credential Integrity:</strong> You are responsible for safeguarding your login identifiers and linked third-party session tokens.</li>
              <li><strong className="text-white">Authorized Access:</strong> You grant Verifi permission to query your linked payment processors in a strictly read-only capacity to extract, normalize, and score revenue logs.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">02.</span> Startup Submissions
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              When submitting startup listings, assets, descriptions, and gateway integrations to Verifi:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Accuracy Warranty:</strong> You warrant that all manual text fields, identity credentials, and self-reported parameters are complete, truthful, and free of misrepresentation.</li>
              <li><strong className="text-white">IP & Brand Licenses:</strong> You grant Verifi a worldwide, non-exclusive, royalty-free license to display your company name, logo, category, and verified metrics on our public leaderboards and badges.</li>
              <li><strong className="text-white">Ownership of Content:</strong> You retain complete ownership of all data submitted. Verifi acts strictly as a verification pipeline and display wrapper.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">03.</span> Verification Limitations & Trust Ratings
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Our automated scoring engine processes transactional datasets to calculate trust scores and assign Verification Tiers. You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">No Investment Advice:</strong> Verification badges, growth benchmarks, and leaderboard stats do not constitute financial audits, credit ratings, or investment advice. Investors should perform independent due diligence.</li>
              <li><strong className="text-white">As-Is Snapshots:</strong> Metrics represent transient trailing periods and depend entirely on the precision and completeness of the connected payment processors.</li>
              <li><strong className="text-white">Algorithmic Auditing:</strong> Verifi reserves the right to apply automated anomaly detection filters (such as spike, repetitions, or customer volume verification) to flag suspect profiles.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">04.</span> Account Ownership & Termination
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Verification profiles belong to the authorized founder holding domain/ownership verification. We reserve the absolute right to suspend, terminate, or unlist any company profile that violates these terms, fails pattern checks, or registers deceptive financial parameters. Founders may request profile termination and an atomic database credentials wipe at any point.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">05.</span> Prohibited Conduct
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              You agree not to engage in any of the following prohibited behaviors:
            </p>
            <ul className="list-disc pl-5 text-neutral-400 text-sm space-y-2 leading-relaxed">
              <li><strong className="text-white">Synthetic Revenue Spoofing:</strong> Triggering artificial, circular, or mock self-billing transactions through connected payment processors to inflate verified MRR.</li>
              <li><strong className="text-white">Sybil Listings:</strong> Creating duplicate, fictitious, or cloned company profiles to claim multiple leaderboard positions.</li>
              <li><strong className="text-white">Infrastructure Attacks:</strong> Attempting to bypass endpoint security, inject scripts, scrape protected founder metadata, or trigger denial of service attacks.</li>
              <li><strong className="text-white">Malicious Badging:</strong> Hotlinking, altering, or spoofing the public SVG/embed badges on unauthorized domains.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">06.</span> Liability Limitations
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, VERIFI AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF REVENUE, PROFITS, BUSINESS REPUTATION, OR INVESTOR TRUST ARISING OUT OF OR IN CONNECTION WITH ACCURACY BENCHMARKS, ALGORITHMIC METRICS FLAGS, PUBLIC DIRECTORIES, LEADERBOARD RANKINGS, OR BADGE EMBEDS.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h3 className="text-lg font-black font-syne uppercase tracking-wide text-white flex items-center gap-3">
              <span className="text-primary">07.</span> Dispute Handling & Jurisdictional Scope
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Any dispute, claim, or controversy arising out of these terms shall be settled through binding, confidential arbitration. The governing law of these terms shall be resolved under standard corporate arbitration jurisdictions, without regard to its conflict of law provisions.
            </p>
          </section>

          {/* Contact widget */}
          <section className="pt-8 border-t border-white/[0.03]">
            <div className="bg-[#09090b]/40 border border-white/[0.06] backdrop-blur-md p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Legal Protocol Inquiries</h4>
                <p className="text-neutral-500 text-xs">For questions regarding terms, licensing, and arbitration.</p>
              </div>
              <a 
                href="mailto:legal@verifi.app" 
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-xs font-bold uppercase tracking-wider text-primary/80"
              >
                <Mail className="w-3.5 h-3.5" />
                legal@verifi.app
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

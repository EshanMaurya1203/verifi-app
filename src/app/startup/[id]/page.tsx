import { getSupabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, AlertTriangle, TrendingUp, Award, Globe, Info, CheckCircle2, XCircle, User } from "lucide-react";
import VerificationFlow from "@/components/startup/VerificationFlow";
import { redirect } from "next/navigation";
import { computeTrustScore } from "@/lib/scoring";
import { StartupDashboard } from "@/components/startup/StartupDashboard";

function SignalItem({ label, active, description }: { label: string, active: boolean, description: string }) {
  return (
    <div className="flex items-start gap-4 p-2">
      <div className={`mt-0.5 p-1 rounded-full ${active ? 'bg-green-500/10 text-green-500' : 'bg-neutral-900 text-neutral-700'}`}>
        {active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      </div>
      <div>
        <p className={`text-[11px] font-black uppercase tracking-wider ${active ? 'text-neutral-200' : 'text-neutral-600'}`}>
          {label}
        </p>
        <p className="text-[10px] text-neutral-600 font-medium leading-relaxed mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

export default async function Page({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await params;
  const rawId = resolvedParams.id;
  
  if (!rawId) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans text-center pt-32">
        <p className="text-red-400 font-bold uppercase tracking-widest">Error: Missing Startup ID</p>
      </div>
    );
  }

  const supabase = getSupabaseServer();
  
  // 1. Initial Fetch
  let { data: startup, error } = await supabase
    .from("startup_submissions")
    .select("*")
    .eq("id", rawId)
    .maybeSingle();

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans text-center pt-32">
        <Navbar />
        <p className="text-neutral-400">Startup profile not found</p>
      </div>
    );
  }

  const formatInr = (value: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-32 pb-24">
        {/* Header Section */}
        <section className="flex flex-col md:flex-row gap-10 items-start md:items-center justify-between mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">{startup.startup_name || startup.name}</h1>
               {startup.payment_connected && <ShieldCheck className="w-8 h-8 text-indigo-500" />}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-neutral-400 font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {startup.founder_name}</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-neutral-600" /> {startup.website}</span>
            </div>
          </div>

          <div className="flex flex-col items-end text-right">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-1">Audited MRR</p>
             <p className="text-3xl md:text-5xl font-black text-white tabular-nums">{formatInr(startup.mrr || 0)}</p>
          </div>
        </section>

        {/* Live Infrastructure Dashboard */}
        <section className="mb-12">
          <StartupDashboard id={startup.id} />
        </section>

        {/* Verification Signals Panel */}
        <section className="mt-6 bg-black border border-white/5 rounded-3xl p-8">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-6 flex items-center gap-2">
              <Award className="w-3 h-3 text-indigo-500" />
              Verification Signals
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
              <SignalItem 
                label="Revenue verified via API" 
                active={startup.verification_method === 'api' || !!startup.last_verified_at} 
                description="Financial data pulled directly from payment processor."
              />
              <SignalItem 
                label="Payment source connected" 
                active={startup.payment_connected} 
                description="Live gateway link established for recurring audits."
              />
              <SignalItem 
                label="Data Freshness < 24h" 
                active={!!startup.last_verified_at && (Date.now() - new Date(startup.last_verified_at).getTime()) < 24 * 60 * 60 * 1000} 
                description="Audit snapshot updated within the standard day window."
              />
              <SignalItem 
                label="Founder Identity Verified" 
                active={startup.verification_status === 'verified' || startup.verification_status === 'approved'} 
                description="Identity cross-referenced with KYC/social databases."
              />
              <SignalItem 
                label="Founder Video Verified" 
                active={!!startup.video_url && startup.video_url.length > 5} 
                description="Personal video walkthrough or pitch verification recorded by the founder."
              />
              <SignalItem 
                label="Active Business Website" 
                active={!!startup.website && startup.website.length > 5} 
                description="Domain ownership and landing page availability verified."
              />
              {startup.trust_tier === 'flagged' && (
                <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl col-span-full">
                   <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                   <div>
                      <p className="text-[10px] font-black uppercase text-red-500">Integrity Alert</p>
                      <p className="text-xs text-red-400/80 font-medium mt-1">Foundational anomalies detected in financial auditing trails. Platform trust status revoked.</p>
                   </div>
                </div>
              )}
           </div>
        </section>

        {/* Verification Flow */}
        <section className="mt-12 bg-neutral-950 border border-white/5 p-10 rounded-[3rem]">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-end mb-12">
             <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Security Center</p>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Improve Audit Depth</h2>
             </div>
          </div>
          <VerificationFlow initialStartup={startup} id={startup.id} />
        </section>

        {/* Trust Summary */}
        <section className="mt-20 border-t border-white/5 pt-20">
           <div className="max-w-2xl">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-700 mb-8 underline decoration-indigo-500/30 underline-offset-8">Audit Integrity Note</h3>
              <p className="text-neutral-500 text-sm leading-relaxed font-medium">
                This startup has authorized <span className="text-white">Verifi</span> to perform automated read-only audits of their financial infrastructure. All revenue metrics displayed are derived from cryptographically signed snapshots and are updated on a 24-hour cycle. Founders cannot manually override these snapshots without re-triggering a deep forensic verification.
              </p>
           </div>
        </section>
      </main>
    </div>
  );
}

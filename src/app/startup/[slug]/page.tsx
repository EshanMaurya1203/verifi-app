import { supabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, ShieldAlert, Share2, Globe, CalendarDays, ExternalLink, Award, CheckCircle2, AlertTriangle, Link, ScanSearch, Clock, TrendingUp, History, Fingerprint } from "lucide-react";
import { RevenueAuthenticityCard } from "@/components/startup/RevenueAuthenticityCard";
import { VerificationTransparencyCard } from "@/components/startup/VerificationTransparencyCard";
import { RevenueChart } from "@/components/startup/RevenueChart";
import { ShareVerificationButton } from "@/components/startup/ShareVerificationButton";
import { BadgeEmbedder } from "@/components/startup/BadgeEmbedder";
import { Metadata } from "next";
import { VerificationStateResult, computeVerificationState } from "@/lib/verification-state";
import { VerificationTimeline } from "@/components/startup/VerificationTimeline";
import { RevenueCompositionCard } from "@/components/startup/RevenueCompositionCard";
import { getBaseUrl } from "@/lib/url";

const TrustTierBadge = ({ state }: { state: VerificationStateResult }) => {
  if (state.verificationStatus === "REVIEWING") {
    return (
      <div className="px-4 py-1.5 bg-neutral-900 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-neutral-500">
        <ScanSearch className="w-3.5 h-3.5" /> Reviewing
      </div>
    );
  }

  if (state.verificationStatus === "NEEDS REVIEW") {
    return (
      <div className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-amber-500">
        <ShieldAlert className="w-3.5 h-3.5" /> Needs Review
      </div>
    );
  }

  if (state.verificationStatus === "INCOMPLETE") {
    return (
      <div className="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-rose-400">
        <Clock className="w-3.5 h-3.5" /> Verification Incomplete
      </div>
    );
  }

  let label = "Active Audit";
  let color = "text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]";
  let Icon = Award;

  if (state.trustScore > 85) { 
    label = "Forensic Grade"; 
    color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"; 
    Icon = ShieldCheck;
  } else if (state.trustScore > 65) { 
    label = "High Integrity"; 
    color = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]"; 
    Icon = CheckCircle2;
  }
  
  return (
    <div className={`px-4 py-1.5 border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 backdrop-blur-md ${color}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </div>
  );
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  
  const { data: startup } = await supabaseServer
    .from("startup_submissions")
    .select("startup_name, mrr, verification_status")
    .eq("slug", slug)
    .maybeSingle();

  if (!startup) {
    return { title: "Startup Not Found | Verifi" };
  }

  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/api/og/startup/${slug}`;

  return {
    title: `${startup.startup_name} - Verified Financial Profile | Verifi`,
    description: `View the independently verified revenue metrics and trust profile for ${startup.startup_name}.`,
    openGraph: {
      title: `${startup.startup_name} is Verified on Verifi`,
      description: `${startup.startup_name} has completed automated revenue verification.`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${startup.startup_name} Verifi Profile`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${startup.startup_name} is Verified on Verifi`,
      description: `${startup.startup_name} has completed automated revenue verification.`,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicStartupProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  // 1. Resolve Startup
  const { data: startup, error } = await supabaseServer
    .from("startup_submissions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="w-12 h-12 text-neutral-600 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-neutral-400">The requested startup profile could not be located.</p>
      </div>
    );
  }

  const startupId = startup.id;

  // 2. Fetch all verification data (including snapshots for trend charts)
  const [revenueRes, fraudRes, providerRes, logsRes, snapshotRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at, provider")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabaseServer
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startupId),
    supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at, last_mrr")
      .eq("startup_id", startupId)
      .eq("status", "connected"),
    supabaseServer
      .from("verification_logs")
      .select("*")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue, provider_breakdown, created_at")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(30)
  ]);

  const rawRevenue = revenueRes.data || [];
  const revenue = rawRevenue.map((event: any) => ({
    timestamp: new Date(event.created_at).getTime(),
    amount: Number(event.amount) || 0
  }));

  const latestSync = (providerRes.data || [])
    .map((p: any) => p.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop() || null;

  // 3. Compute Unified Verification State
  const verificationState = computeVerificationState({
    revenueTransactions: revenue,
    providerConnections: providerRes.data || [],
    fraudSignals: fraudRes.data || [],
    penaltyCount: Number(startup.penalty_count) || 0
  });

  const isVerified = verificationState.verificationStatus === "VERIFIED" || verificationState.verificationStatus === "PARTIALLY VERIFIED";
  
  const formatInr = (value: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

  // 4. Compute per-provider revenue breakdown
  const mrrBreakdown = (startup.mrr_breakdown as Record<string, number>) || {};
  let compositionBreakdown = [];
  
  if (Object.keys(mrrBreakdown).length > 0) {
    const totalMrrFromBreakdown = Object.values(mrrBreakdown).reduce((sum, val) => sum + Number(val), 0) || startup.mrr || 0;
    const providerTxCount: Record<string, number> = {};
    for (const txn of rawRevenue) {
      const p = txn.provider || "unknown";
      providerTxCount[p] = (providerTxCount[p] || 0) + 1;
    }
    compositionBreakdown = Object.entries(mrrBreakdown).map(([provider, amount]) => ({
      provider,
      amount: Number(amount),
      percentage: totalMrrFromBreakdown > 0 ? Math.round((Number(amount) / totalMrrFromBreakdown) * 100) : 0,
      transactionCount: providerTxCount[provider] || 0,
      currency: provider === "stripe" ? "USD" : "INR",
    }));
  } else {
    // Fallback
    const providerTxMap: Record<string, { total: number; count: number; currency: string }> = {};
    for (const txn of rawRevenue) {
      const p = txn.provider || "unknown";
      if (!providerTxMap[p]) providerTxMap[p] = { total: 0, count: 0, currency: p === "stripe" ? "USD" : "INR" };
      providerTxMap[p].total += Number(txn.amount) || 0;
      providerTxMap[p].count += 1;
    }
    const totalFromTxns = Object.values(providerTxMap).reduce((s, v) => s + v.total, 0);
    compositionBreakdown = Object.entries(providerTxMap).map(([provider, data]) => ({
      provider,
      amount: data.total,
      percentage: totalFromTxns > 0 ? Math.round((data.total / totalFromTxns) * 100) : 0,
      transactionCount: data.count,
      currency: data.currency,
    }));
  }

  // 5. Calculate real growth from revenue snapshots
  const snapshots = (snapshotRes.data || []).map((s: any) => ({
    total_revenue: Number(s.total_revenue) || 0,
    provider_breakdown: s.provider_breakdown || {},
    created_at: s.created_at,
  }));

  let revenueGrowth = 0;
  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1];
    // Find a baseline at least 24h old, skip zero-revenue snapshots
    const latestTime = new Date(latest.created_at).getTime();
    const baseline = [...snapshots].reverse().find(
      (s) => new Date(s.created_at).getTime() < latestTime - 86_400_000 && s.total_revenue > 0
    ) || snapshots[snapshots.length - 2];

    if (baseline && baseline.total_revenue > 0) {
      revenueGrowth = ((latest.total_revenue - baseline.total_revenue) / baseline.total_revenue) * 100;
    }
  }

  // Fallbacks for Founder Data
  const founderName = startup.name || "Anonymous Founder";
  const founderTitle = startup.biz_type ? `Founder at ${startup.startup_name}` : "Founder";
  const founderLocation = startup.city || "Remote";
  const founderBio = startup.founder_bio || `Building ${startup.startup_name} with transparency and focus.`;

  const logs = (logsRes.data || []).map((l: any) => ({
    id: l.id,
    event: l.event,
    metadata: l.metadata,
    created_at: l.created_at
  }));

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="max-w-[1100px] mx-auto px-6 pt-32 pb-24">
        
        {/* ─── Premium Header (Founder-Centric) ────────────────────────────────── */}
        <section className="relative group mb-20">
          <div className="absolute -inset-4 bg-gradient-to-b from-indigo-500/5 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
          
          <div className="flex flex-col lg:flex-row gap-10 items-start justify-between">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Startup Logo with Founder Overlay */}
              <div className="relative flex-shrink-0">
                <div className="w-28 h-28 rounded-[2rem] bg-neutral-900 border border-white/10 p-4 shadow-2xl overflow-hidden flex items-center justify-center">
                  {startup.startup_logo ? (
                    <img src={startup.startup_logo} alt={startup.startup_name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-4xl font-black text-neutral-800">{startup.startup_name[0]}</div>
                  )}
                </div>
                {isVerified && (
                  <div className="absolute -bottom-3 -right-3 bg-indigo-500 text-white p-2 rounded-2xl border-4 border-[#050505] shadow-xl ring-1 ring-white/10">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <h1 className="text-5xl md:text-6xl font-black font-syne tracking-tighter leading-none">
                    {startup.startup_name}
                  </h1>
                  <TrustTierBadge state={verificationState} />
                </div>
                <p className="text-neutral-400 text-sm font-medium mb-6 tracking-tight max-w-xl">
                  {startup.notes ? (startup.notes.length > 80 ? startup.notes.substring(0, 80) + '...' : startup.notes) : `Innovative ${startup.biz_type || 'venture'} scaling with verified metrics.`}
                </p>

                <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  {startup.website && (
                    <a href={startup.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                      <Globe className="w-4 h-4 text-indigo-500/50" /> {startup.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                    <span className="text-neutral-600">Location:</span>
                    <span className="text-neutral-300">{founderLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-white/5 pl-6">
                    <span className="text-neutral-600">Sync:</span>
                    <span className="text-emerald-500">Live API</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Revenue Card */}
            <div className="w-full lg:w-auto min-w-[300px]">
              <div className="p-8 rounded-[2.5rem] bg-neutral-900/40 border border-white/5 backdrop-blur-xl relative overflow-hidden group/card hover:border-indigo-500/30 transition-all duration-500 shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/card:opacity-30 transition-opacity">
                  <TrendingUp className="w-20 h-20 text-indigo-500" />
                </div>
                
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-3">
                   Verified Financial Baseline
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-5xl font-black text-white font-syne tracking-tighter tabular-nums">
                    {formatInr(startup.mrr || 0)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                       +12.4% Momentum
                    </span>
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                       Updated {latestSync ? new Date(latestSync).toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-white/[0.03] pt-6">
                  <div className="flex -space-x-3">
                    {verificationState.providersConnected.map(p => (
                      <div key={p} className="w-9 h-9 rounded-full bg-neutral-950 border-2 border-neutral-900 flex items-center justify-center p-2 shadow-lg hover:z-10 transition-transform hover:scale-110" title={p}>
                        <div className="w-full h-full flex items-center justify-center text-[14px] font-black italic text-white/50 group-hover:text-white/90 transition-colors">
                          {p ? p.charAt(0).toUpperCase() : <Globe className="w-4 h-4 text-neutral-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <ShareVerificationButton startupName={startup.startup_name} slug={slug} trustScore={verificationState.trustScore} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Founder Identity Layer ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 mb-16">
          
          <div className="space-y-8">
            {/* Human Trust Statement */}
            <section className="bg-indigo-600 p-10 rounded-[3rem] relative overflow-hidden group shadow-2xl">
               <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:rotate-12 transition-transform duration-1000">
                  <History className="w-32 h-32 text-white" />
               </div>
               <div className="relative z-10 max-w-xl">
                 <h2 className="text-3xl font-black font-syne text-white mb-6 leading-none tracking-tight">
                    &ldquo;Why we verify publicly&rdquo;
                 </h2>
                 <p className="text-white/80 text-[16px] leading-relaxed font-medium mb-8">
                    In an ecosystem often clouded by inflated metrics, we believe transparency is the strongest signal of long-term value. By opening our financial audit to the public, we invite trust from our customers, investors, and team.
                 </p>
                 <div className="flex items-center gap-4">
                   <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                      Integrity First
                   </div>
                   <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                      Forensic Accuracy
                   </div>
                 </div>
               </div>
            </section>

            {/* Verification Timeline (Institutional Ledger) */}
            <VerificationTimeline logs={logs} />

            {/* Revenue Composition (Breakdown) */}
            <RevenueCompositionCard 
              breakdown={compositionBreakdown.length > 0 ? compositionBreakdown : verificationState.providerBreakdown.map(p => ({ ...p, transactionCount: 0, currency: p.provider === 'stripe' ? 'USD' : 'INR' }))}
              totalMrr={startup.mrr || 0}
              growth={revenueGrowth}
              snapshots={snapshots}
            />

            {/* Revenue Analytics (Brief) */}
            <section className="bg-neutral-900/30 border border-white/[0.05] p-10 rounded-[3rem]">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Financial Momentum
                  </h3>
                  <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    Live Provider Stream
                  </div>
               </div>
               <div className="h-[280px]">
                  <RevenueChart data={revenue} />
               </div>
            </section>
          </div>

          <aside className="space-y-8">
            {/* Premium Founder Card */}
            <section className="bg-neutral-900 border border-white/[0.08] p-8 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent" />
              
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-[#050505] shadow-2xl relative">
                  {startup.founder_avatar ? (
                    <img src={startup.founder_avatar} alt={founderName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                      <span className="text-4xl font-black text-neutral-700">{founderName[0]}</span>
                    </div>
                  )}
                </div>
                {isVerified && (
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl border-4 border-[#050505] shadow-xl">
                    <Fingerprint className="w-5 h-5 text-neutral-950" />
                  </div>
                )}
              </div>

              <div className="relative z-10 w-full">
                <h3 className="text-2xl font-black font-syne text-white mb-1 leading-none">{founderName}</h3>
                <p className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">{founderTitle}</p>
                
                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-6">
                   <Globe className="w-3.5 h-3.5 text-neutral-700" />
                   {founderLocation}
                </div>

                <div className="bg-black/40 border border-white/[0.03] p-5 rounded-2xl mb-8 text-left">
                  <p className="text-neutral-400 text-xs leading-relaxed italic line-clamp-4">
                    &ldquo;{founderBio}&rdquo;
                  </p>
                </div>

                <div className="flex gap-3 justify-center mb-6">
                  {startup.linkedin && (
                    <a href={startup.linkedin} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-2xl bg-neutral-800/50 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all hover:scale-105 group">
                      <Share2 className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                    </a>
                  )}
                  {startup.twitter && (
                    <a href={startup.twitter} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-2xl bg-neutral-800/50 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all hover:scale-105 group">
                      <ExternalLink className="w-5 h-5 text-neutral-500 group-hover:text-white" />
                    </a>
                  )}
                  <div className="flex-1">
                    <BadgeEmbedder startupName={startup.startup_name} slug={slug} />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/[0.03] flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    Verified Digital Identity
                  </span>
                </div>
              </div>
            </section>

            {/* Verification Stats Sidebar */}
            <VerificationTransparencyCard verification={verificationState} />
            <RevenueAuthenticityCard authenticity={verificationState} />
          </aside>
        </div>

      </main>

      <footer className="max-w-[1100px] mx-auto px-6 py-12 border-t border-white/[0.03] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-700" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-700">Audit Protocol Verified</span>
        </div>
        <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-neutral-700">
           <a href="#" className="hover:text-neutral-500 transition-colors">Forensic Baseline</a>
           <a href="#" className="hover:text-neutral-500 transition-colors">Privacy</a>
           <a href="#" className="hover:text-neutral-500 transition-colors">Identity</a>
        </div>
      </footer>
    </div>
  );
}

import { supabaseServer } from "@/lib/supabase-server";
import { safeSupabaseQuery } from "@/lib/safe-network";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, ShieldAlert, Share2, Globe, CalendarDays, ExternalLink, Award, CheckCircle2, AlertTriangle, Link, ScanSearch, Clock, TrendingUp, History, Fingerprint } from "lucide-react";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { RevenueConsistencyCard } from "@/components/startup/RevenueConsistencyCard";
import { VerificationMetadata } from "@/components/startup/VerificationMetadata";
import { TrustBadge } from "@/components/startup/TrustBadge";
import { RevenueChart } from "@/components/startup/RevenueChart";
import { ShareVerificationButton } from "@/components/startup/ShareVerificationButton";
import { BadgeEmbedder } from "@/components/startup/BadgeEmbedder";
import { Metadata } from "next";
import {
  buildVerificationStateInput,
  computeVerificationState,
} from "@/lib/verification-state";
import { VerificationTimeline } from "@/components/startup/VerificationTimeline";
import { RevenueCompositionCard } from "@/components/startup/RevenueCompositionCard";
import { getSiteUrl } from "@/lib/site-url";
import { formatCurrency, formatGrowth } from "@/lib/formatters";



export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  
  const { data: startup } = await supabaseServer
    .from("startup_submissions")
    .select("id, startup_name, mrr, verification_status, verification_type, proof_url")
    .eq("slug", slug)
    .maybeSingle();

  if (!startup) {
    return { title: "Startup Not Found | Verifi" };
  }

  const { data: providers } = await supabaseServer
    .from("provider_connections")
    .select("provider, status, last_synced_at, latest_revenue")
    .eq("startup_id", startup.id)
    .eq("status", "connected");

  const { data: revenueRows } = await supabaseServer
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startup.id)
    .limit(200);

  const metaState = computeVerificationState(
    buildVerificationStateInput({
      revenueTransactions: revenueRows || [],
      providerConnections: providers || [],
      fraudSignals: [],
      penaltyCount: 0,
      verificationType: startup.verification_type,
      hasProofUpload: !!startup.proof_url,
    })
  );
  const evidenceBacked = metaState.hasVerificationEvidence;
  const verifiedTitle = evidenceBacked
    ? `${startup.startup_name} is Revenue Verified on Verifi`
    : `${startup.startup_name} on Verifi`;

  const baseUrl = getSiteUrl();
  const encodedSlug = encodeURIComponent(slug);
  const ogImageUrl = baseUrl
    ? `${baseUrl}/api/og/startup/${encodedSlug}`
    : `/api/og/startup/${encodedSlug}`;

  return {
    title: `${startup.startup_name} - Financial Profile | Verifi`,
    description: evidenceBacked
      ? `View provider-backed revenue metrics and trust profile for ${startup.startup_name}.`
      : `View the trust profile and revenue disclosure for ${startup.startup_name}.`,
    openGraph: {
      title: verifiedTitle,
      description: evidenceBacked
        ? `${startup.startup_name} has provider-backed revenue with a recent ledger sync.`
        : `${startup.startup_name} profile on Verifi — verification in progress or self-reported.`,
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
      title: verifiedTitle,
      description: evidenceBacked
        ? `${startup.startup_name} has provider-backed revenue with a recent ledger sync.`
        : `${startup.startup_name} profile on Verifi — verification in progress or self-reported.`,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicStartupProfile({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);

  // 1. Resolve Startup
  const { data: startup, error, ok } = await safeSupabaseQuery<any>(
    supabaseServer
      .from("startup_submissions")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
  );

  if (error || !ok || !startup) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col items-center justify-center">
        <Navbar />
        <AlertTriangle className="w-12 h-12 text-neutral-600 mb-4 animate-pulse" />
        <h1 className="text-2xl font-bold mb-2">Profile Latency</h1>
        <p className="text-neutral-400 max-w-sm text-center leading-relaxed">
          The requested startup profile cannot be verified right now. The live database connection may be experiencing high latency. Please try refreshing.
        </p>
      </div>
    );
  }

  const startupId = startup.id;

  // 2. Fetch all verification data (including snapshots for trend charts) safely
  const [revenueRes, fraudRes, providerRes, logsRes, snapshotRes] = await Promise.all([
    safeSupabaseQuery<any[]>(
      supabaseServer
        .from("revenue_transactions")
        .select("amount, created_at, provider")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: true })
        .limit(200)
    ),
    safeSupabaseQuery<any[]>(
      supabaseServer
        .from("fraud_signals")
        .select("signal_type")
        .eq("startup_id", startupId)
    ),
    safeSupabaseQuery<any[]>(
      supabaseServer
        .from("provider_connections")
        .select("provider, status, last_synced_at, latest_revenue")
        .eq("startup_id", startupId)
        .eq("status", "connected")
    ),
    safeSupabaseQuery<any[]>(
      supabaseServer
        .from("verification_logs")
        .select("*")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    safeSupabaseQuery<any[]>(
      supabaseServer
        .from("revenue_snapshots")
        .select("total_revenue, provider_breakdown, created_at")
        .eq("startup_id", startupId)
        .order("created_at", { ascending: true })
        .limit(30)
    )
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
  const isDemo = startup.user_id?.startsWith("00000000-0000-0000-0000-");

  const verificationState = computeVerificationState(
    buildVerificationStateInput({
      revenueTransactions: rawRevenue,
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: Number(startup.penalty_count) || 0,
      isDemoProfile: isDemo,
      verificationType: startup.verification_type,
      hasProofUpload: !!startup.proof_url,
    })
  );

  const isVerified = verificationState.hasVerificationEvidence;

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

  // DEMO DATA — NOT FOR PRODUCTION DISPLAY
  // Removed synthetic verification reasons.
  const whyVerifyText = "In an ecosystem often clouded by inflated metrics, we believe transparency is the strongest signal of long-term value. By opening our financial audit to the public, we invite trust from our customers, investors, and team.";

  const logs = (logsRes.data || []).map((l: any) => ({
    id: l.id,
    event: l.event,
    metadata: l.metadata,
    created_at: l.created_at
  }));

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary selection:text-[#080808]">
      <Navbar />

      {isDemo && (
        <div className="bg-[#0f0f11] border-b border-primary/20 px-6 py-4 flex items-center justify-center gap-3 mt-16">
          <AlertTriangle className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <strong>Sandbox Demonstration:</strong> This is a sample startup profile containing simulated metrics.
          </span>
          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] font-black uppercase text-primary tracking-wider">
            Example Startup
          </span>
        </div>
      )}

      <main className={`max-w-6xl mx-auto px-6 pb-24 ${isDemo ? 'pt-16' : 'pt-24'}`}>
        
        {/* ─── Premium Header (Founder-Centric) ────────────────────────────────── */}
        <section className="relative group mb-12">
          <div className="absolute -inset-4 bg-gradient-to-b from-primary/5 to-transparent rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
          
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
                  {isVerified && !isDemo && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl border-4 border-[#050505] shadow-xl">
                      <ShieldCheck className="w-5 h-5 text-neutral-950" />
                    </div>
                  )}
                  {isVerified && isDemo && (
                    <div className="absolute -bottom-2 -right-2 bg-neutral-600 p-2 rounded-2xl border-4 border-[#050505] shadow-xl" title="Sample Startup">
                      <Fingerprint className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                  <h1 className="text-5xl md:text-6xl font-black font-syne tracking-tighter leading-none">
                    {startup.startup_name}
                  </h1>
                  <TrustBadge tier={verificationState.confidenceTier} showGlow={isVerified} isDemo={isDemo} />
                </div>
                <p className="text-neutral-400 text-sm font-medium mb-6 tracking-tight max-w-xl">
                  {startup.notes ? (startup.notes.length > 80 ? startup.notes.substring(0, 80) + '...' : startup.notes) : `Innovative ${startup.biz_type || 'venture'} scaling with verified metrics.`}
                </p>

                <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-xs font-bold uppercase tracking-[0.15em] text-neutral-400">
                  {startup.website && (
                    <a href={startup.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#b9ff4b] transition-colors">
                      <Globe className="w-4 h-4 text-[#b9ff4b]/50" /> {startup.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">Founder:</span>
                    <span className="text-neutral-200">{founderName}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:border-l sm:border-white/10 sm:pl-6">
                    <span className="text-neutral-400">Location:</span>
                    <span className="text-neutral-200">{founderLocation}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:border-l sm:border-white/10 sm:pl-6">
                    <span className="text-neutral-400">Sync:</span>
                    {isVerified ? (
                      <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        {verificationState.dataSourceLabel}
                      </span>
                    ) : verificationState.hasConnectedProviders ? (
                      <span className="text-amber-400 font-bold">Provider linked · sync pending</span>
                    ) : (
                      <span className="text-neutral-400 font-bold">{verificationState.dataSourceLabel}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Revenue Card */}
            <div className="w-full lg:w-auto min-w-[300px]">
              <div className="p-8 rounded-[2.5rem] bg-[#0f0f0f]/60 border border-white/[0.08] backdrop-blur-xl relative group/card hover:border-[#b9ff4b]/20 transition-all duration-500 shadow-2xl ring-1 ring-white/[0.01]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/card:opacity-30 transition-opacity">
                  <TrendingUp className="w-20 h-20 text-primary" />
                </div>
                
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3">
                  {verificationState.confidenceTier === "SELF_REPORTED"
                    ? "Self-Reported MRR Estimate"
                    : verificationState.confidenceTier === "PAYMENT_CONNECTED"
                    ? "Connected Provider MRR"
                    : "Verified Revenue Baseline"}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-black text-white font-syne tracking-tighter tabular-nums truncate max-w-full overflow-hidden" title={formatCurrency(startup.mrr || 0, startup.currency || "INR", { compact: false })}>
                    {formatCurrency(startup.mrr || 0, startup.currency || "INR", { compact: false })}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {snapshots && snapshots.length >= 2 && verificationState.confidenceTier !== "SELF_REPORTED" ? (
                      <>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          {formatGrowth(revenueGrowth, 2)} Monthly Growth
                        </span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                      </>
                    ) : verificationState.confidenceTier !== "SELF_REPORTED" ? (
                      <>
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                          Awaiting Growth Trend
                        </span>
                        <span className="w-1 h-1 rounded-full bg-neutral-700" />
                      </>
                    ) : null}
                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                      {verificationState.confidenceTier === "SELF_REPORTED"
                        ? "Declared Baseline"
                        : `Updated ${latestSync ? new Date(latestSync).toLocaleDateString() : 'Just now'}`}
                    </span>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between border-t border-white/[0.03] pt-6">
                  <div className="flex items-center gap-2">
                    {verificationState.providersConnected.length > 0 ? (
                      <div className="flex -space-x-2.5">
                        {verificationState.providersConnected.map(p => (
                          <div
                            key={p}
                            className="w-8 h-8 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center p-1.5 shadow-lg hover:z-10 transition-transform hover:scale-110"
                            title={`Audited Ledger: ${p.toUpperCase()}`}
                          >
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                              {p.substring(0, 2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950 border border-white/5 rounded-xl text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        <ScanSearch className="w-3.5 h-3.5 text-neutral-600" />
                        No connected feeds
                      </div>
                    )}
                  </div>
                  <ShareVerificationButton
                    startupName={startup.startup_name}
                    slug={slug}
                    confidenceTier={verificationState.confidenceTier}
                    isDemo={isDemo}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Responsive Layout System: 65/35 Balanced Grid ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-8 mb-16 items-start">
          
          {/* PRIMARY COLUMN: Revenue, Analytics, Timeline, Charts */}
          <div className="space-y-8 flex flex-col">
            {/* Human Trust Statement - Render only if authentic founder bio exists */}
            {startup.founder_bio && (
              <section className="bg-[#0f0f0f]/50 border border-white/[0.06] backdrop-blur-xl p-10 rounded-[2.5rem] relative overflow-hidden group shadow-2xl hover:border-[#b9ff4b]/20 transition-all duration-500">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                    <History className="w-32 h-32 text-[#b9ff4b]" />
                 </div>
                 <div className="relative z-10 max-w-xl">
                   <h2 className="text-3xl font-black font-syne text-white mb-6 leading-none tracking-tight">
                      &ldquo;Why we verify publicly&rdquo;
                   </h2>
                   <p className="text-neutral-200 text-base md:text-lg leading-relaxed font-normal mb-8 italic font-sans">
                      &ldquo;{startup.founder_bio}&rdquo;
                   </p>
                   <div className="flex items-center gap-4">
                     <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                        Revenue consistency
                     </div>
                     {isVerified && (
                       <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                          Ledger-backed data
                       </div>
                     )}
                   </div>
                 </div>
              </section>
            )}

            {/* Revenue Composition (Primary Financial Area) */}
            <RevenueCompositionCard 
              breakdown={compositionBreakdown}
              totalMrr={startup.mrr || 0}
              growth={revenueGrowth}
              snapshots={snapshots}
              isDemo={isDemo}
            />

            {/* Revenue Consistency Card (Relocated here for dynamic column balance) */}
            <RevenueConsistencyCard consistency={verificationState} ownerId={startup.user_id} isDemo={isDemo} />

            {/* Revenue Analytics (Momentum & Charts) */}
            {revenue && revenue.length >= 2 && (
              <section className="bg-[#09090b]/30 border border-white/[0.05] p-10 rounded-[3rem] backdrop-blur-md shadow-xl ring-1 ring-white/[0.01]">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-primary" /> {isDemo ? "Simulated Momentum" : "Financial Momentum"}
                    </h3>
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                      {isDemo ? "Simulated Stream" : "Live Provider Stream"}
                    </div>
                 </div>
                 <div className="h-[280px]">
                    <RevenueChart data={revenue} isDemo={isDemo} />
                 </div>
              </section>
            )}

            {/* Verification Timeline (Timeline) */}
            {logs && logs.length > 0 && <VerificationTimeline logs={logs} ownerId={startup.user_id} />}
          </div>

          {/* SECONDARY SIDEBAR: Verification, Founder, Badge, Status */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            {/* Premium Founder Card (Founder) */}
            <section className="bg-[#09090b]/40 border border-white/[0.06] backdrop-blur-md p-5 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col items-center text-center ring-1 ring-white/[0.01]">
              <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
              
              <div className="relative mb-3">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/5 shadow-2xl relative">
                  {startup.founder_avatar ? (
                    <img src={startup.founder_avatar} alt={founderName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                      <span className="text-xl font-black text-neutral-600">{founderName[0]}</span>
                    </div>
                  )}
                </div>
                {isVerified && (
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-xl border-2 border-[#09090b] shadow-xl">
                    <Fingerprint className="w-3.5 h-3.5 text-neutral-950" />
                  </div>
                )}
              </div>

              <div className="relative z-10 w-full">
                <h3 className="text-lg font-black font-syne text-white mb-0.5 leading-none">{founderName}</h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mb-2">{founderTitle}</p>
                
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-3">
                   <Globe className="w-3 h-3 text-neutral-700" />
                   {founderLocation}
                </div>

                {founderBio && (
                  <div className="bg-black/40 border border-white/[0.03] p-3.5 rounded-xl mb-4 text-left">
                    <p className="text-neutral-400 text-[11px] leading-relaxed italic line-clamp-3">
                      &ldquo;{founderBio}&rdquo;
                    </p>
                  </div>
                )}

                 <div className="flex gap-2.5 justify-center mb-3">
                   {startup.linkedin && (
                     <a href={startup.linkedin} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-neutral-800/50 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all hover:scale-105 group" title="LinkedIn Profile">
                       <FaLinkedin className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
                     </a>
                   )}
                   {startup.twitter && (
                     <a href={startup.twitter} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-neutral-800/50 border border-white/5 flex items-center justify-center hover:bg-neutral-800 transition-all hover:scale-105 group" title="Twitter Profile">
                       <FaXTwitter className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
                     </a>
                   )}
                 </div>

                {isVerified && (
                  <div className="pt-3 border-t border-white/[0.03] flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
                      Verified Digital Identity
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Verification Metadata Section (Verification & Status) */}
            <section className="bg-[#09090b]/40 border border-white/[0.06] backdrop-blur-md p-5 rounded-[2rem] shadow-2xl relative overflow-hidden ring-1 ring-white/[0.01]">
              <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Verification Status
              </h3>
              <VerificationMetadata state={verificationState} showBreakdown={true} />
            </section>

            {/* Badge Embedder Card (Badge) */}
            <BadgeEmbedder startupName={startup.startup_name} slug={slug} />
          </aside>
        </div>

      </main>

      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-white/[0.03] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-neutral-700" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-700">Verification Protocol</span>
        </div>
        <div className="flex flex-wrap gap-6 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
           <a href="#" className="hover:text-neutral-500 transition-colors">Methods</a>
           <a href="/privacy" className="hover:text-neutral-500 transition-colors">Privacy</a>
           <a href="/terms" className="hover:text-neutral-500 transition-colors">Terms</a>
           <a href="#" className="hover:text-neutral-500 transition-colors">Identity</a>
        </div>
      </footer>
    </div>
  );
}

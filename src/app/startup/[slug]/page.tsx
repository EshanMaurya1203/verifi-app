import { supabaseAdmin } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import { ShieldCheck, Share2, Globe, CalendarDays, ExternalLink, Award, CheckCircle2, AlertTriangle, Link } from "lucide-react";
import { RevenueAuthenticityCard } from "@/components/startup/RevenueAuthenticityCard";
import { VerificationTransparencyCard } from "@/components/startup/VerificationTransparencyCard";
import { RevenueChart } from "@/components/startup/RevenueChart";
import { ShareVerificationButton } from "@/components/startup/ShareVerificationButton";
import { BadgeEmbedder } from "@/components/startup/BadgeEmbedder";
import { Metadata } from "next";
import { VerificationStateResult, computeVerificationState } from "@/lib/verification-state";

const TrustTierBadge = ({ state }: { state: VerificationStateResult }) => {
  if (state.verificationStatus === "UNVERIFIED") {
    return (
      <div className="px-3 py-1 border rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 text-red-400 bg-red-500/10 border-red-500/20">
        <AlertTriangle className="w-4 h-4" /> Unverified
      </div>
    );
  }

  let label = "Active Audit";
  let color = "text-amber-400 bg-amber-400/10 border-amber-400/20";
  let Icon = Award;

  if (state.trustScore > 85) { 
    label = "Forensic Grade"; 
    color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"; 
    Icon = ShieldCheck;
  } else if (state.trustScore > 65) { 
    label = "High Integrity"; 
    color = "text-indigo-400 bg-indigo-400/10 border-indigo-400/20"; 
    Icon = CheckCircle2;
  }
  
  return (
    <div className={`px-3 py-1 border rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${color}`}>
      <Icon className="w-4 h-4" /> {label}
    </div>
  );
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = decodeURIComponent(resolvedParams.slug);
  
  let query = supabaseAdmin.from("startup_submissions").select("startup_name, mrr, verification_status");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    query = query.ilike("startup_name", slug);
  }
  const { data: startup } = await query.maybeSingle();

  if (!startup) {
    return { title: "Startup Not Found | Verifi" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
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
  let query = supabaseAdmin.from("startup_submissions").select("*");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    query = query.ilike("startup_name", slug);
  }
  
  const { data: startup, error } = await query.maybeSingle();

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

  // 2. Fetch all verification data
  const [revenueRes, fraudRes, providerRes] = await Promise.all([
    supabaseAdmin
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabaseAdmin
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startupId),
    supabaseAdmin
      .from("provider_connections")
      .select("provider, status, last_synced_at")
      .eq("startup_id", startupId)
      .eq("status", "connected")
  ]);

  const rawRevenue = revenueRes.data || [];
  const revenue = rawRevenue.map(event => ({
    timestamp: new Date(event.created_at).getTime(),
    amount: Number(event.amount) || 0
  }));

  const latestSync = (providerRes.data || [])
    .map(p => p.last_synced_at)
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        {/* Verification Banner */}
        {isVerified ? (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
              <p className="text-sm font-bold text-indigo-300">Revenue independently verified through connected payment providers</p>
            </div>
            <ShareVerificationButton startupName={startup.startup_name} slug={slug} trustScore={verificationState.trustScore} />
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <p className="text-sm font-bold text-red-300">This profile is currently unverified and undergoing audit.</p>
            </div>
            <ShareVerificationButton startupName={startup.startup_name} slug={slug} trustScore={verificationState.trustScore} />
          </div>
        )}

        {/* Header Section */}
        <section className="flex flex-col md:flex-row gap-8 justify-between items-start mb-16 relative">
          <div className="flex gap-6 items-start">
            {startup.startup_logo && (
              <img src={startup.startup_logo} alt={`${startup.startup_name} logo`} className="w-20 h-20 rounded-2xl object-cover bg-neutral-900 border border-white/10" />
            )}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">{startup.startup_name}</h1>
                <TrustTierBadge state={verificationState} />
              </div>
              
              <div className="flex items-center gap-4 text-sm text-neutral-400 font-medium">
                {startup.website && (
                  <a href={startup.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Globe className="w-4 h-4" /> {startup.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {startup.founder_name && (
                  <span className="flex items-center gap-1.5 border-l border-white/10 pl-4">
                    Founder: <span className="text-white font-bold">{startup.founder_name}</span>
                  </span>
                )}
                <a href={`/startup/${slug}/edit`} className="flex items-center gap-1.5 border-l border-white/10 pl-4 hover:text-indigo-400 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Edit Profile
                </a>
              </div>
            </div>
          </div>

          <div className="text-right">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
               {isVerified ? "Verified Live MRR" : "Reported MRR"}
             </p>
             <p className="text-4xl font-black text-white tabular-nums">{formatInr(startup.mrr || 0)}</p>
          </div>
        </section>

        {/* Provider Badges */}
        <section className="mb-12 flex flex-wrap gap-4">
          {verificationState.providersConnected.map(provider => (
            <div key={provider} className="px-4 py-2 bg-neutral-900 border border-white/5 rounded-xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-300">
                {provider} Verified
              </span>
            </div>
          ))}
          {!verificationState.hasConnectedProviders && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                No Providers Connected
              </span>
            </div>
          )}
        </section>

        {/* Founder Identity Section */}
        {(startup.founder_name || startup.founder_bio) && (
          <section className="mb-12 bg-neutral-900/30 border border-white/5 rounded-3xl p-8 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-shrink-0 relative">
              {startup.founder_avatar ? (
                <img src={startup.founder_avatar} alt={startup.founder_name || 'Founder'} className="w-24 h-24 rounded-full object-cover border-4 border-neutral-950 shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center border-4 border-neutral-950 shadow-xl">
                  <span className="text-3xl font-black text-indigo-400">
                    {(startup.founder_name || 'F')[0].toUpperCase()}
                  </span>
                </div>
              )}
              {isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-neutral-950 p-1.5 rounded-full border-4 border-neutral-950 shadow-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{startup.founder_name || 'Anonymous Founder'}</h2>
                {isVerified && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    Verified Founder
                  </span>
                )}
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl whitespace-pre-line">
                {startup.founder_bio || "No biography provided."}
              </p>
            </div>
          </section>
        )}

        {/* Badge Embedder Section */}
        <section className="mb-12">
          <BadgeEmbedder startupName={startup.startup_name} slug={slug} />
        </section>

        {/* Grid Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Transparency Card */}
          <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl">
             <VerificationTransparencyCard verification={verificationState} />
          </div>

          {/* Authenticity Card */}
          <div className="bg-neutral-900/50 border border-white/5 p-6 rounded-3xl">
             <RevenueAuthenticityCard authenticity={verificationState} />
          </div>
        </div>

        {/* Revenue Chart */}
        <section className="bg-neutral-900/50 border border-white/5 p-8 rounded-3xl mb-12">
           <RevenueChart data={revenue} />
        </section>

      </main>
    </div>
  );
}

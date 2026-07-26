"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, Activity, RefreshCw, TrendingUp, ShieldCheck, AlertTriangle, Check, ChevronDown } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";
import { safeFetch } from "@/lib/safe-network";
import { formatCurrency, formatGrowth } from "@/lib/formatters";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

type StartupCard = {
  initials: string;
  name: string;
  category: string;
  description: string;
  mrr: string;
  growth: string;
  badge: string;
  slug: string;
};

type ActivityEvent = {
  id: string;
  event: string;
  startupName: string;
  timestamp: string;
};

const faqData = [
  {
    question: "Is my revenue shown publicly?",
    answer: "Yes, your verified Monthly Recurring Revenue (MRR) and trust metrics are displayed on your public profile and leaderboard once your payment provider is connected and profile is set to public. You can toggle public visibility off anytime from your dashboard settings."
  },
  {
    question: "What data does Verifii access?",
    answer: "Verifii accesses read-only payment metrics, transaction volume, and subscription statuses from your connected payment account. We never access or store sensitive customer credentials, full credit card numbers, or personal payout banking details."
  },
  {
    question: "Is my payment data secure?",
    answer: "Yes, your payment integration uses restricted, read-only API credentials and official OAuth protocols. All access tokens are encrypted at rest, and Verifii never has permission to move funds or modify your payment provider settings."
  },
  {
    question: "How does Verifii verify revenue from Stripe and Razorpay?",
    answer: "Verifii connects directly to payment provider APIs to aggregate raw transaction logs and active subscription data. This automated sync calculates your MRR from actual completed payments rather than manual text inputs or screenshots."
  },
  {
    question: "Is Verifii free to use?",
    answer: "Verifii offers core revenue verification and public profile hosting for founders. Founders can connect payment providers, earn a verified trust badge, and showcase revenue metrics without any setup costs."
  },
  {
    question: "How is Verifii different from self-reported revenue leaderboards?",
    answer: "Unlike traditional leaderboards where revenue numbers are manually typed or screenshotted, Verifii validates data directly through automated payment provider API integrations. This ensures that every public revenue claim is backed by real, tamper-proof payment activity."
  },
  {
    question: "What happens if I disconnect my payment provider?",
    answer: "Disconnecting your payment provider halts automatic revenue syncs and revokes active API access. Your startup's public profile will no longer display an active verified badge, and unverified profiles are removed from public leaderboard rankings."
  },
  {
    question: "Can I remove my startup from the leaderboard?",
    answer: "Yes, you can set your profile to private or permanently delete your startup submission from your founder dashboard at any time. Toggling your profile to private immediately removes your startup from public search results and leaderboard listings."
  },
  {
    question: "How long does verification take?",
    answer: "Initial revenue verification typically takes less than two minutes after connecting your Stripe or Razorpay account. Once authorized, revenue metrics and trust scores update automatically in near real-time."
  },
  {
    question: "Can I choose what appears on my public profile?",
    answer: "Yes, founders control profile visibility settings, basic startup information, social links, and public bio details. You can also toggle your entire profile private whenever you wish to hide revenue numbers."
  }
];

const getShortActivity = (event: string): string => {
  switch (event) {
    case "stripe_sync_success":
    case "razorpay_sync_success":
      return "Revenue verified";
    case "listing_created":
      return "Profile created";
    default:
      return "Activity recorded";
  }
};

const getProviderBadge = (event: string) => {
  switch (event) {
    case "stripe_sync_success":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Stripe
        </span>
      );
    case "razorpay_sync_success":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Razorpay
        </span>
      );
    case "listing_created":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Verifii
        </span>
      );
  }
};

const fadeUpContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUpItem = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HomePage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentlyListedData, setRecentlyListedData] = useState<StartupCard[]>([]);
  const [trendingData, setTrendingData] = useState<StartupCard[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleVerifyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const effectiveUser = currentUser || user;
    if (effectiveUser) {
      const { data: startups } = await supabase
        .from("startup_submissions")
        .select("slug")
        .eq("user_id", effectiveUser.id)
        .order("created_at", { ascending: false });

      if (startups && startups.length > 0) {
        router.push(`/startup/${encodeURIComponent(startups[0].slug)}/verify`);
      } else {
        router.push("/submit");
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getClientOAuthRedirect("/auth/callback"),
        },
      });
    }
  };

  useEffect(() => {
    async function loadHomepageData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch submissions securely for all modules
        const submissionsRes = await safeFetch<{ success: boolean; data: any[] }>("/api/startup-submissions");
        
        if (!submissionsRes.ok || !submissionsRes.data) {
          setError(submissionsRes.error?.message || "Failed to establish ledger protocol connection.");
          setLoading(false);
          return;
        }

        const { success, data: list } = submissionsRes.data;
        if (success && list) {
          // Top 5 startups for main leaderboard
          const top5 = list
            .slice()
            .sort((a: any, b: any) => (b.mrr || 0) - (a.mrr || 0))
            .slice(0, 5)
            .map((s: any, idx: number) => ({
              rank: idx + 1,
              slug: s.slug || s.id,
              name: s.startup_name,
              founder: s.name || "Anonymous",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              trust_score: s.trust_score || 0,
            }));
          setLeaderboard(top5);

          // Recently listed
          const recent = list
            .slice()
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 4)
            .map((s: any) => ({
              initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
              name: s.startup_name,
              slug: s.slug || s.id,
              category: s.biz_type,
              description: s.notes || "No description provided.",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) : "Stable",
              badge: s.payment_connected ? 'Payment Connected' : 'Self Reported',
            }));
          setRecentlyListedData(recent);

          // Trending (sorted by growth)
          const trending = list
            .slice()
            .filter((s: any) => s.growth !== undefined && s.growth > 0)
            .sort((a: any, b: any) => (b.growth || 0) - (a.growth || 0))
            .slice(0, 3)
            .map((s: any) => ({
              initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
              name: s.startup_name,
              slug: s.slug || s.id,
              category: s.biz_type,
              description: s.notes || "No description provided.",
              mrr: formatCurrency(s.mrr || 0, "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) + " MoM" : "",
              badge: "Trending",
            }));
          setTrendingData(trending);

          // Fetch authoritative activity events from verification_logs
          try {
            const feedRes = await safeFetch<ActivityEvent[]>("/api/live-feed");
            if (feedRes.ok && feedRes.data) {
              setActivities(feedRes.data);
            }
          } catch {
            // Live feed is non-critical; empty state will show
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load home data", err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadHomepageData();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <main className="mx-auto max-w-[1080px] px-6 pb-24">
        {/* Hero Section */}
        <section className="pt-28 md:pt-36 pb-12 flex items-center justify-center">
          <motion.div
            variants={fadeUpContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center w-full max-w-[840px]"
          >
            {/* Trust Framing Tag */}
            <motion.div
              variants={fadeUpItem}
              className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">
                Live Ecosystem Activity
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUpItem}
              className="font-syne text-[36px] md:text-[56px] lg:text-[64px] font-black leading-[1.05] tracking-[-1.5px] sm:tracking-[-2px] text-white"
            >
              Verified startup revenue. <br />
              <span className="text-primary">
                Backed by payment data.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUpItem}
              className="mt-6 max-w-[580px] text-sm md:text-base font-normal leading-relaxed text-neutral-400"
            >
              Connect Stripe or Razorpay to verify your startup&apos;s revenue using real payment data. Earn a public trust badge and build credibility with investors, partners, and future customers—without relying on screenshots or self-reported claims.
            </motion.p>

            {/* Trust Bullets */}
            <motion.div
              variants={fadeUpItem}
              className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm font-medium text-neutral-300"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Revenue verified directly from payment providers</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Public startup profile with verified trust badge</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>No screenshots or self-reported revenue</span>
              </div>
            </motion.div>

            {/* CTA Hierarchy */}
            <motion.div
              variants={fadeUpItem}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-[480px]"
            >
              <Link
                href="/submit"
                onClick={handleVerifyClick}
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-xl bg-primary px-7 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(185,255,75,0.15)]"
              >
                Verify your revenue
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] px-7 text-xs font-bold uppercase tracking-wider text-neutral-300 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/20 active:scale-[0.98]"
              >
                Explore Leaderboard
              </Link>
            </motion.div>

            {/* Minimal Trust Strip */}
            <motion.div
              variants={fadeUpItem}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-5 text-[11px] font-medium text-neutral-500"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                Stripe & Razorpay supported
              </span>
              <span className="hidden sm:inline text-neutral-700">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                Encrypted credentials
              </span>
              <span className="hidden sm:inline text-neutral-700">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                Revenue verified from payment providers
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* Dense Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
          
          {/* Main Column: Leaderboard & Trending */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Leaderboard Preview */}
            <section>
              <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md overflow-hidden shadow-2xl ring-1 ring-white/[0.02]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.05] px-6 md:px-8 py-5 md:py-6 gap-4">
                  <div>
                    <h3 className="font-syne text-base md:text-lg font-black text-white uppercase tracking-tight">
                      Leaderboard Preview
                    </h3>
                    <p className="text-[9px] md:text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mt-1">Top performing internet startups</p>
                  </div>
                  <Link
                    href="/leaderboard"
                    className="text-[10px] md:text-xs font-bold text-primary hover:text-primary/80 uppercase tracking-wider transition-colors px-4 py-2 rounded-xl bg-primary/10 border border-primary/20"
                  >
                    View full list
                  </Link>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="flex items-center justify-between px-6 md:px-8 py-5 animate-pulse">
                        <div className="flex items-center gap-4 w-1/2">
                          <div className="w-6 h-4 bg-neutral-800 rounded" />
                          <div className="space-y-2 w-full">
                            <div className="h-4 bg-neutral-800 rounded w-2/3" />
                            <div className="h-3 bg-neutral-900 rounded w-1/3" />
                          </div>
                        </div>
                        <div className="h-6 bg-neutral-800 rounded w-20" />
                      </div>
                    ))
                  ) : error ? (
                    <div className="px-8 py-14 text-center flex flex-col items-center justify-center bg-black/10">
                      <AlertTriangle className="w-6 h-6 text-amber-500/80 mb-3 animate-pulse" />
                      <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500">Sync Interrupted</p>
                      <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">Could not establish sync with live ledger. Dynamic rankings temporarily offline.</p>
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="px-8 py-14 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest bg-black/10">
                      No startups verified yet. Be the first to join the leaderboard!
                    </div>
                  ) : (
                    leaderboard.map((startup) => (
                      <Link
                        href={`/startup/${startup.slug}`}
                        key={startup.rank}
                        className="flex flex-col sm:flex-row sm:items-center justify-between px-6 md:px-8 py-4 md:py-5 transition-colors hover:bg-white/[0.015] group gap-4 sm:gap-0"
                      >
                        <div className="flex min-w-0 items-center gap-4 md:gap-5">
                          <div className="w-6 font-syne text-sm font-bold text-neutral-600 text-center">
                            #{startup.rank}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white tracking-wide leading-none group-hover:text-primary transition-colors">
                              {startup.name}
                            </p>
                            <p className="truncate text-xs text-neutral-500 font-medium mt-1.5">
                              by {startup.founder}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 md:gap-6 ml-10 sm:ml-0">
                          <div className="flex flex-col items-start sm:items-end">
                            <span className="font-syne text-sm font-black text-white tracking-tight tabular-nums">{startup.mrr}</span>
                            <span className="text-[9px] text-neutral-600 uppercase font-bold tracking-widest leading-none mt-1">MRR</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-2.5 py-1.5 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider leading-none">
                              Verified
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Trending Section */}
            {trendingData.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-syne text-sm font-black text-white uppercase tracking-wider">
                      Trending Growth
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {trendingData.map((s) => (
                    <Link
                      href={`/startup/${s.slug}`}
                      key={s.name}
                      className="bg-[#09090b]/40 border border-white/[0.05] p-5 rounded-3xl relative overflow-hidden group hover:border-white/10 hover:bg-[#0a0a0d]/60 transition-all duration-300 shadow-md ring-1 ring-white/[0.01]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-800/80 border border-white/5 font-syne text-[10px] font-bold text-white shadow-inner shrink-0">
                          {s.initials}
                        </div>
                        <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 truncate">
                          {s.growth}
                        </div>
                      </div>
                      
                      <div className="text-sm font-bold text-white tracking-wide truncate group-hover:text-emerald-400 transition-colors">
                        {s.name}
                      </div>
                      <div className="mt-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate">
                        {s.category}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recently Listed Grid */}
            <section>
              <div className="flex items-center justify-between mb-6 px-2">
                <div>
                  <h3 className="font-syne text-sm font-black text-white uppercase tracking-wider">
                    Recently Verified
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loading ? (
                  Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx} className="bg-[#09090b]/30 border border-white/[0.05] p-5 rounded-3xl animate-pulse space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-neutral-800 rounded-xl" />
                        <div className="space-y-2 w-2/3">
                          <div className="h-4 bg-neutral-800 rounded w-full" />
                          <div className="h-3 bg-neutral-900 rounded w-1/2" />
                        </div>
                      </div>
                      <div className="h-8 bg-neutral-900 rounded w-full mt-4" />
                    </div>
                  ))
                ) : error ? (
                  <div className="col-span-2 px-6 py-10 text-center flex flex-col items-center justify-center bg-black/10 rounded-3xl border border-white/[0.05]">
                    <AlertTriangle className="w-6 h-6 text-amber-500/80 mb-2 animate-pulse" />
                    <p className="text-[10px] uppercase font-bold tracking-widest text-amber-500">Sync Offline</p>
                  </div>
                ) : recentlyListedData.length === 0 ? (
                  <div className="col-span-2 px-6 py-10 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest bg-black/10 rounded-3xl">
                    No startups listed yet.
                  </div>
                ) : (
                  recentlyListedData.map((s) => (
                    <Link
                      href={`/startup/${s.slug}`}
                      key={s.name}
                      className="bg-[#09090b]/30 border border-white/[0.05] p-5 rounded-3xl relative overflow-hidden group hover:border-white/10 hover:bg-[#0a0a0d]/50 transition-all duration-300 ring-1 ring-white/[0.01]"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-800/80 border border-white/5 font-syne text-[10px] font-bold text-white shadow-inner shrink-0">
                          {s.initials}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white tracking-wide group-hover:text-primary transition-colors">
                            {s.name}
                          </div>
                          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">
                            {s.category}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end justify-between border-t border-white/[0.04] pt-3 mt-3">
                        <div>
                          <div className="font-syne text-sm font-black text-white leading-none tracking-tight">
                            {s.mrr}
                          </div>
                          <div className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mt-1">MRR</div>
                        </div>
                        <div className="rounded-full bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-neutral-400">
                          {s.badge}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Column: Activity Feed */}
          <div className="lg:col-span-4">
            <section className="sticky top-24">
              <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md overflow-hidden shadow-xl ring-1 ring-white/[0.02]">
                <div className="border-b border-white/[0.05] px-6 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="font-syne text-sm font-black text-white uppercase tracking-tight">
                      Live Feed
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Real-time</span>
                  </div>
                </div>

                <div className="p-3.5 space-y-2">
                  {activities.map((activity) => (
                    <div 
                      key={activity.id}
                      className="p-3.5 rounded-2xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors flex flex-col gap-1"
                    >
                      {/* Startup Name */}
                      <span className="text-xs font-bold text-white truncate leading-snug">
                        {activity.startupName}
                      </span>

                      {/* Short activity */}
                      <span className="text-[11px] font-medium text-neutral-400 leading-snug">
                        {getShortActivity(activity.event)}
                      </span>

                      {/* Provider Badge */}
                      <div className="mt-0.5">
                        {getProviderBadge(activity.event)}
                      </div>

                      {/* Relative Timestamp */}
                      <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-wider mt-1">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                  {activities.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest">
                      Waiting for ecosystem events...
                    </div>
                  )}
                </div>
                
                <div className="px-6 py-4 border-t border-white/[0.05] bg-black/20">
                  <p className="text-[9px] font-medium text-neutral-500 leading-relaxed text-center">
                    All events are cryptographically backed by live payment provider APIs.
                  </p>
                </div>
              </div>
              
              {/* Feature Box Sidebar */}
              <div className="mt-6 rounded-3xl border border-white/[0.05] bg-primary/[0.02] p-6 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
                <div className="inline-flex rounded-xl bg-primary/10 border border-primary/20 p-2.5 mb-4">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-white">
                  Payment-Backed Proof
                </h3>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8f8f97] font-medium">
                  Verifii connects securely to Stripe and Razorpay. Every profile uses raw API payment streams for authentic, high-confidence verification.
                </p>
              </div>
            </section>
          </div>
          
        </div>

        {/* Improvement 1 — Why Founders Verify with Verifii */}
        <section className="mt-16 sm:mt-20">
          <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md p-6 sm:p-8 md:p-10 shadow-xl ring-1 ring-white/[0.02]">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
              <h2 className="font-syne text-2xl sm:text-3xl font-black text-white tracking-tight">
                Why founders verify with Verifii
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-neutral-400 font-medium">
                Automated revenue verification compared to traditional self-reported methods.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Screenshots */}
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-neutral-500" />
                    <h3 className="font-syne text-base font-bold text-neutral-300">
                      Screenshots
                    </h3>
                  </div>
                  <ul className="space-y-3 text-xs sm:text-sm text-neutral-400">
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-600 mt-0.5">•</span>
                      <span>Can be edited</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-600 mt-0.5">•</span>
                      <span>Static proof</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-600 mt-0.5">•</span>
                      <span>Difficult for others to verify</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-neutral-600 mt-0.5">•</span>
                      <span>Manual sharing</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Verifii Verification */}
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.02] p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h3 className="font-syne text-base font-bold text-white">
                      Verifii Verification
                    </h3>
                  </div>
                  <ul className="space-y-3 text-xs sm:text-sm text-neutral-200">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Verified using connected payment providers</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Continuously trustworthy</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Public trust profile</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>Easy to share confidently</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Improvement 2 — Founder FAQ */}
        <section className="mt-16 sm:mt-20">
          {/* JSON-LD Schema for FAQPage */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": faqData.map((item) => ({
                  "@type": "Question",
                  "name": item.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer,
                  },
                })),
              }),
            }}
          />

          <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md p-6 sm:p-8 md:p-10 shadow-xl ring-1 ring-white/[0.02]">
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
              <h2 className="font-syne text-2xl sm:text-3xl font-black text-white tracking-tight">
                Founder FAQ
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-neutral-400 font-medium">
                Everything you need to know about revenue verification, security, and profile controls.
              </p>
            </div>

            <div className="space-y-3 max-w-3xl mx-auto">
              {faqData.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden transition-all duration-200"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 hover:bg-white/[0.02] transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 rounded-2xl"
                      aria-expanded={isOpen}
                    >
                      <span className="font-syne text-xs sm:text-sm font-bold text-white">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 border-t border-white/[0.03] text-xs sm:text-sm text-neutral-400 leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>


        {/* Bottom CTA Card */}
        <section className="mt-28">
          <div className="rounded-[3rem] border border-white/[0.08] bg-[#09090b]/50 px-8 py-16 text-center relative overflow-hidden shadow-2xl group ring-1 ring-white/[0.01]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
            <h2 className="font-syne text-[28px] md:text-[36px] font-black leading-tight text-white uppercase tracking-tight">
              Ready to verify your revenue?
            </h2>
            <p className="mx-auto mt-4 max-w-[500px] text-xs md:text-sm leading-relaxed text-[#8f8f97] font-medium">
              Join Verifii today and build public trust in minutes with real-time, payment-backed verification streams.
            </p>
            <Link
              href="/submit"
              onClick={handleVerifyClick}
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(185,255,75,0.2)]"
            >
              Verify your startup
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/[0.05] pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">© 2026 Verifii</div>
            <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span className="text-neutral-800">•</span>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <span className="text-neutral-800">•</span>
              <span>Built for founders worldwide</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

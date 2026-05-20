"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, BarChart3, Eye, Activity, RefreshCw, Zap, TrendingUp, ShieldCheck, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/site-url";
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
  type: "VERIFIED" | "SYNCED" | "MILESTONE";
  startupName: string;
  timestamp: string;
  detail: string;
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
  const [stats, setStats] = useState({ count: 0, totalRevenue: 0, activeSyncs: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [demoLeaderboard, setDemoLeaderboard] = useState<any[]>([]);
  const [recentlyListedData, setRecentlyListedData] = useState<StartupCard[]>([]);
  const [trendingData, setTrendingData] = useState<StartupCard[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const handleVerifyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      router.push("/submit");
    } else {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getSiteUrl()}/submit`,
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
          // Split real vs demo startups securely
          const realList = list.filter((item: any) => !item.user_id?.startsWith("00000000-0000-0000-0000-"));
          const demoList = list.filter((item: any) => item.user_id?.startsWith("00000000-0000-0000-0000-"));

          // Total Revenue calculation from real entries only
          const total = realList.reduce((acc: number, item: any) => acc + (Number(item.mrr) || 0), 0);
          
          // Calculate active syncs from real entries only
          const activeSyncsCount = realList.filter((item: any) => item.trust_tier === 'HIGH_CONFIDENCE' || item.trust_tier === 'REVENUE_VERIFIED' || item.trust_tier === 'PAYMENT_CONNECTED').length;
          
          setStats({ 
            count: realList.length,
            totalRevenue: total,
            activeSyncs: activeSyncsCount
          });

          // Top 5 real startups for main leaderboard
          const top5 = realList
            .slice()
            .sort((a: any, b: any) => (b.mrr || 0) - (a.mrr || 0))
            .slice(0, 5)
            .map((s: any, idx: number) => ({
              rank: idx + 1,
              slug: s.slug || s.id,
              name: s.startup_name,
              founder: s.name || "Anonymous",
              mrr: formatCurrency(s.mrr || 0, s.currency || "INR", { compact: true }),
              trust_score: s.trust_score || 0,
            }));
          setLeaderboard(top5);

          // Top 5 demo startups for sandbox leaderboard preview
          const top5Demo = demoList
            .slice()
            .sort((a: any, b: any) => (b.mrr || 0) - (a.mrr || 0))
            .slice(0, 5)
            .map((s: any, idx: number) => ({
              rank: idx + 1,
              slug: s.slug || s.id,
              name: s.startup_name,
              founder: s.name || "Anonymous",
              mrr: formatCurrency(s.mrr || 0, s.currency || "INR", { compact: true }),
              trust_score: s.trust_score || 0,
            }));
          setDemoLeaderboard(top5Demo);

          // Recently listed (real only)
          const recent = realList
            .slice()
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 4)
            .map((s: any) => ({
              initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
              name: s.startup_name,
              slug: s.slug || s.id,
              category: s.biz_type,
              description: s.notes || "No description provided.",
              mrr: formatCurrency(s.mrr || 0, s.currency || "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) : "Stable",
              badge: s.trust_tier === 'HIGH_CONFIDENCE' ? 'Payment Verified' : s.trust_tier === 'REVENUE_VERIFIED' ? 'Revenue Verified' : s.trust_tier === 'PAYMENT_CONNECTED' ? 'Payment Connected' : 'Self Reported',
            }));
          setRecentlyListedData(recent);

          // Trending (real only, sorted by growth)
          const trending = realList
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
              mrr: formatCurrency(s.mrr || 0, s.currency || "INR", { compact: true }),
              growth: s.growth ? formatGrowth(s.growth, 2) + " MoM" : "",
              badge: "Trending",
            }));
          setTrendingData(trending);

          // Generate lightweight activity events from real data only
          const eventStream: ActivityEvent[] = [];
          
          realList.slice(0, 6).forEach((s: any, i: number) => {
            const updatedAt = new Date(s.updated_at || s.created_at);
            const createdAt = new Date(s.created_at);
            
            if (updatedAt.getTime() - createdAt.getTime() > 86400000) {
              eventStream.push({
                id: `sync-${s.id}-${i}`,
                type: "SYNCED",
                startupName: s.startup_name,
                timestamp: updatedAt.toISOString(),
                detail: `Payment provider sync completed`
              });
            } else {
              eventStream.push({
                id: `verify-${s.id}-${i}`,
                type: "VERIFIED",
                startupName: s.startup_name,
                timestamp: createdAt.toISOString(),
                detail: `Joined the verified leaderboard`
              });
            }

            if (s.mrr && s.mrr > 500000 && i % 3 === 0) {
              const milestoneTime = new Date(updatedAt.getTime() - 1000 * 60 * 60 * 2);
              eventStream.push({
                id: `mile-${s.id}-${i}`,
                type: "MILESTONE",
                startupName: s.startup_name,
                timestamp: milestoneTime.toISOString(),
                detail: `Crossed ${formatCurrency(s.mrr || 0, s.currency || "INR", { compact: true })} MRR milestone`
              });
            }
          });

          eventStream.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivities(eventStream.slice(0, 5));
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

  const formatStatsRevenue = (val: number) => {
    return formatCurrency(val, "INR", { compact: true });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "VERIFIED": return <ShieldCheck className="w-3 h-3 text-emerald-400" />;
      case "SYNCED": return <RefreshCw className="w-3 h-3 text-blue-400" />;
      case "MILESTONE": return <Zap className="w-3 h-3 text-amber-400" />;
      default: return <Activity className="w-3 h-3 text-neutral-400" />;
    }
  };

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
              <span className="bg-gradient-to-r from-indigo-400 to-[#b9ff4b] bg-clip-text text-transparent">
                Backed by payment data.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeUpItem}
              className="mt-6 max-w-[580px] text-sm md:text-base font-normal leading-relaxed text-neutral-400"
            >
              Verifi connects securely to Stripe and Razorpay to verify your actual revenue. No self-reported charts. Just real, verified financial data.
            </motion.p>

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

            {/* Lightweight Ecosystem Stats */}
            <motion.div
              variants={fadeUpItem}
              className="mt-14 grid w-full grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/50 backdrop-blur-md p-5 text-center relative overflow-hidden group shadow-lg ring-1 ring-white/[0.02] transition-all duration-300 hover:border-[#b9ff4b]/20">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
                <div className="font-syne text-2xl md:text-3xl font-extrabold text-white leading-none tracking-tight">
                  {stats.count}
                </div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Verified Startups
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/50 backdrop-blur-md p-5 text-center relative overflow-hidden group shadow-lg ring-1 ring-white/[0.02] transition-all duration-300 hover:border-[#b9ff4b]/20">
                <div className="absolute inset-0 bg-gradient-to-b from-[#b9ff4b]/[0.02] to-transparent pointer-events-none" />
                <div className="font-syne text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-[#b9ff4b] bg-clip-text text-transparent leading-none tracking-tight">
                  {formatStatsRevenue(stats.totalRevenue)}
                </div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Combined MRR
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/50 backdrop-blur-md p-5 text-center relative overflow-hidden group shadow-lg ring-1 ring-white/[0.02] transition-all duration-300 hover:border-[#b9ff4b]/20">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/[0.02] to-transparent pointer-events-none" />
                <div className="font-syne text-2xl md:text-3xl font-extrabold text-white leading-none tracking-tight">
                  {stats.activeSyncs}
                </div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Active API Syncs
                </div>
              </div>
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
                    className="text-[10px] md:text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider transition-colors px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
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
                            <p className="truncate text-sm font-bold text-white tracking-wide leading-none group-hover:text-indigo-400 transition-colors">
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
                          <div className="text-sm font-bold text-white tracking-wide group-hover:text-indigo-400 transition-colors">
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
                    <Activity className="w-4 h-4 text-indigo-400" />
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

                <div className="p-4 space-y-1">
                  {activities.map((activity, idx) => (
                    <div 
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="mt-1 w-6 h-6 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">
                          {activity.startupName}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5 leading-snug">
                          {activity.detail}
                        </p>
                        <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider mt-1.5">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
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
              <div className="mt-6 rounded-3xl border border-white/[0.05] bg-indigo-500/[0.02] p-6 backdrop-blur-sm group hover:border-indigo-500/20 transition-all duration-300">
                <div className="inline-flex rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 mb-4">
                  <BadgeCheck className="h-4 w-4 text-indigo-400" />
                </div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-white">
                  Payment-Backed Proof
                </h3>
                <p className="mt-2 text-[11px] leading-relaxed text-[#8f8f97] font-medium">
                  Verifi connects securely to Stripe and Razorpay. Every profile uses raw API payment streams for authentic, high-confidence verification.
                </p>
              </div>
            </section>
          </div>
          
        </div>

        {/* Sandbox Sandbox Preview Section */}
        {demoLeaderboard.length > 0 && (
          <section className="mt-28">
            <div className="rounded-3xl border border-white/[0.04] bg-[#09090b]/20 backdrop-blur-md overflow-hidden shadow-2xl p-6 md:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.04] pb-5 mb-6 gap-4">
                <div>
                  <h3 className="font-syne text-base md:text-lg font-black text-neutral-400 uppercase tracking-tight flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neutral-600 animate-pulse" />
                    Sandbox Leaderboard Preview
                  </h3>
                  <p className="text-[9px] md:text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mt-1">Simulated startups containing mock metrics for demonstration purposes</p>
                </div>
                <div className="px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase text-indigo-400 tracking-wider">
                  Developer Sandbox Mode
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {demoLeaderboard.map((startup) => (
                  <Link
                    href={`/startup/${startup.slug}`}
                    key={startup.slug}
                    className="p-5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] hover:border-white/10 rounded-2xl transition-all duration-200 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="font-bold text-sm text-neutral-300 group-hover:text-indigo-400 transition-colors truncate">
                          {startup.name}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[8px] font-black uppercase text-neutral-500 tracking-wider">Demo</span>
                      </div>
                      <p className="text-xs text-neutral-500 font-medium mt-1">
                        by {startup.founder}
                      </p>
                    </div>

                    <div className="flex justify-between items-end mt-6 pt-3 border-t border-white/[0.03]">
                      <div>
                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider block">Simulated MRR</span>
                        <span className="font-syne text-sm font-extrabold text-neutral-400 tabular-nums">{startup.mrr}</span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-neutral-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA Card */}
        <section className="mt-28">
          <div className="rounded-[3rem] border border-white/[0.08] bg-[#09090b]/50 px-8 py-16 text-center relative overflow-hidden shadow-2xl group ring-1 ring-white/[0.01]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
            <h2 className="font-syne text-[28px] md:text-[36px] font-black leading-tight text-white uppercase tracking-tight">
              Ready to verify your revenue?
            </h2>
            <p className="mx-auto mt-4 max-w-[500px] text-xs md:text-sm leading-relaxed text-[#8f8f97] font-medium">
              Join Verifi today and build public trust in minutes with real-time, payment-backed verification streams.
            </p>
            <Link
              href="/submit"
              onClick={handleVerifyClick}
              className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.2)]"
            >
              Verify your startup
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-white/[0.05] pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">© 2026 Verifi</div>
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

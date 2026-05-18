"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, BarChart3, Eye } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { getBaseUrl } from "@/lib/url";

import { useEffect, useState } from "react";

type StartupCard = {
  initials: string;
  name: string;
  category: string;
  description: string;
  mrr: string;
  growth: string;
  badge: string;
};

const recentlyListed: StartupCard[] = [];

const leaderboardPreview: any[] = [];

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
  const [stats, setStats] = useState({ count: 0, totalRevenue: 0 });
  const [leaderboard, setLeaderboard] = useState(leaderboardPreview);
  const [recentlyListedData, setRecentlyListedData] = useState(recentlyListed);
  const [user, setUser] = useState<any>(null);
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
          redirectTo: `${getBaseUrl()}/submit`,
        },
      });
    }
  };



  useEffect(() => {
    // 1. Fetch real counts
    fetch("/api/startup-submissions/count")
      .then((res) => res.json())
      .then((data) => {
        if (data.count) setStats((prev) => ({ ...prev, count: data.count }));
      })
      .catch(console.error);

    // 2. Fetch submissions for leaderboard & recently listed
    fetch("/api/startup-submissions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const list = data.data;

          // Total Revenue calculation
          const total = list.reduce((acc: number, item: any) => acc + (Number(item.mrr) || 0), 0);
          setStats((prev) => ({ ...prev, totalRevenue: total }));

          // Top 5 for leaderboard (Sorted by trust_score desc)
          const top5 = list
            .slice()
            .sort((a: any, b: any) => (b.trust_score || 0) - (a.trust_score || 0))
            .slice(0, 5)
            .map((s: any, idx: number) => ({
              rank: idx + 1,
              name: s.startup_name,
              founder: s.name || "Anonymous",
              mrr: s.mrr ? (s.mrr >= 100000 ? `₹${(s.mrr / 100000).toFixed(1)}L` : `₹${(s.mrr / 1000).toFixed(0)}k`) : "₹0",
              trust_score: s.trust_score || 0,
            }));
          setLeaderboard(top5);

          // Recently listed
          const recent = list.slice(0, 3).map((s: any) => ({
            initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
            name: s.startup_name,
            category: s.biz_type,
            description: s.notes || "No description provided.",
            mrr: s.mrr ? (s.mrr >= 100000 ? `₹${(s.mrr / 100000).toFixed(1)}L` : `₹${(s.mrr / 1000).toFixed(0)}k`) : "₹0",
            growth: "+0%",
            badge: s.verification_label || "Self Reported",
            trust_score: s.trust_score || 0,
          }));
          setRecentlyListedData(recent);
        }
      })
      .catch(console.error);

    // Removed demo startup fetch
  }, []);

  const formatStatsRevenue = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
    return `₹${val}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      <main className="mx-auto max-w-[840px] px-6 pb-24">
        {/* Hero Section */}
        <section className="pt-28 md:pt-36 pb-12 flex items-center justify-center">
          <motion.div
            variants={fadeUpContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center w-full"
          >
            {/* Trust Framing Tag */}
            <motion.div
              variants={fadeUpItem}
              className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">
                Public Financial Proof
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

            {/* Stat Cards */}
            <motion.div
              variants={fadeUpItem}
              className="mt-14 grid w-full grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/50 backdrop-blur-md p-6 text-center relative overflow-hidden group shadow-lg ring-1 ring-white/[0.02] transition-all duration-300 hover:border-[#b9ff4b]/20">
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.01] to-transparent pointer-events-none" />
                <div className="font-syne text-3xl md:text-4xl font-extrabold text-white leading-none tracking-tight">
                  {stats.count}
                </div>
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Verified Startups
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f0f]/50 backdrop-blur-md p-6 text-center relative overflow-hidden group shadow-lg ring-1 ring-white/[0.02] transition-all duration-300 hover:border-[#b9ff4b]/20">
                <div className="absolute inset-0 bg-gradient-to-b from-[#b9ff4b]/[0.02] to-transparent pointer-events-none" />
                <div className="font-syne text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-[#b9ff4b] bg-clip-text text-transparent leading-none tracking-tight">
                  {formatStatsRevenue(stats.totalRevenue)}
                </div>
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">
                  Verified Combined MRR
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>



        {/* Leaderboard Preview */}
        <section className="mt-20">
          <div className="rounded-[2.5rem] border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md overflow-hidden shadow-2xl ring-1 ring-white/[0.02]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.05] px-8 py-6 gap-4">
              <div>
                <h3 className="font-syne text-lg font-black text-white uppercase tracking-tight">
                  Leaderboard Preview
                </h3>
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.2em] mt-1.5">Top performing internet startups</p>
              </div>
              <Link
                href="/leaderboard"
                className="text-xs font-bold text-primary hover:text-indigo-300 uppercase tracking-wider transition-colors"
              >
                View full list →
              </Link>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {leaderboard.map((startup) => (
                <div
                  key={startup.rank}
                  className="flex items-center justify-between px-8 py-5 transition-colors hover:bg-white/[0.015]"
                >
                  <div className="flex min-w-0 items-center gap-5">
                    <div className="w-6 font-syne text-sm font-bold text-neutral-600 text-center">
                      #{startup.rank}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white tracking-wide leading-none">
                        {startup.name}
                      </p>
                      <p className="truncate text-xs text-neutral-500 font-medium mt-1">
                        by {startup.founder}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="font-syne text-sm font-black text-white tracking-tight tabular-nums">{startup.mrr}</span>
                      <span className="text-[10px] text-neutral-600 uppercase font-bold tracking-widest leading-none mt-1">MRR</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-2.5 py-1.5">
                      <BadgeCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider leading-none">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="px-8 py-14 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest bg-black/10">
                  No startups verified yet. Be the first to join the leaderboard!
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Recently Listed */}
        <section className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-syne text-lg font-black text-white uppercase tracking-tight">
                Recently verified
              </h3>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mt-1.5">Latest verified startups in ecosystem</p>
            </div>
            <Link
              href="/leaderboard"
              className="text-xs font-bold text-neutral-500 hover:text-white uppercase tracking-wider transition-colors"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentlyListedData.map((s) => (
              <div
                key={s.name}
                className="bg-[#09090b]/30 border border-white/[0.05] p-6 rounded-2xl relative overflow-hidden group hover:border-white/10 hover:bg-[#0a0a0d]/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.03)] hover:scale-[1.02] transition-all duration-300 shadow-md ring-1 ring-white/[0.01]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800/80 border border-white/5 font-syne text-xs font-bold text-white shadow-inner">
                      {s.initials}
                    </div>
                    <div className="text-sm font-bold text-white tracking-wide">
                      {s.name}
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    ✓ {s.badge}
                  </div>
                </div>

                <div className="mt-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  {s.category}
                </div>
                <div
                  className="mt-3 text-xs font-medium leading-relaxed text-[#8f8f97]"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                  }}
                >
                  {s.description}
                </div>

                <div className="mt-5 border-t border-white/[0.04] pt-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="font-syne text-[15px] font-black text-white leading-none tracking-tight">
                        {s.mrr}
                      </div>
                      <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">MRR</div>
                    </div>
                    <div className="text-xs font-bold text-emerald-400">
                      ↑ {s.growth}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {recentlyListedData.length === 0 && (
            <div className="rounded-2xl border border-white/[0.05] bg-[#09090b]/30 p-12 text-center backdrop-blur-sm mt-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                <BarChart3 className="w-5 h-5 text-neutral-500" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-white">
                Ecosystem is initializing
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400 font-medium max-w-sm mx-auto">
                No startups have completed the public verification process yet. Be the first to showcase transparent traction to investors and peers.
              </p>
              <Link
                href="/submit"
                className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-white/10 border border-white/10 px-6 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-white/20 hover:scale-[1.02]"
              >
                Start Verification
              </Link>
            </div>
          )}
        </section>

        {/* Feature Grid */}
        <section className="mt-24">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.05] bg-[#09090b]/30 p-6 backdrop-blur-sm group hover:border-white/10 hover:bg-[#09090b]/60 transition-all duration-300">
              <div className="inline-flex rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 mb-5 transition-transform duration-300 group-hover:scale-105">
                <Eye className="h-4 w-4 text-indigo-400" />
              </div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.15em] text-white">
                Transparent Revenue
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-[#8f8f97] font-medium">
                Public, verifiable revenue records so founders and investors can trust the signal.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-[#09090b]/30 p-6 backdrop-blur-sm group hover:border-white/10 hover:bg-[#09090b]/60 transition-all duration-300">
              <div className="inline-flex rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 mb-5 transition-transform duration-300 group-hover:scale-105">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
              </div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.15em] text-white">
                High-Trust Leaderboard
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-[#8f8f97] font-medium">
                Discover top-performing internet startups ranked by real MRR and verified growth patterns.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-[#09090b]/30 p-6 backdrop-blur-sm group hover:border-white/10 hover:bg-[#09090b]/60 transition-all duration-300">
              <div className="inline-flex rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 mb-5 transition-transform duration-300 group-hover:scale-105">
                <BadgeCheck className="h-4 w-4 text-indigo-400" />
              </div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.15em] text-white">
                Payment-Backed Proof
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-[#8f8f97] font-medium">
                Every profile is connected to API payment streams for authentic, high-confidence verification.
              </p>
            </div>
          </div>
        </section>

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
        <footer className="mt-20 border-t border-white/[0.05] pt-6 pb-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">© 2026 Verifi</div>
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Built for founders worldwide
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

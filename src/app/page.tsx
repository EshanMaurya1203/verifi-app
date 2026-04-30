"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, BarChart3, Eye } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { ConnectionStatus } from "@/components/startup/ConnectionStatus";
import { RevenueChart } from "@/components/startup/RevenueChart";
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

const recentlyListed: StartupCard[] = [
  {
    initials: "CF",
    name: "CodeFlow",
    category: "Developer Tools",
    description: "AI-powered code review platform",
    mrr: "₹2.5L",
    growth: "+18.5%",
    badge: "API Verified",
  },
  {
    initials: "SL",
    name: "ShopLens",
    category: "AI",
    description: "Visual search engine for D2C brands",
    mrr: "₹1.8L",
    growth: "+24.2%",
    badge: "API Verified",
  },
  {
    initials: "CP",
    name: "ContentPilot",
    category: "Marketing Tools",
    description: "Automated content scheduling & analytics",
    mrr: "₹3.1L",
    growth: "+12.7%",
    badge: "API Verified",
  },
];

const categories = [
  { name: "SaaS / Software", description: "Subscription tools & web apps" },
  {
    name: "Artificial Intelligence",
    description: "AI tools, agents & LLM products",
  },
  { name: "Mobile Apps", description: "iOS & Android subscription apps" },
  { name: "D2C / E-commerce", description: "Online stores & product brands" },
  { name: "Content / Creator", description: "Newsletters, courses & communities" },
  { name: "Agency / Services", description: "Productized agencies & retainers" },
  { name: "Developer Tools", description: "APIs, SDKs & dev infrastructure" },
  { name: "Marketing Tools", description: "SEO, outreach & analytics" },
];

const leaderboardPreview: any[] = [];

const fadeUpContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUpItem = {
  hidden: { y: 24, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function AdSlot() {
  return (
    <div className="sticky top-20 h-[400px] rounded-xl border border-dashed border-border bg-card p-4">
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-[12px] font-light text-muted-foreground">Ad Slot</div>
        <div className="text-[12px] text-muted-foreground">Available</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState({ count: 142, totalRevenue: 2400000 });
  const [leaderboard, setLeaderboard] = useState(leaderboardPreview);
  const [recentlyListedData, setRecentlyListedData] = useState(recentlyListed);

  const [connections, setConnections] = useState<any[] | null>(null);
  const [revenue, setRevenue] = useState<any[]>([]);

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
            .map((s: any, i: number) => ({
              rank: i + 1,
              name: s.startup_name,
              founder: s.name,
              mrr: s.mrr ? `₹${(s.mrr / 100000).toFixed(1)}L` : "₹0",
              trust_score: s.trust_score || 0,
            }));
          setLeaderboard(top5);

          // Recently listed
          const recent = list.slice(0, 3).map((s: any) => ({
            initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
            name: s.startup_name,
            category: s.biz_type,
            description: s.notes || "No description provided.",
            mrr: s.mrr ? `₹${(s.mrr / 100000).toFixed(1)}L` : "₹0",
            growth: "+0%",
            badge: s.verification_label || "Unverified",
            trust_score: s.trust_score || 0,
          }));
          setRecentlyListedData(recent);
        }
      })
      .catch(console.error);

    // 3. Fetch Overview (for ConnectionStatus & Chart)
    fetch("/api/startup/1/overview")
      .then((res) => res.json())
      .then((data) => {
        setConnections(data.connections || []);
        setRevenue(data.revenue || []);
        console.log("Revenue:", data.revenue);
      })
      .catch(console.error);
  }, []);

  const refreshOverview = () => {
    fetch("/api/startup/1/overview")
      .then((res) => res.json())
      .then((data) => {
        setConnections(data.connections || []);
        setRevenue(data.revenue || []);
      })
      .catch(console.error);
  };

  const formatStatsRevenue = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="mx-auto grid max-w-[1200px] grid-cols-1 px-6 lg:grid-cols-[220px_1fr_220px] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="pt-20">
            <AdSlot />
          </div>
        </aside>

        <main>
          <section className="min-h-[85vh] pt-[120px]">
            <motion.div
              variants={fadeUpContainer}
              initial="hidden"
              animate="show"
              className="mx-auto flex min-h-[85vh] w-full max-w-[860px] flex-col items-center justify-center text-center"
            >
              <motion.h1
                variants={fadeUpItem}
                className="font-syne text-[44px] font-extrabold leading-none tracking-[-2px] sm:text-[68px]"
              >
                <span className="text-foreground">Discover Top Startups</span>
                <br />
                <span className="text-primary">With Verified Revenue</span>
              </motion.h1>

              <motion.p
                variants={fadeUpItem}
                className="mt-6 max-w-[680px] text-[17px] font-light leading-[1.7] text-muted-foreground"
              >
                Explore high-growth startups, transparent founder metrics, and real
                monthly revenue numbers in one trusted leaderboard.
              </motion.p>

              <motion.div
                variants={fadeUpItem}
                className="mt-8 flex w-full max-w-[680px] flex-col gap-3 sm:flex-row"
              >
                <input
                  type="text"
                  placeholder="Search startup, founder, or category..."
                  className="h-12 flex-1 rounded-lg border border-border bg-muted px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-border"
                />
                <Link
                  href="/submit"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-transform duration-200 hover:scale-[1.02]"
                >
                  Add your startup
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUpItem}
                className="mt-12 grid w-full max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-3"
              >
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="font-syne text-[28px] font-bold text-foreground">
                    {stats.count}
                  </div>
                  <div className="text-[13px] text-muted-foreground">startups listed</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-md">
                  <div className="font-syne text-[28px] font-bold text-primary">
                    {formatStatsRevenue(stats.totalRevenue)}
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    total verified revenue
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="font-syne text-[28px] font-bold text-foreground">
                    1
                  </div>
                  <div className="text-[13px] text-muted-foreground">countries</div>
                </div>
              </motion.div>
            </motion.div>
          </section>

          <div className="p-6">
            {!connections ? (
              <div className="h-[200px] flex items-center justify-center rounded-xl border border-dashed border-border animate-pulse">
                <p className="text-sm text-muted-foreground">Loading status...</p>
              </div>
            ) : (
              <>
                <ConnectionStatus connections={connections} />
                <div className="mt-8">
                  <h3 className="font-syne text-[18px] font-bold text-foreground mb-4">Revenue Timeline</h3>
                  <RevenueChart data={revenue} />
                </div>
              </>
            )}
          </div>

          <section className="mt-16">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h3 className="font-syne text-[20px] font-bold text-foreground">
                  Leaderboard Preview
                </h3>
                <Link
                  href="/leaderboard"
                  className="text-[13px] text-primary transition-colors hover:text-primary/80"
                >
                  View full leaderboard →
                </Link>
              </div>

              <div className="divide-y divide-[#151515]">
                {leaderboard.map((startup) => (
                  <div
                    key={startup.rank}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="w-7 font-syne text-[16px] font-bold text-muted-foreground">
                        {startup.rank}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-foreground">
                          {startup.name}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {startup.founder}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end">
                        <span className="font-syne text-[16px] font-bold text-foreground">{startup.mrr}</span>
                        <span className="text-[10px] text-neutral-500 uppercase font-black tracking-tighter">Revenue</span>
                      </div>
                      <div className="flex flex-col items-center justify-center bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1 min-w-[40px]">
                        <span className="text-[12px] font-black text-blue-400">{startup.trust_score}</span>
                        <span className="text-[8px] text-blue-500/60 uppercase font-black -mt-0.5">Trust</span>
                      </div>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-neutral-500 font-medium">
                    No startups verified yet. Be the first to join the leaderboard!
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-[100px]">
            <motion.div
              variants={fadeUpContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.div
                variants={fadeUpItem}
                className="flex items-center justify-between"
              >
                <div className="font-syne text-[22px] font-bold text-foreground">
                  Recently listed
                </div>
                <Link
                  href="/leaderboard"
                  className="text-[14px] text-primary hover:underline"
                >
                  View all →
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUpItem}
                className="mt-6 overflow-hidden rounded-none border border-border bg-accent"
              >
                <div className="grid grid-cols-1 gap-px md:grid-cols-3">
                  {recentlyListedData.map((s) => (
                    <div
                      key={s.name}
                      className="cursor-pointer bg-card p-6 transition-colors duration-200 hover:bg-accent"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent font-syne text-[13px] font-bold text-foreground">
                            {s.initials}
                          </div>
                          <div className="text-[15px] font-medium text-foreground">
                            {s.name}
                          </div>
                        </div>
                        <div className="rounded-full border border-primary/20 bg-primary/20 px-2 py-0.5 text-[12px] text-primary">
                          ✓ {s.badge}
                        </div>
                      </div>

                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {s.category}
                      </div>
                      <div
                        className="mt-3 text-[13px] leading-[1.6] text-muted-foreground"
                        style={{
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        }}
                      >
                        {s.description}
                      </div>

                      <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="font-syne text-[18px] font-bold text-foreground">
                              {s.mrr}
                            </div>
                            <div className="text-[11px] text-muted-foreground">MRR</div>
                          </div>
                          <div className="text-[13px] font-medium text-primary">
                            ↑ {s.growth}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </section>

          <section className="mt-20">
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <p className="text-[12px] uppercase tracking-[1.2px] text-muted-foreground">
                Trusted by founders
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {["CodeFlow", "ShopLens", "ContentPilot", "LeadMagnet"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-border bg-muted px-4 py-2 text-[13px] text-muted-foreground"
                  >
                    {name}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-border bg-muted p-4">
                <p className="text-[14px] leading-[1.6] text-muted-foreground">
                  &quot;Verifi helped us build instant credibility with customers and
                  investors. Having public, verified revenue changed every
                  conversation.&quot;
                </p>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  — Arjun Mehta, Founder at CodeFlow
                </p>
              </div>
            </div>
          </section>

          <section className="mt-20">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="inline-flex rounded-lg border border-border bg-muted p-2">
                  <Eye className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-foreground">
                  Transparent Revenue
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                  Public, verifiable revenue numbers so founders and users can
                  trust the signal.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="inline-flex rounded-lg border border-border bg-muted p-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-foreground">
                  Leaderboard
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                  Discover top-performing startups ranked by real MRR and verified
                  growth momentum.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="inline-flex rounded-lg border border-border bg-muted p-2">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-foreground">
                  Verified Startups
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                  Every profile is backed by payment-provider data for authentic,
                  high-confidence startup discovery.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-20">
            <motion.div
              variants={fadeUpContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.div
                variants={fadeUpItem}
                className="font-syne text-[22px] font-bold text-foreground"
              >
                Browse by category
              </motion.div>

              <motion.div
                variants={fadeUpItem}
                className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4"
              >
                {categories.map((c) => (
                  <div
                    key={c.name}
                    className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition-colors duration-200 hover:border-border hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-medium text-foreground">
                          {c.name}
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {c.description}
                        </div>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          <section className="mt-24">
            <div className="rounded-2xl border border-primary/20 bg-card px-6 py-10 text-center shadow-lg md:px-10 md:py-12">
              <h2 className="font-syne text-[34px] font-extrabold leading-tight text-foreground md:text-[42px]">
                Ready to list your startup publicly?
              </h2>
              <p className="mx-auto mt-3 max-w-[620px] text-[15px] leading-[1.7] text-muted-foreground">
                Join Verifi and build trust with transparent, verified revenue in
                minutes.
              </p>
              <Link
                href="/submit"
                className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-transform duration-200 hover:scale-[1.03] hover:bg-primary/90"
              >
                Add your startup
              </Link>
            </div>
          </section>

          <footer className="mt-[100px] border-t border-border py-6">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-muted-foreground">© 2025 Verifi</div>
              <div className="text-[12px] text-muted-foreground">
                Built for founders worldwide
              </div>
            </div>
          </footer>
        </main>

        <aside className="hidden lg:block">
          <div className="pt-20">
            <AdSlot />
          </div>
        </aside>
      </div>
    </div>
  );
}

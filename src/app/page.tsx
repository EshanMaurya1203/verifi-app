"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, BarChart3, Eye } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

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

const leaderboardPreview = [
  { rank: 1, name: "LeadMagnet", founder: "Karan Joshi", mrr: "₹5.7L" },
  { rank: 2, name: "CartPulse", founder: "Riya Patel", mrr: "₹4.5L" },
  { rank: 3, name: "BrandForge", founder: "Ananya Reddy", mrr: "₹4.2L" },
  { rank: 4, name: "ContentPilot", founder: "Rahul Kapoor", mrr: "₹3.1L" },
  { rank: 5, name: "CodeFlow", founder: "Arjun Mehta", mrr: "₹2.5L" },
];

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
    <div className="sticky top-20 h-[400px] rounded-xl border border-dashed border-[#262626] bg-[#0f0f0f] p-4">
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <div className="text-[12px] font-light text-[#333333]">Ad Slot</div>
        <div className="text-[12px] text-[#606060]">Available</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#edede9]">
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
                <span className="text-[#edede9]">Discover Top Startups</span>
                <br />
                <span className="text-[#b9ff4b]">With Verified Revenue</span>
              </motion.h1>

              <motion.p
                variants={fadeUpItem}
                className="mt-6 max-w-[680px] text-[17px] font-light leading-[1.7] text-[#a0a09a]"
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
                  className="h-12 flex-1 rounded-lg border border-[#2a2a2a] bg-[#121212] px-4 text-[14px] text-[#edede9] placeholder:text-[#606060] outline-none transition-colors focus:border-[#3a3a3a]"
                />
                <Link
                  href="/submit"
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-[#b9ff4b] px-6 text-[14px] font-semibold text-[#080808] transition-transform duration-200 hover:scale-[1.02]"
                >
                  Add your startup
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUpItem}
                className="mt-12 grid w-full max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-3"
              >
                <div className="rounded-xl border border-[#242424] bg-[#0f0f0f] p-5 shadow-[0_0_20px_rgba(185,255,75,0.05)]">
                  <div className="font-syne text-[28px] font-bold text-[#edede9]">
                    142
                  </div>
                  <div className="text-[13px] text-[#606060]">startups listed</div>
                </div>
                <div className="rounded-xl border border-[#242424] bg-[#0f0f0f] p-5 shadow-[0_0_20px_rgba(185,255,75,0.08)]">
                  <div className="font-syne text-[28px] font-bold text-[#b9ff4b]">
                    ₹2.4Cr
                  </div>
                  <div className="text-[13px] text-[#606060]">
                    total verified revenue
                  </div>
                </div>
                <div className="rounded-xl border border-[#242424] bg-[#0f0f0f] p-5 shadow-[0_0_20px_rgba(185,255,75,0.05)]">
                  <div className="font-syne text-[28px] font-bold text-[#edede9]">
                    12
                  </div>
                  <div className="text-[13px] text-[#606060]">countries</div>
                </div>
              </motion.div>
            </motion.div>
          </section>

          <section className="mt-16">
            <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f]">
              <div className="flex items-center justify-between border-b border-[#1a1a1a] px-5 py-4">
                <h3 className="font-syne text-[20px] font-bold text-[#edede9]">
                  Leaderboard Preview
                </h3>
                <Link
                  href="/leaderboard"
                  className="text-[13px] text-[#b9ff4b] transition-colors hover:text-[#d5ff93]"
                >
                  View full leaderboard →
                </Link>
              </div>

              <div className="divide-y divide-[#151515]">
                {leaderboardPreview.map((startup) => (
                  <div
                    key={startup.rank}
                    className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-[#121212]"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="w-7 font-syne text-[16px] font-bold text-[#a0a09a]">
                        {startup.rank}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[#edede9]">
                          {startup.name}
                        </p>
                        <p className="truncate text-[12px] text-[#606060]">
                          {startup.founder}
                        </p>
                      </div>
                    </div>
                    <div className="font-syne text-[16px] font-bold text-[#edede9]">
                      {startup.mrr}
                    </div>
                  </div>
                ))}
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
                <div className="font-syne text-[22px] font-bold text-[#edede9]">
                  Recently listed
                </div>
                <Link
                  href="/leaderboard"
                  className="text-[14px] text-[#b9ff4b] hover:underline"
                >
                  View all →
                </Link>
              </motion.div>

              <motion.div
                variants={fadeUpItem}
                className="mt-6 overflow-hidden rounded-none border border-[#1a1a1a] bg-[#1a1a1a]"
              >
                <div className="grid grid-cols-1 gap-px md:grid-cols-3">
                  {recentlyListed.map((s) => (
                    <div
                      key={s.name}
                      className="cursor-pointer bg-[#0f0f0f] p-6 transition-colors duration-200 hover:bg-[#141414]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1e1e1e] font-syne text-[13px] font-bold text-[#edede9]">
                            {s.initials}
                          </div>
                          <div className="text-[15px] font-medium text-[#edede9]">
                            {s.name}
                          </div>
                        </div>
                        <div className="rounded-full border border-[rgba(185,255,75,0.2)] bg-[#0d1f00] px-2 py-0.5 text-[12px] text-[#b9ff4b]">
                          ✓ {s.badge}
                        </div>
                      </div>

                      <div className="mt-1 text-[12px] text-[#606060]">
                        {s.category}
                      </div>
                      <div
                        className="mt-3 text-[13px] leading-[1.6] text-[#a0a09a]"
                        style={{
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          overflow: "hidden",
                        }}
                      >
                        {s.description}
                      </div>

                      <div className="mt-4 border-t border-[#1a1a1a] pt-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="font-syne text-[18px] font-bold text-[#edede9]">
                              {s.mrr}
                            </div>
                            <div className="text-[11px] text-[#606060]">MRR</div>
                          </div>
                          <div className="text-[13px] font-medium text-[#b9ff4b]">
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
            <div className="rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]/70 p-6 md:p-8">
              <p className="text-[12px] uppercase tracking-[1.2px] text-[#606060]">
                Trusted by founders
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {["CodeFlow", "ShopLens", "ContentPilot", "LeadMagnet"].map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-[#252525] bg-[#121212] px-4 py-2 text-[13px] text-[#a0a09a]"
                  >
                    {name}
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-[#252525] bg-[#121212] p-4">
                <p className="text-[14px] leading-[1.6] text-[#a0a09a]">
                  &quot;Verifi helped us build instant credibility with customers and
                  investors. Having public, verified revenue changed every
                  conversation.&quot;
                </p>
                <p className="mt-3 text-[12px] text-[#606060]">
                  — Arjun Mehta, Founder at CodeFlow
                </p>
              </div>
            </div>
          </section>

          <section className="mt-20">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-5">
                <div className="inline-flex rounded-lg border border-[#2b2b2b] bg-[#151515] p-2">
                  <Eye className="h-4 w-4 text-[#b9ff4b]" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-[#edede9]">
                  Transparent Revenue
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#a0a09a]">
                  Public, verifiable revenue numbers so founders and users can
                  trust the signal.
                </p>
              </div>

              <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-5">
                <div className="inline-flex rounded-lg border border-[#2b2b2b] bg-[#151515] p-2">
                  <BarChart3 className="h-4 w-4 text-[#b9ff4b]" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-[#edede9]">
                  Leaderboard
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#a0a09a]">
                  Discover top-performing startups ranked by real MRR and verified
                  growth momentum.
                </p>
              </div>

              <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-5">
                <div className="inline-flex rounded-lg border border-[#2b2b2b] bg-[#151515] p-2">
                  <BadgeCheck className="h-4 w-4 text-[#b9ff4b]" />
                </div>
                <h3 className="mt-4 text-[16px] font-medium text-[#edede9]">
                  Verified Startups
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-[#a0a09a]">
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
                className="font-syne text-[22px] font-bold text-[#edede9]"
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
                    className="group cursor-pointer rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-5 transition-colors duration-200 hover:border-[#333333] hover:bg-[#141414]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-medium text-[#edede9]">
                          {c.name}
                        </div>
                        <div className="mt-1 text-[12px] text-[#606060]">
                          {c.description}
                        </div>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 text-[#606060] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          <section className="mt-24">
            <div className="rounded-2xl border border-[rgba(185,255,75,0.25)] bg-[radial-gradient(circle_at_top,rgba(185,255,75,0.14),rgba(13,13,13,0.96)_55%)] px-6 py-10 text-center shadow-[0_0_50px_rgba(185,255,75,0.14)] md:px-10 md:py-12">
              <h2 className="font-syne text-[34px] font-extrabold leading-tight text-[#edede9] md:text-[42px]">
                Ready to list your startup publicly?
              </h2>
              <p className="mx-auto mt-3 max-w-[620px] text-[15px] leading-[1.7] text-[#a0a09a]">
                Join Verifi and build trust with transparent, verified revenue in
                minutes.
              </p>
              <Link
                href="/submit"
                className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-[#b9ff4b] px-7 text-[15px] font-semibold text-[#080808] transition-transform duration-200 hover:scale-[1.03] hover:bg-[#d5ff93]"
              >
                Add your startup
              </Link>
            </div>
          </section>

          <footer className="mt-[100px] border-t border-[#1a1a1a] py-6">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[#606060]">© 2025 Verifi</div>
              <div className="text-[12px] text-[#606060]">
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
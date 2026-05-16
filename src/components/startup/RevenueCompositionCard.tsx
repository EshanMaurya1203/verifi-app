"use client";

import React, { useState } from "react";
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Globe,
  Zap,
  BarChart3,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPie,
  Pie,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProviderBreakdown {
  provider: string;
  amount: number;
  percentage: number;
  transactionCount: number;
  currency: string;
}

export interface RevenueSnapshot {
  total_revenue: number;
  provider_breakdown: Record<string, number>;
  created_at: string;
}

interface RevenueCompositionCardProps {
  breakdown: ProviderBreakdown[];
  totalMrr: number;
  growth: number;
  snapshots: RevenueSnapshot[];
}

// ─── Provider Styling ───────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { color: string; gradient: string; label: string; ring: string }> = {
  stripe: {
    color: "#6366f1",
    gradient: "from-indigo-500/20 to-indigo-600/5",
    label: "Stripe",
    ring: "ring-indigo-500/30",
  },
  razorpay: {
    color: "#3b82f6",
    gradient: "from-blue-500/20 to-blue-600/5",
    label: "Razorpay",
    ring: "ring-blue-500/30",
  },
};

const getStyle = (provider: string) =>
  PROVIDER_STYLES[provider.toLowerCase()] || {
    color: "#737373",
    gradient: "from-neutral-500/20 to-neutral-600/5",
    label: provider,
    ring: "ring-neutral-500/30",
  };

// ─── Currency Formatting ────────────────────────────────────────────────────

function formatCurrency(value: number, currency = "INR"): string {
  const cur = currency.toUpperCase();
  if (cur === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number, currency = "INR"): string {
  const symbol = currency.toUpperCase() === "USD" ? "$" : "₹";
  if (value >= 1_00_000) return `${symbol}${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}k`;
  return `${symbol}${value}`;
}

// ─── Donut Chart Component ──────────────────────────────────────────────────

const ProviderDonut = ({ breakdown }: { breakdown: ProviderBreakdown[] }) => {
  const data = breakdown.map((b) => ({
    name: b.provider,
    value: b.amount,
    fill: getStyle(b.provider).color,
  }));

  if (data.length === 0) return null;

  return (
    <div className="w-[140px] h-[140px] mx-auto relative">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={62}
            paddingAngle={4}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            animationDuration={1200}
            animationBegin={200}
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
        </RechartsPie>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Sources</span>
        <span className="text-lg font-black text-white font-syne">{breakdown.length}</span>
      </div>
    </div>
  );
};

// ─── Growth Trend Sparkline ─────────────────────────────────────────────────

const GrowthSparkline = ({ snapshots }: { snapshots: RevenueSnapshot[] }) => {
  if (snapshots.length < 2) return null;

  const chartData = snapshots.slice(-20).map((s) => ({
    date: new Date(s.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    revenue: Number(s.total_revenue) || 0,
  }));

  return (
    <div className="h-[160px] w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 8, fontWeight: 800 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#404040", fontSize: 8, fontWeight: 800 }}
            tickFormatter={(v) => compactCurrency(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 14px",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.6)",
            }}
            itemStyle={{ color: "#fff", fontSize: "11px", fontWeight: "900" }}
            labelStyle={{
              color: "#525252",
              fontSize: "9px",
              fontWeight: "900",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
              marginBottom: "4px",
            }}
            formatter={(value: any) => [formatCurrency(Number(value)), "VERIFIED MRR"]}
            cursor={{ stroke: "rgba(99, 102, 241, 0.15)", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{
              r: 5,
              strokeWidth: 0,
              fill: "#6366f1",
              style: { filter: "drop-shadow(0 0 6px rgba(99,102,241,0.5))" },
            }}
            animationDuration={1800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Per-provider Stacked Trend ─────────────────────────────────────────────

const ProviderTrend = ({ snapshots }: { snapshots: RevenueSnapshot[] }) => {
  if (snapshots.length < 2) return null;

  // Extract unique providers from snapshots
  const allProviders = new Set<string>();
  snapshots.forEach((s) => {
    if (s.provider_breakdown) {
      Object.keys(s.provider_breakdown).forEach((p) => allProviders.add(p));
    }
  });
  const providers = Array.from(allProviders);
  if (providers.length < 2) return null;

  const chartData = snapshots.slice(-15).map((s) => {
    const row: Record<string, string | number> = {
      date: new Date(s.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    };
    for (const p of providers) {
      row[p] = s.provider_breakdown?.[p] || 0;
    }
    return row;
  });

  return (
    <div className="h-[160px] w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 8, fontWeight: 800 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#404040", fontSize: 8, fontWeight: 800 }}
            tickFormatter={(v) => compactCurrency(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "10px 14px",
              boxShadow: "0 20px 50px -12px rgba(0,0,0,0.6)",
            }}
            itemStyle={{ fontSize: "10px", fontWeight: "900" }}
            labelStyle={{
              color: "#525252",
              fontSize: "9px",
              fontWeight: "900",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
            }}
            formatter={(value: any, name: any) => [
              formatCurrency(Number(value)),
              String(name).toUpperCase(),
            ]}
          />
          {providers.map((p) => (
            <Area
              key={p}
              type="monotone"
              dataKey={p}
              stackId="1"
              stroke={getStyle(p).color}
              fill={getStyle(p).color}
              fillOpacity={0.15}
              strokeWidth={2}
              animationDuration={1800}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

type ViewMode = "composition" | "trend" | "provider-trend";

export const RevenueCompositionCard = ({
  breakdown,
  totalMrr,
  growth,
  snapshots,
}: RevenueCompositionCardProps) => {
  const [view, setView] = useState<ViewMode>("composition");
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  const hasMultipleProviders =
    snapshots.some((s) => s.provider_breakdown && Object.keys(s.provider_breakdown).length > 1);

  // ─── Empty State ────────────────────────────────────────────────────────
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[3rem] p-10 text-center">
        <PieChart className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
        <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-500">
          Composition Unavailable
        </h4>
        <p className="text-[9px] text-neutral-600 mt-2 max-w-[180px] mx-auto font-bold uppercase tracking-widest leading-relaxed">
          Connect institutional providers to visualize revenue distribution.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[3rem] p-8 lg:p-10 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full group-hover:bg-indigo-500/8 transition-colors duration-1000 pointer-events-none" />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 relative z-10 gap-4">
        <div>
          <h3 className="text-xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
            <PieChart className="w-5 h-5 text-indigo-400" /> Revenue Composition
          </h3>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
            Multi-Source Verification
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-neutral-950/50 border border-white/[0.05] rounded-2xl p-1">
          {[
            { key: "composition" as ViewMode, icon: PieChart, label: "Split" },
            { key: "trend" as ViewMode, icon: TrendingUp, label: "Trend" },
            ...(hasMultipleProviders
              ? [{ key: "provider-trend" as ViewMode, icon: Layers, label: "Stack" }]
              : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                view === tab.key
                  ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content Views ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {view === "composition" && (
          <motion.div
            key="composition"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="relative z-10"
          >
            {/* Donut + Legend */}
            <div className="flex flex-col lg:flex-row gap-8 items-center mb-8">
              <ProviderDonut breakdown={breakdown} />

              <div className="flex-1 w-full space-y-3">
                {breakdown.map((item, idx) => {
                  const style = getStyle(item.provider);
                  const isHovered = hoveredProvider === item.provider;

                  return (
                    <motion.div
                      key={item.provider}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onMouseEnter={() => setHoveredProvider(item.provider)}
                      onMouseLeave={() => setHoveredProvider(null)}
                      className={`relative bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 flex items-center justify-between transition-all duration-300 cursor-default ${
                        isHovered ? "bg-white/[0.05] border-white/[0.08] scale-[1.01]" : ""
                      }`}
                    >
                      {/* Active left bar */}
                      <div
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: style.color,
                          opacity: isHovered ? 1 : 0.4,
                        }}
                      />

                      <div className="flex items-center gap-4 pl-4">
                        <div className="w-10 h-10 rounded-xl bg-neutral-950 border border-white/5 flex items-center justify-center p-2 relative">
                          <div className="w-full h-full flex items-center justify-center text-[18px] font-black italic text-white/50 transition-colors" style={{ color: style.color }}>
                            {item.provider.charAt(0).toUpperCase()}
                          </div>
                          {/* Active pulse */}
                          <div
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 animate-pulse"
                            style={{ backgroundColor: style.color }}
                          />
                        </div>
                        <div>
                          <h4 className="text-[12px] font-black uppercase tracking-widest text-white">
                            {style.label}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                              {item.transactionCount} verified txns
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[14px] font-black text-white tabular-nums">
                          {formatCurrency(item.amount, item.currency)}
                        </div>
                        <div className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-0.5">
                          {item.percentage}% share
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Progress Bar Stack */}
            <div className="h-3 w-full bg-neutral-800/50 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-white/5">
              {breakdown.map((item, idx) => (
                <motion.div
                  key={item.provider}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 1.2, delay: idx * 0.15, ease: "circOut" }}
                  className="h-full rounded-full relative overflow-hidden"
                  style={{ backgroundColor: getStyle(item.provider).color }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {view === "trend" && (
          <motion.div
            key="trend"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="relative z-10"
          >
            {snapshots.length >= 2 ? (
              <>
                <div className="flex items-center gap-4 mb-2">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Verified MRR Over Time
                  </span>
                </div>
                <GrowthSparkline snapshots={snapshots} />
              </>
            ) : (
              <div className="py-12 text-center">
                <TrendingUp className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                  Insufficient snapshots for trend projection
                </p>
              </div>
            )}
          </motion.div>
        )}

        {view === "provider-trend" && (
          <motion.div
            key="provider-trend"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="relative z-10"
          >
            {snapshots.length >= 2 && hasMultipleProviders ? (
              <>
                <div className="flex items-center gap-4 mb-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    Stacked Provider Revenue
                  </span>
                  <div className="flex gap-3 ml-auto">
                    {breakdown.map((b) => (
                      <div key={b.provider} className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getStyle(b.provider).color }}
                        />
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">
                          {getStyle(b.provider).label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <ProviderTrend snapshots={snapshots} />
              </>
            ) : (
              <div className="py-12 text-center">
                <Layers className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">
                  Multiple providers needed for stacked view
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Summary Footer ──────────────────────────────────────────────── */}
      <div className="mt-10 pt-8 border-t border-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
        <div>
          <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1">
            Total Verified Aggregation
          </p>
          <p className="text-3xl font-black font-syne text-white tracking-tighter tabular-nums">
            {formatCurrency(totalMrr)}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Growth badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${
              growth >= 0
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {growth >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(growth).toFixed(1)}% Momentum
          </div>

          {/* Live indicator */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

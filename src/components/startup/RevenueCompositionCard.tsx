"use client";

import React, { useState } from "react";
import { formatCurrency as formatCurrencyUtil, formatPercentage } from "@/lib/formatters";
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
  Info,
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
  isDemo?: boolean;
}

// ─── Provider Styling ───────────────────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { color: string; gradient: string; label: string; ring: string }> = {
  stripe: {
    color: "#b9ff4b",
    gradient: "from-primary/20 to-primary/5",
    label: "Stripe",
    ring: "ring-primary/30",
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

const formatCurrency = (value: number, currency = "INR") =>
  formatCurrencyUtil(value, currency, { compact: false });

const compactCurrency = (value: number, currency = "INR") =>
  formatCurrencyUtil(value, currency, { compact: true });

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
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Sources</span>
        <span className="text-lg font-black text-white font-syne">{breakdown.length}</span>
      </div>
    </div>
  );
};

// ─── Growth Trend Sparkline ─────────────────────────────────────────────────

const GrowthSparkline = ({ snapshots, isDemo = false }: { snapshots: RevenueSnapshot[]; isDemo?: boolean }) => {
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
              <stop offset="0%" stopColor="#b9ff4b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#b9ff4b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
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
            itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "600" }}
            labelStyle={{
              color: "#525252",
              fontSize: "10px",
              fontWeight: "600",
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
              marginBottom: "4px",
            }}
            formatter={(value: any) => [formatCurrency(Number(value)), isDemo ? "SIMULATED MRR" : "VERIFIED MRR"]}
            cursor={{ stroke: "rgba(99, 102, 241, 0.15)", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#b9ff4b"
            strokeWidth={2.5}
            fill="url(#revGrad)"
            dot={false}
            activeDot={{
              r: 5,
              strokeWidth: 0,
              fill: "#b9ff4b",
              style: { filter: "drop-shadow(0 0 6px rgba(185,255,75,0.5))" },
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
            tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
            dy={8}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
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
            itemStyle={{ fontSize: "11px", fontWeight: "600" }}
            labelStyle={{
              color: "#525252",
              fontSize: "10px",
              fontWeight: "600",
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
  isDemo = false,
}: RevenueCompositionCardProps) => {
  const [view, setView] = useState<ViewMode>("composition");
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);

  const hasMultipleProviders =
    snapshots.some((s) => s.provider_breakdown && Object.keys(s.provider_breakdown).length > 1);

  // ─── Empty State (Sleek Compact Placeholder) ────────────────────────────
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[3rem] p-8 md:p-10 text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col items-center justify-center py-4">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <PieChart className="w-5 h-5 text-neutral-500" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-neutral-300">
            No Revenue Data Available
          </h4>
          <p className="text-xs text-neutral-500 mt-2.5 max-w-sm mx-auto font-medium leading-relaxed">
            Revenue composition is currently empty. Connect your payment provider to verify your revenue and build trust.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[3rem] p-8 lg:p-10 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full group-hover:bg-primary/8 transition-colors duration-1000 pointer-events-none" />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 relative z-10 gap-4">
        <div>
          <h3 className="text-xl font-black font-syne uppercase tracking-tight text-white flex items-center gap-3">
            <PieChart className="w-5 h-5 text-primary" /> Revenue Breakdown
          </h3>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">
            {isDemo ? "Illustrative Metrics" : "Verified Sources"}
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                view === tab.key
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 translate-y-[-0.5px]" />
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
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                            {style.label}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isDemo ? (
                              <Info className="w-3.5 h-3.5 text-amber-400 translate-y-[-0.5px]" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 translate-y-[-0.5px]" />
                            )}
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                              {isDemo ? `${item.transactionCount} simulated txns` : `${item.transactionCount} verified txns`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 ml-4 max-w-[50%] overflow-hidden">
                        <div className="text-sm font-bold text-white tabular-nums truncate" title={formatCurrency(item.amount, item.currency)}>
                          {formatCurrency(item.amount, item.currency)}
                        </div>
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-0.5">
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
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {isDemo ? "Simulated MRR Over Time" : "Verified MRR Over Time"}
                  </span>
                </div>
                <GrowthSparkline snapshots={snapshots} isDemo={isDemo} />
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
                  <Layers className="w-4 h-4 text-primary" />
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
          <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider mb-1">
            {isDemo ? "Illustrative MRR (Demo)" : "Total Verified MRR"}
          </p>
          <p className="text-[clamp(1.5rem,3.5vw,1.875rem)] leading-none font-extrabold font-syne text-white tracking-tighter tabular-nums truncate max-w-full overflow-hidden" title={formatCurrency(totalMrr)}>
            {formatCurrency(totalMrr)}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Growth badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider ${
              growth >= 0
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {growth >= 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5 translate-y-[-0.5px]" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 translate-y-[-0.5px]" />
            )}
            {formatPercentage(Math.abs(growth), 2)} Momentum
          </div>

          {/* Live indicator */}
          <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary translate-y-[-0.5px]" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

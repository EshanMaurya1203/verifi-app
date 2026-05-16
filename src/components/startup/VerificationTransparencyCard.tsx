"use client";

import React from "react";
import {
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Copy,
  Layers,
  FileCheck2,
  History,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

import { VerificationStateResult, UnifiedVerificationStatus } from "@/lib/verification-state";

interface VerificationTransparencyCardProps {
  verification: VerificationStateResult | null | undefined;
}

// ─── Status Config ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  VERIFIED: {
    icon: ShieldCheck,
    label: "Verified",
    color: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    glow: "bg-emerald-500",
    ringColor: "stroke-emerald-500",
    trackColor: "stroke-emerald-500/15",
    description: "High-confidence data pipeline",
  },
  "PARTIALLY VERIFIED": {
    icon: Activity,
    label: "Partially Verified",
    color: "text-blue-400",
    bg: "bg-blue-500/12",
    border: "border-blue-500/25",
    glow: "bg-blue-500",
    ringColor: "stroke-blue-500",
    trackColor: "stroke-blue-500/15",
    description: "Acceptable but incomplete signals",
  },
  REVIEWING: {
    icon: ScanSearch,
    label: "Reviewing",
    color: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    glow: "bg-amber-500",
    ringColor: "stroke-amber-500",
    trackColor: "stroke-amber-500/15",
    description: "Initial verification phase",
  },
  "NEEDS REVIEW": {
    icon: ShieldAlert,
    label: "Needs Review",
    color: "text-amber-500",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    glow: "bg-amber-500",
    ringColor: "stroke-amber-500",
    trackColor: "stroke-amber-500/15",
    description: "Requires manual clarification",
  },
  INCOMPLETE: {
    icon: Clock,
    label: "Verification Incomplete",
    color: "text-rose-400",
    bg: "bg-rose-500/12",
    border: "border-rose-500/25",
    glow: "bg-rose-500",
    ringColor: "stroke-rose-500",
    trackColor: "stroke-rose-500/15",
    description: "Awaiting final reconciliation",
  },
  MONITORING: {
    icon: Activity,
    label: "Monitoring",
    color: "text-neutral-400",
    bg: "bg-neutral-500/12",
    border: "border-neutral-500/25",
    glow: "bg-neutral-500",
    ringColor: "stroke-neutral-500",
    trackColor: "stroke-neutral-500/15",
    description: "Continuous audit active",
  },
  UNVERIFIED: {
    icon: ScanSearch,
    label: "Reviewing",
    color: "text-amber-500",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    glow: "bg-amber-500",
    ringColor: "stroke-amber-500",
    trackColor: "stroke-amber-500/15",
    description: "Verification in progress",
  },
} as const;

const FRAUD_STATUS_CONFIG = {
  passed: { icon: CheckCircle2, label: "Passed", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  flagged: { icon: AlertTriangle, label: "Flagged", color: "text-amber-400", bg: "bg-amber-500/10" },
  no_data: { icon: Clock, label: "No Data", color: "text-neutral-500", bg: "bg-neutral-500/10" },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getProviderDisplayName(provider: string): string {
  const names: Record<string, string> = {
    stripe: "Stripe",
    razorpay: "Razorpay",
  };
  return names[provider.toLowerCase()] || provider;
}

// ─── Confidence Ring ────────────────────────────────────────────────────────

const ConfidenceRing = ({
  value,
  ringColor,
  trackColor,
}: {
  value: number;
  ringColor: string;
  trackColor: string;
}) => {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        {/* Track */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none" strokeWidth="5"
          className={trackColor}
        />
        {/* Progress */}
        <circle
          cx="48" cy="48" r={radius}
          fill="none" strokeWidth="5" strokeLinecap="round"
          className={ringColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white tabular-nums">{value}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-neutral-500">conf.</span>
      </div>
    </div>
  );
};

// ─── Metric Row ─────────────────────────────────────────────────────────────

const MetricRow = ({
  icon: Icon,
  label,
  value,
  valueColor = "text-white",
  iconColor = "text-neutral-500",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  iconColor?: string;
}) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0 group">
    <div className="flex items-center gap-2.5">
      <Icon className={`w-3.5 h-3.5 ${iconColor} transition-transform duration-200 group-hover:scale-110`} />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </span>
    </div>
    <span className={`text-xs font-black ${valueColor}`}>
      {value}
    </span>
  </div>
);

// ─── Verification Depth (Sub-component) ──────────────────────────────────────

const VerificationDepth = ({ level }: { level: number }) => {
  const steps = [
    { label: "Signals", desc: "Data Ingested" },
    { label: "Identity", desc: "Founder Verified" },
    { label: "Sync", desc: "Institutional Sync" },
    { label: "Forensic", desc: "Final Audit" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">Verification Depth</span>
        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Level {level}/4</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((step, idx) => (
          <div key={idx} className="space-y-2">
            <div className={`h-1 rounded-full transition-all duration-1000 ${idx < level ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-neutral-800'}`} />
            <div className="flex flex-col items-center">
              <span className={`text-[7px] font-black uppercase tracking-tighter ${idx < level ? 'text-indigo-300' : 'text-neutral-700'}`}>
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

export const VerificationTransparencyCard: React.FC<VerificationTransparencyCardProps> = ({
  verification,
}) => {
  if (!verification) {
    return (
      <div className="p-6 bg-neutral-900/20 border border-white/5 rounded-[2rem] flex items-center gap-4">
        <div className="p-3 bg-neutral-800/50 rounded-2xl">
          <ScanSearch className="w-5 h-5 text-neutral-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">
            Verification Transparency
          </p>
          <p className="text-sm text-neutral-500 mt-0.5">Awaiting pipeline data…</p>
        </div>
      </div>
    );
  }

  const {
    verificationConfidence,
    verificationStatus,
    transactionCount,
    duplicateProtectionActive,
    fraudChecksPassed,
    hasConnectedProviders,
    providersConnected,
    lastSyncAt,
  } = verification;

  const statusConfig = STATUS_CONFIG[verificationStatus];
  const fraudCheckStatus = transactionCount === 0 ? "no_data" : fraudChecksPassed ? "passed" : "flagged";
  const fraudConfig = FRAUD_STATUS_CONFIG[fraudCheckStatus];
  const StatusIcon = statusConfig.icon;
  const FraudIcon = fraudConfig.icon;

  return (
    <div className={`
      relative overflow-hidden rounded-[2rem]
      bg-neutral-900/30 border ${statusConfig.border}
      transition-all duration-500
    `}>
      {/* Ambient glow */}
      <div className={`
        absolute -top-20 -left-20 w-40 h-40 rounded-full opacity-[0.05]
        ${statusConfig.glow} blur-3xl pointer-events-none
      `} />

      {/* ── Header ────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-neutral-900/70 rounded-xl backdrop-blur-sm">
              <ScanSearch className={`w-4 h-4 ${statusConfig.color}`} />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500">
                Verification Transparency
              </p>
              <p className={`text-[10px] font-medium ${statusConfig.color} opacity-70 mt-0.5`}>
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bg}`}>
            <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
            <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Confidence Ring + Key Metrics ──────────────── */}
      <div className="px-6 pb-4 relative z-10">
        <div className="flex items-center gap-6">
          <ConfidenceRing
            value={verificationConfidence}
            ringColor={statusConfig.ringColor}
            trackColor={statusConfig.trackColor}
          />

          <div className="flex-1 min-w-0">
            {/* Provider pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {providersConnected.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">
                    {getProviderDisplayName(provider)}
                  </span>
                  <span className="text-[8px] font-bold text-neutral-600">
                    Verified
                  </span>
                </div>
              ))}
              {!hasConnectedProviders && (
                <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                  No providers connected
                </span>
              )}
            </div>

            {/* Last sync */}
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-neutral-600" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">
                Last sync: {formatSyncTime(lastSyncAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 relative z-10">
        <VerificationDepth level={verificationConfidence > 80 ? 4 : verificationConfidence > 50 ? 3 : 2} />
      </div>

      {/* ── Divider ───────────────────────────────────── */}
      <div className="mx-6 border-t border-white/[0.04]" />

      {/* ── Audit Metrics ─────────────────────────────── */}
      <div className="px-6 py-3 relative z-10">
        <MetricRow
          icon={FileCheck2}
          label="Verified Transactions"
          value={transactionCount.toLocaleString()}
          iconColor="text-indigo-400/70"
        />
        <MetricRow
          icon={Copy}
          label="Duplicate Prevention"
          value={
            duplicateProtectionActive ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Monitoring
              </span>
            )
          }
          valueColor={duplicateProtectionActive ? "text-emerald-400" : "text-red-400"}
          iconColor="text-cyan-400/70"
        />
        <MetricRow
          icon={FraudIcon}
          label="Fraud Checks"
          value={
            <span className={`flex items-center gap-1.5 ${fraudConfig.color}`}>
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${fraudConfig.bg}`}>
                {fraudConfig.label}
              </span>
            </span>
          }
          iconColor={fraudConfig.color}
        />
        <MetricRow
          icon={Activity}
          label="Confidence Level"
          value={`${verificationConfidence}%`}
          valueColor={statusConfig.color}
          iconColor={statusConfig.color}
        />
        <MetricRow
          icon={Layers}
          label="Authenticity Alignment"
          value={verificationStatus}
          valueColor={statusConfig.color}
          iconColor="text-violet-400/70"
        />
      </div>

      {/* ── Verification History (Premium) ──────────────── */}
      <div className="mx-6 border-t border-white/[0.04] pt-4 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Audit History</span>
        </div>
        <div className="space-y-4">
          {providersConnected.map((provider) => (
            <div key={provider} className="flex items-start gap-3 group">
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 group-hover:scale-125 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-300 capitalize">{provider} API Integrated</span>
                  <span className="text-[9px] font-bold text-neutral-600">Active</span>
                </div>
                <p className="text-[9px] text-neutral-500 mt-0.5">Secure handshake established. Syncing historical snapshots.</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 group">
            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 ring-4 ring-indigo-500/10" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-300">Forensic Trust Computed</span>
                <span className="text-[9px] font-bold text-indigo-400">Stable</span>
              </div>
              <p className="text-[9px] text-neutral-500 mt-0.5">Revenue integrity score generated based on multi-provider signals.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

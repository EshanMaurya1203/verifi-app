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

import {
  VerificationStateResult,
  ConfidenceTier,
  formatLastSyncRelative,
} from "@/lib/verification-state";
import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/isAdmin";

interface VerificationTransparencyCardProps {
  verification: VerificationStateResult | null | undefined;
  ownerId?: string;
}

// ─── Confidence Tier Config ─────────────────────────────────────────────────

const TIER_CONFIG: Record<ConfidenceTier, {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  ringColor: string;
  trackColor: string;
  description: string;
}> = {
  SELF_REPORTED: {
    icon: ScanSearch,
    label: "Self Reported",
    color: "text-neutral-400",
    bg: "bg-neutral-500/12",
    border: "border-neutral-500/20",
    glow: "bg-neutral-500",
    ringColor: "stroke-neutral-500",
    trackColor: "stroke-neutral-500/15",
    description: "Revenue data self-declared",
  },
  PAYMENT_CONNECTED: {
    icon: Activity,
    label: "Payment Connected",
    color: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    glow: "bg-amber-500",
    ringColor: "stroke-amber-500",
    trackColor: "stroke-amber-500/15",
    description: "Provider linked, building history",
  },
  REVENUE_VERIFIED: {
    icon: ShieldCheck,
    label: "Revenue Verified",
    color: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    glow: "bg-emerald-500",
    ringColor: "stroke-emerald-500",
    trackColor: "stroke-emerald-500/15",
    description: "Provider-backed revenue with a recent sync",
  },
};

const FRAUD_STATUS_CONFIG = {
  passed: { icon: CheckCircle2, label: "Passed", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  flagged: { icon: AlertTriangle, label: "Flagged", color: "text-amber-400", bg: "bg-amber-500/10" },
  no_data: { icon: Clock, label: "No Data", color: "text-neutral-500", bg: "bg-neutral-500/10" },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

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
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">conf.</span>
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
    </div>
    <span className={`text-xs font-bold ${valueColor}`}>
      {value}
    </span>
  </div>
);

// ─── Verification Depth (Sub-component) ──────────────────────────────────────

const VerificationDepth = ({ level }: { level: number }) => {
  const steps = [
    { label: "Self Reported", desc: "Self Declared" },
    { label: "Payment Connected", desc: "Provider Linked" },
    { label: "Revenue Verified", desc: "Transactions Checked" },
    { label: "High Confidence", desc: "Signals Validated" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Verification Depth</span>
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Level {level}/4</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((step, idx) => (
          <div key={idx} className="space-y-2">
            <div className={`h-1 rounded-full transition-all duration-1000 ${idx < level ? 'bg-primary shadow-[0_0_8px_rgba(185,255,75,0.4)]' : 'bg-neutral-800'}`} />
            <div className="flex flex-col items-center">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${idx < level ? 'text-primary/80' : 'text-neutral-700'}`}>
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
  ownerId,
}) => {
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = React.useState(false);

  React.useEffect(() => {
    const checkOwner = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const isOwner = data.user.id === ownerId;
        const admin = isAdmin(data.user.email);
        setIsOwnerOrAdmin(!!(isOwner || admin));
      }
    };
    if (ownerId) {
      checkOwner();
    }
  }, [ownerId]);

  if (!verification) {
    return (
      <div className="p-6 bg-neutral-900/20 border border-white/5 rounded-[2rem] flex items-center gap-4">
        <div className="p-3 bg-neutral-800/50 rounded-2xl">
          <ShieldAlert className="w-5 h-5 text-neutral-600" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Unverified Profile
          </p>
          <p className="text-sm text-neutral-500 mt-0.5">No verification data available yet.</p>
        </div>
      </div>
    );
  }

  const {
    verificationConfidence,
    confidenceTier,
    transactionCount,
    duplicateProtectionActive,
    fraudChecksPassed,
    hasConnectedProviders,
    providersConnected,
    lastSyncAt,
    verificationMethodLabel,
    dataSourceLabel,
    hasVerificationEvidence: evidenceBacked,
  } = verification;

  const statusConfig = TIER_CONFIG[confidenceTier];
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Verification Details
              </p>
              <p className={`text-[10px] font-semibold ${statusConfig.color} opacity-70 mt-0.5`}>
                {statusConfig.description}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${statusConfig.bg}`}>
            <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.color} translate-y-[-0.5px]`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Confidence Ring / Shield Badge + Key Metrics ──────────────── */}
      <div className="px-6 pb-4 relative z-10">
        <div className="flex items-center gap-6">
          {isOwnerOrAdmin ? (
            <ConfidenceRing
              value={verificationConfidence}
              ringColor={statusConfig.ringColor}
              trackColor={statusConfig.trackColor}
            />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
              <ShieldCheck className={`w-8 h-8 ${statusConfig.color}`} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Provider pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {providersConnected.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {getProviderDisplayName(provider)}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-600">
                    {evidenceBacked ? "Ledger-backed" : "Linked"}
                  </span>
                </div>
              ))}
              {!hasConnectedProviders && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/5 border border-amber-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Awaiting API Sync
                  </span>
                </div>
              )}
            </div>

            {/* Last sync */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neutral-600 translate-y-[-0.5px]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Last sync: {formatLastSyncRelative(lastSyncAt)}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Method: {verificationMethodLabel} · Source: {dataSourceLabel} · {verificationConfidence}% conf.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Verification Depth & Audit Details (Owner-only) ── */}
      {isOwnerOrAdmin ? (
        <>
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
              iconColor="text-primary/70"
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${fraudConfig.bg}`}>
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
              label="Verification Status"
              value={confidenceTier.replace(/_/g, " ")}
              valueColor={statusConfig.color}
              iconColor={statusConfig.color}
            />
          </div>

          {/* ── Verification History (Premium) ──────────────── */}
          <div className="mx-6 border-t border-white/[0.04] pt-4 pb-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-3.5 h-3.5 text-neutral-500 translate-y-[-0.5px]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Audit History</span>
            </div>
            <div className="space-y-4">
              {providersConnected.map((provider) => (
                <div key={provider} className="flex items-start gap-3 group">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10 group-hover:scale-125 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-300 capitalize">{provider} API Integrated</span>
                      <span className="text-[10px] font-bold text-neutral-600">Active</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Connection verified. Syncing your past revenue data.</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 group">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary ring-4 ring-primary/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-300">Verification Recalculated</span>
                    <span className="text-[10px] font-bold text-primary">Stable</span>
                  </div>
                  <p className="text-[10px] text-neutral-500 mt-0.5">Verification recalculated from connected activity.</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Divider ───────────────────────────────────── */}
          <div className="mx-6 border-t border-white/[0.04]" />
          
          {/* ── Public Verified Info Explainer ─────────────── */}
          <div className="px-6 py-5 relative z-10">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  {evidenceBacked ? "Direct Ledger Sync" : "Verification In Progress"}
                </h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {evidenceBacked
                    ? `Revenue is reconciled from ${dataSourceLabel}. Last sync ${formatLastSyncRelative(lastSyncAt)} (${verificationConfidence}% confidence).`
                    : `Method: ${verificationMethodLabel}. Source: ${dataSourceLabel}. Connect and sync a payment provider for ledger-backed verification.`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

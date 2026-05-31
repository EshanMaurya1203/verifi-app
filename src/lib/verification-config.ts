import { ShieldCheck, ScanSearch, CheckCircle2, Award, LucideIcon } from "lucide-react";
import { ConfidenceTier } from "./verification-state";

export interface TierConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  icon: LucideIcon;
  description: string;
}

export const VERIFICATION_TIER_CONFIG: Record<ConfidenceTier, TierConfig> = {
  SELF_REPORTED: {
    label: "Self Reported",
    color: "text-neutral-400",
    bg: "bg-neutral-500/10",
    border: "border-neutral-500/20",
    glow: "",
    icon: ScanSearch,
    description: "Revenue data self-declared without a connected payment provider",
  },
  PAYMENT_CONNECTED: {
    label: "Payment Connected",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    icon: Award,
    description: "Payment provider linked; building verified transaction history",
  },
  REVENUE_VERIFIED: {
    label: "Revenue Verified",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    icon: ShieldCheck,
    description: "Provider-backed revenue history with a recent sync",
  },
};

export const FALLBACK_VERIFICATION_TIER: ConfidenceTier = "SELF_REPORTED";

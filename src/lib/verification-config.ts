import { ShieldCheck, ScanSearch, CheckCircle2, Award, LucideIcon } from "lucide-react";
import { ConfidenceTier } from "./verification-state";

export interface TierConfig {
  label: string;
  color: string; // Taildwind text classes
  bg: string;    // Tailwind bg classes
  border: string; // Tailwind border classes
  glow: string;  // Tailwind shadow/glow classes
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
    description: "Revenue data self-declared without verification",
  },
  PAYMENT_CONNECTED: {
    label: "Payment Connected",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    icon: Award,
    description: "Provider linked, building transaction history",
  },
  REVENUE_VERIFIED: {
    label: "Revenue Verified",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    glow: "shadow-[0_0_15px_rgba(99,102,241,0.1)]",
    icon: CheckCircle2,
    description: "Consistent revenue confirmed by payment provider",
  },
  HIGH_CONFIDENCE: {
    label: "Payment Verified", // High Confidence -> Payment Verified
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    icon: ShieldCheck,
    description: "Multi-signal verification complete",
  },
};

export const FALLBACK_VERIFICATION_TIER: ConfidenceTier = "SELF_REPORTED";

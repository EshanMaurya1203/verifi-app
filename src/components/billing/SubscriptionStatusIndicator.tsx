"use client";

import { AlertCircle, Crown, Clock } from "lucide-react";
import Link from "next/link";

interface SubscriptionStatusIndicatorProps {
  planCode: string;
  status: string;
  trialEnd?: string | null;
}

export function SubscriptionStatusIndicator({
  planCode,
  status,
  trialEnd,
}: SubscriptionStatusIndicatorProps) {
  if (planCode === "viewer") {
    return (
      <Link href="/pricing" className="hidden sm:flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        Free Plan
      </Link>
    );
  }

  if (status === "past_due" || status === "grace_period") {
    return (
      <Link href="/dashboard/billing" className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-xs font-bold text-red-500 transition-colors hover:bg-red-500/20">
        <AlertCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Payment Failed</span>
      </Link>
    );
  }

  if (status === "trialing" && trialEnd) {
    const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
      <Link href="/dashboard/billing" className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-500 transition-colors hover:bg-amber-500/20">
        <Clock className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{daysLeft}d Trial Left</span>
      </Link>
    );
  }

  if (planCode === "pro") {
    return (
      <Link href="/dashboard/billing" className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20">
        <Crown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Pro</span>
      </Link>
    );
  }

  return (
    <Link href="/dashboard/billing" className="flex items-center gap-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400 transition-colors hover:bg-blue-500/20">
      <span className="hidden sm:inline">Founder</span>
    </Link>
  );
}

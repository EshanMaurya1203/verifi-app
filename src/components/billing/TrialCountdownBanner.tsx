"use client";

import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface TrialCountdownBannerProps {
  status: string;
  trialEnd?: string | null;
}

export function TrialCountdownBanner({ status, trialEnd }: TrialCountdownBannerProps) {
  if (status !== "trialing" || !trialEnd) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  if (daysLeft > 14) return null; // Safety check

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-amber-500 font-medium">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            You have <strong>{daysLeft} days left</strong> in your Founder trial.
          </span>
        </div>
        <Link 
          href="/dashboard/billing" 
          className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-400"
        >
          Manage Subscription
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

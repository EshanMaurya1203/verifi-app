"use client";

import React, { useSyncExternalStore } from "react";
import { Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface TrialCountdownBannerProps {
  status: string;
  trialEnd?: string | null;
}

let currentClockSnapshot: number | null = null;
const clockListeners = new Set<() => void>();
let clockIntervalId: ReturnType<typeof setInterval> | null = null;

function subscribeClock(onStoreChange: () => void): () => void {
  if (currentClockSnapshot === null) {
    currentClockSnapshot = Date.now();
  }
  clockListeners.add(onStoreChange);

  if (!clockIntervalId && typeof window !== "undefined") {
    clockIntervalId = setInterval(() => {
      currentClockSnapshot = Date.now();
      clockListeners.forEach((listener) => listener());
    }, 60000);
  }

  return () => {
    clockListeners.delete(onStoreChange);
    if (clockListeners.size === 0 && clockIntervalId) {
      clearInterval(clockIntervalId);
      clockIntervalId = null;
    }
  };
}

function getClockSnapshot(): number | null {
  if (currentClockSnapshot === null && typeof window !== "undefined") {
    currentClockSnapshot = Date.now();
  }
  return currentClockSnapshot;
}

function getSSRClockSnapshot(): null {
  return null;
}

export function TrialCountdownBanner({ status, trialEnd }: TrialCountdownBannerProps) {
  const now = useSyncExternalStore(subscribeClock, getClockSnapshot, getSSRClockSnapshot);

  if (status !== "trialing" || !trialEnd) return null;
  if (now === null) return null;

  const daysLeft = Math.max(0, Math.ceil((new Date(trialEnd).getTime() - now) / (1000 * 60 * 60 * 24)));

  if (daysLeft > 14) return null; // Safety check

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-amber-500 font-medium">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            You have <strong>{daysLeft} days left</strong> in your Pro trial.
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

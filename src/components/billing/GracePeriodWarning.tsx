"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface GracePeriodWarningProps {
  status: string;
}

export function GracePeriodWarning({ status }: GracePeriodWarningProps) {
  if (status !== "grace_period" && status !== "past_due") return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2.5">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-red-500 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Payment Failed.</strong> Please update your payment method to avoid losing access.
          </span>
        </div>
        <Link 
          href="/dashboard/billing" 
          className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-red-600"
        >
          Update Payment
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

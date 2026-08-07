"use client";

import React, { useEffect, useState } from "react";
import { Activity, BadgeCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { safeFetch } from "@/lib/safe-network";

type ActivityEvent = {
  id: string;
  event: string;
  startupName: string;
  timestamp: string;
};

const getShortActivity = (event: string): string => {
  switch (event) {
    case "stripe_sync_success":
    case "razorpay_sync_success":
      return "Revenue verified";
    case "listing_created":
      return "Profile created";
    default:
      return "Activity recorded";
  }
};

const getProviderBadge = (event: string) => {
  switch (event) {
    case "stripe_sync_success":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Stripe
        </span>
      );
    case "razorpay_sync_success":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Razorpay
        </span>
      );
    case "listing_created":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Verifii
        </span>
      );
  }
};

export function LiveFeed() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    async function loadLiveFeed() {
      try {
        const feedRes = await safeFetch<ActivityEvent[]>("/api/live-feed");
        if (feedRes.ok && feedRes.data) {
          setActivities(feedRes.data);
        }
      } catch {
        // Live feed is non-critical; empty state will show
      }
    }

    loadLiveFeed();
  }, []);

  return (
    <section className="sticky top-24">
      <div className="rounded-3xl border border-white/[0.06] bg-[#09090b]/40 backdrop-blur-md overflow-hidden shadow-xl ring-1 ring-white/[0.02]">
        <div className="border-b border-white/[0.05] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-syne text-sm font-black text-white uppercase tracking-tight">
              Live Feed
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
              Real-time
            </span>
          </div>
        </div>

        <div className="p-3.5 space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="p-3.5 rounded-2xl bg-white/[0.015] border border-white/[0.04] hover:bg-white/[0.03] transition-colors flex flex-col gap-1"
            >
              {/* Startup Name */}
              <span className="text-xs font-bold text-white truncate leading-snug">
                {activity.startupName}
              </span>

              {/* Short activity */}
              <span className="text-[11px] font-medium text-neutral-400 leading-snug">
                {getShortActivity(activity.event)}
              </span>

              {/* Provider Badge */}
              <div className="mt-0.5">{getProviderBadge(activity.event)}</div>

              {/* Relative Timestamp */}
              <span className="text-[9px] font-medium text-neutral-500 uppercase tracking-wider mt-1">
                {formatDistanceToNow(new Date(activity.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-neutral-500 uppercase font-bold tracking-widest">
              Waiting for ecosystem events...
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.05] bg-black/20">
          <p className="text-[9px] font-medium text-neutral-500 leading-relaxed text-center">
            All events are cryptographically backed by live payment provider APIs.
          </p>
        </div>
      </div>

      {/* Feature Box Sidebar */}
      <div className="mt-6 rounded-3xl border border-white/[0.05] bg-primary/[0.02] p-6 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
        <div className="inline-flex rounded-xl bg-primary/10 border border-primary/20 p-2.5 mb-4">
          <BadgeCheck className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-white">
          Payment-Backed Proof
        </h3>
        <p className="mt-2 text-[11px] leading-relaxed text-[#8f8f97] font-medium">
          Verifii connects securely to Stripe and Razorpay. Every profile uses raw
          API payment streams for authentic, high-confidence verification.
        </p>
      </div>
    </section>
  );
}

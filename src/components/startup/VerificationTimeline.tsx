"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Link, 
  Award, 
  Clock,
  History,
  RefreshCcw,
  ShieldCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/isAdmin";

export interface VerificationLog {
  id: string;
  event: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface VerificationTimelineProps {
  logs: VerificationLog[];
  ownerId?: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; description: (meta: Record<string, any>) => string }> = {
  razorpay_sync_success: {
    label: "Revenue Reconciliation",
    icon: RefreshCcw,
    color: "text-emerald-400 bg-emerald-500/10",
    description: (meta) => `Successfully reconciled ₹${meta.mrr?.toLocaleString() || '0'} across ${meta.count || 0} API records.`
  },
  razorpay_sync_success_public: {
    label: "Revenue Reconciliation",
    icon: RefreshCcw,
    color: "text-emerald-400 bg-emerald-500/10",
    description: () => `Successfully reconciled and synced India (Razorpay) ledger connection.`
  },
  stripe_sync_success: {
    label: "Revenue Reconciliation",
    icon: RefreshCcw,
    color: "text-emerald-400 bg-emerald-500/10",
    description: (meta) => `Successfully reconciled $${meta.mrr?.toLocaleString() || '0'} across ${meta.count || 0} API records.`
  },
  stripe_sync_success_public: {
    label: "Revenue Reconciliation",
    icon: RefreshCcw,
    color: "text-emerald-400 bg-emerald-500/10",
    description: () => `Successfully reconciled and synced Stripe ledger connection.`
  },
  provider_connected: {
    label: "Source Integrated",
    icon: Link,
    color: "text-indigo-400 bg-indigo-500/10",
    description: (meta) => `Successfully connected to ${meta.provider || 'payment provider'}.`
  },
  trust_score_updated: {
    label: "Verification Updated",
    icon: ShieldCheck,
    color: "text-[#b9ff4b] bg-[#b9ff4b]/10",
    description: (meta) => `System verification completed. Verification score refined to ${meta.score || 0}/100.`
  },
  trust_score_updated_public: {
    label: "Verification Updated",
    icon: ShieldCheck,
    color: "text-[#b9ff4b] bg-[#b9ff4b]/10",
    description: () => `System verification completed. Verification parameters and patterns validated.`
  },
  tier_upgraded: {
    label: "Verification Tier Upgrade",
    icon: Award,
    color: "text-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    description: (meta) => `Startup attained ${meta.tier || 'New'} Verification Tier based on sustained revenue consistency.`
  },
  fraud_check_passed: {
    label: "Revenue Consistency Check",
    icon: ShieldCheck,
    color: "text-emerald-400 bg-emerald-500/10",
    description: () => "Revenue patterns analyzed. Data verified as consistent and authentic."
  },
  listing_created: {
    label: "Platform Listing",
    icon: ShieldCheck,
    color: "text-indigo-400 bg-indigo-500/10",
    description: () => "Startup entered the Verifi ecosystem. Verification protocols initialized."
  }
};

export const VerificationTimeline = ({ logs, ownerId }: VerificationTimelineProps) => {
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);

  useEffect(() => {
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

  const sanitizedLogs = useMemo(() => {
    if (isOwnerOrAdmin) return logs;
    return logs.map((log) => {
      if (log.event === "trust_score_updated") {
        return { ...log, event: "trust_score_updated_public" };
      }
      if (log.event === "razorpay_sync_success") {
        return { ...log, event: "razorpay_sync_success_public" };
      }
      if (log.event === "stripe_sync_success") {
        return { ...log, event: "stripe_sync_success_public" };
      }
      return log;
    });
  }, [logs, isOwnerOrAdmin]);

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[2.5rem] p-10 text-center">
        <Clock className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
        <h4 className="text-sm font-black uppercase tracking-widest text-neutral-500">Connect to Start Verification</h4>
        <p className="text-[10px] text-neutral-600 mt-2 max-w-[200px] mx-auto font-bold uppercase tracking-widest leading-relaxed">
          Verification events will appear here once you connect a payment provider.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/30 border border-white/[0.05] rounded-[3rem] p-8 lg:p-10 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none">
        <History className="w-40 h-40" />
      </div>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-black font-syne uppercase tracking-tight text-white">Verification Timeline</h3>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">Verified Activity Log</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Clock className="w-5 h-5 text-indigo-400" />
        </div>
      </div>

      <div className="space-y-10 relative">
        {/* The connecting line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/[0.05]" />

        {sanitizedLogs.map((log, idx) => {
          const config = EVENT_CONFIG[log.event] || {
            label: "Verification Event",
            icon: ShieldCheck,
            color: "text-neutral-400 bg-neutral-500/10",
            description: () => "Verified system interaction completed successfully."
          };
          const Icon = config.icon;

          return (
            <div key={log.id} className="flex gap-6 relative group">
              <div className={`w-10 h-10 rounded-2xl ${config.color} border border-white/5 flex items-center justify-center flex-shrink-0 relative z-10 transition-transform group-hover:scale-110 duration-500`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 pt-1">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                  <h4 className="text-[13px] font-black uppercase tracking-[0.1em] text-white leading-none">
                    {config.label}
                  </h4>
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest bg-black/40 px-2.5 py-1 rounded-lg border border-white/[0.02]">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed font-medium max-w-lg">
                  {config.description(log.metadata || {})}
                </p>
                
                {/* Visual marker for current/latest event */}
                {idx === 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Revenue verified</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

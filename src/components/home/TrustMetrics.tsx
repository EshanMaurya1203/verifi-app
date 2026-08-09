"use client";

import React from "react";
import { ShieldCheck, CreditCard, Lock, CheckCircle2 } from "lucide-react";
import { useStartupData } from "./StartupDataProvider";
import { formatCurrency } from "@/lib/formatters";

export function TrustMetrics() {
  const { verifiedStartupCount, verifiedRevenueTotal, loading } = useStartupData();

  const formattedRevenue = formatCurrency(verifiedRevenueTotal || 0, "INR", {
    compact: true,
  });

  const metrics = [
    {
      id: "verified-startups",
      value: loading ? "0" : String(verifiedStartupCount),
      title: "Payment-Verified Startups",
      supportingText: "Live verified profiles",
      icon: ShieldCheck,
      badgeText: "Real-time",
    },
    {
      id: "verified-revenue",
      value: loading ? "₹0" : formattedRevenue,
      title: "Verified Revenue",
      supportingText: "Payment-backed revenue",
      icon: CreditCard,
      badgeText: "API Ledger",
    },
    {
      id: "payment-integrations",
      value: "2",
      title: "Payment Integrations",
      supportingText: "Stripe + Razorpay",
      icon: Lock,
      badgeText: "Native APIs",
    },
    {
      id: "verification-standard",
      value: "API",
      title: "Verification Standard",
      supportingText: "No screenshots accepted",
      icon: CheckCircle2,
      badgeText: "Zero Friction",
    },
  ];

  return (
    <section className="mt-8 mb-12" aria-label="Verifii Trust Metrics">
      <div className="rounded-2xl border border-white/[0.08] bg-[#09090b]/80 backdrop-blur-md p-6 shadow-xl ring-1 ring-white/[0.02]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.id}
                className={`flex flex-col justify-between ${
                  index !== 0 ? "pt-5 sm:pt-0 sm:pl-6 lg:pl-4" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                        {metric.title}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-white/[0.04] text-neutral-400 border border-white/[0.06]">
                      {metric.badgeText}
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-syne text-3xl lg:text-4xl font-black text-white tracking-tight">
                      {metric.value}
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-[11px] font-medium text-neutral-400 leading-snug">
                  {metric.supportingText}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

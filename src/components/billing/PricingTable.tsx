"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PricingTableProps {
  currentPlanCode?: string;
  status?: string;
  currentPeriodEnd?: string | null;
  onCheckoutStart?: () => void;
  onCheckoutComplete?: () => void;
  isModal?: boolean;
}

export function PricingTable({
  currentPlanCode = "viewer",
  status,
  currentPeriodEnd: _currentPeriodEnd,
  onCheckoutStart,
  onCheckoutComplete,
  isModal = false,
}: PricingTableProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const router = useRouter();

  const handleCheckout = async (planCode: string) => {
    if (loadingPlan) return;

    if (planCode === "viewer" && currentPlanCode !== "viewer") {
      setShowCancelModal(true);
      return;
    }

    if (planCode !== "pro") return;

    setLoadingPlan(planCode);
    onCheckoutStart?.();

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: "pro", billing_cycle: "monthly" }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?next=/pricing");
          return;
        }
        alert(data.error || "Failed to initialize checkout");
        setLoadingPlan(null);
        return;
      }

      if (data.short_url) {
        window.location.href = data.short_url;
        return;
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    } finally {
      if (!isModal) {
        setLoadingPlan(null);
      }
    }
  };

  const handleCancelConfirm = async () => {
    setLoadingPlan("cancel");
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to cancel subscription");
      } else {
        setShowCancelModal(false);
        onCheckoutComplete?.();
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      code: "viewer",
      name: "Free",
      description: "Permanently free revenue verification and public profile.",
      price: 0,
      features: [
        "Permanent Free Revenue Verification",
        "Connect Stripe & Razorpay",
        "Public Verified Profile",
        "Tamper-Proof SVG Verified Badge",
        "Live Revenue Sync & Trust Metrics",
        "Search Public Directory",
      ],
      buttonText:
        currentPlanCode === "viewer"
          ? "Current Plan"
          : status === "cancelled"
            ? "Downgraded to Free"
            : "Downgrade to Free",
      disabled: currentPlanCode === "viewer" || status === "cancelled",
    },
    {
      code: "pro",
      name: "Pro",
      description: "Advanced analytics, multiple gateways, and developer tools.",
      price: 999,
      features: [
        "Everything in Free (Permanently Free)",
        "Multi-Gateway Composite Analytics",
        "CSV Ledger Export",
        "REST API Access (Coming Soon)",
        "Advanced Verification Filters",
        "Priority Founder Support",
      ],
      buttonText:
        currentPlanCode === "pro"
          ? status === "cancelled"
            ? "Cancelled (Active until period end)"
            : "Current Plan"
          : "Upgrade to Pro",
      disabled: currentPlanCode === "pro" && status !== "cancelled",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto font-sans">
      {/* 2-Tier Grid */}
      <div className="grid gap-8 md:grid-cols-2">
        {plans.map((plan) => {
          const isPro = plan.code === "pro";
          return (
            <div
              key={plan.code}
              className={`relative flex flex-col rounded-3xl border p-8 shadow-sm transition-all ${
                isPro
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-card"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-syne text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-syne text-4xl font-extrabold">
                    {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    /month
                  </span>
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.code)}
                disabled={plan.disabled || loadingPlan !== null}
                className={`w-full rounded-xl px-4 py-3 text-sm font-bold transition-all flex justify-center items-center ${
                  plan.disabled
                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                    : isPro
                      ? "bg-primary text-primary-foreground hover:bg-[#a8e630]"
                      : "bg-card border border-border hover:border-primary text-foreground"
                }`}
              >
                {loadingPlan === plan.code ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  plan.buttonText
                )}
              </button>
            </div>
          );
        })}
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm sm:p-6">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl text-center">
            <h3 className="font-syne text-2xl font-bold mb-2">Cancel Subscription?</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Your Pro subscription will remain active until the current billing period ends.
              After expiry your account will automatically move to the permanent Free plan.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl px-6 py-2.5 border border-border font-bold hover:bg-muted transition-colors text-sm"
                disabled={loadingPlan === "cancel"}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelConfirm}
                className="rounded-xl px-6 py-2.5 bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center gap-2 text-sm"
                disabled={loadingPlan === "cancel"}
              >
                {loadingPlan === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

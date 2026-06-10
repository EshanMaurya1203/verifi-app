"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PricingTableProps {
  currentPlanCode?: string;
  currentCycle?: "monthly" | "annual";
  status?: string;
  currentPeriodEnd?: string | null;
  onCheckoutStart?: () => void;
  onCheckoutComplete?: () => void;
  isModal?: boolean;
}

export function PricingTable({
  currentPlanCode = "viewer",
  currentCycle = "monthly",
  status,
  currentPeriodEnd,
  onCheckoutStart,
  onCheckoutComplete,
  isModal = false,
}: PricingTableProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const router = useRouter();

  const handleCheckout = async (planCode: string) => {
    if (loadingPlan) return;
    
    if (planCode === "viewer" && currentPlanCode !== "viewer") {
      setShowCancelModal(true);
      return;
    }

    setLoadingPlan(planCode);
    onCheckoutStart?.();

    try {
      // Determine if it's an upgrade/downgrade vs a new checkout
      const isChange = currentPlanCode !== "viewer";
      const endpoint = isChange ? "/api/billing/change-plan" : "/api/billing/checkout";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, billing_cycle: billingCycle }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to process request");
        setLoadingPlan(null);
        return;
      }

      if (data.short_url) {
        window.location.href = data.short_url;
        return;
      }

      if (isChange) {
        onCheckoutComplete?.();
        router.refresh();
      } else {
        router.refresh();
      }
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
        method: "POST"
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
      name: "Viewer",
      description: "Basic access to public verified profiles.",
      price: { monthly: 0, annual: 0 },
      features: ["View public startup profiles", "Search verified database", "Community access"],
      buttonText: currentPlanCode === "viewer" 
        ? "Current Plan" 
        : status === "cancelled"
          ? `Cancels on ${currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : 'period end'}`
          : "Cancel Subscription",
      disabled: currentPlanCode === "viewer" || status === "cancelled",
    },
    {
      code: "founder",
      name: "Verified Founder",
      description: "Get verified and showcase your revenue publicly.",
      price: { monthly: 599, annual: 5748 }, // 5748 / 12 = 479/mo (20% off)
      features: [
        "Everything in Viewer",
        "Public Verified Profile",
        "Connect 1 Payment Provider",
        "Tamper-proof Revenue Badges",
        "14-Day Free Trial",
      ],
      buttonText: currentPlanCode === "founder" && currentCycle === billingCycle ? "Current Plan" : "Start 14-Day Trial",
      disabled: currentPlanCode === "founder" && currentCycle === billingCycle,
    },
    {
      code: "pro",
      name: "Pro",
      description: "Advanced analytics and multiple integrations for scale.",
      price: { monthly: 1799, annual: 17268 }, // 17268 / 12 = 1439/mo (20% off)
      features: [
        "Everything in Founder",
        "Connect Multiple Providers",
        "API Access (Coming Soon)",
        "Priority Support",
        "Custom Branding",
      ],
      buttonText: currentPlanCode === "pro" && currentCycle === billingCycle ? "Current Plan" : "Upgrade to Pro",
      disabled: currentPlanCode === "pro" && currentCycle === billingCycle,
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto font-sans">
      {/* Toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
              billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={`rounded-full px-6 py-2 text-sm font-bold transition-colors ${
              billingCycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual <span className="ml-1 text-xs text-green-500">-20%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isPro = plan.code === "pro";
          return (
            <div
              key={plan.code}
              className={`relative flex flex-col rounded-3xl border p-8 shadow-sm transition-all ${
                isPro ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="font-syne text-2xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-syne text-4xl font-extrabold">
                    {plan.price[billingCycle] === 0 ? "Free" : `₹${plan.price[billingCycle]}`}
                  </span>
                  {plan.price[billingCycle] > 0 && (
                    <span className="text-sm font-medium text-muted-foreground">
                      /{billingCycle === "annual" ? "yr" : "mo"}
                    </span>
                  )}
                </div>
                {billingCycle === "annual" && plan.price.annual > 0 && (
                  <p className="mt-1 text-xs text-primary font-medium">
                    Billed annually
                  </p>
                )}
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
              Your subscription will remain active until the current billing period ends.
              After expiry your account will automatically move to the Free plan.
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

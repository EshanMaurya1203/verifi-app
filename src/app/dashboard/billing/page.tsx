import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserPlan } from "@/lib/subscriptions";
import { Navbar } from "@/components/layout/Navbar";
import { TrialCountdownBanner } from "@/components/billing/TrialCountdownBanner";
import { GracePeriodWarning } from "@/components/billing/GracePeriodWarning";
import { CreditCard, Calendar, ShieldCheck, Crown } from "lucide-react";
import Link from "next/link";
import { BillingActions } from "./BillingActions";

export const metadata = {
  title: "Billing & Subscriptions | Verifii",
};

export default async function BillingDashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/submit");
  }

  const plan = await getUserPlan(user.id);

  const isFree = plan.plan_code === "viewer";
  const isPro = plan.plan_code === "pro";
  const isFounder = plan.plan_code === "founder";
  
  const periodEnd = plan.current_period_end 
    ? new Date(plan.current_period_end).toLocaleDateString()
    : "—";

  const statusDisplay = 
    plan.status === "trialing" ? "Trial Active" :
    plan.status === "active" ? "Active" :
    plan.status === "cancelled" ? `Cancels on ${periodEnd}` :
    plan.status === "past_due" ? "Past Due" :
    "Inactive";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Navbar />
      
      {/* Global Billing Banners */}
      <TrialCountdownBanner status={plan.status} trialEnd={plan.trial_end} />
      <GracePeriodWarning status={plan.status} />

      <main className="mx-auto w-full max-w-4xl px-4 pt-12 pb-24 flex-1">
        <div className="mb-8">
          <h1 className="font-syne text-3xl font-extrabold">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-2">
            Manage your plan, payment methods, and billing history.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          {/* Main Overview */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Plan</p>
                  <h2 className="font-syne text-2xl font-bold mt-1 flex items-center gap-2">
                    {isPro ? <Crown className="h-6 w-6 text-primary" /> : null}
                    {isFounder ? <ShieldCheck className="h-6 w-6 text-blue-400" /> : null}
                    {isFree ? "Free Viewer" : isPro ? "Pro" : "Verified Founder"}
                  </h2>
                </div>
                <div className={`px-3 py-1 text-xs font-bold rounded-full border ${
                  plan.status === "active" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                  plan.status === "trialing" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                  plan.status === "cancelled" ? "bg-neutral-500/10 text-neutral-400 border-neutral-500/20" :
                  "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>
                  {statusDisplay}
                </div>
              </div>

              {!isFree && (
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                      <CreditCard className="h-4 w-4" />
                      Billing Cycle
                    </p>
                    <p className="font-medium capitalize">{plan.billing_cycle}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Calendar className="h-4 w-4" />
                      {plan.status === "cancelled" ? "Ends On" : "Renews On"}
                    </p>
                    <p className="font-medium">{periodEnd}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions / Upgrade Card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-syne text-lg font-bold mb-4">Manage Plan</h3>
              <BillingActions 
                currentPlanCode={plan.plan_code} 
                currentCycle={plan.billing_cycle}
                status={plan.status}
                currentPeriodEnd={plan.current_period_end}
              />
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <h3 className="font-syne text-lg font-bold mb-2">Need help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                If you have questions about your billing, refunds, or changing plans, our support team is ready to help.
              </p>
              <a href="mailto:support@verifii.in" className="text-sm font-bold text-primary hover:underline">
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

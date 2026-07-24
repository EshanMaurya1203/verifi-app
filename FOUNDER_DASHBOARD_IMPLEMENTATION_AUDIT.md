# Founder Dashboard Implementation Audit

This document contains the complete implementation of the Founder Dashboard, including rendering, fetching, updating logic, utilities, formatting, routing, auth/middleware, and SQL schemas.

## File Inventory
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/billing/page.tsx`
- `src/components/founder-dashboard/ActivityTimeline.tsx`
- `src/components/founder-dashboard/ARRWidget.tsx`
- `src/components/founder-dashboard/DashboardHero.tsx`
- `src/components/founder-dashboard/EmptyDashboard.tsx`
- `src/components/founder-dashboard/FounderHealthScore.tsx`
- `src/components/founder-dashboard/FounderInsightsCard.tsx`
- `src/components/founder-dashboard/LearnVerifii.tsx`
- `src/components/founder-dashboard/MRRWidget.tsx`
- `src/components/founder-dashboard/NextActionCard.tsx`
- `src/components/founder-dashboard/ProgressChecklist.tsx`
- `src/components/founder-dashboard/ProgressOverview.tsx`
- `src/components/founder-dashboard/QuickActions.tsx`
- `src/components/founder-dashboard/RecentActivity.tsx`
- `src/components/founder-dashboard/RecommendationCard.tsx`
- `src/components/founder-dashboard/RecommendationList.tsx`
- `src/components/founder-dashboard/RevenueBreakdownWidget.tsx`
- `src/components/founder-dashboard/RevenueDashboard.tsx`
- `src/components/founder-dashboard/RevenueHealthCard.tsx`
- `src/components/founder-dashboard/StatusCards.tsx`
- `src/components/founder-dashboard/TimelineDateSection.tsx`
- `src/components/founder-dashboard/TimelineEmptyState.tsx`
- `src/components/founder-dashboard/TimelineEventCard.tsx`
- `src/app/api/startup/[id]/overview/route.ts`
- `src/app/api/startup/[id]/sync/route.ts`
- `src/lib/dashboard/founder-insights-engine.ts`
- `src/lib/dashboard/founder-insights-presenter.ts`
- `src/lib/dashboard/getFounderProgress.ts`
- `src/lib/dashboard/getNextFounderAction.ts`
- `src/lib/dashboard/recommendation-engine.ts`
- `src/lib/dashboard/revenue-engine.ts`
- `src/lib/dashboard/revenue-presenter.ts`
- `src/lib/dashboard/startup-status.ts`
- `src/lib/dashboard/timeline-engine.ts`
- `src/lib/dashboard/timeline-formatters.ts`
- `src/lib/dashboard/timeline-grouper.ts`
- `src/lib/dashboard/timeline-presenter.ts`
- `src/lib/dashboard/timeline-types.ts`
- `src/lib/scoring.ts`
- `src/lib/verification-state.ts`
- `src/lib/verification-data.ts`
- `src/lib/revenue-aggregation.ts`
- `src/lib/formatters.ts`
- `middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase-server.ts`
- `supabase/migrations/20240416000000_revenue_tracking.sql`
- `supabase/migrations/20240416000003_v2_verification_engine.sql`
- `supabase/migrations/20240416000004_fraud_detection.sql`
- `supabase/migrations/20240416000011_provider_connections.sql`
- `supabase/migrations/20260420124038_historical_snapshots.sql`

---

## `src/app/dashboard/layout.tsx`

```tsx
import { ReactNode } from "react";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserPlan } from "@/lib/subscriptions";
import { TrialCountdownBanner } from "@/components/billing/TrialCountdownBanner";
import { GracePeriodWarning } from "@/components/billing/GracePeriodWarning";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();
  let status = "active";
  let trialEnd = null;

  if (user) {
    const plan = await getUserPlan(user.id);
    status = plan.status;
    trialEnd = plan.trial_end;
  }

  return (
    <>
      <TrialCountdownBanner status={status} trialEnd={trialEnd} />
      <GracePeriodWarning status={status} />
      {children}
    </>
  );
}
```

## `src/app/dashboard/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { Navbar } from "@/components/layout/Navbar";
import type { Metadata } from "next";

import { EmptyDashboard } from "@/components/founder-dashboard/EmptyDashboard";
import { DashboardHero } from "@/components/founder-dashboard/DashboardHero";
import { StatusCards } from "@/components/founder-dashboard/StatusCards";
import { QuickActions } from "@/components/founder-dashboard/QuickActions";
import { RecentActivity } from "@/components/founder-dashboard/RecentActivity";
import { LearnVerifii } from "@/components/founder-dashboard/LearnVerifii";
import { ProgressOverview } from "@/components/founder-dashboard/ProgressOverview";
import { ProgressChecklist } from "@/components/founder-dashboard/ProgressChecklist";
import { NextActionCard } from "@/components/founder-dashboard/NextActionCard";
import { getFounderProgress } from "@/lib/dashboard/getFounderProgress";
import { getNextFounderAction } from "@/lib/dashboard/getNextFounderAction";
import { buildTimelineEvents } from "@/lib/dashboard/timeline-engine";
import { presentTimelineEvents } from "@/lib/dashboard/timeline-presenter";
import { getFounderInsightsSnapshot } from "@/lib/dashboard/founder-insights-engine";
import { getDashboardInsights } from "@/lib/dashboard/founder-insights-presenter";
import { FounderInsightsCard } from "@/components/founder-dashboard/FounderInsightsCard";
import { buildStartupStatus } from "@/lib/dashboard/startup-status";
import { getRecommendations } from "@/lib/dashboard/recommendation-engine";
import { getStartupMetrics, getRevenueHistory } from "@/lib/revenue-aggregation";
import { buildRevenueSnapshot } from "@/lib/dashboard/revenue-engine";
import { presentRevenueDashboard } from "@/lib/dashboard/revenue-presenter";
import { RevenueDashboard } from "@/components/founder-dashboard/RevenueDashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your verified startup identities and integrations on Verifii.",
  alternates: {
    canonical: "https://www.verifii.in/dashboard/",
  }
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.verifii.in/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Dashboard",
      "item": "https://www.verifii.in/dashboard/"
    }
  ]
};

// Isolated helper for selecting primary startup
// Note: In the future, this can be expanded to support switching, pinning, or last-viewed startup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPrimaryStartup(startups: any[]) {
  return startups?.[0] || null;
}

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/submit");
  }

  // Fetch startups owned by authenticated user
  const { data: startups } = await supabaseServer
    .from("startup_submissions")
    .select("id, startup_name, slug, verification_status, trust_tier, startup_logo, payment_connected, created_at, is_public, mrr, proof_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const displayName = user.user_metadata?.full_name;
  const userName = user.email?.split("@")[0] || "Founder";
  const primaryStartup = getPrimaryStartup(startups || []);
  
  let content;

  if (!primaryStartup) {
    content = <EmptyDashboard />;
  } else {
    const startupSlug = primaryStartup.slug || primaryStartup.id;
    const status = buildStartupStatus(primaryStartup);
    
    // Unified recommendations pipeline
    const recommendations = getRecommendations(status, startupSlug);
    const primaryRecommendation = recommendations.length > 0 ? recommendations[0] : null;
    const insightsRecommendations = recommendations.slice(1);

    const progress = getFounderProgress(status);
    const nextAction = getNextFounderAction(primaryRecommendation, status, startupSlug);

    // Timeline: engine produces raw events → presenter resolves wording
    const rawEvents = buildTimelineEvents(primaryStartup);
    const timelineEvents = presentTimelineEvents(rawEvents);

    // Founder Insights: engine produces snapshot → presenter maps to dashboard wording
    const insightsSnapshot = getFounderInsightsSnapshot(status);
    const dashboardInsights = getDashboardInsights(insightsSnapshot, insightsRecommendations);

    // Revenue Analytics Dashboard
    const [revenueMetrics, revenueHistory, { data: latestConnection }] = await Promise.all([
      getStartupMetrics(primaryStartup.id),
      getRevenueHistory(primaryStartup.id),
      supabaseServer
        .from("provider_connections")
        .select("last_synced_at")
        .eq("startup_id", primaryStartup.id)
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
    ]);
    const lastSyncedAt = latestConnection?.last_synced_at ? new Date(latestConnection.last_synced_at) : null;
    const revenueSnapshot = buildRevenueSnapshot(revenueMetrics, revenueHistory, lastSyncedAt);
    const revenueViewModel = presentRevenueDashboard(revenueSnapshot);

    content = (
      <>
        <DashboardHero
          displayName={displayName}
          userName={userName}
          startupName={primaryStartup.startup_name}
          status={status}
          startupSlug={startupSlug}
        />
        <ProgressOverview 
          progress={progress} 
          statusMessage={nextAction.statusMessage}
        />
        <ProgressChecklist 
          progress={progress}
        />
        <NextActionCard 
          action={nextAction} 
        />
        <FounderInsightsCard 
          insights={dashboardInsights} 
        />
        {revenueSnapshot.hasData && (
          <div className="mt-8 mb-4">
            <h2 className="text-xl font-semibold tracking-tight mb-4">Revenue Analytics</h2>
            <RevenueDashboard viewModel={revenueViewModel} />
          </div>
        )}
        <StatusCards
          status={status}
          trustTier={primaryStartup.trust_tier}
        />
        <QuickActions
          startupSlug={startupSlug}
          status={status}
        />
        <RecentActivity events={timelineEvents} />
        <LearnVerifii />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-12">
        {content}
      </main>
    </div>
  );
}

```

## `src/app/dashboard/billing/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getUserPlan } from "@/lib/subscriptions";
import { supabaseServer } from "@/lib/supabase-server";
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

  const { data: pendingReplacement } = await supabaseServer
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "trialing")
    .not("replaces_razorpay_subscription_id", "is", null)
    .neq("id", plan.id) // Ensure we don't treat the current subscription as a replacement of itself
    .limit(1)
    .maybeSingle();

  const isFree = plan.plan_code === "viewer";
  const isPro = plan.plan_code === "pro";
  const isFounder = plan.plan_code === "founder";
  
  const periodEnd = plan.current_period_end 
    ? new Date(plan.current_period_end).toLocaleDateString()
    : "—";

  const displayDate =
    plan.status === "trialing"
      ? (plan.trial_end
          ? new Date(plan.trial_end).toLocaleDateString()
          : "—")
      : periodEnd;

  const statusDisplay = 
    plan.status === "trialing" ? "Trial Active" :
    plan.status === "active" ? "Active" :
    plan.status === "cancelled" ? `Cancels on ${periodEnd}` :
    plan.status === "past_due" ? "Past Due" :
    "Inactive";

  const pendingPlanName = pendingReplacement?.plan_code === "pro" ? "Pro" : "Verified Founder";
  const pendingCycleName = pendingReplacement?.billing_cycle === "annual" ? "annual" : "monthly";
  const pendingActivationDate = pendingReplacement?.trial_end
    ? new Date(pendingReplacement.trial_end).toLocaleDateString()
    : periodEnd;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Navbar />
      
      {/* Global Billing Banners */}
      <TrialCountdownBanner status={plan.status} trialEnd={plan.trial_end} />
      <GracePeriodWarning status={plan.status} />
      
      {pendingReplacement && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                You have a scheduled plan change to <strong>{pendingPlanName} ({pendingCycleName})</strong> starting on <strong>{pendingActivationDate}</strong>.
              </span>
            </div>
          </div>
        </div>
      )}

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
                      {plan.status === "cancelled" ? "Ends On" : plan.status === "trialing" ? "Trial Ends" : "Renews On"}
                    </p>
                    <p className="font-medium">{displayDate}</p>
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
                pendingReplacement={pendingReplacement}
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
```

## `src/components/founder-dashboard/ActivityTimeline.tsx`

```tsx
import type { PresentableTimelineEvent } from "@/lib/dashboard/timeline-types";
import { groupEventsByDate } from "@/lib/dashboard/timeline-grouper";
import { TimelineDateSection } from "./TimelineDateSection";
import { TimelineEmptyState } from "./TimelineEmptyState";

/**
 * ActivityTimeline
 *
 * Container component that orchestrates the full timeline display.
 * Groups presentable events by date and renders sections, or shows
 * an empty state when there are no events.
 */

interface ActivityTimelineProps {
  events: PresentableTimelineEvent[];
  /** Optional cap on the number of events to display (for dashboard summary view) */
  maxEvents?: number;
  /** Show "View all activity" link when events are truncated (retained for future use) */
  showViewAll?: boolean;
}

export function ActivityTimeline({
  events,
  maxEvents,
  showViewAll = false,
}: ActivityTimelineProps) {
  // Apply optional cap
  const truncated = maxEvents != null && events.length > maxEvents;
  const displayEvents = maxEvents != null ? events.slice(0, maxEvents) : events;

  // Empty state
  if (displayEvents.length === 0) {
    return <TimelineEmptyState />;
  }

  // Group by date
  const groups = groupEventsByDate(displayEvents);

  return (
    <div>
      {groups.map((group) => (
        <TimelineDateSection
          key={group.dateKey}
          label={group.label}
          events={group.events}
        />
      ))}

      {/* Future: "View all activity" link */}
      {showViewAll && truncated && (
        <div className="mt-2 text-center">
          <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            View all activity →
          </span>
        </div>
      )}
    </div>
  );
}
```

## `src/components/founder-dashboard/ARRWidget.tsx`

```tsx
"use client";

interface ARRWidgetProps {
  formattedARR: string;
}

export function ARRWidget({ formattedARR }: ARRWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
      <h3 className="text-sm font-medium tracking-tight mb-2">Annual Run Rate</h3>
      <div className="text-2xl font-bold">{formattedARR}</div>
      <p className="text-xs text-muted-foreground mt-2">
        Based on current MRR
      </p>
    </div>
  );
}
```

## `src/components/founder-dashboard/DashboardHero.tsx`

```tsx
import Link from "next/link";
import { ShieldCheck, ArrowRight, Activity, Eye, Pencil, Globe, Lock } from "lucide-react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface DashboardHeroProps {
  displayName?: string | null;
  userName: string;
  startupName: string;
  status: StartupStatus;
  startupSlug: string;
}

export function DashboardHero({ displayName, userName, startupName, status, startupSlug }: DashboardHeroProps) {
  let message = "";
  let ctaText = "";
  let ctaLink = "";
  let CtaIcon = ArrowRight;
  let ctaStyle = "bg-primary text-primary-foreground hover:bg-[#a8e630]";
  let BadgeIcon = Lock;
  let badgeText = "Private";
  let badgeStyle = "bg-neutral-500/10 text-neutral-500 border-neutral-500/20";

  if (status.publication === "public") {
    message = "Live on Verifii — keep your revenue sync active to maintain trust.";
    ctaText = "View Public Profile";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}`;
    CtaIcon = Eye;
    ctaStyle = "bg-primary text-primary-foreground hover:bg-[#a8e630]";
    BadgeIcon = Globe;
    badgeText = "Public";
    badgeStyle = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  } else if (status.verification === "verified") {
    message = "Verified but private. Publish to get discovered.";
    ctaText = "Publish Startup";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/edit`;
    CtaIcon = Pencil;
  } else if (status.verification === "pending") {
    message = "Verification in progress — analyzing your connected data.";
    ctaText = "Continue Verification";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/verify`;
    CtaIcon = Activity;
  } else {
    message = "Complete verification to publish your profile and build trust.";
    ctaText = "Resume Verification";
    ctaLink = `/startup/${encodeURIComponent(startupSlug)}/verify`;
    CtaIcon = ShieldCheck;
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
          <h1 className="font-syne text-2xl sm:text-3xl font-extrabold tracking-[-0.5px] truncate">
            {startupName}
          </h1>
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeStyle}`}>
            <BadgeIcon className="h-2.5 w-2.5" />
            {badgeText}
          </span>
        </div>
        <p className="text-muted-foreground text-xs mb-1">
          Founder <span className="font-medium text-foreground">{displayName || userName}</span>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
          {message}
        </p>
      </div>
      <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <Link
          href={ctaLink}
          className={`inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${ctaStyle}`}
        >
          <CtaIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{ctaText}</span>
        </Link>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/EmptyDashboard.tsx`

```tsx
import { FolderKanban } from "lucide-react";
import Link from "next/link";

export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center my-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-syne text-2xl font-bold mb-2">Welcome to Verifii</h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        Submit your startup to begin the verification process, prove your traction, and start building trust with investors.
      </p>
      <Link
        href="/submit"
        className="rounded-xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
      >
        Submit Startup
      </Link>
    </div>
  );
}
```

## `src/components/founder-dashboard/FounderHealthScore.tsx`

```tsx
import { Activity } from "lucide-react";

interface FounderHealthScoreProps {
  score: number;
  grade: string;
  summary: string;
  trend?: "up" | "down" | "flat";
}

export function FounderHealthScore({ score, grade, summary, trend }: FounderHealthScoreProps) {
  // Determine color based on score
  let colorClass = "text-emerald-500";
  let bgClass = "bg-emerald-500/10";
  let borderClass = "border-emerald-500/20";
  
  if (score < 40) {
    colorClass = "text-red-500";
    bgClass = "bg-red-500/10";
    borderClass = "border-red-500/20";
  } else if (score < 70) {
    colorClass = "text-amber-500";
    bgClass = "bg-amber-500/10";
    borderClass = "border-amber-500/20";
  } else if (score < 90) {
    colorClass = "text-blue-500";
    bgClass = "bg-blue-500/10";
    borderClass = "border-blue-500/20";
  }

  return (
    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-6 rounded-2xl border border-border bg-card shadow-sm">
      {/* Score Circle */}
      <div className="relative shrink-0 flex items-center justify-center w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="40" 
            className="stroke-muted fill-none" 
            strokeWidth="8"
          />
          <circle 
            cx="50" cy="50" r="40" 
            className={`fill-none ${colorClass}`} 
            stroke="currentColor"
            strokeWidth="8" 
            strokeLinecap="round"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 - (251.2 * score) / 100}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <span className="text-3xl font-extrabold tracking-tighter">{score}</span>
        </div>
      </div>
      
      {/* Grade and Summary */}
      <div className="flex flex-col justify-center flex-1 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
          <h3 className="text-xl font-bold font-syne">{grade}</h3>
          {trend && (
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${bgClass} ${colorClass}`}>
              <Activity className="w-3 h-3" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-lg">
          {summary}
        </p>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/FounderInsightsCard.tsx`

```tsx
import type { DashboardInsights } from "@/lib/dashboard/founder-insights-presenter";
import { FounderHealthScore } from "./FounderHealthScore";
import { RecommendationList } from "./RecommendationList";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface FounderInsightsCardProps {
  insights: DashboardInsights;
}

export function FounderInsightsCard({ insights }: FounderInsightsCardProps) {
  const { 
    healthScore, 
    healthGrade, 
    summary, 
    strengths, 
    improvements, 
    primaryRecommendation, 
    secondaryRecommendations 
  } = insights;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-xl sm:text-2xl font-extrabold tracking-[-0.5px]">
          Founder Insights
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <FounderHealthScore 
            score={healthScore}
            grade={healthGrade}
            summary={summary}
          />
          
          <RecommendationList 
            primaryRecommendation={primaryRecommendation}
            secondaryRecommendations={secondaryRecommendations}
          />
        </div>
        
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 space-y-5 sm:space-y-6">
            
            {/* Strengths */}
            {strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Strengths
                </h3>
                <ul className="space-y-2">
                  {strengths.map(strength => (
                    <li key={strength.id} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{strength.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {strengths.length > 0 && improvements.length > 0 && (
              <div className="h-px bg-border" />
            )}

            {/* Improvements */}
            {improvements.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Needs Improvement
                </h3>
                <ul className="space-y-2">
                  {improvements.map(improvement => (
                    <li key={improvement.id} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{improvement.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {strengths.length === 0 && improvements.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No insights available yet.
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/LearnVerifii.tsx`

```tsx
import { BookOpen, ShieldCheck, TrendingUp, Sparkles, Rocket } from "lucide-react";

export function LearnVerifii() {
  const cards = [
    {
      title: "Discover how verified revenue builds trust",
      description: "Learn how verified revenue increases investor confidence and accelerates due diligence.",
      icon: <Sparkles className="h-5 w-5 text-indigo-500" />,
      bg: "bg-indigo-500/10",
    },
    {
      title: "Learn how we securely verify your startup",
      description: "Understand how automated verification protects your credibility without exposing sensitive data.",
      icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />,
      bg: "bg-emerald-500/10",
    },
    {
      title: "Stand out to investors and early adopters",
      description: "See why public startups receive more visibility and attract stronger investment leads.",
      icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
      bg: "bg-blue-500/10",
    },
    {
      title: "Understand how your Trust Score is calculated",
      description: "Learn how connecting a payment provider instantly maximizes your algorithmic confidence tier.",
      icon: <BookOpen className="h-5 w-5 text-amber-500" />,
      bg: "bg-amber-500/10",
    },
    {
      title: "Best practices before publishing publicly",
      description: "Ensure your profile is fully optimized to convert profile views into meaningful connections.",
      icon: <Rocket className="h-5 w-5 text-rose-500" />,
      bg: "bg-rose-500/10",
    }
  ];

  return (
    <div className="mb-12">
      <h2 className="font-syne text-2xl font-bold mb-6">Learn Verifii</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md cursor-default"
          >
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
              {card.icon}
            </div>
            <h3 className="font-syne text-base font-bold mb-1">
              {card.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/MRRWidget.tsx`

```tsx
"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MRRWidgetProps {
  formattedMRR: string;
  formattedGrowth: string;
  trend: "up" | "down" | "neutral";
  trendColor: string;
}

export function MRRWidget({ formattedMRR, formattedGrowth, trend, trendColor }: MRRWidgetProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm">
      <h3 className="text-sm font-medium tracking-tight mb-2">Monthly Recurring Revenue</h3>
      <div className="text-2xl font-bold">{formattedMRR}</div>
      <p className="text-xs text-muted-foreground flex items-center mt-2">
        <span className={`flex items-center ${trendColor} mr-1 font-medium`}>
          {trend === "up" && <TrendingUp className="h-3 w-3 mr-1" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 mr-1" />}
          {trend === "neutral" && <Minus className="h-3 w-3 mr-1" />}
          {formattedGrowth}
        </span>
        from last month
      </p>
    </div>
  );
}
```

## `src/components/founder-dashboard/NextActionCard.tsx`

```tsx
import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Clock } from "lucide-react";
import type { FounderAction } from "@/lib/dashboard/getNextFounderAction";

interface NextActionCardProps {
  action: FounderAction;
}

// Derive a rough time estimate from the action type. This is purely presentational.
function getEstimatedTime(title: string): string | null {
  const lower = title.toLowerCase();
  if (lower.includes("profile") || lower.includes("publish")) return "~2 minutes";
  if (lower.includes("revenue") || lower.includes("declare")) return "~1 minute";
  if (lower.includes("proof") || lower.includes("upload")) return "~3 minutes";
  if (lower.includes("connect") || lower.includes("provider")) return "~5 minutes";
  if (lower.includes("verification") || lower.includes("complete")) return "~5 minutes";
  if (lower.includes("share")) return "~1 minute";
  return null;
}

export function NextActionCard({ action }: NextActionCardProps) {
  const estimate = getEstimatedTime(action.title);

  return (
    <div className="mb-8 rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Next Recommended Action
            </span>
          </div>
          <h3 className="font-syne text-xl sm:text-2xl font-bold mb-1.5">
            {action.title}
          </h3>
          <p className="text-muted-foreground text-sm max-w-xl mb-2">
            {action.description}
          </p>
          {estimate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Estimated time: {estimate}</span>
            </div>
          )}
        </div>
        
        <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          <Link
            href={action.href}
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-[#a8e630] hover:-translate-y-0.5 shadow-sm hover:shadow-md text-center"
          >
            <span className="truncate">{action.cta}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/ProgressChecklist.tsx`

```tsx
import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProgressResult } from "@/lib/dashboard/getFounderProgress";

interface ProgressChecklistProps {
  progress: ProgressResult;
}

export function ProgressChecklist({ progress }: ProgressChecklistProps) {
  const { allMilestones, remainingMilestones } = progress;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-syne text-lg font-bold mb-3">Milestones</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {allMilestones.map((m) => {
          if (m.completed) {
            return (
              <div key={m.id} className="flex items-start gap-2.5 py-1 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                <span className="text-sm line-through opacity-60 leading-tight">{m.label}</span>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex items-start gap-2.5 py-1 text-foreground">
              <Circle className="h-4 w-4 mt-0.5 shrink-0 text-primary fill-primary/10" />
              <span className="text-sm font-semibold leading-tight">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/ProgressOverview.tsx`

```tsx
import React from "react";
import type { ProgressResult } from "@/lib/dashboard/getFounderProgress";

interface ProgressOverviewProps {
  progress: ProgressResult;
  statusMessage: string;
}

export function ProgressOverview({ progress, statusMessage }: ProgressOverviewProps) {
  const { percentage, completedCount, remainingCount } = progress;
  const totalCount = completedCount + remainingCount;

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="mb-4">
        <div className="font-syne text-3xl sm:text-4xl font-extrabold tracking-tight">
          {percentage}% <span className="text-muted-foreground font-medium text-2xl sm:text-3xl">Complete</span>
        </div>
      </div>
      
      <div className="h-3 w-full rounded-full bg-secondary overflow-hidden mb-4">
        <div 
          className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" 
          style={{ width: `${percentage}%` }} 
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">
          <span className="font-bold text-foreground">{completedCount}</span> of{" "}
          <span className="font-bold text-foreground">{totalCount}</span> milestones completed
        </p>
        <p className="text-muted-foreground text-sm max-w-md text-left sm:text-right">
          {statusMessage}
        </p>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/QuickActions.tsx`

```tsx
import Link from "next/link";
import { Pencil, Eye, CreditCard, ChevronRight } from "lucide-react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface QuickActionsProps {
  startupSlug: string;
  status: StartupStatus;
}

export function QuickActions({ startupSlug, status }: QuickActionsProps) {
  const actions = [];

  // 1. Preview Profile (only if verified but private)
  if (status.verification === "verified" && status.publication === "private") {
    actions.push({
      title: "Preview Profile",
      description: "See how it will look.",
      icon: <Eye className="h-5 w-5 text-emerald-500" />,
      bg: "bg-emerald-500/10",
      href: `/startup/${encodeURIComponent(startupSlug)}`,
    });
  }

  // 3. Edit Startup (always available, but lower priority if pending verification)
  actions.push({
    title: "Edit Startup",
    description: "Update your startup details.",
    icon: <Pencil className="h-5 w-5 text-blue-500" />,
    bg: "bg-blue-500/10",
    href: `/startup/${encodeURIComponent(startupSlug)}/edit`,
  });

  // 4. Manage Subscription
  actions.push({
    title: "Manage Subscription",
    description: "View billing & plans.",
    icon: <CreditCard className="h-5 w-5 text-purple-500" />,
    bg: "bg-purple-500/10",
    href: `/dashboard/billing`,
  });

  return (
    <div className="mb-8">
      <h2 className="font-syne text-lg font-bold mb-4">Quick Actions</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                {action.icon}
              </div>
              <div>
                <h3 className="font-syne text-base font-bold group-hover:text-primary transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {action.description}
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/RecentActivity.tsx`

```tsx
import type { PresentableTimelineEvent } from "@/lib/dashboard/timeline-types";
import { ActivityTimeline } from "./ActivityTimeline";

/**
 * RecentActivity
 *
 * Thin wrapper that provides the section heading and delegates
 * all timeline rendering to ActivityTimeline.
 */

interface RecentActivityProps {
  events: PresentableTimelineEvent[];
}

export function RecentActivity({ events }: RecentActivityProps) {
  return (
    <div className="mb-12">
      <h2 className="font-syne text-2xl font-bold mb-6">Recent Activity</h2>
      <ActivityTimeline events={events} maxEvents={10} showViewAll={false} />
    </div>
  );
}
```

## `src/components/founder-dashboard/RecommendationCard.tsx`

```tsx
import Link from "next/link";
import { ArrowRight, Clock, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { Recommendation } from "@/lib/dashboard/recommendation-engine";

interface RecommendationCardProps {
  recommendation: Recommendation;
  isPrimary?: boolean;
}

export function RecommendationCard({ recommendation, isPrimary = false }: RecommendationCardProps) {
  const { title, description, cta, href, estimatedMinutes, severity } = recommendation;

  let Icon = Info;
  let iconClass = "text-blue-500";
  let bgClass = "bg-blue-500/10";
  
  if (severity === "critical") {
    Icon = AlertTriangle;
    iconClass = "text-red-500";
    bgClass = "bg-red-500/10";
  } else if (severity === "warning") {
    Icon = AlertTriangle;
    iconClass = "text-amber-500";
    bgClass = "bg-amber-500/10";
  } else if (severity === "info") {
    Icon = CheckCircle2;
    iconClass = "text-emerald-500";
    bgClass = "bg-emerald-500/10";
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-3 p-3 rounded-xl border ${isPrimary ? 'border-primary shadow-sm bg-primary/5' : 'border-border bg-card'} items-start sm:items-center`}>
      <div className={`p-2 rounded-lg shrink-0 ${bgClass} ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-bold text-sm text-foreground truncate">{title}</h4>
          {isPrimary && (
            <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Priority
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 max-w-xl">
          {description}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <Clock className="w-3 h-3" />
          <span>~{estimatedMinutes} min</span>
        </div>
      </div>
      
      <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <Link 
          href={href}
          className={`inline-flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            isPrimary 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {cta}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/RecommendationList.tsx`

```tsx
import type { Recommendation } from "@/lib/dashboard/recommendation-engine";
import { RecommendationCard } from "./RecommendationCard";
import { CheckCircle2 } from "lucide-react";

interface RecommendationListProps {
  primaryRecommendation: Recommendation | null;
  secondaryRecommendations: Recommendation[];
}

export function RecommendationList({ primaryRecommendation, secondaryRecommendations }: RecommendationListProps) {
  const hasRecommendations = primaryRecommendation || secondaryRecommendations.length > 0;

  if (!hasRecommendations) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-muted/30">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="font-syne font-bold text-foreground mb-1">All caught up!</h4>
        <p className="text-sm text-muted-foreground max-w-sm">
          You've completed all current recommendations. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Action Plan</h3>
      </div>
      
      <div className="flex flex-col gap-3">
        {primaryRecommendation && (
          <RecommendationCard recommendation={primaryRecommendation} isPrimary={true} />
        )}
        
        {secondaryRecommendations.map(rec => (
          <RecommendationCard key={rec.id} recommendation={rec} isPrimary={false} />
        ))}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/RevenueBreakdownWidget.tsx`

```tsx
"use client";

interface RevenueBreakdownWidgetProps {
  providers: { name: string; formattedAmount: string; percentage: number; color: string }[];
  hasMultiple: boolean;
}

export function RevenueBreakdownWidget({ providers, hasMultiple }: RevenueBreakdownWidgetProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
        <h3 className="text-sm font-medium tracking-tight mb-4">Revenue Breakdown</h3>
        <div className="text-sm text-muted-foreground">No provider data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
      <h3 className="text-sm font-medium tracking-tight mb-4">Revenue by Provider</h3>
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: provider.color }}
                />
                <span className="font-medium">{provider.name}</span>
              </div>
              <span className="text-muted-foreground">{provider.formattedAmount}</span>
            </div>
            {hasMultiple && (
              <div className="h-1.5 w-full bg-secondary overflow-hidden rounded-full">
                <div 
                  className="h-full rounded-full" 
                  style={{ width: `${provider.percentage}%`, backgroundColor: provider.color }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/RevenueDashboard.tsx`

```tsx
"use client";

import { RevenueDashboardViewModel } from "@/lib/dashboard/revenue-presenter";
import { MRRWidget } from "./MRRWidget";
import { ARRWidget } from "./ARRWidget";
import { RevenueBreakdownWidget } from "./RevenueBreakdownWidget";
import { RevenueHealthCard } from "./RevenueHealthCard";
import { RevenueChart } from "@/components/startup/RevenueChart";

interface RevenueDashboardProps {
  viewModel: RevenueDashboardViewModel;
}

export function RevenueDashboard({ viewModel }: RevenueDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MRRWidget 
          formattedMRR={viewModel.heroMetrics.formattedMRR}
          formattedGrowth={viewModel.heroMetrics.formattedGrowth}
          trend={viewModel.heroMetrics.trend}
          trendColor={viewModel.heroMetrics.trendColor}
        />
        <ARRWidget 
          formattedARR={viewModel.heroMetrics.formattedARR}
        />
        <RevenueBreakdownWidget 
          providers={viewModel.breakdown.providers}
          hasMultiple={viewModel.breakdown.hasMultiple}
        />
        <RevenueHealthCard 
          health={viewModel.health}
          freshness={viewModel.freshness}
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold tracking-tight">Revenue Trend</h3>
        </div>
        <div className="p-2">
          {!viewModel.chart.isEmpty ? (
            <RevenueChart data={viewModel.chart.series} />
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-neutral-900/40 rounded-[2rem] border border-white/5 m-4">
              <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest text-center">
                Insufficient data for trend analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/RevenueHealthCard.tsx`

```tsx
"use client";

import { CheckCircle2, Clock, AlertTriangle, AlertCircle } from "lucide-react";

interface RevenueHealthCardProps {
  health: {
    statusText: string;
    statusLevel: "healthy" | "warning" | "empty";
  };
  freshness: {
    freshnessStatus: "fresh" | "aging" | "stale" | "never_synced";
    freshnessLabel: string;
    freshnessColor: string;
  };
}

export function RevenueHealthCard({ health, freshness }: RevenueHealthCardProps) {
  const getFreshnessIcon = () => {
    switch (freshness.freshnessStatus) {
      case "fresh":
        return <CheckCircle2 className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "aging":
        return <Clock className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "stale":
        return <AlertTriangle className={`h-4 w-4 ${freshness.freshnessColor}`} />;
      case "never_synced":
      default:
        return <AlertCircle className={`h-4 w-4 ${freshness.freshnessColor}`} />;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
      <h3 className="text-sm font-medium tracking-tight mb-4">Data Health</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm border-b pb-2">
          <span className="text-muted-foreground">Tracking Status</span>
          <span className="font-medium">{health.statusText}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Data Freshness</span>
          <div className="flex items-center gap-1.5 font-medium">
            {getFreshnessIcon()}
            <span className={freshness.freshnessColor}>{freshness.freshnessLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/StatusCards.tsx`

```tsx
import { Globe, Lock, ShieldCheck, Activity, Clock, Shield, LineChart } from "lucide-react";
import React from "react";
import type { StartupStatus } from "@/lib/dashboard/startup-status";

interface StatusCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function StatusCard({ title, value, icon, iconBg, iconColor }: StatusCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <div className="font-syne text-lg sm:text-xl font-bold truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatusCardsProps {
  status: StartupStatus;
  trustTier: string | null;
}

export function StatusCards({ status, trustTier }: StatusCardsProps) {
  // 1. Startup Status
  const isPublic = status.publication === "public";
  const startupStatusLabel = isPublic ? "Public" : "Private";
  const startupStatusIcon = isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />;
  const startupStatusBg = isPublic ? "bg-emerald-500/10" : "bg-neutral-500/10";
  const startupStatusColor = isPublic ? "text-emerald-500" : "text-neutral-500";

  // 2. Verification Status
  let verificationLabel = "Pending";
  let verificationIcon = <Clock className="h-5 w-5" />;
  let verificationBg = "bg-neutral-500/10";
  let verificationColor = "text-neutral-500";

  if (status.verification === "verified") {
    verificationLabel = "Verified";
    verificationIcon = <ShieldCheck className="h-5 w-5" />;
    verificationBg = "bg-emerald-500/10";
    verificationColor = "text-emerald-500";
  } else if (status.verification === "pending") {
    verificationLabel = "In Progress";
    verificationIcon = <Activity className="h-5 w-5" />;
    verificationBg = "bg-blue-500/10";
    verificationColor = "text-blue-500";
  }

  // 3. Trust Score
  let formattedTrustTier: string;
  if (!trustTier || trustTier === "SELF_REPORTED" || trustTier === "UNVERIFIED") {
    if (status.verification === "verified" || status.verification === "pending") {
      formattedTrustTier = "Calculating…";
    } else {
      formattedTrustTier = "Pending";
    }
  } else {
    formattedTrustTier = trustTier.replace(/_/g, " ");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <StatusCard
        title="Startup Status"
        value={startupStatusLabel}
        icon={startupStatusIcon}
        iconBg={startupStatusBg}
        iconColor={startupStatusColor}
      />
      <StatusCard
        title="Verification"
        value={verificationLabel}
        icon={verificationIcon}
        iconBg={verificationBg}
        iconColor={verificationColor}
      />
      <StatusCard
        title="Trust Score"
        value={
          <span className="capitalize">{formattedTrustTier}</span>
        }
        icon={<Shield className="h-5 w-5" />}
        iconBg="bg-primary/10"
        iconColor="text-primary"
      />
      <StatusCard
        title="Revenue"
        value="—"
        icon={<LineChart className="h-5 w-5" />}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-500"
      />
    </div>
  );
}
```

## `src/components/founder-dashboard/TimelineDateSection.tsx`

```tsx
import type { PresentableTimelineEvent } from "@/lib/dashboard/timeline-types";
import { TimelineEventCard } from "./TimelineEventCard";

/**
 * TimelineDateSection
 *
 * Renders a single date group: a header label ("Today", "Jul 7", etc.)
 * followed by the event cards for that date.
 */

interface TimelineDateSectionProps {
  label: string;
  events: PresentableTimelineEvent[];
}

export function TimelineDateSection({ label, events }: TimelineDateSectionProps) {
  return (
    <div className="mb-6 last:mb-0">
      {/* Date header */}
      <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </h3>

      {/* Events list */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        {events.map((event, index) => (
          <TimelineEventCard
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
```

## `src/components/founder-dashboard/TimelineEmptyState.tsx`

```tsx
import { History } from "lucide-react";

/**
 * TimelineEmptyState
 *
 * Empty placeholder rendered when the timeline has no events.
 * Mirrors the existing empty-state pattern from EmptyDashboard.tsx.
 */
export function TimelineEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <History className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-syne text-lg font-bold mb-1">No activity yet</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Your startup activity will appear here after verification, syncs, or
        profile updates.
      </p>
    </div>
  );
}
```

## `src/components/founder-dashboard/TimelineEventCard.tsx`

```tsx
import {
  TIMELINE_CATEGORY_CONFIGS,
  SEVERITY_COLORS,
  type PresentableTimelineEvent,
} from "@/lib/dashboard/timeline-types";
import { formatEventTime } from "@/lib/dashboard/timeline-formatters";

/**
 * TimelineEventCard
 *
 * Renders a single timeline event row. Purely presentational.
 * Icon is resolved from TIMELINE_CATEGORY_CONFIGS at render time.
 * Color is resolved from SEVERITY_COLORS based on event severity.
 */

interface TimelineEventCardProps {
  event: PresentableTimelineEvent;
  /** Whether this is the last event in its group (hides the connector line) */
  isLast?: boolean;
}

export function TimelineEventCard({ event, isLast = false }: TimelineEventCardProps) {
  const categoryConfig = TIMELINE_CATEGORY_CONFIGS[event.category];
  const severityColor = SEVERITY_COLORS[event.severity];
  const IconComponent = categoryConfig.icon;

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-[30px] bottom-0 w-px bg-border" />
      )}

      {/* Icon dot */}
      <div
        className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${severityColor.bg}`}
      >
        <IconComponent className={`h-3.5 w-3.5 ${severityColor.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-syne text-sm font-bold leading-snug truncate">
            {event.title}
          </h4>
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {formatEventTime(event.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {event.description}
        </p>
      </div>
    </div>
  );
}
```

## `src/app/api/startup/[id]/overview/route.ts`

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { calculateTrustScore } from "@/lib/scoring";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
} from "@/lib/verification-state";
import { isDemoStartupUserId } from "@/lib/verification-data";

/**
 * Startup Overview API (/api/startup/[id]/overview)
 *
 * Owner-only: aggregates metadata, connections, revenue, and verification state
 * for the founder verification dashboard.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const startupId = Number(rawId);

  if (isNaN(startupId)) {
    return NextResponse.json({ error: "Invalid startup ID" }, { status: 400 });
  }

  const ownership = await verifyStartupOwnership(startupId);
  if (!ownership.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!ownership.owned && !ownership.isDemo) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const [startupRes, connectionsRes, revenueRes, fraudRes, txnRes] =
      await Promise.all([
        supabaseServer
          .from("startup_submissions")
          .select(
            "id, startup_name, trust_score, penalty_count, verification_type, proof_url, user_id"
          )
          .eq("id", startupId)
          .single(),
        supabaseServer
          .from("provider_connections")
          .select("provider, status, last_synced_at, latest_revenue")
          .eq("startup_id", startupId),
        supabaseServer
          .from("revenue_snapshots")
          .select("total_revenue, created_at")
          .eq("startup_id", startupId)
          .order("created_at", { ascending: true })
          .limit(30),
        supabaseServer
          .from("fraud_signals")
          .select("signal_type")
          .eq("startup_id", startupId),
        supabaseServer
          .from("revenue_transactions")
          .select("amount, created_at, provider")
          .eq("startup_id", startupId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

    if (startupRes.error || !startupRes.data) {
      return NextResponse.json({ error: "Startup not found" }, { status: 404 });
    }

    const revenue = (revenueRes.data || []).map((snap) => ({
      timestamp: new Date(snap.created_at).getTime(),
      amount: Number(snap.total_revenue) || 0,
    }));

    const fraudSignals = {
      rate_limit_violations: (fraudRes.data || []).filter(
        (f) => f.signal_type === "rate_limit"
      ).length,
      spike_events: (fraudRes.data || []).filter(
        (f) => f.signal_type === "revenue_spike"
      ).length,
      penalty_count: Number(startupRes.data?.penalty_count) || 0,
    };

    const trustScore = calculateTrustScore(revenue, fraudSignals);

    const verificationState = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: txnRes.data || [],
        providerConnections: (connectionsRes.data || []).map((row) => ({
          provider: row.provider,
          status: row.status,
          last_synced_at: row.last_synced_at,
          latest_revenue: row.latest_revenue,
        })),
        fraudSignals: fraudRes.data || [],
        penaltyCount: Number(startupRes.data.penalty_count) || 0,
        isDemoProfile: isDemoStartupUserId(startupRes.data.user_id),
        verificationType: startupRes.data.verification_type,
        hasProofUpload: !!startupRes.data.proof_url,
      })
    );

    const overview = {
      startup: {
        id: startupRes.data.id,
        name: startupRes.data.startup_name,
        trust_score: trustScore,
      },
      connections: (connectionsRes.data || []).map((row) => ({
        provider: row.provider,
        connected: row.status === "connected",
        last_sync: row.last_synced_at
          ? new Date(row.last_synced_at).getTime()
          : null,
        mrr: Number(row.latest_revenue) || 0,
      })),
      revenue,
      verification: {
        verification_confidence: verificationState.verificationConfidence,
        confidence_tier: verificationState.confidenceTier,
        data_source: verificationState.dataSourceLabel,
        verification_method: verificationState.verificationMethodLabel,
        last_sync_at: verificationState.lastSyncAt,
        has_verification_evidence: verificationState.hasVerificationEvidence,
      },
      authenticity: {
        level:
          verificationState.consistencyLevel === "Consistent"
            ? "Organic"
            : verificationState.consistencyLevel === "Moderate"
              ? "Moderate"
              : "Refining",
        consistency_score: verificationState.consistencyScore,
        flags: verificationState.consistencyFlags,
      },
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("[StartupOverview] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

## `src/app/api/startup/[id]/sync/route.ts`

```typescript
import { getSupabaseServer } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";
import { computeTrustScore } from "@/lib/scoring";
import { decrypt } from "@/lib/encryption";
import { getPlatformStripe, getStripeForSecretKey, isStripeConnectAccountId } from "@/lib/stripe";
import { resyncExistingRazorpayConnection } from "@/lib/razorpay-sync";

import { verifyStartupOwnership } from "@/lib/auth-server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Enforce authentication and strict startup ownership validation
  const { authenticated, owned, startup, user } = await verifyStartupOwnership(id);
  if (!authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!owned) {
    return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
  }

  const { getUserPlan } = await import("@/lib/subscriptions");
  const plan = await getUserPlan(user!.id);
  if (plan.plan_code === "viewer") {
    return NextResponse.json(
      { error: "Subscription required for manual sync" },
      { status: 403 }
    );
  }

  const supabase = getSupabaseServer();

  // 1. Fetch provider connections for this startup
  const { data: connections, error: connError } = await supabase
    .from("provider_connections")
    .select("*")
    .eq("startup_id", id)
    .eq("status", "connected");

  if (connError) {
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }

  let snapshotsSynced = 0;

  // 2. Sync transactions from providers
  for (const conn of connections || []) {
    try {
      const decryptedKey = decrypt(conn.api_key_encrypted);

      if (conn.provider === "razorpay") {
        const result = await resyncExistingRazorpayConnection(Number(id));
        if (result) snapshotsSynced += (result.total_transactions || 0);
      } else if (conn.provider === "stripe") {
        const stripe = isStripeConnectAccountId(conn.account_id)
          ? getPlatformStripe()
          : getStripeForSecretKey(decryptedKey);
        const from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        const requestOptions = isStripeConnectAccountId(conn.account_id)
          ? { stripeAccount: conn.account_id }
          : undefined;
        const bTxns = await stripe.balanceTransactions.list(
          { created: { gte: from }, limit: 100 },
          requestOptions
        );

        for (const tx of bTxns.data) {
          if (tx.type === "charge" || tx.type === "payment") {
            const { error: upsertError } = await supabase
              .from("revenue_transactions")
              .upsert(
                {
                  startup_id: id,
                  provider: "stripe",
                  amount: tx.amount / 100,
                  currency: tx.currency?.toUpperCase() || "USD",
                  status: "captured",
                  external_id: tx.id,
                  payment_id: tx.id,
                  created_at: new Date(tx.created * 1000).toISOString(),
                },
                { onConflict: "external_id" }
              );
            if (!upsertError) snapshotsSynced++;
          }
        }
      }
    } catch (err: any) {
      const isProviderError = err && err.name === "ProviderError";
      console.error(`[Manual Sync] Error for connection ${conn.id}:`, isProviderError ? (err.originalError || err) : err);
    }
  }

  // 3. Recompute aggregated stats
  try {
    await getAggregatedRevenue(Number(id));
    await computeTrustScore(Number(id));
    
    // Update overview timestamp or status if needed
    await supabase
      .from("startup_submissions")
      .update({ payment_connected: true })
      .eq("id", id);

  } catch (err) {
    console.error(`[Manual Sync] Aggregation error:`, err);
    return NextResponse.json({ error: "Failed to aggregate revenue" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    snapshots_synced: snapshotsSynced
  });
}
```

## `src/lib/dashboard/founder-insights-engine.ts`

```typescript
import type { StartupStatus } from "./startup-status";

export interface ScoreBreakdown {
  id: string;
  earned: number;
  possible: number;
  weight: number;
}

export interface FounderInsightsSnapshot {
  healthScore: number;
  completionScore: number;
  verificationProgress: number;
  signals: {
    passed: string[];
    failed: string[];
  };
  issues: string[];
  scoreBreakdown: ScoreBreakdown[];
}

interface HealthScoreSignal {
  id: string;
  weight: number;
  resolve: (status: StartupStatus) => boolean;
}

const HEALTH_SCORE_SIGNALS: HealthScoreSignal[] = [
  {
    id: "profile_completeness",
    weight: 10,
    resolve: (status) => status.profile === "complete",
  },
  {
    id: "revenue_declaration",
    weight: 10,
    resolve: (status) => status.revenue !== "undeclared",
  },
  {
    id: "trust",
    weight: 20,
    resolve: (status) => status.proof === "submitted" || status.payment === "connected" || status.verification === "verified",
  },
  {
    id: "provider_connection",
    weight: 30,
    resolve: (status) => status.payment === "connected",
  },
  {
    id: "verification",
    weight: 30,
    resolve: (status) => status.verification === "verified",
  },
  {
    id: "publication",
    weight: 0,
    resolve: (status) => status.publication === "public",
  }
];

export function getFounderInsightsSnapshot(status: StartupStatus): FounderInsightsSnapshot {
  if (!status) {
    return {
      healthScore: 0,
      completionScore: 0,
      verificationProgress: 0,
      signals: { passed: [], failed: [] },
      issues: [],
      scoreBreakdown: []
    };
  }

  const passed: string[] = [];
  const failed: string[] = [];
  const scoreBreakdown: ScoreBreakdown[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  HEALTH_SCORE_SIGNALS.forEach(signal => {
    const isPassed = signal.resolve(status);
    maxPossibleScore += signal.weight;
    
    if (isPassed) {
      totalScore += signal.weight;
      passed.push(signal.id);
    } else {
      failed.push(signal.id);
    }

    scoreBreakdown.push({
      id: signal.id,
      earned: isPassed ? signal.weight : 0,
      possible: signal.weight,
      weight: signal.weight
    });
  });

  const normalizedHealthScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
  const verificationProgress = Math.round((passed.length / HEALTH_SCORE_SIGNALS.length) * 100);

  return {
    healthScore: normalizedHealthScore,
    completionScore: normalizedHealthScore,
    verificationProgress,
    signals: {
      passed,
      failed
    },
    issues: failed,
    scoreBreakdown
  };
}
```

## `src/lib/dashboard/founder-insights-presenter.ts`

```typescript
import type { FounderInsightsSnapshot } from "./founder-insights-engine";
import type { Recommendation } from "./recommendation-engine";

export interface InsightItem {
  id: string;
  label: string;
}

export interface DashboardInsights {
  healthScore: number;
  healthGrade: string;
  summary: string;
  messaging: string;
  strengths: InsightItem[];
  improvements: InsightItem[];
  primaryRecommendation: Recommendation | null;
  secondaryRecommendations: Recommendation[];
  verificationProgress: number;
}

const STRENGTH_LABELS: Record<string, string> = {
  profile_completeness: "Profile completed",
  revenue_declaration: "Revenue declared",
  provider_connection: "Provider connected",
  verification: "Verification completed",
  trust: "Trust evidence received",
  publication: "Public profile published"
};

const IMPROVEMENT_LABELS: Record<string, string> = {
  profile_completeness: "Complete your profile to enable verification.",
  revenue_declaration: "Declare your revenue to start the verification process.",
  provider_connection: "Connect a payment provider to enable automatic revenue verification.",
  verification: "Complete verification to unlock your public profile.",
  trust: "Provide additional proof or connect a provider to build trust.",
  publication: "Publish your verified startup to get discovered."
};

export function getDashboardInsights(
  snapshot: FounderInsightsSnapshot, 
  insightsRecommendations: Recommendation[]
): DashboardInsights {
  const { healthScore, signals, verificationProgress } = snapshot;

  // 1. Determine Grade and Messaging
  let healthGrade = "";
  let summary = "";
  let messaging = "";

  if (healthScore >= 95) {
    healthGrade = "Excellent";
    summary = "Your startup is in excellent shape.";
    messaging = "You have established strong trust signals.";
  } else if (healthScore >= 80) {
    healthGrade = "Great Progress";
    summary = "Your profile is almost ready to build investor trust.";
    messaging = "Complete the remaining steps to maximize your visibility.";
  } else if (healthScore >= 65) {
    healthGrade = "Good Progress";
    summary = "You are on the right track.";
    messaging = "Keep improving your profile to unlock verification.";
  } else if (healthScore >= 45) {
    healthGrade = "Needs Attention";
    summary = "Action is required to build trust and verify your revenue.";
    messaging = "Follow the recommendations to improve your score.";
  } else {
    healthGrade = "Getting Started";
    summary = "Welcome to Verifii. Let's get your startup verified.";
    messaging = "Follow the recommendations to begin your journey.";
  }

  // 2. Map Strengths and Improvements
  const strengths: InsightItem[] = signals.passed.map(id => ({
    id,
    label: STRENGTH_LABELS[id] || id
  }));

  const improvements: InsightItem[] = signals.failed.map(id => ({
    id,
    label: IMPROVEMENT_LABELS[id] || id
  }));

  // 3. Determine Primary and Secondary Recommendations from injected array
  let primaryRecommendation: Recommendation | null = null;
  let secondaryRecommendations: Recommendation[] = [];

  if (insightsRecommendations.length > 0) {
    primaryRecommendation = insightsRecommendations[0];
    secondaryRecommendations = insightsRecommendations.slice(1);
  }

  return {
    healthScore,
    healthGrade,
    summary,
    messaging,
    strengths,
    improvements,
    primaryRecommendation,
    secondaryRecommendations,
    verificationProgress
  };
}
```

## `src/lib/dashboard/getFounderProgress.ts`

```typescript
import type { StartupStatus } from "./startup-status";

export interface Milestone {
  id: string;
  label: string;
  weight: number;
  completed: boolean;
}

export interface ProgressResult {
  percentage: number;
  completedMilestones: Milestone[];
  remainingMilestones: Milestone[];
  allMilestones: Milestone[];
  completedCount: number;
  remainingCount: number;
  nextMilestone: Milestone | null;
}

interface MilestoneConfig {
  id: string;
  label: string;
  weight: number;
  resolve: (status: StartupStatus) => boolean;
}

const MILESTONE_CONFIGS: MilestoneConfig[] = [
  {
    id: "basic_profile",
    label: "Basic Profile Complete",
    weight: 15,
    resolve: (status) => status.profile === "complete",
  },
  {
    id: "revenue_declared",
    label: "Revenue Declared",
    weight: 15,
    resolve: (status) => status.revenue !== "undeclared",
  },
  {
    id: "proof_uploaded",
    label: "Proof Uploaded",
    weight: 15,
    resolve: (status) => status.proof === "submitted" || status.payment === "connected" || status.verification === "verified",
  },
  {
    id: "payment_connected",
    label: "Payment Provider Connected",
    weight: 20,
    resolve: (status) => status.payment === "connected",
  },
  {
    id: "verification_complete",
    label: "Verification Complete",
    weight: 20,
    resolve: (status) => status.verification === "verified",
  },
  {
    id: "startup_published",
    label: "Startup Published",
    weight: 15,
    resolve: (status) => status.publication === "public",
  }
];

export function getFounderProgress(status: StartupStatus): ProgressResult {
  if (!status) {
    return {
      percentage: 0,
      completedMilestones: [],
      remainingMilestones: [],
      allMilestones: [],
      completedCount: 0,
      remainingCount: 0,
      nextMilestone: null,
    };
  }

  const evaluated: Milestone[] = MILESTONE_CONFIGS.map(config => ({
    id: config.id,
    label: config.label,
    weight: config.weight,
    completed: config.resolve(status)
  }));

  const completedMilestones = evaluated.filter(m => m.completed);
  const remainingMilestones = evaluated.filter(m => !m.completed);
  
  const percentage = evaluated.reduce((total, m) => total + (m.completed ? m.weight : 0), 0);

  return {
    percentage: Math.min(percentage, 100),
    completedMilestones,
    remainingMilestones,
    allMilestones: evaluated,
    completedCount: completedMilestones.length,
    remainingCount: remainingMilestones.length,
    nextMilestone: remainingMilestones[0] || null,
  };
}
```

## `src/lib/dashboard/getNextFounderAction.ts`

```typescript
import type { Recommendation } from "./recommendation-engine";
import type { StartupStatus } from "./startup-status";

export interface FounderAction {
  title: string;
  description: string;
  cta: string;
  href: string;
  statusMessage: string;
}

export function getNextFounderAction(
  primaryRecommendation: Recommendation | null, 
  status: StartupStatus,
  startupSlug: string
): FounderAction {
  // Determine status message based on canonical status
  let statusMessage = "Let's set up your startup profile.";
  
  if (status.publication === "public") {
    statusMessage = "Your startup is live and fully verified.";
  } else if (status.verification === "verified") {
    statusMessage = "Publish your startup to get discovered by the community.";
  } else if (status.verification === "pending") {
    statusMessage = "Your verification is running. We'll notify you when it's complete.";
  } else if (status.payment === "disconnected" && status.revenue === "declared") {
    statusMessage = "Connect your payment provider to complete verification.";
  } else if (status.profile === "complete") {
    statusMessage = "Complete the remaining steps to build trust and publish your profile.";
  }

  if (!primaryRecommendation) {
    return {
      title: "Share Your Profile",
      description: "Show off your verified status by sharing your profile with investors and customers.",
      cta: "View Public Profile",
      href: `/startup/${encodeURIComponent(startupSlug)}`,
      statusMessage
    };
  }

  return {
    title: primaryRecommendation.title,
    description: primaryRecommendation.description,
    cta: primaryRecommendation.cta,
    href: primaryRecommendation.href,
    statusMessage
  };
}
```

## `src/lib/dashboard/recommendation-engine.ts`

```typescript
import type { StartupStatus } from "./startup-status";

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  severity: "critical" | "warning" | "info";
  impact: "high" | "medium" | "low";
  estimatedMinutes: number;
  title: string;
  description: string;
  cta: string;
  href: string;
}

type RecommendationConfig = Omit<Recommendation, "href"> & { hrefGenerator: (slug: string) => string };

const RECOMMENDATION_MAP: Record<string, RecommendationConfig> = {
  complete_profile: {
    id: "complete_profile",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 5,
    title: "Complete your profile",
    description: "A complete profile builds investor trust and is required to unlock the verification process, immediately boosting your Health Score.",
    cta: "Edit Profile",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  },
  declare_revenue: {
    id: "declare_revenue",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 2,
    title: "Declare your revenue",
    description: "Self-declared revenue establishes your baseline. It's the first step toward verified status and unlocks higher Health Score tiers.",
    cta: "Update Revenue",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  },
  connect_payment: {
    id: "connect_payment",
    priority: "high",
    severity: "critical",
    impact: "high",
    estimatedMinutes: 5,
    title: "Connect payment provider",
    description: "Automatic revenue verification significantly increases your Health Score and provides the strongest trust signal to investors.",
    cta: "Connect Provider",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  complete_verification: {
    id: "complete_verification",
    priority: "high",
    severity: "warning",
    impact: "high",
    estimatedMinutes: 3,
    title: "Complete verification",
    description: "Unlocks your public profile and maximizes your Health Score, proving your startup's credibility to the community.",
    cta: "Resume Verification",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  upload_stronger_verification: {
    id: "upload_stronger_verification",
    priority: "medium",
    severity: "warning",
    impact: "medium",
    estimatedMinutes: 10,
    title: "Upload stronger verification",
    description: "Stronger trust signals elevate your startup's grade. Investors prioritize startups with robust, verifiable evidence.",
    cta: "Add Proof",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/verify`
  },
  publish_startup: {
    id: "publish_startup",
    priority: "medium",
    severity: "info",
    impact: "high",
    estimatedMinutes: 1,
    title: "Publish startup",
    description: "A public profile is the ultimate trust signal. It makes your verified startup visible to investors and maximizes your score.",
    cta: "Publish Now",
    hrefGenerator: (slug) => `/startup/${encodeURIComponent(slug)}/edit`
  }
};

/**
 * Generates a unified, sorted list of recommendations based on the StartupStatus.
 */
export function getRecommendations(status: StartupStatus, startupSlug: string): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const add = (id: string) => {
    const config = RECOMMENDATION_MAP[id];
    if (config) {
      recommendations.push({
        ...config,
        href: config.hrefGenerator(startupSlug)
      });
    }
  };

  // Evaluate in logical order (highest priority first)
  if (status.profile === "incomplete") {
    add("complete_profile");
  }

  if (status.revenue === "undeclared") {
    add("declare_revenue");
  }
  
  if (status.payment === "disconnected") {
    add("connect_payment");
  }

  if (status.proof === "none") {
    add("upload_stronger_verification");
  }

  if (status.verification !== "verified") {
    add("complete_verification");
  }

  if (status.publication === "private" && status.verification === "verified") {
    add("publish_startup");
  }

  return recommendations;
}
```

## `src/lib/dashboard/revenue-engine.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RevenueSnapshotRow = any;

export interface RevenueAnalyticsSnapshot {
  mrr: number;
  arr: number;
  growthPercentage: number;
  history: { date: Date; amount: number }[];
  lastSyncedAt: Date | null;
  hasData: boolean;
  hasMultipleProviders: boolean;
  providerBreakdown: Record<string, number>;
}

/**
 * Revenue Engine
 * 
 * Pure transformer function that assembles pre-fetched revenue data into a
 * raw business facts snapshot.
 * 
 * ZERO database queries. ZERO presentation logic (colors, formatting).
 */
export function buildRevenueSnapshot(
  metrics: { mrr: number; arr: number; growthPercentage: number },
  historyRows: RevenueSnapshotRow[],
  lastSyncedAt: Date | null
): RevenueAnalyticsSnapshot {
  const history = historyRows.map(row => ({
    date: new Date(row.snapshot_date || row.created_at),
    amount: Number(row.total_revenue || 0)
  }));

  const hasData = history.length > 0;

  // History is ordered ascending by `created_at` from `getRevenueHistory`, 
  // so the latest snapshot is at the end of the array.
  const latestSnapshot = hasData ? historyRows[historyRows.length - 1] : null;
  const providerBreakdown: Record<string, number> = latestSnapshot?.provider_breakdown || {};
  
  const hasMultipleProviders = Object.keys(providerBreakdown).length > 1;

  return {
    mrr: metrics.mrr || 0,
    arr: metrics.arr || 0,
    growthPercentage: metrics.growthPercentage || 0,
    history,
    lastSyncedAt,
    hasData,
    hasMultipleProviders,
    providerBreakdown
  };
}
```

## `src/lib/dashboard/revenue-presenter.ts`

```typescript
import { RevenueAnalyticsSnapshot } from "./revenue-engine";
import { formatCurrency, formatGrowth } from "@/lib/formatters";

export interface RevenueDashboardViewModel {
  heroMetrics: {
    formattedMRR: string;
    formattedARR: string;
    formattedGrowth: string;
    trend: "up" | "down" | "neutral";
    trendColor: string;
  };
  chart: {
    series: { date: string; amount: number; timestamp: number }[];
    isEmpty: boolean;
  };
  breakdown: {
    providers: { name: string; formattedAmount: string; percentage: number; color: string }[];
    hasMultiple: boolean;
  };
  health: {
    statusText: string;
    statusLevel: "healthy" | "warning" | "empty";
  };
  freshness: {
    freshnessStatus: "fresh" | "aging" | "stale" | "never_synced";
    freshnessLabel: string;
    freshnessColor: string;
  };
  emptyState: boolean;
}

export function presentRevenueDashboard(snapshot: RevenueAnalyticsSnapshot): RevenueDashboardViewModel {
  const trend = snapshot.growthPercentage > 0 ? "up" : snapshot.growthPercentage < 0 ? "down" : "neutral";
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-neutral-400";
  
  const series = snapshot.history.map(h => ({
    date: h.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amount: h.amount,
    timestamp: h.date.getTime(),
  }));

  const totalBreakdownAmount = Object.values(snapshot.providerBreakdown).reduce((sum, val) => sum + val, 0);

  const providers = Object.entries(snapshot.providerBreakdown).map(([name, amount], index) => {
    const percentage = totalBreakdownAmount > 0 ? (amount / totalBreakdownAmount) * 100 : 0;
    const colors = ["#10b981", "#6366f1", "#f59e0b", "#ec4899"];
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      formattedAmount: formatCurrency(amount, "INR", { compact: true }),
      percentage,
      color: colors[index % colors.length]
    };
  });

  // Calculate freshness
  let freshnessStatus: "fresh" | "aging" | "stale" | "never_synced" = "never_synced";
  let freshnessLabel = "Never synced";
  let freshnessColor = "text-neutral-500";

  if (snapshot.lastSyncedAt) {
    const hoursSinceSync = (Date.now() - snapshot.lastSyncedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync < 6) {
      freshnessStatus = "fresh";
      freshnessLabel = "Synced recently";
      freshnessColor = "text-emerald-400";
    } else if (hoursSinceSync < 24) {
      freshnessStatus = "aging";
      freshnessLabel = "Synced today";
      freshnessColor = "text-amber-400";
    } else {
      freshnessStatus = "stale";
      const days = Math.floor(hoursSinceSync / 24);
      freshnessLabel = `Synced ${days} day${days > 1 ? "s" : ""} ago`;
      freshnessColor = "text-neutral-400";
    }
  }

  let statusText = "Awaiting Data";
  let statusLevel: "healthy" | "warning" | "empty" = "empty";
  
  if (snapshot.hasData) {
    statusText = "Revenue Tracked";
    statusLevel = "healthy";
  }

  return {
    heroMetrics: {
      formattedMRR: formatCurrency(snapshot.mrr, "INR", { compact: false }),
      formattedARR: formatCurrency(snapshot.arr, "INR", { compact: true }),
      formattedGrowth: formatGrowth(snapshot.growthPercentage),
      trend,
      trendColor,
    },
    chart: {
      series,
      isEmpty: !snapshot.hasData,
    },
    breakdown: {
      providers,
      hasMultiple: snapshot.hasMultipleProviders,
    },
    health: {
      statusText,
      statusLevel,
    },
    freshness: {
      freshnessStatus,
      freshnessLabel,
      freshnessColor,
    },
    emptyState: !snapshot.hasData,
  };
}
```

## `src/lib/dashboard/startup-status.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Startup = any;

export interface StartupStatus {
  profile: "incomplete" | "complete";
  publication: "private" | "public";
  payment: "disconnected" | "connected";
  verification: "unverified" | "pending" | "verified";
  revenue: "undeclared" | "declared" | "synced";
  proof: "none" | "submitted";
}

export function buildStartupStatus(startup: Startup): StartupStatus {
  if (!startup) {
    return {
      profile: "incomplete",
      publication: "private",
      payment: "disconnected",
      verification: "unverified",
      revenue: "undeclared",
      proof: "none",
    };
  }

  const profile = (startup.startup_name && startup.slug) ? "complete" : "incomplete";
  const publication = startup.is_public ? "public" : "private";
  
  const payment = startup.payment_connected ? "connected" : "disconnected";

  const verifiedStatuses = [
    "api_verified",
    "stripe_connected",
    "PAYMENT_CONNECTED",
    "REVENUE_VERIFIED",
    "HIGH_CONFIDENCE",
    "verified",
    "approved",
    "identity_verified"
  ];
  
  const pendingStatuses = ["syncing", "proof_submitted"];
  
  const isVerified = startup.payment_connected || verifiedStatuses.includes(startup.verification_status);
  
  let verification: "unverified" | "pending" | "verified" = "unverified";
  if (isVerified) {
    verification = "verified";
  } else if (pendingStatuses.includes(startup.verification_status)) {
    verification = "pending";
  }

  let revenue: "undeclared" | "declared" | "synced" = "undeclared";
  if (startup.mrr != null) {
    revenue = startup.last_synced_at ? "synced" : "declared";
  }

  let proof: "none" | "submitted" = "none";
  if (startup.proof_url || startup.payment_connected || isVerified || pendingStatuses.includes(startup.verification_status)) {
    proof = "submitted";
  }

  return {
    profile,
    publication,
    payment,
    verification,
    revenue,
    proof,
  };
}
```

## `src/lib/dashboard/timeline-engine.ts`

```typescript
import type { TimelineEvent } from "./timeline-types";

/**
 * Timeline Engine
 *
 * Pure function that transforms raw startup data into TimelineEvent[] records.
 * Produces ONLY raw event records — no presentation wording (titles, descriptions).
 * Wording is the presenter's responsibility.
 *
 * This is the single place to add new event detection logic.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StartupData = Record<string, any>;

/**
 * Generate a deterministic event ID from eventType and timestamp.
 * Uses a simple hash to avoid collisions without requiring crypto.
 */
function makeEventId(eventType: string, timestamp: string): string {
  // Simple FNV-1a-inspired hash for deterministic short IDs
  let hash = 2166136261;
  const str = `${eventType}-${timestamp}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `${eventType}-${hash.toString(36)}`;
}

/**
 * Builds a flat list of TimelineEvent records from startup data.
 *
 * Each event is derived from observable startup fields — no hardcoded JSX,
 * no presentation wording. Returns events sorted newest-first.
 */
export function buildTimelineEvents(startup: StartupData): TimelineEvent[] {
  if (!startup) return [];

  const events: TimelineEvent[] = [];

  // ── Profile: startup created ────────────────────────────────────────────
  if (startup.created_at) {
    events.push({
      id: makeEventId("startup_created", startup.created_at),
      eventType: "startup_created",
      timestamp: startup.created_at,
      metadata: { startupName: startup.startup_name },
    });
  }

  // ── Provider: payment connected ─────────────────────────────────────────
  if (startup.payment_connected) {
    // Use created_at as fallback since we don't track connection timestamp
    // on the startup_submissions table. Future: use provider_connections.created_at
    const connectedAt = startup.connected_at || startup.created_at;
    if (connectedAt) {
      events.push({
        id: makeEventId("provider_connected", connectedAt),
        eventType: "provider_connected",
        timestamp: connectedAt,
        metadata: { provider: startup.verification_source || "Payment Provider" },
      });
    }
  }

  // ── Verification: tier-based events ─────────────────────────────────────
  const verifiedStatuses = [
    "api_verified",
    "stripe_connected",
    "PAYMENT_CONNECTED",
    "REVENUE_VERIFIED",
    "HIGH_CONFIDENCE",
    "verified",
    "approved",
    "identity_verified",
  ];

  if (verifiedStatuses.includes(startup.verification_status)) {
    // Derive timestamp: prefer a sync timestamp, fall back to created_at
    const verifiedAt = startup.last_synced_at || startup.created_at;
    if (verifiedAt) {
      events.push({
        id: makeEventId("sync_success", verifiedAt),
        eventType: "sync_success",
        timestamp: verifiedAt,
        metadata: { verificationStatus: startup.verification_status },
      });
    }
  }

  // ── Verification: trust tier upgrade ────────────────────────────────────
  if (
    startup.trust_tier &&
    startup.trust_tier !== "SELF_REPORTED" &&
    startup.trust_tier !== "UNVERIFIED"
  ) {
    const tierAt = startup.last_synced_at || startup.created_at;
    if (tierAt) {
      events.push({
        id: makeEventId("tier_upgraded", tierAt),
        eventType: "tier_upgraded",
        timestamp: tierAt,
        metadata: { newTier: startup.trust_tier },
      });
    }
  }

  // ── Publication: startup published ──────────────────────────────────────
  if (startup.is_public) {
    // Use published_at if available, otherwise fall back to created_at
    const publishedAt = startup.published_at || startup.created_at;
    if (publishedAt) {
      events.push({
        id: makeEventId("startup_published", publishedAt),
        eventType: "startup_published",
        timestamp: publishedAt,
        metadata: { slug: startup.slug },
      });
    }
  }

  // ── Revenue: MRR updated ────────────────────────────────────────────────
  if (startup.mrr != null && startup.mrr > 0) {
    const mrrAt = startup.last_synced_at || startup.created_at;
    if (mrrAt) {
      events.push({
        id: makeEventId("mrr_updated", mrrAt),
        eventType: "mrr_updated",
        timestamp: mrrAt,
        metadata: { mrr: startup.mrr },
      });
    }
  }

  // Sort oldest-first to prepare for staggering
  const eventPriority: Record<string, number> = {
    "startup_created": 1,
    "mrr_updated": 2,
    "provider_connected": 3,
    "sync_success": 4,
    "tier_upgraded": 5,
    "startup_published": 6,
  };

  events.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (Math.abs(tA - tB) < 60000) {
      return (eventPriority[a.eventType] || 99) - (eventPriority[b.eventType] || 99);
    }
    return tA - tB;
  });

  // Stagger identical or very close timestamps for realistic UX
  let lastTime = 0;
  for (let i = 0; i < events.length; i++) {
    const t = new Date(events[i].timestamp).getTime();
    if (i > 0 && Math.abs(t - lastTime) < 60000) {
      // Add a realistic offset (e.g. 2 hours 15 mins) if events happened "instantly"
      const newTime = new Date(lastTime + 1000 * 60 * 135); 
      events[i].timestamp = newTime.toISOString();
      lastTime = newTime.getTime();
    } else {
      lastTime = t;
    }
  }

  // Sort newest-first for final presentation
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return events;
}
```

## `src/lib/dashboard/timeline-formatters.ts`

```typescript
import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  isSameWeek,
  isSameYear,
  parseISO,
  differenceInMinutes,
} from "date-fns";

/**
 * Timeline Formatters
 *
 * Relative time, smart date labels, and time-only formatting
 * for the timeline display. Uses date-fns (already installed, v4.1.0).
 */

/**
 * Formats a date key (YYYY-MM-DD) into a smart group label.
 *
 * - Same calendar day → "Today"
 * - Previous calendar day → "Yesterday"
 * - Same calendar week → Day name ("Monday")
 * - Same calendar year → "Jul 7"
 * - Different year → "Jul 7, 2025"
 */
export function formatDateGroupLabel(dateKey: string): string {
  const date = parseISO(dateKey);
  const now = new Date();

  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isSameWeek(date, now)) return format(date, "EEEE"); // "Monday"
  if (isSameYear(date, now)) return format(date, "MMM d"); // "Jul 7"
  return format(date, "MMM d, yyyy"); // "Jul 7, 2025"
}

/**
 * Formats an ISO timestamp into a relative time string.
 *
 * - < 1 minute → "Just now"
 * - < 7 days → "12 minutes ago", "3 hours ago", "2 days ago"
 * - ≥ 7 days → absolute short date ("Jul 2")
 */
export function formatRelativeTime(isoString: string): string {
  const date = parseISO(isoString);
  const now = new Date();
  const minutesAgo = differenceInMinutes(now, date);

  if (minutesAgo < 1) return "Just now";

  // For events within the last 7 days, use relative format
  const daysAgo = minutesAgo / (60 * 24);
  if (daysAgo < 7) {
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }

  // For older events, use absolute short date
  if (isSameYear(date, now)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

/**
 * Formats an ISO timestamp into time-only display for within-group use.
 * The date is already shown in the section header.
 *
 * Output: "2:34 PM"
 */
export function formatEventTime(isoString: string): string {
  return format(parseISO(isoString), "h:mm a");
}
```

## `src/lib/dashboard/timeline-grouper.ts`

```typescript
import type { PresentableTimelineEvent, TimelineDateGroup } from "./timeline-types";
import { formatDateGroupLabel } from "./timeline-formatters";

/**
 * Timeline Grouper
 *
 * Groups a flat array of PresentableTimelineEvent[] into TimelineDateGroup[]
 * organized by calendar date. Groups and events within groups are sorted
 * newest-first.
 */

/**
 * Extracts the YYYY-MM-DD date key from an ISO timestamp.
 */
function getDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

/**
 * Groups presentable timeline events by calendar date.
 *
 * - Events sharing the same YYYY-MM-DD are grouped together.
 * - Within each group, events remain sorted by timestamp descending.
 * - Groups are ordered newest-first.
 * - Each group's label is a smart date string ("Today", "Yesterday", etc.).
 */
export function groupEventsByDate(
  events: PresentableTimelineEvent[]
): TimelineDateGroup[] {
  if (!events.length) return [];

  // Build a Map to preserve insertion order (events are already sorted newest-first)
  const groupMap = new Map<string, PresentableTimelineEvent[]>();

  for (const event of events) {
    const dateKey = getDateKey(event.timestamp);
    const existing = groupMap.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groupMap.set(dateKey, [event]);
    }
  }

  // Convert to TimelineDateGroup[]
  const groups: TimelineDateGroup[] = [];
  for (const [dateKey, groupEvents] of groupMap) {
    groups.push({
      dateKey,
      label: formatDateGroupLabel(dateKey),
      events: groupEvents,
    });
  }

  return groups;
}
```

## `src/lib/dashboard/timeline-presenter.ts`

```typescript
import type {
  TimelineEvent,
  TimelineEventType,
  TimelineCategory,
  TimelineSeverity,
  PresentableTimelineEvent,
} from "./timeline-types";

/**
 * Timeline Presenter
 *
 * Maps raw TimelineEvent records (from the engine) into PresentableTimelineEvent
 * records with user-facing titles, descriptions, category, and severity.
 *
 * All presentation wording lives here — the engine and components are wording-free.
 */

// ── Event Type Map ──────────────────────────────────────────────────────────
// Each eventType maps to its derived category, severity, title, and description.
// Description can be a static string or a function that receives metadata.

interface EventTypeConfig {
  category: TimelineCategory;
  severity: TimelineSeverity;
  title: string;
  description: string | ((metadata?: Record<string, unknown>) => string);
}

const EVENT_TYPE_MAP: Record<TimelineEventType, EventTypeConfig> = {
  // ── Verification ──────────────────────────────────────────────────────
  sync_success: {
    category: "verification",
    severity: "success",
    title: "Revenue Verified",
    description: "Your revenue data has been synced and verified.",
  },
  sync_failure: {
    category: "verification",
    severity: "error",
    title: "Sync Failed",
    description:
      "Revenue sync encountered an error. Check your provider credentials.",
  },
  tier_upgraded: {
    category: "verification",
    severity: "success",
    title: "Trust Tier Upgraded",
    description: (m) =>
      `Your trust tier upgraded to ${formatTierName(m?.newTier as string) ?? "a higher level"}.`,
  },
  tier_downgraded: {
    category: "verification",
    severity: "warning",
    title: "Trust Tier Downgraded",
    description:
      "Your trust tier has decreased. Ensure your sync is active.",
  },

  // ── Publication ───────────────────────────────────────────────────────
  startup_published: {
    category: "publication",
    severity: "success",
    title: "Startup Published",
    description: "Your verified profile is now live and discoverable.",
  },
  startup_unpublished: {
    category: "publication",
    severity: "warning",
    title: "Startup Unpublished",
    description: "Your profile has been taken private.",
  },

  // ── Revenue ───────────────────────────────────────────────────────────
  mrr_updated: {
    category: "revenue",
    severity: "info",
    title: "MRR Updated",
    description: "Your monthly recurring revenue has been recalculated.",
  },
  revenue_milestone: {
    category: "revenue",
    severity: "success",
    title: "Revenue Milestone",
    description: (m) =>
      `You've crossed ${(m?.milestone as string) ?? "a new revenue milestone"}!`,
  },

  // ── Provider ──────────────────────────────────────────────────────────
  provider_connected: {
    category: "provider",
    severity: "success",
    title: "Provider Connected",
    description: (m) =>
      `${(m?.provider as string) ?? "Payment provider"} is now linked. Revenue data can sync automatically.`,
  },
  provider_disconnected: {
    category: "provider",
    severity: "warning",
    title: "Provider Disconnected",
    description:
      "A payment provider has been disconnected. Revenue sync is paused.",
  },

  // ── Subscription ──────────────────────────────────────────────────────
  plan_upgraded: {
    category: "subscription",
    severity: "success",
    title: "Plan Upgraded",
    description: (m) =>
      `You've upgraded to the ${(m?.planName as string) ?? "new"} plan.`,
  },
  plan_downgraded: {
    category: "subscription",
    severity: "info",
    title: "Plan Changed",
    description: "Your subscription plan has been updated.",
  },
  trial_started: {
    category: "subscription",
    severity: "info",
    title: "Trial Started",
    description: "Your free trial has begun. Explore all features.",
  },
  subscription_cancelled: {
    category: "subscription",
    severity: "warning",
    title: "Subscription Cancelled",
    description:
      "Your subscription will end at the current billing period.",
  },

  // ── Profile ───────────────────────────────────────────────────────────
  startup_created: {
    category: "profile",
    severity: "success",
    title: "Startup Created",
    description: (m) =>
      `${(m?.startupName as string) ?? "Your startup"} has been submitted to Verifii.`,
  },
  profile_edited: {
    category: "profile",
    severity: "info",
    title: "Profile Updated",
    description: "Your startup profile details have been changed.",
  },

  // ── Trust ─────────────────────────────────────────────────────────────
  trust_score_changed: {
    category: "trust",
    severity: "info",
    title: "Trust Score Updated",
    description:
      "Your trust score has been recalculated based on new data.",
  },
  fraud_flag_raised: {
    category: "trust",
    severity: "error",
    title: "Anomaly Detected",
    description:
      "Unusual activity was flagged. This may affect your trust score.",
  },
};

/**
 * Formats a raw tier name (e.g. "REVENUE_VERIFIED") into a human-readable form.
 */
function formatTierName(tier: string | undefined | null): string | null {
  if (!tier) return null;
  return tier
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve the description for a given event type config and metadata.
 */
function resolveDescription(
  config: EventTypeConfig,
  metadata?: Record<string, unknown>
): string {
  if (typeof config.description === "function") {
    return config.description(metadata);
  }
  return config.description;
}

/**
 * Maps a single raw TimelineEvent to a PresentableTimelineEvent.
 */
export function presentEvent(event: TimelineEvent): PresentableTimelineEvent {
  const config = EVENT_TYPE_MAP[event.eventType];

  return {
    ...event,
    category: config.category,
    severity: config.severity,
    title: config.title,
    description: resolveDescription(config, event.metadata),
  };
}

/**
 * Maps an array of raw TimelineEvent records to PresentableTimelineEvent records.
 * Preserves input order.
 */
export function presentTimelineEvents(
  events: TimelineEvent[]
): PresentableTimelineEvent[] {
  return events.map(presentEvent);
}
```

## `src/lib/dashboard/timeline-types.ts`

```typescript
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Globe,
  LineChart,
  CreditCard,
  Pencil,
  Shield,
} from "lucide-react";

// ── Event Types (discriminated union — primary identifier) ────────────────────
export type TimelineEventType =
  // verification
  | "sync_success"
  | "sync_failure"
  | "tier_upgraded"
  | "tier_downgraded"
  // publication
  | "startup_published"
  | "startup_unpublished"
  // revenue
  | "mrr_updated"
  | "revenue_milestone"
  // provider
  | "provider_connected"
  | "provider_disconnected"
  // subscription
  | "plan_upgraded"
  | "plan_downgraded"
  | "trial_started"
  | "subscription_cancelled"
  // profile
  | "startup_created"
  | "profile_edited"
  // trust
  | "trust_score_changed"
  | "fraud_flag_raised";

// ── Categories (derived from eventType, never set manually) ──────────────────
export type TimelineCategory =
  | "verification"
  | "publication"
  | "revenue"
  | "provider"
  | "subscription"
  | "profile"
  | "trust";

// ── Severity / Visual Weight (derived from eventType, never set manually) ────
export type TimelineSeverity = "success" | "info" | "warning" | "error";

// ── Core Event Record (engine output — no presentation wording) ──────────────
export interface TimelineEvent {
  /** Unique key: `${eventType}-${timestamp hash}` */
  id: string;
  /** Primary identifier — drives all derived fields via the presenter */
  eventType: TimelineEventType;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Extensible payload (provider name, amount, tier, etc.) */
  metadata?: Record<string, unknown>;
}

// ── Presentable Event (after presentation mapper) ────────────────────────────
export interface PresentableTimelineEvent extends TimelineEvent {
  /** Derived from eventType */
  category: TimelineCategory;
  /** Derived from eventType */
  severity: TimelineSeverity;
  /** WHAT happened (user-facing) */
  title: string;
  /** WHY it matters (user-facing) */
  description: string;
}

// ── Grouped for display ─────────────────────────────────────────────────────
export interface TimelineDateGroup {
  /** "2026-07-09" (YYYY-MM-DD) */
  dateKey: string;
  /** "Today", "Yesterday", "Jul 7, 2026" */
  label: string;
  /** Events within this date, sorted newest-first */
  events: PresentableTimelineEvent[];
}

// ── Category Configuration (icon, label, color per category) ────────────────
export interface TimelineCategoryConfig {
  label: string;
  icon: LucideIcon;
  defaultSeverity: TimelineSeverity;
  /** Tailwind color token base (e.g. "emerald", "blue") */
  colorClass: string;
}

export const TIMELINE_CATEGORY_CONFIGS: Record<
  TimelineCategory,
  TimelineCategoryConfig
> = {
  verification: {
    label: "Verification",
    icon: ShieldCheck,
    defaultSeverity: "info",
    colorClass: "emerald",
  },
  publication: {
    label: "Publication",
    icon: Globe,
    defaultSeverity: "success",
    colorClass: "emerald",
  },
  revenue: {
    label: "Revenue",
    icon: LineChart,
    defaultSeverity: "info",
    colorClass: "purple",
  },
  provider: {
    label: "Provider",
    icon: CreditCard,
    defaultSeverity: "info",
    colorClass: "blue",
  },
  subscription: {
    label: "Subscription",
    icon: CreditCard,
    defaultSeverity: "info",
    colorClass: "purple",
  },
  profile: {
    label: "Profile",
    icon: Pencil,
    defaultSeverity: "info",
    colorClass: "blue",
  },
  trust: {
    label: "Trust",
    icon: Shield,
    defaultSeverity: "info",
    colorClass: "primary",
  },
};

// ── Severity → color mapping for components ─────────────────────────────────
export const SEVERITY_COLORS: Record<
  TimelineSeverity,
  { dot: string; bg: string; text: string }
> = {
  success: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
  },
  info: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    text: "text-red-500",
  },
};
```

## `src/lib/scoring.ts`

```typescript
import { getSupabaseServer } from "./supabase-server";
import { detectFraud } from "./fraud";

export interface FraudSignals {
  rate_limit_violations: number;
  spike_events: number;
  penalty_count: number;
}

/**
 * Advanced Trust Score Calculation based on Revenue Events and Fraud Signals
 * 
 * Logic:
 * 1. Base Score = Avg Revenue / 100
 * 2. Consistency: High variance reduces score (-10 to -20)
 * 3. Growth: Upward trend increases score (+5 to +15)
 * 4. Fraud Penalties:
 *    - Each spike: -10
 *    - Each rate limit violation: -15
 *    - Repeated offenses: Exponential scaling via penalty_count
 */
export function calculateTrustScore(
  events: { amount: number; timestamp: number }[],
  fraudSignals: FraudSignals = { rate_limit_violations: 0, spike_events: 0, penalty_count: 0 }
): number {
  if (!events || events.length === 0) return 0;

  // 1. Sort by timestamp (ascending)
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // 2. Average Revenue
  const total = sorted.reduce((sum, e) => sum + Number(e.amount), 0);
  const average = total / sorted.length;

  // 3. Consistency Adjustment (-10 to -20)
  const variance = sorted.reduce((sum, e) => sum + Math.pow(Number(e.amount) - average, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  const cv = average > 0 ? stdDev / average : 0; // Coefficient of Variation
  
  let consistencyAdjustment = 0;
  if (cv > 0.3) {
    consistencyAdjustment = -Math.min(20, 10 + (cv - 0.3) * 14);
  }

  // 4. Growth Adjustment (+5 to +15)
  let growthAdjustment = 0;
  if (sorted.length >= 2) {
    const first = Number(sorted[0].amount);
    const last = Number(sorted[sorted.length - 1].amount);
    const growth = (last - first) / (first || 1);
    
    if (growth > 0) {
      growthAdjustment = Math.min(15, 5 + (growth - 0.05) * 22);
    }
  }

    // 5. Pattern Detection (Anti-bot / Entropy check)
    let patternPenalty = 0;
    if (sorted.length >= 6) {
      const amounts = sorted.map((e) => Number(e.amount));
      const uniqueValues = new Set(amounts).size;
      const entropyRatio = uniqueValues / amounts.length;

      // Detect repetition signals
      let isRepetitive = entropyRatio < 0.5;
      let sequenceDetected = false;
      for (let len = 2; len <= Math.floor(amounts.length / 2); len++) {
        const firstSeq = amounts.slice(-len * 2, -len);
        const secondSeq = amounts.slice(-len);
        if (firstSeq.length === len && firstSeq.every((v, i) => v === secondSeq[i])) {
          sequenceDetected = true;
          isRepetitive = true;
          break;
        }
      }

      if (isRepetitive) {
        // Analyze timestamp distribution (Coefficient of Variation for gaps)
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
        }
        
        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
        const gapStdDev = Math.sqrt(gapVariance);
        const gapCV = avgGap > 0 ? gapStdDev / avgGap : 0;

        if (gapCV < 0.4) {
          // Repetition + Fixed Timing (Automated pattern)
          patternPenalty = 20;
        } else {
          // Repetition + Varied Timing (Potentially legitimate but suspicious)
          patternPenalty = 5;
        }
      } else if (entropyRatio < 0.7) {
        // Mild entropy penalty
        patternPenalty = 5;
      }
    }

  // 6. Fraud Penalties
  const spikePenalty = fraudSignals.spike_events * 10;
  const rateLimitPenalty = fraudSignals.rate_limit_violations * 15;
  const repeatPenalty = Math.pow(fraudSignals.penalty_count, 1.5) * 5;
  const totalFraudPenalty = spikePenalty + rateLimitPenalty + repeatPenalty;

  // 7. Base Score & Final Calculation
  const baseScore = average / 100;
  const score = baseScore + consistencyAdjustment + growthAdjustment - patternPenalty - totalFraudPenalty;

  // 8. Clamp & Return Integer
  return Math.round(Math.max(0, Math.min(100, score)));
}

export interface ScoringResult {
  score: number;
  status: "verified" | "syncing" | "unverified" | "flagged";
  tier: "high_confidence" | "revenue_verified" | "payment_connected" | "self_reported" | "flagged";
}

function getTrustTier(score: number): ScoringResult["tier"] {
  if (score >= 80) return "high_confidence";
  if (score >= 60) return "revenue_verified";
  if (score >= 30) return "payment_connected";
  return "self_reported";
}



/**
 * Verification Score Engine
 * Computes a deterministic score based on revenue signals and verification metadata.
 */
export async function computeTrustScore(
  startup_id: number,
  options: { startup?: any; persist?: boolean } = { persist: true }
): Promise<ScoringResult & { updateData?: Record<string, unknown> }> {
  const supabase = getSupabaseServer();
  let score = 0;
  const breakdown: Record<string, number> = {
    payment: 0,
    revenue: 0,
    video: 0,
    website: 0,
    identity: 0
  };

  // Fetch all necessary signals
  let startup = options.startup;
  if (!startup) {
    const { data } = await supabase
      .from("startup_submissions")
      .select("*")
      .eq("id", startup_id)
      .single();
    startup = data;
  }

  if (!startup) return { score: 0, status: "unverified", tier: "self_reported" };

  // 1. Payment Gateway Connection (+30 base)
  if (startup.payment_connected) {
    breakdown.payment = 30;
    score += 30;
  }

  // 2. Revenue Stability Check (Consistency-based scoring)
  const { data: historicalSnapshots } = await supabase
    .from("revenue_snapshots")
    .select("total_revenue")
    .eq("startup_id", startup_id)
    .gt("total_revenue", 0)
    .order("created_at", { ascending: false })
    .limit(4); // Use the last 4 valid snapshots

  const latestMrr = Number(startup.mrr) || 0;
  let avgHistoricalRevenue = latestMrr;

  if (historicalSnapshots && historicalSnapshots.length > 0) {
    const sum = historicalSnapshots.reduce((acc, s) => acc + Number(s.total_revenue), 0);
    avgHistoricalRevenue = sum / historicalSnapshots.length;
  }

  // Use historical average for verification level to prevent instant spikes
  const scoringMrr = avgHistoricalRevenue;
  let revenueBonus = 0;
  
  if (scoringMrr > 0) revenueBonus += 5;       // Tier 1: Generating Revenue
  if (scoringMrr >= 1000) revenueBonus += 5;   // Tier 2: $1k+ MRR
  if (scoringMrr >= 5000) revenueBonus += 5;   // Tier 3: $5k+ MRR
  if (scoringMrr >= 10000) revenueBonus += 5;  // Tier 4: $10k+ MRR

  breakdown.revenue = revenueBonus;
  score += revenueBonus;

  // 3. Consistent Payments Check (+10)
  let hasConsistentPayments = false;
  if (startup.raw_metrics && (startup.raw_metrics as any).payment_count >= 3) {
    hasConsistentPayments = true;
  } else {
    const { count: snapshotCount } = await supabase
      .from("revenue_transactions")
      .select("*", { count: 'exact', head: true })
      .eq("startup_id", startup_id)
      .in("provider", ["stripe", "razorpay"]);
    if (snapshotCount && snapshotCount > 0) hasConsistentPayments = true;
  }

  if (hasConsistentPayments) {
    const historicalBonus = 10;
    breakdown.revenue += historicalBonus;
    score += historicalBonus;
  }

  // 4. Video Verification (+20)
  if (startup.video_url && startup.video_url.trim().length > 5) {
    breakdown.video = 20;
    score += 20;
  }

  // 5. Website (+10)
  if (startup.website && startup.website.trim().length > 5 && !startup.website.includes("@")) {
    breakdown.website = 10;
    score += 10;
  }

  // 6. Identity Verified (+20)
  const isVerified = ["identity_verified", "approved", "verified"].includes(startup.verification_status);
  if (isVerified) {
    breakdown.identity = 20;
    score += 20;
  }

  // 7. Fraud Detection
  const { data: history } = await supabase
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startup_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const historyAmounts = (history ?? []).map(h => Number(h.amount));
  const historyTimestamps = (history ?? []).map(h => new Date(h.created_at).getTime());

  const currentTxAmount = historyAmounts[0] || 0;
  const prevTxAmounts = historyAmounts.slice(1);
  const prevTxTimestamps = historyTimestamps.slice(1);

  const fraud = detectFraud({
    amount: currentTxAmount,
    previousTransactions: prevTxAmounts,
    timestamps: prevTxTimestamps,
    now: Date.now()
  });

  const isSpikeDetected = fraud.reason === "spike";
  const isRateLimited = fraud.reason === "rate_limit";
  
  // Penalty Persistence, Decay & Clean Events Logic
  const lastPenaltyAt = startup.last_penalty_at ? new Date(startup.last_penalty_at) : null;
  let penaltyCount = Number(startup.penalty_count) || 0;
  const cleanEvents = Number(startup.clean_events) || 0;
  let isRecovering = false;

  const isAnyNewPenalty = isRateLimited || isSpikeDetected;

  // Note: clean_events is now handled in updateRevenueAndSnapshot for atomic logging
  // But we still need to know its value for recovery calculation
  
  // Decay penalty count over time (reduce by 1 every 15 mins of clean activity)
  // Requirement: Minimum 3 clean events to earn decay
  if (lastPenaltyAt && penaltyCount > 0 && !isAnyNewPenalty && cleanEvents >= 3) {
    const minsSince = (Date.now() - lastPenaltyAt.getTime()) / (1000 * 60);
    const decay = Math.floor(minsSince / 15);
    if (decay > 0) {
      penaltyCount = Math.max(0, penaltyCount - 1); // Only 1 per cycle
      isRecovering = true;
    }
  }

  // --- FRAUD PENALTIES ---
  const { data: fraudSignals } = await supabase
    .from("fraud_signals")
    .select("severity")
    .eq("startup_id", startup_id)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  let maxSeverity = 0;
  if (fraudSignals && fraudSignals.length > 0) {
    for (const signal of fraudSignals) {
      if (signal.severity > maxSeverity) maxSeverity = signal.severity;
      
      if (signal.severity === 5) score -= 40;
      else if (signal.severity === 4) score -= 25;
      else if (signal.severity === 3) score -= 15;
      else if (signal.severity === 2) score -= 5;
    }
  }

  // Apply Stability Penalty with Severity Scaling
  if (isSpikeDetected) {
    const baseSeverity = 0.2;
    const scaledSeverity = Math.min(0.5, baseSeverity + (penaltyCount * 0.05));
    const penalty = score * scaledSeverity;
    score -= penalty;
    breakdown.stability_penalty = -Math.round(penalty);
  }

  // Apply Rate Penalty with Severity Scaling (10%, 20%, 30%+)
  if (isRateLimited) {
    const severity = Math.min(0.5, 0.1 * penaltyCount); 
    const penalty = score * severity;
    score -= penalty;
    breakdown.rate_penalty = -Math.round(penalty);
  }

  // Verification Stability: If a penalty happened recently (< 10 mins), apply a dampening factor
  const isInertiaActive = lastPenaltyAt && (Date.now() - lastPenaltyAt.getTime()) < 10 * 60 * 1000;
  if (isInertiaActive && !isAnyNewPenalty) {
    const inertiaPenalty = score * 0.15; // 15% dampening of score
    score -= inertiaPenalty;
    breakdown.inertia_penalty = -Math.round(inertiaPenalty);
  }

  // Verification Recovery Boost: If recovering (penalty_count decayed) and no new penalties
  if (isRecovering && !isAnyNewPenalty) {
    const boostBase = Math.max(1, Math.floor(5 / (penaltyCount + 1))); 
    const recoveryBoost = Math.min(2, boostBase); // Max score gain per recovery cycle = +2
    score += recoveryBoost;
    breakdown.recovery_boost = recoveryBoost;
  }

  // Final Clamp & Integer Conversion
  score = Math.round(Math.max(0, Math.min(100, score)));
  
  // Compute Tier
  let tier = getTrustTier(score);
  if (maxSeverity >= 4) tier = "flagged";

  // Derive status
  let status: ScoringResult["status"] = "unverified";
  if (maxSeverity >= 4) status = "flagged";
  else if (score >= 70) status = "verified";
  else if (score >= 31) status = "syncing";

  // Persist back to DB with penalty state
  const updateData: Record<string, unknown> = {
    trust_score: score,
    trust_tier: tier,
    trust_breakdown: breakdown,
    penalty_count: penaltyCount
  };

  if (isAnyNewPenalty) {
    updateData.last_penalty_at = new Date().toISOString();
  }

  if (options.persist !== false) {
    await supabase
      .from("startup_submissions")
      .update(updateData)
      .eq("id", startup_id);
  }

  return { score, status, tier, updateData };
}
```

## `src/lib/verification-state.ts`

```typescript
import { computeVerificationConfidence } from "./verification-confidence";
import { analyzeRevenueConsistency } from "./revenue-consistency";
import { calculateTrustScore } from "./scoring";

// ─── Confidence-Based Trust Tiers (data-derived only) ───────────────────────
//
//   SELF_REPORTED     → No connected payment provider
//   PAYMENT_CONNECTED → Provider linked; insufficient provider-backed revenue history
//   REVENUE_VERIFIED  → Provider linked + transaction history + recent sync

export type ConfidenceTier =
  | "SELF_REPORTED"
  | "PAYMENT_CONNECTED"
  | "REVENUE_VERIFIED";

/** @deprecated Use REVENUE_VERIFIED — kept for callers not yet updated */
export type LegacyConfidenceTier = ConfidenceTier | "HIGH_CONFIDENCE";

export type InternalAnomalyFlag =
  | "RATE_LIMIT_TRIGGERED"
  | "REVENUE_SPIKE_DETECTED"
  | "CONSISTENCY_LOW"
  | "PENALTY_ACTIVE"
  | "PROVIDER_STALE";

export interface VerificationStateInput {
  revenueTransactions: { amount: number; timestamp: number }[];
  providerConnections: {
    provider: string;
    status: string;
    last_synced_at: string | null;
    latest_revenue?: number;
  }[];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  /** Sandbox/demo profiles must not inherit simulated DB metrics as verified */
  isDemoProfile?: boolean;
  /** From startup_submissions.verification_type (api, manual, proof, social) */
  verificationType?: string | null;
  hasProofUpload?: boolean;
}

export interface VerificationStateResult {
  confidenceTier: ConfidenceTier;
  verificationConfidence: number;
  providersConnected: string[];
  duplicateProtectionActive: boolean;
  fraudChecksPassed: boolean;
  consistencyLevel: string;
  consistencyScore: number;
  consistencyFlags: string[];
  trustScore: number;
  lastSyncAt: string | null;
  transactionCount: number;
  hasConnectedProviders: boolean;
  providerBreakdown: { provider: string; amount: number; percentage: number }[];
  verificationDepth: number;
  internalFlags: InternalAnomalyFlag[];
  /** @deprecated Use confidenceTier */
  verificationStatus: string;
  /** Submission verification_type */
  verificationMethod: string;
  verificationMethodLabel: string;
  /** Primary revenue evidence channel */
  dataSource: string;
  dataSourceLabel: string;
  /** Provider-backed revenue with recent sync — required before "verified" UI */
  hasVerificationEvidence: boolean;
}

const MIN_PROVIDER_TRANSACTIONS = 3;
const SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function formatLastSyncRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatVerificationMethodLabel(
  verificationType: string | null | undefined
): string {
  switch (verificationType?.toLowerCase()) {
    case "api":
      return "Payment API";
    case "proof":
      return "Proof upload";
    case "social":
      return "Social links";
    case "manual":
      return "Manual declaration";
    default:
      return "Manual declaration";
  }
}

export function resolveTrustDataSource(params: {
  confidenceTier: ConfidenceTier;
  providersConnected: string[];
  verificationType?: string | null;
  hasProofUpload?: boolean;
  isDemoProfile?: boolean;
}): { dataSource: string; dataSourceLabel: string } {
  if (params.isDemoProfile) {
    return { dataSource: "sandbox", dataSourceLabel: "Sandbox sample data" };
  }

  if (params.providersConnected.length > 0) {
    const names = params.providersConnected.map(
      (p) => p.charAt(0).toUpperCase() + p.slice(1)
    );
    const label =
      params.confidenceTier === "REVENUE_VERIFIED"
        ? names.join(" + ")
        : `${names.join(" + ")} (awaiting sync)`;
    return { dataSource: params.providersConnected[0], dataSourceLabel: label };
  }

  if (params.hasProofUpload || params.verificationType === "proof") {
    return {
      dataSource: "proof",
      dataSourceLabel: "Uploaded proof (not ledger-backed)",
    };
  }

  if (params.verificationType === "api") {
    return {
      dataSource: "pending_api",
      dataSourceLabel: "Payment API (not connected)",
    };
  }

  return {
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
  };
}

export function hasVerificationEvidence(
  state: Pick<VerificationStateResult, "confidenceTier">
): boolean {
  return state.confidenceTier === "REVENUE_VERIFIED";
}

function normalizeSignalType(signal: string): string {
  return signal.toLowerCase().replace(/_/g, "");
}

function sumTransactionAmounts(
  transactions: { amount: number; timestamp: number }[]
): number {
  return transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

function hasDuplicateProtection(
  transactions: { amount: number; timestamp: number }[]
): boolean {
  if (transactions.length < 2) return false;
  const keys = new Set(
    transactions.map((t) => `${t.timestamp}:${Number(t.amount)}`)
  );
  return keys.size >= 2;
}

/**
 * Tier rules use only observable pipeline data (no trust-score or reliability priors).
 */
export function resolveConfidenceTierFromData(params: {
  hasProviders: boolean;
  transactionCount: number;
  providerRevenueTotal: number;
  lastSyncAt: string | null;
}): ConfidenceTier {
  if (!params.hasProviders) {
    return "SELF_REPORTED";
  }

  const syncFresh =
    !!params.lastSyncAt &&
    Date.now() - new Date(params.lastSyncAt).getTime() <= SYNC_FRESH_MS;

  const hasProviderRevenueHistory =
    params.transactionCount >= MIN_PROVIDER_TRANSACTIONS &&
    params.providerRevenueTotal > 0;

  if (hasProviderRevenueHistory && syncFresh) {
    return "REVENUE_VERIFIED";
  }

  return "PAYMENT_CONNECTED";
}

function detectInternalAnomalies(
  fraudSignals: { signal_type: string }[],
  penaltyCount: number,
  consistencyScore: number,
  lastSyncAt: string | null
): InternalAnomalyFlag[] {
  const flags: InternalAnomalyFlag[] = [];

  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("ratelimit"))
  ) {
    flags.push("RATE_LIMIT_TRIGGERED");
  }
  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("spike"))
  ) {
    flags.push("REVENUE_SPIKE_DETECTED");
  }
  if (consistencyScore < 30 && consistencyScore > 0) {
    flags.push("CONSISTENCY_LOW");
  }
  if (penaltyCount > 0) {
    flags.push("PENALTY_ACTIVE");
  }
  if (lastSyncAt) {
    const staleThreshold = Date.now() - SYNC_FRESH_MS;
    if (new Date(lastSyncAt).getTime() < staleThreshold) {
      flags.push("PROVIDER_STALE");
    }
  }

  return flags;
}

function selfReportedResult(
  penaltyCount: number,
  fraudSignals: { signal_type: string }[],
  verificationType?: string | null,
  hasProofUpload?: boolean,
  isDemoProfile?: boolean
): VerificationStateResult {
  const method = verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: "SELF_REPORTED",
    providersConnected: [],
    verificationType: method,
    hasProofUpload,
    isDemoProfile,
  });

  return {
    confidenceTier: "SELF_REPORTED",
    verificationConfidence: 0,
    providersConnected: [],
    duplicateProtectionActive: false,
    fraudChecksPassed: false,
    consistencyLevel: "Refining",
    consistencyScore: 0,
    consistencyFlags: [],
    trustScore: 0,
    lastSyncAt: null,
    transactionCount: 0,
    hasConnectedProviders: false,
    providerBreakdown: [],
    verificationDepth: 1,
    internalFlags: detectInternalAnomalies(fraudSignals, penaltyCount, 0, null),
    verificationStatus: "SELF_REPORTED",
    verificationMethod: method,
    verificationMethodLabel: formatVerificationMethodLabel(method),
    dataSource,
    dataSourceLabel,
    hasVerificationEvidence: false,
  };
}

export function computeVerificationState(
  input: VerificationStateInput
): VerificationStateResult {
  if (input.isDemoProfile) {
    return selfReportedResult(
      input.penaltyCount,
      input.fraudSignals,
      input.verificationType,
      input.hasProofUpload,
      true
    );
  }

  const activeProviders = input.providerConnections
    .filter((p) => p.status === "connected")
    .map((p) => p.provider);

  const latestSync =
    input.providerConnections
      .map((p) => p.last_synced_at)
      .filter(Boolean)
      .sort()
      .pop() || null;

  const fraudFlagCount = input.fraudSignals.length;
  const fraudMetrics = {
    rate_limit_violations: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("ratelimit")
    ).length,
    spike_events: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("spike")
    ).length,
    penalty_count: input.penaltyCount,
  };

  const trustResult = calculateTrustScore(
    input.revenueTransactions,
    fraudMetrics
  );
  const authResult = analyzeRevenueConsistency(input.revenueTransactions);
  const deduplicationActive = hasDuplicateProtection(input.revenueTransactions);
  const hasProviders = activeProviders.length > 0;
  const providerRevenueTotal = sumTransactionAmounts(input.revenueTransactions);

  const confResult = computeVerificationConfidence({
    transactionCount: input.revenueTransactions.length,
    providers: activeProviders,
    consistencyScore: authResult.consistency_score,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt: latestSync,
  });

  const confidenceTier = resolveConfidenceTierFromData({
    hasProviders,
    transactionCount: input.revenueTransactions.length,
    providerRevenueTotal,
    lastSyncAt: latestSync,
  });

  const fraudChecksPassed =
    fraudFlagCount === 0 &&
    input.revenueTransactions.length > 0 &&
    hasProviders;

  const internalFlags = detectInternalAnomalies(
    input.fraudSignals,
    input.penaltyCount,
    authResult.consistency_score,
    latestSync
  );

  const depthMap: Record<ConfidenceTier, number> = {
    SELF_REPORTED: 1,
    PAYMENT_CONNECTED: 2,
    REVENUE_VERIFIED: 3,
  };

  const result: VerificationStateResult = {
    confidenceTier,
    verificationConfidence: confResult.verification_confidence,
    providersConnected: activeProviders,
    duplicateProtectionActive: deduplicationActive,
    fraudChecksPassed,
    consistencyLevel: authResult.consistency_level,
    consistencyScore: authResult.consistency_score,
    consistencyFlags: authResult.consistency_flags,
    trustScore: trustResult,
    lastSyncAt: latestSync,
    transactionCount: input.revenueTransactions.length,
    hasConnectedProviders: hasProviders,
    providerBreakdown: input.providerConnections
      .filter((p) => p.status === "connected")
      .map((p) => ({
        provider: p.provider,
        amount: Number(p.latest_revenue) || 0,
        percentage: 0,
      })),
    verificationDepth: depthMap[confidenceTier],
    internalFlags,
    verificationStatus: confidenceTier,
    verificationMethod: "manual",
    verificationMethodLabel: "Manual declaration",
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
    hasVerificationEvidence: confidenceTier === "REVENUE_VERIFIED",
  };

  const totalMrr = result.providerBreakdown.reduce((acc, p) => acc + p.amount, 0);
  if (totalMrr > 0) {
    result.providerBreakdown = result.providerBreakdown.map((p) => ({
      ...p,
      percentage: Math.round((p.amount / totalMrr) * 100),
    }));
  }

  const verificationMethod = input.verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: result.confidenceTier,
    providersConnected: result.providersConnected,
    verificationType: verificationMethod,
    hasProofUpload: input.hasProofUpload,
    isDemoProfile: false,
  });

  result.verificationMethod = verificationMethod;
  result.verificationMethodLabel = formatVerificationMethodLabel(verificationMethod);
  result.dataSource = dataSource;
  result.dataSourceLabel = dataSourceLabel;
  result.hasVerificationEvidence = result.confidenceTier === "REVENUE_VERIFIED";

  return result;
}

/** True only when provider-backed revenue has a recent sync (evidence-backed). */
export function isVerifiedConfidenceTier(tier: ConfidenceTier): boolean {
  return tier === "REVENUE_VERIFIED";
}

export function buildVerificationStateInput(params: {
  revenueTransactions: { amount: number; created_at: string }[];
  providerConnections: VerificationStateInput["providerConnections"];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  isDemoProfile?: boolean;
  verificationType?: string | null;
  hasProofUpload?: boolean;
}): VerificationStateInput {
  return {
    revenueTransactions: params.revenueTransactions.map((event) => ({
      amount: Number(event.amount) || 0,
      timestamp: new Date(event.created_at).getTime(),
    })),
    providerConnections: params.providerConnections,
    fraudSignals: params.fraudSignals,
    penaltyCount: params.penaltyCount,
    isDemoProfile: params.isDemoProfile,
    verificationType: params.verificationType,
    hasProofUpload: params.hasProofUpload,
  };
}
```

## `src/lib/verification-data.ts`

```typescript
import { supabaseServer } from "@/lib/supabase-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
  VerificationStateResult,
} from "@/lib/verification-state";

export function isDemoStartupUserId(userId: string | null | undefined): boolean {
  return !!userId?.startsWith("00000000-0000-0000-0000-");
}

export async function computeVerificationStateForStartup(
  startupId: number,
  options?: { isDemoProfile?: boolean }
): Promise<VerificationStateResult> {
  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at, latest_revenue")
      .eq("startup_id", startupId),
    supabaseServer
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startupId),
    supabaseServer
      .from("startup_submissions")
      .select("penalty_count, user_id, verification_type, proof_url")
      .eq("id", startupId)
      .maybeSingle(),
  ]);

  const isDemo =
    options?.isDemoProfile ??
    isDemoStartupUserId(startupRes.data?.user_id);

  return computeVerificationState(
    buildVerificationStateInput({
      revenueTransactions: revenueRes.data || [],
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: Number(startupRes.data?.penalty_count) || 0,
      isDemoProfile: isDemo,
      verificationType: startupRes.data?.verification_type,
      hasProofUpload: !!startupRes.data?.proof_url,
    })
  );
}

export async function computeVerificationStatesForStartups(
  startupIds: number[],
  demoUserIds: Map<number, string | null>
): Promise<Map<number, VerificationStateResult>> {
  const results = new Map<number, VerificationStateResult>();
  if (startupIds.length === 0) return results;

  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("startup_id, amount, created_at")
      .in("startup_id", startupIds)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("provider_connections")
      .select("startup_id, provider, status, last_synced_at, latest_revenue")
      .in("startup_id", startupIds),
    supabaseServer
      .from("fraud_signals")
      .select("startup_id, signal_type")
      .in("startup_id", startupIds),
    supabaseServer
      .from("startup_submissions")
      .select("id, penalty_count, user_id, verification_type, proof_url")
      .in("id", startupIds),
  ]);

  const revenueByStartup = new Map<number, { amount: number; created_at: string }[]>();
  for (const row of revenueRes.data || []) {
    const list = revenueByStartup.get(row.startup_id) || [];
    list.push({ amount: row.amount, created_at: row.created_at });
    revenueByStartup.set(row.startup_id, list);
  }

  const providersByStartup = new Map<
    number,
    { provider: string; status: string; last_synced_at: string | null; latest_revenue?: number }[]
  >();
  for (const row of providerRes.data || []) {
    const list = providersByStartup.get(row.startup_id) || [];
    list.push({
      provider: row.provider,
      status: row.status,
      last_synced_at: row.last_synced_at,
      latest_revenue: row.latest_revenue,
    });
    providersByStartup.set(row.startup_id, list);
  }

  const fraudByStartup = new Map<number, { signal_type: string }[]>();
  for (const row of fraudRes.data || []) {
    const list = fraudByStartup.get(row.startup_id) || [];
    list.push({ signal_type: row.signal_type });
    fraudByStartup.set(row.startup_id, list);
  }

  const penaltyByStartup = new Map<number, number>();
  for (const row of startupRes.data || []) {
    penaltyByStartup.set(row.id, Number(row.penalty_count) || 0);
    demoUserIds.set(row.id, row.user_id);
  }

  for (const id of startupIds) {
    const startupRow = (startupRes.data || []).find((r) => r.id === id);
    const state = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: revenueByStartup.get(id) || [],
        providerConnections: providersByStartup.get(id) || [],
        fraudSignals: fraudByStartup.get(id) || [],
        penaltyCount: penaltyByStartup.get(id) || 0,
        isDemoProfile: isDemoStartupUserId(demoUserIds.get(id)),
        verificationType: startupRow?.verification_type,
        hasProofUpload: !!startupRow?.proof_url,
      })
    );
    results.set(id, state);
  }

  return results;
}
```

## `src/lib/revenue-aggregation.ts`

```typescript
import { supabaseServer } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import { safeFetch } from "@/lib/safe-network";
import { getPlatformStripe, isStripeConnectAccountId } from "@/lib/stripe";
import {
  createRazorpayClient,
  fetchRazorpayCapturedPayments,
} from "@/lib/razorpay-sync";

// ─── Types ─────────────────────────────────────────────────────────────

/** 
 * Static FX rate for simplicity. 
 * In production, this could be fetched dynamically from an exchange rate API.
 */
export const USD_TO_INR = 83.50;

/** Normalized revenue result from any single provider */
export type ProviderRevenue = {
  provider: string;
  originalRevenue: number; // The exact amount in source currency
  originalCurrency: string; // The source currency (e.g. USD, INR)
  revenue: number;         // Normalized to INR
  currency: string;        // Always "INR"
  transactionCount: number;
  success: boolean;
  error?: string;
};

/** Aggregated revenue across all connected providers */
export type AggregatedRevenue = {
  totalRevenue: number;
  breakdown: Record<string, number>;
  providers: ProviderRevenue[];
};

// ─── Provider Fetchers ─────────────────────────────────────────────────

/**
 * Fetches last-30-day revenue from a Stripe Connect account (platform credentials).
 */
export async function getStripeConnectRevenue(
  stripeAccountId: string
): Promise<ProviderRevenue> {
  try {
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );
    const stripe = getPlatformStripe();
    const page = await stripe.balanceTransactions.list(
      { created: { gte: thirtyDaysAgo }, limit: 100 },
      { stripeAccount: stripeAccountId }
    );

    const charges = page.data.filter(
      (t) => t.type === "charge" || t.type === "payment"
    );
    const totalCents = charges.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );

    const originalRevenue = totalCents / 100;
    const originalCurrency = (charges[0]?.currency || "usd").toUpperCase();

    return {
      provider: "stripe",
      originalRevenue,
      originalCurrency,
      revenue: originalCurrency === "USD" ? originalRevenue * USD_TO_INR : originalRevenue,
      currency: "INR",
      transactionCount: charges.length,
      success: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      provider: "stripe",
      originalRevenue: 0,
      originalCurrency: "USD",
      revenue: 0,
      currency: "INR",
      transactionCount: 0,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Fetches last-30-day revenue from Stripe via balance_transactions.
 * Returns a normalized { revenue, currency: "INR" } shape.
 */
export async function getStripeRevenue(apiKey: string): Promise<ProviderRevenue> {
  try {
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );

    const res = await safeFetch<any>(
      `https://api.stripe.com/v1/balance_transactions?created[gte]=${thirtyDaysAgo}&limit=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      return {
        provider: "stripe",
        originalRevenue: 0,
        originalCurrency: "USD",
        revenue: 0,
        currency: "INR",
        transactionCount: 0,
        success: false,
        error: res.error?.message || `Stripe API error: ${res.status}`,
      };
    }

    const data = res.data;
    const charges = (data.data || []).filter(
      (t: { type: string }) => t.type === "charge" || t.type === "payment"
    );
    const totalCents = charges.reduce(
      (sum: number, t: { amount?: number }) => sum + (t.amount || 0),
      0
    );

    const originalRevenue = totalCents / 100;
    // Defaulting to USD since this is standard Stripe API without explicit filtering
    const originalCurrency = (charges[0]?.currency || "usd").toUpperCase();

    return {
      provider: "stripe",
      originalRevenue,
      originalCurrency,
      revenue: originalCurrency === "USD" ? originalRevenue * USD_TO_INR : originalRevenue,
      currency: "INR",
      transactionCount: charges.length,
      success: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      provider: "stripe",
      originalRevenue: 0,
      originalCurrency: "USD",
      revenue: 0,
      currency: "INR",
      transactionCount: 0,
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Fetches last-30-day revenue from Razorpay via payments API.
 * Returns a normalized { revenue, currency: "INR" } shape.
 */
export async function getRazorpayRevenue(
  keyId: string,
  keySecret: string
): Promise<ProviderRevenue> {
  try {
    const razorpay = createRazorpayClient(keyId, keySecret);
    const captured = await fetchRazorpayCapturedPayments(razorpay);
    const totalPaise = captured.reduce((sum, p) => sum + p.amount, 0);

    const originalRevenue = totalPaise / 100;
    const originalCurrency = (captured[0]?.currency || "INR").toUpperCase();

    return {
      provider: "razorpay",
      originalRevenue,
      originalCurrency,
      revenue: originalRevenue, // Razorpay is already in INR
      currency: "INR",
      transactionCount: captured.length,
      success: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return {
      provider: "razorpay",
      originalRevenue: 0,
      originalCurrency: "INR",
      revenue: 0,
      currency: "INR",
      transactionCount: 0,
      success: false,
      error: errorMsg,
    };
  }
}

// ─── Unified Aggregation Engine ────────────────────────────────────────

/**
 * THE single source of truth for startup revenue.
 *
 * 1. Fetches all connected providers from `provider_connections`
 * 2. Calls each provider's live API to get current 30-day revenue
 * 3. Normalizes every response to { revenue, currency: "INR" }
 * 4. Aggregates into a total + per-provider breakdown
 * 5. Persists `latest_revenue` per connection  &  `mrr` + `mrr_breakdown` on startup_submissions
 * 6. Returns { totalRevenue, breakdown, providers }
 *
 * Every route in the system MUST use this function instead of
 * calculating Stripe / Razorpay revenue independently.
 */
export async function getAggregatedRevenue(
  startupId: number,
  prefetchedProviders?: Record<string, ProviderRevenue>,
  skipPersist: boolean = false
): Promise<AggregatedRevenue> {
  // ── 1. Fetch all connected providers ─────────────────────
  const { data: connections, error } = await supabaseServer
    .from("provider_connections")
    .select("*")
    .eq("startup_id", startupId)
    .eq("status", "connected");

  if (error) {
    console.error("[RevenueEngine] ERROR:", {
      startupId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return { totalRevenue: 0, breakdown: {}, providers: [] };
  }

  if (!connections || connections.length === 0) {
    return { totalRevenue: 0, breakdown: {}, providers: [] };
  }

  // ── 2. Fetch live revenue from each provider (parallel) ──
  const providerResults: ProviderRevenue[] = await Promise.all(
    connections.map(async (conn) => {
      if (prefetchedProviders && prefetchedProviders[conn.provider]) {
        return prefetchedProviders[conn.provider];
      }

      const decryptedKey = decrypt(conn.api_key_encrypted);

      switch (conn.provider) {
        case "stripe":
          if (isStripeConnectAccountId(conn.account_id)) {
            return getStripeConnectRevenue(conn.account_id);
          }
          return getStripeRevenue(decryptedKey);

        case "razorpay":
          return getRazorpayRevenue(conn.account_id, decryptedKey);

        default:
          return {
            provider: conn.provider,
            revenue: 0,
            currency: "INR",
            transactionCount: 0,
            success: false,
            error: `Unsupported provider: ${conn.provider}`,
          } as ProviderRevenue;
      }
    })
  );

  // ── 3. Normalize + Aggregate ─────────────────────────────
  let totalRevenue = 0;
  const breakdown: Record<string, number> = {};

  for (const result of providerResults) {
    const cached = connections.find((c) => c.provider === result.provider);
    const cachedRevenue = cached?.latest_revenue ? Number(cached.latest_revenue) : 0;

    if (result.success) {
      // 🛡️ Suspicious Zero Detection: 
      // If live returns 0, but cache was significantly higher, AND we have 0 transactions,
      // it might be a temporary sync issue or API state. 
      // We use the cache as a safety fallback unless confirmed.
      if (result.revenue === 0 && result.transactionCount === 0 && cachedRevenue > 0) {
        console.warn(`[RevenueEngine] Suspicious zero for ${result.provider}. Falling back to cache.`);
        totalRevenue += cachedRevenue;
        breakdown[result.provider] = cachedRevenue;
      } else {
        totalRevenue += result.revenue;
        breakdown[result.provider] = result.revenue;
      }
    } else {
      // Fallback to cached latest_revenue when a live call fails
      console.warn(
        `[RevenueEngine] ${result.provider} live fetch failed, using cache:`,
        result.error
      );
      if (cachedRevenue > 0) {
        totalRevenue += cachedRevenue;
        breakdown[result.provider] = cachedRevenue;
      }
    }
  }

  if (!skipPersist) {
    // ── 4. Persist per-provider latest_revenue ───────────────
    await Promise.all(
      providerResults
        .filter((r) => r.success)
        .map((result) =>
          supabaseServer
            .from("provider_connections")
            .update({
              latest_revenue: result.revenue,
              last_synced_at: new Date().toISOString(),
            })
            .eq("startup_id", startupId)
            .eq("provider", result.provider)
        )
    );

    // ── 5. Persist aggregated MRR to startup_submissions ─────
    await supabaseServer
      .from("startup_submissions")
      .update({
        mrr: Math.round(totalRevenue),
        mrr_breakdown: breakdown,
      })
      .eq("id", startupId);

    // ── 6. Persist historical snapshot if changed ─────────────
    const { data: lastSnapshot } = await supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue, provider_breakdown")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const roundedTotal = Math.round(totalRevenue);
    
    // 🛡️ Snapshot Consistency Guard:
    // Prevent combined snapshots from collapsing to zero if we have active connections
    // and previous revenue. A total collapse to 0 is highly suspicious in a production app.
    const isSuspiciousCollapse = roundedTotal === 0 && lastSnapshot && Number(lastSnapshot.total_revenue) > 0;

    const isChanged = !lastSnapshot || 
      Number(lastSnapshot.total_revenue) !== roundedTotal ||
      JSON.stringify(lastSnapshot.provider_breakdown) !== JSON.stringify(breakdown);

    if (isChanged && !isSuspiciousCollapse) {
      await supabaseServer.from("revenue_snapshots").insert({
        startup_id: startupId,
        total_revenue: roundedTotal,
        provider_breakdown: breakdown,
        provider: "combined",
      });
      console.log("[RevenueEngine] Snapshot persisted:", { startupId, total_revenue: roundedTotal });
    } else if (isSuspiciousCollapse) {
      console.warn("[RevenueEngine] Prevented suspicious zero-value snapshot for:", startupId);
    }
  }

  return { totalRevenue, breakdown, providers: providerResults };
}

/**
 * Retrieves the historical MRR snapshots for a startup.
 * Useful for calculating MoM growth and drawing charts.
 */
export async function getRevenueHistory(startupId: number) {
  const { data, error } = await supabaseServer
    .from("revenue_snapshots")
    .select("*")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: true });
    
  if (error) {
    console.error("[RevenueEngine] ERROR:", {
      startupId,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
    });
    return [];
  }
  return data || [];
}

/**
 * Computes core business health metrics using the snapshot history.
 * Returns MRR, ARR, and Month-over-Month (Snapshot-over-Snapshot) growth.
 */
export async function getStartupMetrics(startupId: number) {
  try {

    const { data, error } = await supabaseServer
      .from("revenue_snapshots")
      .select("*")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: false });

    // 🔴 REAL ERROR LOGGING
    if (error) {
      console.error("[RevenueEngine] SUPABASE ERROR:", error);
      console.error("[RevenueEngine] ERROR STRING:", JSON.stringify(error, null, 2));

      return {
        mrr: 0,
        arr: 0,
        growthPercentage: 0,
      };
    }



    // 🟡 EMPTY DATA CASE (MOST IMPORTANT FIX)
    if (!data || data.length === 0) {
      console.warn("[RevenueEngine] No revenue snapshots found for:", startupId);

      return {
        mrr: 0,
        arr: 0,
        growthPercentage: 0,
      };
    }

    // ✅ SAFE ACCESS
    const latest = data[0];
    const previous = data.find(
      (d) => new Date(d.created_at) < new Date(latest.created_at)
    ) || null;



    const mrr = latest?.total_revenue ?? 0;
    const arr = mrr * 12;

    let growthPercentage = 0;

    // 🛡️ Reliable Growth Metric:
    // Look for a baseline from at least 24h ago to avoid 0% growth from frequent syncs.
    // Also skip zero-revenue snapshots to avoid false -100% growth.
    const baselineThreshold = new Date(latest.created_at).getTime() - (24 * 60 * 60 * 1000);
    const stablePrevious = data.find(
      (d) => new Date(d.created_at).getTime() < baselineThreshold && Number(d.total_revenue) > 0
    ) || data.find(
      (d) => new Date(d.created_at) < new Date(latest.created_at) && Number(d.total_revenue) > 0
    ) || previous;

    if (stablePrevious && stablePrevious.total_revenue > 0) {
      growthPercentage =
        ((latest.total_revenue - stablePrevious.total_revenue) /
          stablePrevious.total_revenue) *
        100;
    }



    return {
      mrr,
      arr,
      growthPercentage,
    };
  } catch (err) {
    console.error("[RevenueEngine] CRITICAL CRASH:", err);

    return {
      mrr: 0,
      arr: 0,
      growthPercentage: 0,
    };
  }
}
```

## `src/lib/formatters.ts`

```typescript
/**
 * Centralized, Premium Reusable Numeric Formatting Utilities for Verifii
 */

/**
 * Format any float/percentage value to consistent decimal precision.
 * E.g., 2.856408168513082 -> "2.86%"
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format growth rate, prepending a plus/minus sign automatically.
 * E.g., 12.3456 -> "+12.35%", -2.8564 -> "-2.86%"
 */
export function formatGrowth(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Formats scores (Trust scores, Confidence scores, etc.) with consistent precision.
 * E.g., 85.342 -> "85" (or "85.3" if specified)
 */
export function formatScore(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) return "0";
  return value.toFixed(decimals);
}

/**
 * Format a ranking number to a human-readable rank format (e.g., 1 -> "#1").
 */
export function formatRank(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return `#${value}`;
}

/**
 * Format a number to a human-readable ordinal format (e.g., 1 -> "1st", 2 -> "2nd").
 */
export function formatOrdinal(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return "";
  const s = ["th", "st", "nd", "rd"];
  const v = value % 100;
  return value + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Formats a currency value consistently.
 * Supports INR (Indian Rupee with Lakh/Crore grouping and naming)
 * and USD (US Dollar with standard millions/billions/thousands grouping).
 */
export function formatCurrency(
  value: number,
  currency: string = "INR",
  options: { compact?: boolean; precision?: number } = {}
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return currency.toUpperCase() === "USD" ? "$0" : "₹0";
  }

  const curr = currency.toUpperCase();
  const symbol = curr === "USD" ? "$" : "₹";
  const compact = options.compact ?? true;
  const precision = options.precision ?? 1;

  if (!compact) {
    if (curr === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    } else {
      // Indian standard grouping for INR (e.g., ₹1,50,000)
      return symbol + new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0,
      }).format(value);
    }
  }

  // Compact Currency Formats
  if (curr === "USD") {
    if (value >= 1_000_000_000) {
      return `${symbol}${(value / 1_000_000_000).toFixed(precision)}B`;
    }
    if (value >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(precision)}M`;
    }
    if (value >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(precision === 1 ? 0 : precision)}k`;
    }
    return `${symbol}${value.toFixed(0)}`;
  } else {
    // INR Standard Formatting
    if (value >= 10_000_000) {
      return `${symbol}${(value / 10_000_000).toFixed(precision)}Cr`;
    }
    if (value >= 100_000) {
      return `${symbol}${(value / 100_000).toFixed(precision)}L`;
    }
    if (value >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(precision === 1 ? 0 : precision)}k`;
    }
    return `${symbol}${value.toFixed(0)}`;
  }
}
```

## `middleware.ts`

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

## `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

## `src/lib/supabase-server.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Missing Supabase Server environment variables (SUPABASE_SERVICE_ROLE_KEY). API calls will fail.");
}

/**
 * Supabase Server Client
 * Uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * MUST ONLY be used in server-side contexts (API routes, Server Actions).
 */
export const supabaseServer = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key"
);

/**
 * Legacy helper for Server Components.
 * Returns the same singleton instance.
 */
export function getSupabaseServer() {
  return supabaseServer;
}
```

## `supabase/migrations/20240416000000_revenue_tracking.sql`

```sql
-- Extended Schema for Revenue Tracking

create table if not exists revenue_snapshots (
  id bigserial primary key,
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text not null, -- 'razorpay' or 'stripe'
  amount bigint not null, -- in smallest unit (paise/cents)
  currency text default 'INR',
  status text, -- captured / failed
  external_id text unique, -- payment id from provider
  created_at timestamptz default now()
);

-- Indices for performance
create index if not exists idx_revenue_startup on revenue_snapshots(startup_id);
create index if not exists idx_revenue_created on revenue_snapshots(created_at);

-- Payment connections table (used for storing API keys for automated audits)
create table if not exists payment_connections (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text not null,
  account_id text not null,
  access_token text not null, -- encrypted or secret key
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(startup_id, provider)
);

create index if not exists idx_payment_connections_startup on payment_connections(startup_id);

-- Update startup_submissions with persistent scoring and revenue fields
alter table startup_submissions add column if not exists trust_score int default 0;
alter table startup_submissions add column if not exists mrr bigint default 0; -- MRR in base currency
alter table startup_submissions add column if not exists payment_connected boolean default false;

-- Security: Row Level Security (RLS)
alter table payment_connections enable row level security;

-- Only authenticated service role (server) can manage these
create policy "Server only access"
  on payment_connections
  for all
  to service_role
  using (true)
  with check (true);

-- Deny all for other roles
create policy "No public access"
  on payment_connections
  for all
  to public
  using (false);
```

## `supabase/migrations/20240416000003_v2_verification_engine.sql`

```sql
-- Production-Grade Revenue Verification Schema

-- 1. Revenue snapshots (source of truth for deterministic auditing)
create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  provider text check (provider in ('razorpay', 'stripe')),
  amount numeric not null, -- stored in base currency (INR/USD)
  currency text default 'INR',
  period_start date,
  period_end date,
  source text default 'api',
  external_id text unique, -- Provider transaction/bulk ID
  created_at timestamptz default now()
);

-- 2. Audit logs for monitoring sync operations
create table if not exists public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  event text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

-- 3. Update startup_submissions with audit metadata
alter table public.startup_submissions
add column if not exists trust_score integer default 0,
add column if not exists verification_status text default 'pending',
add column if not exists last_verified_at timestamptz,
add column if not exists mrr numeric default 0;

-- 4. Indices for high-speed leaderboard sorting
create index if not exists idx_startup_trust_score on public.startup_submissions(trust_score desc);
create index if not exists idx_revenue_lookup on public.revenue_snapshots(startup_id, created_at);
```

## `supabase/migrations/20240416000004_fraud_detection.sql`

```sql
-- Fraud Detection and Anomaly signals schema

-- Table to store detected fraud signals
create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  startup_id bigint references startup_submissions(id) on delete cascade,
  signal_type text not null, -- e.g., 'revenue_spike', 'micro_transactions'
  severity integer check (severity between 1 and 5), -- 1 (low) to 5 (critical)
  metadata jsonb,
  created_at timestamptz default now()
);

-- Indices for reporting
create index if not exists idx_fraud_startup on public.fraud_signals(startup_id);
create index if not exists idx_fraud_severity on public.fraud_signals(severity desc);

-- Allow server role to manage fraud signals
alter table public.fraud_signals enable row level security;
create policy "Server manage fraud signals"
  on public.fraud_signals
  for all
  to service_role
  using (true)
  with check (true);
```

## `supabase/migrations/20240416000011_provider_connections.sql`

```sql
-- Migration: Refactor to multiple payment providers

-- 1. Create the new provider_connections table
CREATE TABLE IF NOT EXISTS public.provider_connections (
    id uuid primary key default gen_random_uuid(),
    startup_id bigint references public.startup_submissions(id) on delete cascade,
    provider text not null check (provider in ('stripe', 'razorpay')),
    account_id text, -- Used for Razorpay key_id or Stripe account id
    api_key_encrypted text not null, -- Replaces access_token
    status text default 'connected' check (status in ('connected', 'failed')),
    latest_revenue numeric default 0,
    last_synced_at timestamptz default now(),
    created_at timestamptz default now(),
    unique(startup_id, provider) -- Allows one of each type per startup, or can be relaxed if they have multiple stripes
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_provider_connections_startup ON public.provider_connections(startup_id);

-- 2. Migrate existing data from payment_connections
INSERT INTO public.provider_connections (id, startup_id, provider, account_id, api_key_encrypted, status, created_at)
SELECT 
    id, 
    startup_id, 
    provider, 
    account_id, 
    access_token as api_key_encrypted, 
    case when is_active then 'connected' else 'failed' end as status,
    created_at
FROM public.payment_connections
ON CONFLICT (startup_id, provider) DO NOTHING;

-- 3. Add mrr_breakdown to startup_submissions to remove single-provider logic and store multi-provider info
ALTER TABLE public.startup_submissions 
ADD COLUMN IF NOT EXISTS mrr_breakdown jsonb default '{}'::jsonb;

-- Security: RLS for provider_connections
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Server only access"
  ON public.provider_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "No public access"
  ON public.provider_connections
  FOR ALL
  TO public
  USING (false);

-- Optionally drop the old table after migrating logic
-- DROP TABLE IF EXISTS public.payment_connections;
```

## `supabase/migrations/20260420124038_historical_snapshots.sql`

```sql
-- 1. Rename existing table to revenue_transactions
ALTER TABLE IF EXISTS "revenue_snapshots" RENAME TO "revenue_transactions";

-- 2. Create the new historical snapshots table
CREATE TABLE "public"."revenue_snapshots" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "startup_id" bigint REFERENCES "public"."startup_submissions"("id") ON DELETE CASCADE,
    "total_revenue" numeric NOT NULL,
    "provider_breakdown" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE "public"."revenue_snapshots" ENABLE ROW LEVEL SECURITY;

-- Service role access
CREATE POLICY "Service role can manage revenue_snapshots" ON "public"."revenue_snapshots"
    USING (true)
    WITH CHECK (true);
```


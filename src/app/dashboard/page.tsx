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


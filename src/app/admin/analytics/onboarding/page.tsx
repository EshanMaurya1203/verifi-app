import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { AnalyticsDashboardClient } from "./AnalyticsDashboardClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding Analytics | Admin",
  description: "Monitor onboarding performance and bottlenecks.",
};

export const dynamic = "force-dynamic";

export default async function OnboardingAnalyticsPage() {
  const user = await getAuthenticatedUser();

  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }

  return <AnalyticsDashboardClient />;
}

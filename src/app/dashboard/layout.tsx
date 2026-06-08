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

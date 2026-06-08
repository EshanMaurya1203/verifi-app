import { supabaseServer } from "@/lib/supabase-server";

export type PlanCode = "viewer" | "founder" | "pro";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "grace_period"
  | "past_due"
  | "cancelled"
  | "expired";

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_code: PlanCode;
  billing_cycle: "monthly" | "annual";
  status: SubscriptionStatus;
  current_period_end: string;
  trial_end?: string | null;
}

/**
 * Retrieves the currently active subscription for a given user.
 * If the user has no active subscription, defaults to the 'viewer' plan.
 */
export async function getUserPlan(userId: string): Promise<UserSubscription> {
  const nowIso = new Date().toISOString();
  
  // Authorization reads ONLY from local subscriptions table.
  // Active/Grace: status is active or grace_period
  // Trialing: status is trialing AND trial_end > now
  // Cancelled: status is cancelled AND current_period_end > now
  const { data, error } = await supabaseServer
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .or(`status.in.(active,grace_period),and(status.eq.trialing,trial_end.gt.${nowIso}),and(status.eq.cancelled,current_period_end.gt.${nowIso})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Default fallback is the free viewer plan
    return {
      id: "free_viewer_fallback",
      user_id: userId,
      plan_code: "viewer",
      billing_cycle: "monthly",
      status: "active",
      current_period_end: new Date(9999, 11, 31).toISOString(), // Never expires
    };
  }

  return data as UserSubscription;
}

/**
 * Checks if a specific feature is enabled for a given plan code.
 */
export async function hasFeatureAccess(
  planCode: PlanCode,
  featureName: string
): Promise<boolean> {
  // If we want to hardcode for speed instead of DB hit, we could, but let's query the DB:
  const { data, error } = await supabaseServer
    .from("feature_access")
    .select("is_enabled")
    .eq("plan_code", planCode)
    .eq("feature_name", featureName)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return data.is_enabled;
}

/**
 * Validates if the user has a sufficient plan to perform an action.
 * Returns true if allowed, false if blocked.
 */
export async function enforcePlanAccess(
  userId: string,
  featureName: string
): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return hasFeatureAccess(plan.plan_code, featureName);
}

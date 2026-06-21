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
 * Status priority for selecting the "current" subscription.
 * Lower number = higher priority.
 */
const STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  grace_period: 1,
  trialing: 2,
  cancelled: 3,
};

/**
 * Retrieves the currently active subscription for a given user.
 * Selection priority: active > grace_period > trialing > cancelled.
 * Within the same priority, the newest (by created_at) wins.
 * If the user has no qualifying subscription, defaults to the 'viewer' plan.
 */
export async function getUserPlan(userId: string): Promise<UserSubscription> {
  const nowIso = new Date().toISOString();
  
  // Fetch ALL qualifying subscriptions (not just 1) so we can sort by
  // status priority. Qualifying means:
  //   - active or grace_period (always valid)
  //   - trialing with trial_end in the future AND (trial_start <= now OR trial_start IS NULL)
  //   - cancelled with current_period_end in the future (still has access)
  const { data, error } = await supabaseServer
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .or(`status.in.(active,grace_period),and(status.eq.trialing,trial_end.gt.${nowIso},or(trial_start.lte.${nowIso},trial_start.is.null)),and(status.eq.cancelled,current_period_end.gt.${nowIso})`)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
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

  // Sort by status priority (active > grace_period > trialing > cancelled),
  // then by created_at descending.
  data.sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    // Same priority → newest first (already ordered by query, but be explicit)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const selected = data[0] as UserSubscription;

  return selected;
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

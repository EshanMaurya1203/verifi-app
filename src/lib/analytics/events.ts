import { supabaseServer } from "@/lib/supabase-server";
import type { TimeRange } from "./types";
import type { DateWindow } from "./comparison";
export { ONBOARDING_ANALYTICS_EVENTS } from "./event-constants";
export type { OnboardingAnalyticsEvent } from "./event-constants";

export interface RawOnboardingEventRecord {
  event_name: string;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export function getTimeWindow(range: TimeRange): string | null {
  const now = new Date();
  switch (range) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
      return null;
    default:
      return null;
  }
}

/**
 * Fetches raw onboarding event records from PostgreSQL for a given time range.
 */
export async function fetchOnboardingEvents(
  range: TimeRange
): Promise<RawOnboardingEventRecord[]> {
  const cutoff = getTimeWindow(range);
  let query = supabaseServer
    .from("onboarding_events")
    .select("event_name, user_id, metadata, created_at")
    .order("created_at", { ascending: true });

  if (cutoff) {
    query = query.gte("created_at", cutoff);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as RawOnboardingEventRecord[];
}

/**
 * Fetches raw onboarding event records from PostgreSQL for a specific date window.
 */
export async function fetchOnboardingEventsForWindow(
  window: DateWindow
): Promise<RawOnboardingEventRecord[]> {
  const { data, error } = await supabaseServer
    .from("onboarding_events")
    .select("event_name, user_id, metadata, created_at")
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as RawOnboardingEventRecord[];
}

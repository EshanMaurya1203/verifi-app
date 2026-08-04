import { supabaseServer } from "@/lib/supabase-server";
import type { TimeRange } from "./types";
import type { DateWindow } from "./comparison";

export const ONBOARDING_ANALYTICS_EVENTS = {
  onboarding_started: "onboarding_started",
  step_1_completed: "step_1_completed",
  step_2_completed: "step_2_completed",
  step_3_completed: "step_3_completed",
  submission_completed: "submission_completed",
  submission_failed: "submission_failed",
  draft_restored: "draft_restored",
  draft_discarded: "draft_discarded",
} as const;

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

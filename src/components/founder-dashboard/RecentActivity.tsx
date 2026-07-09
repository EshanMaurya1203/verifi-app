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

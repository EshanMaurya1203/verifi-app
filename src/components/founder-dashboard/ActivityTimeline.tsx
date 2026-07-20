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
    <div className="activity-timeline">
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

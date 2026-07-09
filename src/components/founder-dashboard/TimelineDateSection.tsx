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

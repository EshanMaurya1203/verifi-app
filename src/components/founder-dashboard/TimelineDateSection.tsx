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
    <section className="mb-6 last:mb-0" aria-label={label}>
      {/* Date header */}
      <h3 className="font-syne text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </h3>

      {/* Events list */}
      <ul className="rounded-xl border border-border bg-card px-4 py-3 list-none m-0">
        {events.map((event, index) => (
          <li key={event.id}>
            <TimelineEventCard
              event={event}
              isLast={index === events.length - 1}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

import {
  TIMELINE_CATEGORY_CONFIGS,
  SEVERITY_COLORS,
  type PresentableTimelineEvent,
} from "@/lib/dashboard/timeline-types";
import { formatEventTime } from "@/lib/dashboard/timeline-formatters";

/**
 * TimelineEventCard
 *
 * Renders a single timeline event row. Purely presentational.
 * Icon is resolved from TIMELINE_CATEGORY_CONFIGS at render time.
 * Color is resolved from SEVERITY_COLORS based on event severity.
 */

interface TimelineEventCardProps {
  event: PresentableTimelineEvent;
  /** Whether this is the last event in its group (hides the connector line) */
  isLast?: boolean;
}

export function TimelineEventCard({ event, isLast = false }: TimelineEventCardProps) {
  const categoryConfig = TIMELINE_CATEGORY_CONFIGS[event.category];
  const severityColor = SEVERITY_COLORS[event.severity];
  const IconComponent = categoryConfig.icon;

  return (
    <div role="listitem" className="relative flex gap-3 pb-4 last:pb-0">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-[30px] bottom-0 w-px bg-border" />
      )}

      {/* Icon dot */}
      <div
        className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${severityColor.bg}`}
      >
        <IconComponent className={`h-3.5 w-3.5 ${severityColor.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-syne text-sm font-bold leading-snug truncate">
            {event.title}
          </h4>
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {formatEventTime(event.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {event.description}
        </p>
      </div>
    </div>
  );
}

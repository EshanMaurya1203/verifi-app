import type { PresentableTimelineEvent, TimelineDateGroup } from "./timeline-types";
import { formatDateGroupLabel } from "./timeline-formatters";

/**
 * Timeline Grouper
 *
 * Groups a flat array of PresentableTimelineEvent[] into TimelineDateGroup[]
 * organized by calendar date. Groups and events within groups are sorted
 * newest-first.
 */

/**
 * Extracts the YYYY-MM-DD date key from an ISO timestamp.
 */
function getDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

/**
 * Groups presentable timeline events by calendar date.
 *
 * - Events sharing the same YYYY-MM-DD are grouped together.
 * - Within each group, events remain sorted by timestamp descending.
 * - Groups are ordered newest-first.
 * - Each group's label is a smart date string ("Today", "Yesterday", etc.).
 */
export function groupEventsByDate(
  events: PresentableTimelineEvent[]
): TimelineDateGroup[] {
  if (!events.length) return [];

  // Build a Map to preserve insertion order (events are already sorted newest-first)
  const groupMap = new Map<string, PresentableTimelineEvent[]>();

  for (const event of events) {
    const dateKey = getDateKey(event.timestamp);
    const existing = groupMap.get(dateKey);
    if (existing) {
      existing.push(event);
    } else {
      groupMap.set(dateKey, [event]);
    }
  }

  // Convert to TimelineDateGroup[]
  const groups: TimelineDateGroup[] = [];
  for (const [dateKey, groupEvents] of groupMap) {
    groups.push({
      dateKey,
      label: formatDateGroupLabel(dateKey),
      events: groupEvents,
    });
  }

  return groups;
}

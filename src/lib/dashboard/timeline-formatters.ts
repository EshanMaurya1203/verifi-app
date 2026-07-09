import {
  format,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
  isSameWeek,
  isSameYear,
  parseISO,
  differenceInMinutes,
} from "date-fns";

/**
 * Timeline Formatters
 *
 * Relative time, smart date labels, and time-only formatting
 * for the timeline display. Uses date-fns (already installed, v4.1.0).
 */

/**
 * Formats a date key (YYYY-MM-DD) into a smart group label.
 *
 * - Same calendar day → "Today"
 * - Previous calendar day → "Yesterday"
 * - Same calendar week → Day name ("Monday")
 * - Same calendar year → "Jul 7"
 * - Different year → "Jul 7, 2025"
 */
export function formatDateGroupLabel(dateKey: string): string {
  const date = parseISO(dateKey);
  const now = new Date();

  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isSameWeek(date, now)) return format(date, "EEEE"); // "Monday"
  if (isSameYear(date, now)) return format(date, "MMM d"); // "Jul 7"
  return format(date, "MMM d, yyyy"); // "Jul 7, 2025"
}

/**
 * Formats an ISO timestamp into a relative time string.
 *
 * - < 1 minute → "Just now"
 * - < 7 days → "12 minutes ago", "3 hours ago", "2 days ago"
 * - ≥ 7 days → absolute short date ("Jul 2")
 */
export function formatRelativeTime(isoString: string): string {
  const date = parseISO(isoString);
  const now = new Date();
  const minutesAgo = differenceInMinutes(now, date);

  if (minutesAgo < 1) return "Just now";

  // For events within the last 7 days, use relative format
  const daysAgo = minutesAgo / (60 * 24);
  if (daysAgo < 7) {
    return formatDistanceToNowStrict(date, { addSuffix: true });
  }

  // For older events, use absolute short date
  if (isSameYear(date, now)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

/**
 * Formats an ISO timestamp into time-only display for within-group use.
 * The date is already shown in the section header.
 *
 * Output: "2:34 PM"
 */
export function formatEventTime(isoString: string): string {
  return format(parseISO(isoString), "h:mm a");
}

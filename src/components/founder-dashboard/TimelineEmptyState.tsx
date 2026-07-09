import { History } from "lucide-react";

/**
 * TimelineEmptyState
 *
 * Empty placeholder rendered when the timeline has no events.
 * Mirrors the existing empty-state pattern from EmptyDashboard.tsx.
 */
export function TimelineEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <History className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-syne text-lg font-bold mb-1">No activity yet</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Your startup activity will appear here after verification, syncs, or
        profile updates.
      </p>
    </div>
  );
}

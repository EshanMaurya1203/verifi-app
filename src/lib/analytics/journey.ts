export type JourneyStatus =
  | "completed"
  | "failed"
  | "abandoned"
  | "in_progress";

export interface JourneyStep {
  readonly event: string;
  readonly timestamp: string;
  readonly provider: string | null;
}

export interface FounderJourney {
  readonly sessionId: string;
  readonly userId: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly status: JourneyStatus;
  readonly durationMs: number | null;
  readonly steps: readonly JourneyStep[];
}

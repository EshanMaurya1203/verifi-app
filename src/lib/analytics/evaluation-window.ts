// ─── VRF-ONBOARD-001E.12D.1 — Discrete Evaluation Windows ────────────────

import type { ConfidenceContext } from "./experiments";

export interface EvaluationWindow {
  lastEvaluationAt?: Date;
  nextEvaluationAt: Date;
  canEvaluate: boolean;
}

/**
 * Computes discrete evaluation window checkpoints (daily: 24h, 48h, 72h... | weekly: 7d, 14d, 21d...).
 * Prevents continuous peeking by strictly locking evaluations to discrete checkpoint boundaries.
 */
export function computeEvaluationWindow(
  context: ConfidenceContext
): EvaluationWindow {
  if (!context || !context.startedAt || !context.now) {
    return {
      nextEvaluationAt: new Date(),
      canEvaluate: false,
    };
  }

  const { startedAt, now, evaluationFrequency } = context;
  const elapsedMs = now.getTime() - startedAt.getTime();
  const intervalHours = evaluationFrequency === "weekly" ? 168 : 24;

  if (elapsedMs < 0) {
    return {
      nextEvaluationAt: new Date(startedAt.getTime() + intervalHours * 3600 * 1000),
      canEvaluate: false,
    };
  }

  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const completedCheckpoints = Math.floor(elapsedHours / intervalHours);

  let lastEvaluationAt: Date | undefined;
  if (completedCheckpoints > 0) {
    lastEvaluationAt = new Date(startedAt.getTime() + completedCheckpoints * intervalHours * 3600 * 1000);
  }

  const nextEvaluationAt = new Date(startedAt.getTime() + (completedCheckpoints + 1) * intervalHours * 3600 * 1000);

  // Distance to nearest discrete checkpoint boundary
  const remainder = elapsedHours % intervalHours;
  const distToNearest = Math.min(remainder, intervalHours - remainder);

  // Discrete checkpoint condition: at least 1 interval elapsed & within 0.5h window of checkpoint boundary
  const canEvaluate = elapsedHours >= intervalHours && distToNearest <= 0.5;

  return {
    lastEvaluationAt,
    nextEvaluationAt,
    canEvaluate,
  };
}

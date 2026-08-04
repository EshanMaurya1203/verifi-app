import type { FounderJourney } from "./journey";
import { STUCK_THRESHOLD_MS } from "./diagnostics-config";
import { normalizeStepDuration } from "./duration-normalizer";

export interface DiagnosticsReport {
  readonly averageCompletionTimeMs: number;
  readonly averageStepsPerJourney: number;
  readonly stuckFounders: number;
  readonly abandonmentRate: number;
  readonly mostCommonDropOffStep: string | null;
  readonly slowestStep: string | null;
}

export interface DropOffPoint {
  readonly step: string;
  readonly count: number;
}

export interface StepDuration {
  readonly from: string;
  readonly to: string;
  readonly averageMs: number;
}

function round1Decimal(num: number): number {
  if (!Number.isFinite(num) || isNaN(num)) return 0.0;
  return Math.max(0, Math.round(num * 10) / 10);
}

/**
 * Finds stuck founders whose journey status is "in_progress" and whose last step activity
 * occurred more than STUCK_THRESHOLD_MS (24 hours) ago.
 */
export function findStuckFounders(journeys: readonly FounderJourney[]): readonly FounderJourney[] {
  if (!journeys || journeys.length === 0) return [];

  const nowMs = Date.now();

  return journeys.filter((journey) => {
    if (journey.status !== "in_progress") return false;
    if (!journey.steps || journey.steps.length === 0) return false;

    const lastStep = journey.steps[journey.steps.length - 1];
    const lastTimestampMs = new Date(lastStep.timestamp).getTime();

    return nowMs - lastTimestampMs > STUCK_THRESHOLD_MS;
  });
}

/**
 * Analyzes abandoned journeys to determine the final step reached before abandonment.
 * Returns drop-off points sorted by count descending.
 */
export function findDropOffPoints(journeys: readonly FounderJourney[]): readonly DropOffPoint[] {
  if (!journeys || journeys.length === 0) return [];

  const abandoned = journeys.filter((j) => j.status === "abandoned");
  if (abandoned.length === 0) return [];

  const countsMap = new Map<string, number>();

  for (const j of abandoned) {
    if (!j.steps || j.steps.length === 0) continue;
    const finalStep = j.steps[j.steps.length - 1].event;
    countsMap.set(finalStep, (countsMap.get(finalStep) || 0) + 1);
  }

  const dropOffs: DropOffPoint[] = [];
  for (const [step, count] of countsMap.entries()) {
    dropOffs.push({ step, count });
  }

  dropOffs.sort((a, b) => b.count - a.count);
  return dropOffs;
}

/**
 * Analyzes completed journeys to compute normalized average transition durations between consecutive steps.
 * Excludes transitions exceeding MAX_STEP_DURATION_MS (2h) via normalizeStepDuration.
 * Returns step durations sorted by averageMs descending.
 */
export function findSlowSteps(journeys: readonly FounderJourney[]): readonly StepDuration[] {
  if (!journeys || journeys.length === 0) return [];

  const completed = journeys.filter((j) => j.status === "completed");
  if (completed.length === 0) return [];

  const transitionSums = new Map<string, { from: string; to: string; sumMs: number; count: number }>();

  for (const j of completed) {
    if (!j.steps || j.steps.length < 2) continue;

    for (let i = 0; i < j.steps.length - 1; i++) {
      const stepA = j.steps[i];
      const stepB = j.steps[i + 1];

      const timeA = new Date(stepA.timestamp).getTime();
      const timeB = new Date(stepB.timestamp).getTime();

      const rawDiff = timeB - timeA;
      const normalizedDiff = normalizeStepDuration(rawDiff);

      if (normalizedDiff === null) continue; // Exclude idle outliers

      const key = `${stepA.event} -> ${stepB.event}`;
      const existing = transitionSums.get(key) || { from: stepA.event, to: stepB.event, sumMs: 0, count: 0 };
      transitionSums.set(key, {
        from: stepA.event,
        to: stepB.event,
        sumMs: existing.sumMs + normalizedDiff,
        count: existing.count + 1,
      });
    }
  }

  const result: StepDuration[] = [];

  for (const entry of transitionSums.values()) {
    const averageMs = Math.round(entry.sumMs / entry.count);
    result.push({
      from: entry.from,
      to: entry.to,
      averageMs,
    });
  }

  result.sort((a, b) => b.averageMs - a.averageMs);
  return result;
}

/**
 * Builds the complete DiagnosticsReport for a collection of founder journeys.
 */
export function buildDiagnosticsReport(journeys: readonly FounderJourney[]): DiagnosticsReport {
  if (!journeys || journeys.length === 0) {
    return {
      averageCompletionTimeMs: 0,
      averageStepsPerJourney: 0,
      stuckFounders: 0,
      abandonmentRate: 0,
      mostCommonDropOffStep: null,
      slowestStep: null,
    };
  }

  const totalJourneys = journeys.length;

  // 1. Average completion time
  const completedJourneys = journeys.filter((j) => j.status === "completed" && typeof j.durationMs === "number" && j.durationMs >= 0);
  let averageCompletionTimeMs = 0;
  if (completedJourneys.length > 0) {
    const totalDuration = completedJourneys.reduce((sum, j) => sum + (j.durationMs || 0), 0);
    averageCompletionTimeMs = Math.round(totalDuration / completedJourneys.length);
  }

  // 2. Average steps per journey
  const totalSteps = journeys.reduce((sum, j) => sum + (j.steps ? j.steps.length : 0), 0);
  const averageStepsPerJourney = round1Decimal(totalSteps / totalJourneys);

  // 3. Stuck founders
  const stuckList = findStuckFounders(journeys);
  const stuckFounders = stuckList.length;

  // 4. Abandonment rate
  const abandonedJourneys = journeys.filter((j) => j.status === "abandoned");
  const abandonmentRate = round1Decimal((abandonedJourneys.length / totalJourneys) * 100);

  // 5. Drop-off and slow step summaries
  const dropOffs = findDropOffPoints(journeys);
  const mostCommonDropOffStep = dropOffs.length > 0 ? dropOffs[0].step : null;

  const slowSteps = findSlowSteps(journeys);
  const slowestStep = slowSteps.length > 0 ? `${slowSteps[0].from} → ${slowSteps[0].to}` : null;

  return {
    averageCompletionTimeMs,
    averageStepsPerJourney,
    stuckFounders,
    abandonmentRate,
    mostCommonDropOffStep,
    slowestStep,
  };
}

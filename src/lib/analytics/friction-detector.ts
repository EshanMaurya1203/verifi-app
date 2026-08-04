import type { DiagnosticsReport } from "./diagnostics";
import type { Recommendation } from "./recommendations";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export function detectFrictionPoints(
  diagnostics: DiagnosticsReport
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  if (!diagnostics) return recommendations;

  // Rule 1: Dropoff / Abandonment Rate > 40%
  if (diagnostics.abandonmentRate > 40) {
    const dropOffStep = diagnostics.mostCommonDropOffStep || "onboarding_flow";
    recommendations.push({
      id: `friction_high_dropoff_${dropOffStep}`,
      target: {
        entityType: "step",
        entityId: dropOffStep,
      },
      category: "dropoff",
      severity: "high",
      kind: "warning",
      title: "High Onboarding Abandonment Rate",
      description: `Abandonment rate reached ${diagnostics.abandonmentRate}%, exceeding the 40% acceptable threshold.`,
      impact: "Severe loss of converting founders during onboarding setup.",
      evidence: [
        `Abandonment rate: ${diagnostics.abandonmentRate}%`,
        `Most common drop-off step: ${diagnostics.mostCommonDropOffStep || "N/A"}`,
      ],
      action: `Simplify requirements and clarify instructions for step: ${dropOffStep}.`,
    });
  }

  // Rule 2: Completion time > 15 minutes
  if (diagnostics.averageCompletionTimeMs > FIFTEEN_MINUTES_MS) {
    const durationMinutes = Math.round(
      diagnostics.averageCompletionTimeMs / 60000
    );
    const slowStep = diagnostics.slowestStep || "overall_flow";
    recommendations.push({
      id: `friction_slow_completion_${slowStep}`,
      target: {
        entityType: "step",
        entityId: slowStep,
      },
      category: "friction",
      severity: "medium",
      kind: "warning",
      title: "Extended Onboarding Completion Time",
      description: `Average completion duration is ${durationMinutes} minutes, exceeding the 15-minute target.`,
      impact: "Increased friction and drop-off due to length of registration process.",
      evidence: [
        `Average duration: ${durationMinutes} minutes`,
        `Slowest transition: ${diagnostics.slowestStep || "N/A"}`,
      ],
      action: "Enable autofill and pre-populate known details to shorten onboarding steps.",
    });
  }

  // Rule 3: Stuck founders > 0 or stuck founders rate > 20%
  if (diagnostics.stuckFounders > 0) {
    recommendations.push({
      id: "friction_stuck_founders_global",
      target: {
        entityType: "journey",
        entityId: "stuck_founders",
      },
      category: "friction",
      severity: "high",
      kind: "warning",
      title: "Founders Stuck In Progress",
      description: `${diagnostics.stuckFounders} founders are stuck with no activity for more than 24 hours.`,
      impact: "High probability of complete abandonment if not re-engaged promptly.",
      evidence: [`Stuck founders count: ${diagnostics.stuckFounders}`],
      action: "Trigger proactive email reminders offering onboarding support.",
    });
  }

  return recommendations;
}

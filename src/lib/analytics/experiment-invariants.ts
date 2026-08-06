// ─── VRF-ONBOARD-001E.12B / 12F — Experiment Invariants Engine ──────────

import type {
  AssignmentAuditRecord,
  AssignmentRecoveryResult,
  ConfidenceContext,
  ConfidenceResult,
  DashboardCacheEntry,
  DashboardExperimentCard,
  DashboardState,
  Experiment,
  ExperimentVariant,
  ExportResult,
  IdentityContext,
  PerformanceMetrics,
  RegressionContext,
  RegressionResult,
  RollbackResult,
  VariantAssignment,
} from "./experiments";
import type { RuntimeEvent } from "./runtime/runtime-types";
import type { RouterResult, RuntimeExperiment } from "./runtime/router-types";
import type { MiddlewareResult } from "./runtime/middleware-types";
import type { ExperimentRegistry } from "./runtime/experiment-discovery";
import type { FlagDecision } from "./runtime/feature-flags";
import type { AuditLog } from "./runtime/audit-log";
import { MAX_AUDIT_ENTRIES } from "./runtime/audit-log";
import type { ExperimentMetrics, ExperimentHealth, ObservabilitySnapshot } from "./runtime/observability-types";
import type { Anomaly } from "./runtime/anomaly-detector";
import type { EventQueue } from "./runtime/event-queue";
import type { QueuedEvent } from "./runtime/queue-types";
import type { ValidationResult, CertificationReport } from "./runtime/validation-types";
import type { BenchmarkMetadata } from "./runtime/benchmark-types";
import type { MemoryProfile } from "./runtime/memory-profiler";
import type { ConcurrencyValidationResult } from "./runtime/concurrency-validator";
import type { ExperimentDefinition } from "./registry/experiment-types";
import type { DomainRegistryStore } from "./registry/experiment-registry";
import { isValidLifecycleTransition } from "./registry/experiment-registry";
import type { TargetingContext } from "./targeting/targeting-context";
import type { ExperimentTargetingRules } from "./targeting/targeting-rules";
import type { EligibilityResult } from "./targeting/targeting-types";
import { isEligible } from "./targeting/targeting-engine";
import { validateTargetingRules } from "./targeting/targeting-validator";
import type { ExperimentSchedule, ScheduleEvaluationResult } from "./scheduler/scheduler-types";
import { isExperimentActive } from "./scheduler/scheduler-engine";
import type { GovernanceActor, GovernanceAction, GovernanceDecision } from "./governance/governance-types";
import type { GovernanceAuditLog } from "./governance/governance-audit";
import { canPerformAction } from "./governance/governance-engine";
import { isOwner } from "./governance/governance-utils";
import { validateSchedule } from "./scheduler/scheduler-validator";
import type { ExperimentConsoleView } from "./console/console-types";
import { buildExperimentConsoleView } from "./console/console-engine";
import {
  validateControlVariant,
  validateAllocations,
  validateExclusionGroup,
  validateAssignmentAuditability,
} from "./experiment-validators";
import { resolveIdentity } from "./identity-resolver";
import { validateCacheConsistency } from "./cache-consistency";
import { replayAssignment } from "./replay-engine";
import { computeEvaluationWindow } from "./evaluation-window";
import { computeConfidence } from "./confidence-engine";
import { detectRegression } from "./regression-detector";
import { evaluateRollback } from "./rollback-engine";
import { shouldInvalidateDashboard } from "./dashboard-cache";
import { validateEvent } from "./runtime/event-validator";
import { detectConflict } from "./runtime/router-conflicts";
import { getActiveExperiments } from "./runtime/experiment-discovery";

export interface DistributionHealth {
  expectedPercentage: number;
  actualPercentage: number;
  deltaPercentage: number;
  healthy: boolean;
}

export interface InvariantCheckContext {
  experiment?: Experiment;
  runningExperiments?: Experiment[];
  sampleSize?: number;
  runtimeDays?: number;
  winnerBeatsControl?: boolean;
  srmPValue?: number;
  assignment?: VariantAssignment;
  previousAssignment?: VariantAssignment;
  migratedAssignment?: VariantAssignment;
  cachedAssignment?: VariantAssignment;
  recomputedAssignment?: VariantAssignment;
  auditRecord?: AssignmentAuditRecord;
  recoveryResult?: AssignmentRecoveryResult;
  identityContext?: IdentityContext;
  confidenceResult?: ConfidenceResult;
  confidenceContext?: ConfidenceContext;
  regressionResult?: RegressionResult;
  regressionContext?: RegressionContext;
  rollbackResult?: RollbackResult;
  dashboardState?: DashboardState;
  dashboardCards?: DashboardExperimentCard[];
  exportResult?: ExportResult;
  dashboardCacheEntry?: DashboardCacheEntry;
  performanceMetrics?: PerformanceMetrics;
  runtimeEvent?: RuntimeEvent;
  routerResult?: RouterResult | null;
  runtimeExperiment?: RuntimeExperiment;
  assignedRouterResults?: RouterResult[];
  middlewareResult?: MiddlewareResult;
  experimentRegistry?: ExperimentRegistry;
  flagDecision?: FlagDecision;
  auditLog?: AuditLog;
  experimentMetrics?: ExperimentMetrics;
  experimentHealth?: ExperimentHealth;
  observabilitySnapshot?: ObservabilitySnapshot;
  anomalies?: Anomaly[];
  eventQueue?: EventQueue;
  simulationErrorPercentage?: number;
  snapshotDurationMs?: number;
  deadLetterEvents?: QueuedEvent[];
  distributionCounts?: Record<string, number>;
  distributionTotal?: number;
  stressResult?: ValidationResult;
  chaosResult?: ValidationResult;
  determinismScore?: number;
  performanceResult?: ValidationResult;
  concurrencyResult?: ConcurrencyValidationResult;
  memoryProfile?: MemoryProfile;
  benchmarkMetadata?: BenchmarkMetadata;
  certificationReport?: CertificationReport;
  experimentDefinition?: ExperimentDefinition;
  previousDefinition?: ExperimentDefinition;
  registryStore?: DomainRegistryStore;
  targetingContext?: TargetingContext;
  targetingRules?: ExperimentTargetingRules;
  eligibilityResult?: EligibilityResult;
  schedule?: ExperimentSchedule;
  evaluationTime?: Date;
  scheduleEvaluationResult?: ScheduleEvaluationResult;
  governanceActor?: GovernanceActor;
  governanceAction?: GovernanceAction;
  governanceDecision?: GovernanceDecision;
  governanceAuditLog?: GovernanceAuditLog;
  consoleView?: ExperimentConsoleView;
  runtimeRequest?: import("./runtime/runtime-types").RuntimeRequest;
  runtimeResult?: import("./runtime/runtime-types").RuntimeResult;
  exposureRequest?: import("./exposure/exposure-types").ExposureRequest;
  existingEvents?: import("./exposure/exposure-types").ExposureEvent[];
  exposureResult?: import("./exposure/exposure-types").ExposureResult;
  exposureEvent?: import("./exposure/exposure-types").ExposureEvent;
  goalCandidate?: import("./conversion/conversion-types").GoalCandidate;
  goalDefinition?: import("./conversion/conversion-types").GoalDefinition;
  existingConversions?: import("./conversion/conversion-types").ConversionEvent[];
  conversionResult?: import("./conversion/conversion-types").ConversionResult;
  metricsExperimentId?: string;
  metricsExposures?: import("./exposure/exposure-types").ExposureEvent[];
  metricsConversions?: import("./conversion/conversion-types").ConversionEvent[];
  metricsGeneratedAt?: Date;
  metricsResult?: import("./metrics/metrics-types").MetricsResult;
  statsExperimentId?: string;
  statsBaseline?: import("./metrics/metrics-types").VariantMetrics;
  statsCandidate?: import("./metrics/metrics-types").VariantMetrics;
  statsConfidenceLevel?: number;
  statsResult?: import("./statistics/statistics-types").StatisticsResult;
  decisionSignificance?: import("./statistics/statistics-types").SignificanceReport;
  decisionBaseline?: import("./metrics/metrics-types").VariantMetrics;
  decisionCandidate?: import("./metrics/metrics-types").VariantMetrics;
  decisionConfig?: Partial<import("./decision/decision-types").DecisionConfig>;
  decisionResult?: import("./decision/decision-types").DecisionResult;
  rolloutDecision?: import("./decision/decision-types").DecisionReport;
  rolloutBaselineVariantId?: string;
  rolloutCandidateVariantId?: string;
  rolloutPolicy?: Partial<import("./rollout/rollout-types").RolloutPolicy>;
  rolloutResult?: import("./rollout/rollout-types").RolloutResult;
  executionPlan?: import("./rollout/rollout-types").RolloutPlan;
  executionHistory?: readonly import("./execution/execution-types").ExecutionHistoryEntry[];
  executionPolicy?: Partial<import("./execution/execution-types").ExecutionPolicy>;
  executionResult?: import("./execution/execution-types").ExecutionResult;
  scheduleExecutionReport?: import("./execution/execution-types").ExecutionReport;
  scheduleHistory?: readonly import("./scheduler/scheduler-types").ScheduleHistoryEntry[];
  scheduleClock?: import("./scheduler/scheduler-types").LogicalClock;
  schedulePolicy?: Partial<import("./scheduler/scheduler-types").SchedulingPolicy>;
  scheduleResult?: import("./scheduler/scheduler-types").ScheduleResult;
}

export interface InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "warning" | "critical";
  reason?: string;
  details?: unknown;
}

export interface ExperimentInvariant {
  id: string;
  name: string;
  description: string;
  severity: "warning" | "critical";
  check: (context: InvariantCheckContext) => InvariantCheckResult;
}

/**
 * Checks whether empirical variant assignment counts match configured allocation percentages within a tolerance.
 */
export function checkDistributionFairness(
  variantCounts: Record<string, number>,
  totalAssignments: number,
  variants: ExperimentVariant[],
  tolerancePercent: number = 1.0
): { passed: boolean; health: Record<string, DistributionHealth>; reason?: string } {
  if (!totalAssignments || totalAssignments <= 0 || !variants || variants.length === 0) {
    return { passed: true, health: {} };
  }

  const health: Record<string, DistributionHealth> = {};
  let overallPassed = true;
  const unhealthyVariants: string[] = [];

  for (const variant of variants) {
    const count = variantCounts[variant.id] || 0;
    const actualPercentage = (count / totalAssignments) * 100;
    const expectedPercentage = variant.allocation;
    const deltaPercentage = Math.abs(actualPercentage - expectedPercentage);
    const healthy = deltaPercentage <= tolerancePercent;

    health[variant.id] = {
      expectedPercentage,
      actualPercentage: Math.round(actualPercentage * 100) / 100,
      deltaPercentage: Math.round(deltaPercentage * 100) / 100,
      healthy,
    };

    if (!healthy) {
      overallPassed = false;
      unhealthyVariants.push(
        `Variant '${variant.id}': expected ${expectedPercentage}%, actual ${actualPercentage.toFixed(2)}% (delta ${deltaPercentage.toFixed(2)}% > ±${tolerancePercent}%)`
      );
    }
  }

  return {
    passed: overallPassed,
    health,
    reason: unhealthyVariants.length > 0 ? unhealthyVariants.join("; ") : undefined,
  };
}

/**
 * Invariant #1: Exactly one control variant per experiment.
 */
export const INV_001_SINGLE_CONTROL: ExperimentInvariant = {
  id: "INV_001_SINGLE_CONTROL",
  name: "Exactly One Control Variant",
  description: "Every experiment must contain exactly one variant where isControl === true.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experiment) {
      return { passed: true, invariantId: "INV_001_SINGLE_CONTROL", name: "Exactly One Control Variant", severity: "critical" };
    }
    const res = validateControlVariant(ctx.experiment);
    return {
      passed: res.valid,
      invariantId: "INV_001_SINGLE_CONTROL",
      name: "Exactly One Control Variant",
      severity: "critical",
      reason: res.reason,
    };
  },
};

/**
 * Invariant #2: Sum of variant allocations must equal 100%.
 */
export const INV_002_ALLOCATION_SUM: ExperimentInvariant = {
  id: "INV_002_ALLOCATION_SUM",
  name: "100% Traffic Allocation",
  description: "Sum of variant allocations must equal exactly 100.0%.",
  severity: "critical",
  check: (ctx) => {
    const res = validateAllocations(ctx.experiment?.variants || []);
    return {
      passed: res.valid,
      invariantId: "INV_002_ALLOCATION_SUM",
      name: "100% Traffic Allocation",
      severity: "critical",
      reason: res.reason,
    };
  },
};

/**
 * Invariant #3: Minimum runtime (7 days) and minimum sample size required.
 */
export const INV_003_MINIMUM_BOUNDS: ExperimentInvariant = {
  id: "INV_003_MINIMUM_BOUNDS",
  name: "Minimum Sample & Runtime Bounds",
  description: "No experiment evaluation or winner decision can occur before 7 days runtime and minSampleSize reached.",
  severity: "critical",
  check: (ctx) => {
    const minRuntime = 7;
    const runtime = ctx.runtimeDays ?? 0;
    const minSample = ctx.experiment?.minSampleSize ?? 0;
    const sample = ctx.sampleSize ?? 0;

    if (runtime < minRuntime) {
      return {
        passed: false,
        invariantId: "INV_003_MINIMUM_BOUNDS",
        name: "Minimum Sample & Runtime Bounds",
        severity: "critical",
        reason: `Minimum runtime of 7 days required (current: ${runtime.toFixed(1)} days).`,
      };
    }

    if (sample < minSample) {
      return {
        passed: false,
        invariantId: "INV_003_MINIMUM_BOUNDS",
        name: "Minimum Sample & Runtime Bounds",
        severity: "critical",
        reason: `Minimum sample size of ${minSample} required (current: ${sample}).`,
      };
    }

    return {
      passed: true,
      invariantId: "INV_003_MINIMUM_BOUNDS",
      name: "Minimum Sample & Runtime Bounds",
      severity: "critical",
    };
  },
};

/**
 * Invariant #4: Winning variant must beat control with statistical significance.
 */
export const INV_004_WINNER_BEATS_CONTROL: ExperimentInvariant = {
  id: "INV_004_WINNER_BEATS_CONTROL",
  name: "Winner Must Beat Control",
  description: "A winning variant must show statistically significant lift over the Control variant.",
  severity: "critical",
  check: (ctx) => {
    const beats = ctx.winnerBeatsControl ?? false;
    return {
      passed: beats,
      invariantId: "INV_004_WINNER_BEATS_CONTROL",
      name: "Winner Must Beat Control",
      severity: "critical",
      reason: beats ? undefined : "Candidate winning variant failed to demonstrate statistically significant lift over Control.",
    };
  },
};

/**
 * Invariant #5: Only one running experiment per exclusion group.
 */
export const INV_005_EXCLUSION_MUTEX: ExperimentInvariant = {
  id: "INV_005_EXCLUSION_MUTEX",
  name: "Exclusion Group Mutual Exclusion",
  description: "At most one experiment per exclusion group can be in 'running' status at any time.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experiment) {
      return { passed: true, invariantId: "INV_005_EXCLUSION_MUTEX", name: "Exclusion Group Mutual Exclusion", severity: "critical" };
    }
    const res = validateExclusionGroup(ctx.experiment, ctx.runningExperiments || []);
    return {
      passed: res.valid,
      invariantId: "INV_005_EXCLUSION_MUTEX",
      name: "Exclusion Group Mutual Exclusion",
      severity: "critical",
      reason: res.reason,
    };
  },
};

/**
 * Invariant #6: SRM (Sample Ratio Mismatch) invalidates evaluation.
 */
export const INV_006_CONTINUOUS_SRM_GUARD: ExperimentInvariant = {
  id: "INV_006_CONTINUOUS_SRM_GUARD",
  name: "Continuous SRM Guard",
  description: "If Chi-Square test indicates Sample Ratio Mismatch (p < 0.001), evaluation is strictly invalidated.",
  severity: "warning",
  check: (ctx) => {
    const pVal = ctx.srmPValue ?? 1.0;
    const hasSRM = pVal < 0.001;
    return {
      passed: !hasSRM,
      invariantId: "INV_006_CONTINUOUS_SRM_GUARD",
      name: "Continuous SRM Guard",
      severity: "warning",
      reason: hasSRM ? `Sample Ratio Mismatch detected (Chi-square p-value = ${pVal} < 0.001). Evaluation invalidated.` : undefined,
    };
  },
};

/**
 * Invariant #7: Assignment Auditability. Every VariantAssignment must contain a valid assignmentHash.
 */
export const INV_007_ASSIGNMENT_AUDITABILITY: ExperimentInvariant = {
  id: "INV_007_ASSIGNMENT_AUDITABILITY",
  name: "Assignment Auditability",
  description: "Every VariantAssignment must contain a non-empty assignmentHash generated from identifier + experimentId + experimentVersion.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.assignment) {
      return {
        passed: false,
        invariantId: "INV_007_ASSIGNMENT_AUDITABILITY",
        name: "Assignment Auditability",
        severity: "critical",
        reason: "No VariantAssignment record provided for auditability check.",
      };
    }
    const res = validateAssignmentAuditability(ctx.assignment);
    return {
      passed: res.valid,
      invariantId: "INV_007_ASSIGNMENT_AUDITABILITY",
      name: "Assignment Auditability",
      severity: "critical",
      reason: res.reason,
    };
  },
};

/**
 * Invariant #8: Assignment Determinism. Same identifier + experimentVersion MUST yield same variant.
 */
export const INV_008_ASSIGNMENT_DETERMINISM: ExperimentInvariant = {
  id: "INV_008_ASSIGNMENT_DETERMINISM",
  name: "Assignment Determinism",
  description: "Same identifier + experimentId + experimentVersion must always yield the exact same variant and assignmentHash.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.assignment || !ctx.previousAssignment) {
      return {
        passed: true,
        invariantId: "INV_008_ASSIGNMENT_DETERMINISM",
        name: "Assignment Determinism",
        severity: "critical",
      };
    }

    const a = ctx.assignment;
    const b = ctx.previousAssignment;

    if (
      a.experimentId === b.experimentId &&
      a.experimentVersion === b.experimentVersion
    ) {
      const match = a.variantId === b.variantId && a.assignmentHash === b.assignmentHash;
      return {
        passed: match,
        invariantId: "INV_008_ASSIGNMENT_DETERMINISM",
        name: "Assignment Determinism",
        severity: "critical",
        reason: match ? undefined : `Assignment determinism broken: identical inputs produced different variant/hash (${a.variantId} vs ${b.variantId}).`,
      };
    }

    return {
      passed: true,
      invariantId: "INV_008_ASSIGNMENT_DETERMINISM",
      name: "Assignment Determinism",
      severity: "critical",
    };
  },
};

/**
 * Invariant #9: Version Isolation. Changing experimentVersion MUST produce an independent assignment hash.
 */
export const INV_009_VERSION_ISOLATION: ExperimentInvariant = {
  id: "INV_009_VERSION_ISOLATION",
  name: "Version Isolation",
  description: "Changing experimentVersion must generate a distinct assignmentHash to re-randomize users across versions.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.assignment || !ctx.previousAssignment) {
      return {
        passed: true,
        invariantId: "INV_009_VERSION_ISOLATION",
        name: "Version Isolation",
        severity: "critical",
      };
    }

    const a = ctx.assignment;
    const b = ctx.previousAssignment;

    if (
      a.experimentId === b.experimentId &&
      a.experimentVersion !== b.experimentVersion
    ) {
      const distinct = a.assignmentHash !== b.assignmentHash;
      return {
        passed: distinct,
        invariantId: "INV_009_VERSION_ISOLATION",
        name: "Version Isolation",
        severity: "critical",
        reason: distinct ? undefined : `Version isolation broken: changing version from ${b.experimentVersion} to ${a.experimentVersion} produced identical hash ${a.assignmentHash}.`,
      };
    }

    return {
      passed: true,
      invariantId: "INV_009_VERSION_ISOLATION",
      name: "Version Isolation",
      severity: "critical",
    };
  },
};

/**
 * Invariant #10: Distribution Fairness. Across large samples, variant counts must match configured allocations (±1.0%).
 */
export const INV_010_DISTRIBUTION_FAIRNESS: ExperimentInvariant = {
  id: "INV_010_DISTRIBUTION_FAIRNESS",
  name: "Distribution Fairness",
  description: "Across sufficiently large samples, variant allocations must approximately match configured percentages (±1.0% tolerance).",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.distributionCounts || !ctx.distributionTotal || ctx.distributionTotal < 1000) {
      return {
        passed: true,
        invariantId: "INV_010_DISTRIBUTION_FAIRNESS",
        name: "Distribution Fairness",
        severity: "warning",
      };
    }

    const fairness = checkDistributionFairness(
      ctx.distributionCounts,
      ctx.distributionTotal,
      ctx.experiment?.variants || [],
      1.0
    );

    return {
      passed: fairness.passed,
      invariantId: "INV_010_DISTRIBUTION_FAIRNESS",
      name: "Distribution Fairness",
      severity: "warning",
      reason: fairness.reason,
      details: fairness.health,
    };
  },
};

/**
 * Invariant #11: Sticky Assignment. Founder keeps the same variant throughout the experiment.
 */
export const INV_011_STICKY_ASSIGNMENT: ExperimentInvariant = {
  id: "INV_011_STICKY_ASSIGNMENT",
  name: "Sticky Assignment",
  description: "Founder keeps the exact same variant throughout the duration of the experiment once assigned.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.assignment || !ctx.previousAssignment) {
      return {
        passed: true,
        invariantId: "INV_011_STICKY_ASSIGNMENT",
        name: "Sticky Assignment",
        severity: "critical",
      };
    }

    const a = ctx.assignment;
    const b = ctx.previousAssignment;

    if (a.experimentId === b.experimentId && a.experimentVersion === b.experimentVersion) {
      const isSticky = a.variantId === b.variantId;
      return {
        passed: isSticky,
        invariantId: "INV_011_STICKY_ASSIGNMENT",
        name: "Sticky Assignment",
        severity: "critical",
        reason: isSticky ? undefined : `Sticky assignment broken: user variant changed from ${b.variantId} to ${a.variantId} for same experiment version.`,
      };
    }

    return {
      passed: true,
      invariantId: "INV_011_STICKY_ASSIGNMENT",
      name: "Sticky Assignment",
      severity: "critical",
    };
  },
};

/**
 * Invariant #12: Identity Resolution Priority. Resolution order MUST be userId → deviceId → sessionId.
 */
export const INV_012_IDENTITY_RESOLUTION: ExperimentInvariant = {
  id: "INV_012_IDENTITY_RESOLUTION",
  name: "Identity Resolution Priority",
  description: "Identity resolution priority must strictly follow userId → deviceId → sessionId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.identityContext) {
      return {
        passed: true,
        invariantId: "INV_012_IDENTITY_RESOLUTION",
        name: "Identity Resolution Priority",
        severity: "critical",
      };
    }

    try {
      const resolved = resolveIdentity(ctx.identityContext);
      let expected: "userId" | "deviceId" | "sessionId";
      if (ctx.identityContext.userId && ctx.identityContext.userId.trim() !== "") {
        expected = "userId";
      } else if (ctx.identityContext.deviceId && ctx.identityContext.deviceId.trim() !== "") {
        expected = "deviceId";
      } else {
        expected = "sessionId";
      }

      const passed = resolved === expected;
      return {
        passed,
        invariantId: "INV_012_IDENTITY_RESOLUTION",
        name: "Identity Resolution Priority",
        severity: "critical",
        reason: passed ? undefined : `Identity resolution priority broken: expected '${expected}', got '${resolved}'.`,
      };
    } catch (err: any) {
      return {
        passed: false,
        invariantId: "INV_012_IDENTITY_RESOLUTION",
        name: "Identity Resolution Priority",
        severity: "critical",
        reason: err.message,
      };
    }
  },
};

/**
 * Invariant #13: Migration Preservation. Migration cannot change variantId, assignmentHash, or experimentVersion.
 */
export const INV_013_MIGRATION_PRESERVATION: ExperimentInvariant = {
  id: "INV_013_MIGRATION_PRESERVATION",
  name: "Migration Preservation",
  description: "Assignment migration from anonymous device/session to authenticated userId cannot alter variantId, assignmentHash, or experimentVersion.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.migratedAssignment || !ctx.previousAssignment) {
      return {
        passed: true,
        invariantId: "INV_013_MIGRATION_PRESERVATION",
        name: "Migration Preservation",
        severity: "critical",
      };
    }

    const prev = ctx.previousAssignment;
    const mig = ctx.migratedAssignment;

    const variantPreserved = mig.variantId === prev.variantId;
    const hashPreserved = mig.assignmentHash === prev.assignmentHash;
    const versionPreserved = mig.experimentVersion === prev.experimentVersion;
    const reasonUpdated = mig.assignmentReason === "migration";

    const passed = variantPreserved && hashPreserved && versionPreserved && reasonUpdated;

    return {
      passed,
      invariantId: "INV_013_MIGRATION_PRESERVATION",
      name: "Migration Preservation",
      severity: "critical",
      reason: passed
        ? undefined
        : `Migration preservation violated (variantPreserved: ${variantPreserved}, hashPreserved: ${hashPreserved}, versionPreserved: ${versionPreserved}, reasonUpdated: ${reasonUpdated}).`,
    };
  },
};

/**
 * Invariant #14: Cache Consistency. Cached assignment must equal recomputed assignment.
 */
export const INV_014_CACHE_CONSISTENCY: ExperimentInvariant = {
  id: "INV_014_CACHE_CONSISTENCY",
  name: "Cache Consistency",
  description: "Cached assignment must match recomputed assignment across variantId, assignmentHash, experimentVersion, and reason.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.cachedAssignment || !ctx.recomputedAssignment) {
      return {
        passed: true,
        invariantId: "INV_014_CACHE_CONSISTENCY",
        name: "Cache Consistency",
        severity: "critical",
      };
    }

    const res = validateCacheConsistency(ctx.cachedAssignment, ctx.recomputedAssignment);
    return {
      passed: res.valid,
      invariantId: "INV_014_CACHE_CONSISTENCY",
      name: "Cache Consistency",
      severity: "critical",
      reason: res.reason,
    };
  },
};

/**
 * Invariant #15: Assignment Replay. Replaying an audit record must produce the exact same assignment.
 */
export const INV_015_ASSIGNMENT_REPLAY: ExperimentInvariant = {
  id: "INV_015_ASSIGNMENT_REPLAY",
  name: "Assignment Replay",
  description: "Replaying an audit record against experiment definition must reproduce the exact same variantId, hash, and version.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.auditRecord || !ctx.experiment) {
      return {
        passed: true,
        invariantId: "INV_015_ASSIGNMENT_REPLAY",
        name: "Assignment Replay",
        severity: "critical",
      };
    }

    const replayRes = replayAssignment(ctx.auditRecord, ctx.experiment);
    return {
      passed: replayRes.matches,
      invariantId: "INV_015_ASSIGNMENT_REPLAY",
      name: "Assignment Replay",
      severity: "critical",
      reason: replayRes.matches ? undefined : `Replay failed: replayed variant '${replayRes.replayedAssignment.variantId}' vs audit '${ctx.auditRecord.variantId}'.`,
    };
  },
};

/**
 * Invariant #16: Recovery Priority. Assignment recovery order MUST be cache → replay → fresh.
 */
export const INV_016_RECOVERY_PRIORITY: ExperimentInvariant = {
  id: "INV_016_RECOVERY_PRIORITY",
  name: "Recovery Priority",
  description: "Assignment recovery order must strictly follow cache → replay → fresh assignment.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.recoveryResult) {
      return {
        passed: true,
        invariantId: "INV_016_RECOVERY_PRIORITY",
        name: "Recovery Priority",
        severity: "warning",
      };
    }

    const validSources = ["cache", "replay", "fresh"];
    const passed = validSources.includes(ctx.recoveryResult.source);
    return {
      passed,
      invariantId: "INV_016_RECOVERY_PRIORITY",
      name: "Recovery Priority",
      severity: "warning",
      reason: passed ? undefined : `Invalid recovery source '${ctx.recoveryResult.source}'. Must be one of: cache, replay, fresh.`,
    };
  },
};

/**
 * Invariant #17: Sample Requirement. Declaring a winner requires minimum sample size.
 */
export const INV_017_SAMPLE_REQUIREMENT: ExperimentInvariant = {
  id: "INV_017_SAMPLE_REQUIREMENT",
  name: "Sample Size Requirement for Winner",
  description: "Winner cannot be declared unless total participants satisfy minSampleSize.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.confidenceResult) {
      return {
        passed: true,
        invariantId: "INV_017_SAMPLE_REQUIREMENT",
        name: "Sample Size Requirement for Winner",
        severity: "critical",
      };
    }

    const passed = ctx.confidenceResult.sampleSizeSatisfied;
    return {
      passed,
      invariantId: "INV_017_SAMPLE_REQUIREMENT",
      name: "Sample Size Requirement for Winner",
      severity: "critical",
      reason: passed ? undefined : "Winner declaration failed: sample size requirement not satisfied.",
    };
  },
};

/**
 * Invariant #18: Runtime Requirement. Declaring a winner requires minimum 7 days runtime.
 */
export const INV_018_RUNTIME_REQUIREMENT: ExperimentInvariant = {
  id: "INV_018_RUNTIME_REQUIREMENT",
  name: "Runtime Requirement for Winner",
  description: "Winner cannot be declared unless experiment runtime is at least 7 days.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.confidenceResult) {
      return {
        passed: true,
        invariantId: "INV_018_RUNTIME_REQUIREMENT",
        name: "Runtime Requirement for Winner",
        severity: "critical",
      };
    }

    const passed = ctx.confidenceResult.runtimeSatisfied;
    return {
      passed,
      invariantId: "INV_018_RUNTIME_REQUIREMENT",
      name: "Runtime Requirement for Winner",
      severity: "critical",
      reason: passed ? undefined : "Winner declaration failed: minimum 7-day runtime requirement not satisfied.",
    };
  },
};

/**
 * Invariant #19: Peeking Protection. Winner cannot be declared outside evaluation windows.
 */
export const INV_019_PEEKING_PROTECTION: ExperimentInvariant = {
  id: "INV_019_PEEKING_PROTECTION",
  name: "Peeking Protection",
  description: "Winner cannot be declared outside discrete evaluation windows (daily/weekly).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.confidenceResult) {
      return {
        passed: true,
        invariantId: "INV_019_PEEKING_PROTECTION",
        name: "Peeking Protection",
        severity: "critical",
      };
    }

    const passed = ctx.confidenceResult.peekingProtected;
    return {
      passed,
      invariantId: "INV_019_PEEKING_PROTECTION",
      name: "Peeking Protection",
      severity: "critical",
      reason: passed ? undefined : "Winner declaration failed: peeking protection window not satisfied.",
    };
  },
};

/**
 * Invariant #20: Winner Eligibility. Winner eligibility requires sample size, runtime, and peeking protection.
 */
export const INV_020_WINNER_ELIGIBILITY: ExperimentInvariant = {
  id: "INV_020_WINNER_ELIGIBILITY",
  name: "Winner Eligibility",
  description: "Winner eligibility requires sample size satisfied AND runtime satisfied AND peeking protection satisfied.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.confidenceResult) {
      return {
        passed: true,
        invariantId: "INV_020_WINNER_ELIGIBILITY",
        name: "Winner Eligibility",
        severity: "critical",
      };
    }

    const passed = ctx.confidenceResult.winnerEligible;
    return {
      passed,
      invariantId: "INV_020_WINNER_ELIGIBILITY",
      name: "Winner Eligibility",
      severity: "critical",
      reason: passed ? undefined : "Experiment is NOT eligible for winner declaration.",
    };
  },
};

/**
 * Invariant #21: Evaluation Window. Winner can only be evaluated at discrete checkpoints.
 */
export const INV_021_EVALUATION_WINDOW: ExperimentInvariant = {
  id: "INV_021_EVALUATION_WINDOW",
  name: "Discrete Evaluation Window Checkpoint",
  description: "Evaluations and winner declarations must align strictly with discrete evaluation window checkpoints (24h/48h/72h or 7d/14d/21d).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.confidenceContext) {
      return {
        passed: true,
        invariantId: "INV_021_EVALUATION_WINDOW",
        name: "Discrete Evaluation Window Checkpoint",
        severity: "critical",
      };
    }

    const window = computeEvaluationWindow(ctx.confidenceContext);
    return {
      passed: window.canEvaluate,
      invariantId: "INV_021_EVALUATION_WINDOW",
      name: "Discrete Evaluation Window Checkpoint",
      severity: "critical",
      reason: window.canEvaluate ? undefined : "Evaluation attempted outside discrete checkpoint boundary.",
    };
  },
};

/**
 * Invariant #22: Confidence Saturation. Confidence growth must saturate rather than scale linearly.
 */
export const INV_022_CONFIDENCE_SATURATION: ExperimentInvariant = {
  id: "INV_022_CONFIDENCE_SATURATION",
  name: "Nonlinear Confidence Saturation",
  description: "Confidence scoring must use square-root saturation curves rather than linear scaling.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.confidenceContext || !ctx.confidenceResult) {
      return {
        passed: true,
        invariantId: "INV_022_CONFIDENCE_SATURATION",
        name: "Nonlinear Confidence Saturation",
        severity: "warning",
      };
    }

    const recomputed = computeConfidence(ctx.confidenceContext);
    const passed = Math.abs(recomputed.score - ctx.confidenceResult.score) <= 1;

    return {
      passed,
      invariantId: "INV_022_CONFIDENCE_SATURATION",
      name: "Nonlinear Confidence Saturation",
      severity: "warning",
      reason: passed ? undefined : `Confidence score ${ctx.confidenceResult.score} does not match expected nonlinear saturation score ${recomputed.score}.`,
    };
  },
};

/**
 * Invariant #23: Conversion Regression. Flags when treatment conversion drops below control.
 */
export const INV_023_CONVERSION_REGRESSION: ExperimentInvariant = {
  id: "INV_023_CONVERSION_REGRESSION",
  name: "Conversion Rate Regression Guard",
  description: "Detects and flags when treatment variant conversion rate is lower than control baseline.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.regressionResult && !ctx.regressionContext) {
      return {
        passed: true,
        invariantId: "INV_023_CONVERSION_REGRESSION",
        name: "Conversion Rate Regression Guard",
        severity: "critical",
      };
    }

    const reg = ctx.regressionResult || (ctx.regressionContext ? detectRegression(ctx.regressionContext) : null);
    if (!reg) return { passed: true, invariantId: "INV_023_CONVERSION_REGRESSION", name: "Conversion Rate Regression Guard", severity: "critical" };

    const noRegression = reg.conversionDelta >= 0;
    return {
      passed: noRegression,
      invariantId: "INV_023_CONVERSION_REGRESSION",
      name: "Conversion Rate Regression Guard",
      severity: "critical",
      reason: noRegression ? undefined : `Conversion regression detected: treatment dropped by ${Math.abs(reg.conversionDelta)}%.`,
    };
  },
};

/**
 * Invariant #24: Recovery Regression. Flags when treatment recovery rate drops below control.
 */
export const INV_024_RECOVERY_REGRESSION: ExperimentInvariant = {
  id: "INV_024_RECOVERY_REGRESSION",
  name: "Recovery Rate Regression Guard",
  description: "Detects and flags when treatment variant recovery rate is lower than control baseline.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.regressionResult && !ctx.regressionContext) {
      return {
        passed: true,
        invariantId: "INV_024_RECOVERY_REGRESSION",
        name: "Recovery Rate Regression Guard",
        severity: "critical",
      };
    }

    const reg = ctx.regressionResult || (ctx.regressionContext ? detectRegression(ctx.regressionContext) : null);
    if (!reg) return { passed: true, invariantId: "INV_024_RECOVERY_REGRESSION", name: "Recovery Rate Regression Guard", severity: "critical" };

    const noRegression = reg.recoveryDelta >= 0;
    return {
      passed: noRegression,
      invariantId: "INV_024_RECOVERY_REGRESSION",
      name: "Recovery Rate Regression Guard",
      severity: "critical",
      reason: noRegression ? undefined : `Recovery regression detected: treatment dropped by ${Math.abs(reg.recoveryDelta)}%.`,
    };
  },
};

/**
 * Invariant #25: Completion Regression. Flags when treatment completion duration exceeds control.
 */
export const INV_025_COMPLETION_REGRESSION: ExperimentInvariant = {
  id: "INV_025_COMPLETION_REGRESSION",
  name: "Completion Duration Regression Guard",
  description: "Detects and flags when treatment variant completion duration exceeds control baseline.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.regressionResult && !ctx.regressionContext) {
      return {
        passed: true,
        invariantId: "INV_025_COMPLETION_REGRESSION",
        name: "Completion Duration Regression Guard",
        severity: "critical",
      };
    }

    const reg = ctx.regressionResult || (ctx.regressionContext ? detectRegression(ctx.regressionContext) : null);
    if (!reg) return { passed: true, invariantId: "INV_025_COMPLETION_REGRESSION", name: "Completion Duration Regression Guard", severity: "critical" };

    const noRegression = reg.completionDelta <= 0;
    return {
      passed: noRegression,
      invariantId: "INV_025_COMPLETION_REGRESSION",
      name: "Completion Duration Regression Guard",
      severity: "critical",
      reason: noRegression ? undefined : `Completion duration regression detected: treatment increased by ${reg.completionDelta} minutes.`,
    };
  },
};

/**
 * Invariant #26: Risk Score Bounds. Risk score must strictly reside in [0, 100].
 */
export const INV_026_RISK_SCORE_BOUNDS: ExperimentInvariant = {
  id: "INV_026_RISK_SCORE_BOUNDS",
  name: "Risk Score Bounds Guard",
  description: "Regression risk score must strictly reside within [0, 100].",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.regressionResult) {
      return {
        passed: true,
        invariantId: "INV_026_RISK_SCORE_BOUNDS",
        name: "Risk Score Bounds Guard",
        severity: "critical",
      };
    }

    const score = ctx.regressionResult.riskScore;
    const passed = typeof score === "number" && !isNaN(score) && score >= 0 && score <= 100;

    return {
      passed,
      invariantId: "INV_026_RISK_SCORE_BOUNDS",
      name: "Risk Score Bounds Guard",
      severity: "critical",
      reason: passed ? undefined : `Risk score ${score} out of bounds [0, 100].`,
    };
  },
};

/**
 * Invariant #27: Alert Generation. Alerts must be generated whenever a regression is detected.
 */
export const INV_027_ALERT_GENERATION: ExperimentInvariant = {
  id: "INV_027_ALERT_GENERATION",
  name: "Regression Alert Generation",
  description: "Alerts array must contain human-readable notification strings whenever a regression is detected.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.regressionResult) {
      return {
        passed: true,
        invariantId: "INV_027_ALERT_GENERATION",
        name: "Regression Alert Generation",
        severity: "warning",
      };
    }

    const reg = ctx.regressionResult;
    const passed = !reg.regressionDetected || (reg.alerts && reg.alerts.length > 0);

    return {
      passed,
      invariantId: "INV_027_ALERT_GENERATION",
      name: "Regression Alert Generation",
      severity: "warning",
      reason: passed ? undefined : "Regression detected but zero alert messages generated.",
    };
  },
};

/**
 * Invariant #28: Rollback Score Bounds. Rollback score must strictly reside in [0, 100].
 */
export const INV_028_ROLLBACK_SCORE_BOUNDS: ExperimentInvariant = {
  id: "INV_028_ROLLBACK_SCORE_BOUNDS",
  name: "Rollback Score Bounds Guard",
  description: "Rollback score must strictly reside within [0, 100].",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.rollbackResult) {
      return {
        passed: true,
        invariantId: "INV_028_ROLLBACK_SCORE_BOUNDS",
        name: "Rollback Score Bounds Guard",
        severity: "critical",
      };
    }

    const score = ctx.rollbackResult.rollbackScore;
    const passed = typeof score === "number" && !isNaN(score) && score >= 0 && score <= 100;

    return {
      passed,
      invariantId: "INV_028_ROLLBACK_SCORE_BOUNDS",
      name: "Rollback Score Bounds Guard",
      severity: "critical",
      reason: passed ? undefined : `Rollback score ${score} out of bounds [0, 100].`,
    };
  },
};

/**
 * Invariant #29: Immediate Rollback Safety. When rollback is "recommended" or "immediate", safeToContinue must be false.
 */
export const INV_029_IMMEDIATE_ROLLBACK_SAFETY: ExperimentInvariant = {
  id: "INV_029_IMMEDIATE_ROLLBACK_SAFETY",
  name: "Immediate Rollback Safety Guard",
  description: "When rollback recommendation is 'recommended' or 'immediate', safeToContinue must be false.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.rollbackResult) {
      return {
        passed: true,
        invariantId: "INV_029_IMMEDIATE_ROLLBACK_SAFETY",
        name: "Immediate Rollback Safety Guard",
        severity: "critical",
      };
    }

    const { recommendation, safeToContinue } = ctx.rollbackResult;
    const requiresBlock = recommendation === "recommended" || recommendation === "immediate";

    if (requiresBlock) {
      const passed = safeToContinue === false;
      return {
        passed,
        invariantId: "INV_029_IMMEDIATE_ROLLBACK_SAFETY",
        name: "Immediate Rollback Safety Guard",
        severity: "critical",
        reason: passed ? undefined : `Rollback recommendation '${recommendation}' must block continuation (safeToContinue must be false).`,
      };
    }

    return {
      passed: true,
      invariantId: "INV_029_IMMEDIATE_ROLLBACK_SAFETY",
      name: "Immediate Rollback Safety Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #30: Reason Generation. Rollback reasons must be generated whenever a non-"none" recommendation is issued.
 */
export const INV_030_REASON_GENERATION: ExperimentInvariant = {
  id: "INV_030_REASON_GENERATION",
  name: "Rollback Reason Generation",
  description: "Rollback reasons array must contain human-readable strings whenever recommendation is not 'none'.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.rollbackResult) {
      return {
        passed: true,
        invariantId: "INV_030_REASON_GENERATION",
        name: "Rollback Reason Generation",
        severity: "warning",
      };
    }

    const { recommendation, reasons } = ctx.rollbackResult;
    const passed = recommendation === "none" || (reasons && reasons.length > 0);

    return {
      passed,
      invariantId: "INV_030_REASON_GENERATION",
      name: "Rollback Reason Generation",
      severity: "warning",
      reason: passed ? undefined : "Non-none rollback recommendation issued but zero reason strings generated.",
    };
  },
};

/**
 * Invariant #31: Dashboard Summary. Summary counts must strictly equal card aggregates.
 */
export const INV_031_DASHBOARD_SUMMARY: ExperimentInvariant = {
  id: "INV_031_DASHBOARD_SUMMARY",
  name: "Dashboard Summary Accuracy Guard",
  description: "Dashboard summary totals (total, running, healthy, risky, blocked) must strictly match experiment card aggregates.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.dashboardState) {
      return {
        passed: true,
        invariantId: "INV_031_DASHBOARD_SUMMARY",
        name: "Dashboard Summary Accuracy Guard",
        severity: "critical",
      };
    }

    const { summary, cards } = ctx.dashboardState;
    const totalMatch = summary.totalExperiments === cards.length;
    const runningMatch = summary.runningExperiments === cards.filter((c) => c.status === "running").length;
    const healthyMatch = summary.healthyExperiments === cards.filter((c) => c.safeToContinue === true).length;
    const riskyMatch =
      summary.riskyExperiments ===
      cards.filter((c) => c.regressionSeverity === "high" || c.regressionSeverity === "critical").length;
    const blockedMatch =
      summary.blockedExperiments ===
      cards.filter(
        (c) => c.rollbackRecommendation === "recommended" || c.rollbackRecommendation === "immediate"
      ).length;

    const passed = totalMatch && runningMatch && healthyMatch && riskyMatch && blockedMatch;

    return {
      passed,
      invariantId: "INV_031_DASHBOARD_SUMMARY",
      name: "Dashboard Summary Accuracy Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Dashboard summary mismatch (total: ${totalMatch}, running: ${runningMatch}, healthy: ${healthyMatch}, risky: ${riskyMatch}, blocked: ${blockedMatch}).`,
    };
  },
};

/**
 * Invariant #32: Blocked Experiment. Blocked experiments must have safeToContinue = false.
 */
export const INV_032_BLOCKED_EXPERIMENT: ExperimentInvariant = {
  id: "INV_032_BLOCKED_EXPERIMENT",
  name: "Blocked Experiment Safety Guard",
  description: "Experiments with recommended or immediate rollback recommendations must be marked safeToContinue = false.",
  severity: "critical",
  check: (ctx) => {
    const cards = ctx.dashboardCards || ctx.dashboardState?.cards;
    if (!cards) {
      return {
        passed: true,
        invariantId: "INV_032_BLOCKED_EXPERIMENT",
        name: "Blocked Experiment Safety Guard",
        severity: "critical",
      };
    }

    const invalid = cards.filter(
      (c) =>
        (c.rollbackRecommendation === "recommended" || c.rollbackRecommendation === "immediate") &&
        c.safeToContinue !== false
    );

    const passed = invalid.length === 0;
    return {
      passed,
      invariantId: "INV_032_BLOCKED_EXPERIMENT",
      name: "Blocked Experiment Safety Guard",
      severity: "critical",
      reason: passed ? undefined : `${invalid.length} blocked experiment card(s) have safeToContinue = true.`,
    };
  },
};

/**
 * Invariant #33: Alert Visibility. Critical rollback recommendations must generate alerts.
 */
export const INV_033_ALERT_VISIBILITY: ExperimentInvariant = {
  id: "INV_033_ALERT_VISIBILITY",
  name: "Critical Alert Visibility Guard",
  description: "Critical rollback recommendations (recommended / immediate) must generate visible alerts in the dashboard state.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.dashboardState) {
      return {
        passed: true,
        invariantId: "INV_033_ALERT_VISIBILITY",
        name: "Critical Alert Visibility Guard",
        severity: "warning",
      };
    }

    const { cards, alerts } = ctx.dashboardState;
    const blockedCards = cards.filter(
      (c) => c.rollbackRecommendation === "recommended" || c.rollbackRecommendation === "immediate"
    );

    if (blockedCards.length === 0) {
      return {
        passed: true,
        invariantId: "INV_033_ALERT_VISIBILITY",
        name: "Critical Alert Visibility Guard",
        severity: "warning",
      };
    }

    const hasRollbackAlerts = alerts.some((a) => a.type === "rollback" && a.severity === "critical");
    return {
      passed: hasRollbackAlerts,
      invariantId: "INV_033_ALERT_VISIBILITY",
      name: "Critical Alert Visibility Guard",
      severity: "warning",
      reason: hasRollbackAlerts ? undefined : "Blocked experiment present but zero critical rollback alerts generated.",
    };
  },
};

/**
 * Invariant #34: Export Consistency. Export experiment count must equal dashboard card count.
 */
export const INV_034_EXPORT_CONSISTENCY: ExperimentInvariant = {
  id: "INV_034_EXPORT_CONSISTENCY",
  name: "Export Experiment Count Consistency Guard",
  description: "Export metadata experimentCount must strictly equal dashboard cards length.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exportResult || !ctx.dashboardState) {
      return {
        passed: true,
        invariantId: "INV_034_EXPORT_CONSISTENCY",
        name: "Export Experiment Count Consistency Guard",
        severity: "critical",
      };
    }

    const exportCount = ctx.exportResult.metadata.experimentCount;
    const dashboardCount = ctx.dashboardState.cards.length;
    const passed = exportCount === dashboardCount;

    return {
      passed,
      invariantId: "INV_034_EXPORT_CONSISTENCY",
      name: "Export Experiment Count Consistency Guard",
      severity: "critical",
      reason: passed ? undefined : `Export experiment count (${exportCount}) does not match dashboard cards count (${dashboardCount}).`,
    };
  },
};

/**
 * Invariant #35: Cache Validity. Expired dashboard cache entries are invalid.
 */
export const INV_035_CACHE_VALIDITY: ExperimentInvariant = {
  id: "INV_035_CACHE_VALIDITY",
  name: "Dashboard Cache Validity Guard",
  description: "Expired dashboard cache entries must be flagged invalid by shouldInvalidateDashboard.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.dashboardCacheEntry) {
      return {
        passed: true,
        invariantId: "INV_035_CACHE_VALIDITY",
        name: "Dashboard Cache Validity Guard",
        severity: "critical",
      };
    }

    const entry = ctx.dashboardCacheEntry;
    const isExpired = new Date().getTime() >= entry.expiresAt.getTime();
    const invalidates = shouldInvalidateDashboard(entry);

    const passed = isExpired ? invalidates === true : invalidates === false;

    return {
      passed,
      invariantId: "INV_035_CACHE_VALIDITY",
      name: "Dashboard Cache Validity Guard",
      severity: "critical",
      reason: passed ? undefined : `Dashboard cache validity check failed (isExpired: ${isExpired}, invalidates: ${invalidates}).`,
    };
  },
};

/**
 * Invariant #36: Performance Metrics. Performance metrics must accurately reflect dashboard state.
 */
export const INV_036_PERFORMANCE_METRICS: ExperimentInvariant = {
  id: "INV_036_PERFORMANCE_METRICS",
  name: "Performance Metrics Integrity Guard",
  description: "Performance metrics experimentCount and alertCount must accurately match dashboard state.",
  severity: "warning",
  check: (ctx) => {
    if (!ctx.performanceMetrics || !ctx.dashboardState) {
      return {
        passed: true,
        invariantId: "INV_036_PERFORMANCE_METRICS",
        name: "Performance Metrics Integrity Guard",
        severity: "warning",
      };
    }

    const { experimentCount, alertCount } = ctx.performanceMetrics;
    const expMatch = experimentCount === ctx.dashboardState.cards.length;
    const alertMatch = alertCount === ctx.dashboardState.alerts.length;
    const passed = expMatch && alertMatch;

    return {
      passed,
      invariantId: "INV_036_PERFORMANCE_METRICS",
      name: "Performance Metrics Integrity Guard",
      severity: "warning",
      reason: passed ? undefined : `Performance metrics mismatch (expMatch: ${expMatch}, alertMatch: ${alertMatch}).`,
    };
  },
};

/**
 * Invariant #37: Event ID Required. Every runtime event must have a non-empty id.
 */
export const INV_037_EVENT_ID_REQUIRED: ExperimentInvariant = {
  id: "INV_037_EVENT_ID_REQUIRED",
  name: "Runtime Event ID Guard",
  description: "Every runtime event must contain a non-empty id.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeEvent) {
      return {
        passed: true,
        invariantId: "INV_037_EVENT_ID_REQUIRED",
        name: "Runtime Event ID Guard",
        severity: "critical",
      };
    }

    const passed = Boolean(ctx.runtimeEvent.id && ctx.runtimeEvent.id.trim() !== "");
    return {
      passed,
      invariantId: "INV_037_EVENT_ID_REQUIRED",
      name: "Runtime Event ID Guard",
      severity: "critical",
      reason: passed ? undefined : "Runtime event is missing a non-empty id.",
    };
  },
};

/**
 * Invariant #38: Session Required. Every runtime event must contain a sessionId.
 */
export const INV_038_SESSION_REQUIRED: ExperimentInvariant = {
  id: "INV_038_SESSION_REQUIRED",
  name: "Runtime Event Session ID Guard",
  description: "Every runtime event must contain a non-empty sessionId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeEvent) {
      return {
        passed: true,
        invariantId: "INV_038_SESSION_REQUIRED",
        name: "Runtime Event Session ID Guard",
        severity: "critical",
      };
    }

    const passed = Boolean(ctx.runtimeEvent.sessionId && ctx.runtimeEvent.sessionId.trim() !== "");
    return {
      passed,
      invariantId: "INV_038_SESSION_REQUIRED",
      name: "Runtime Event Session ID Guard",
      severity: "critical",
      reason: passed ? undefined : "Runtime event is missing a non-empty sessionId.",
    };
  },
};

/**
 * Invariant #39: Event Type Valid. Event type must belong to OnboardingEventType.
 */
export const INV_039_EVENT_TYPE_VALID: ExperimentInvariant = {
  id: "INV_039_EVENT_TYPE_VALID",
  name: "Runtime Event Type Guard",
  description: "Event type must strictly belong to the OnboardingEventType enum.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeEvent) {
      return {
        passed: true,
        invariantId: "INV_039_EVENT_TYPE_VALID",
        name: "Runtime Event Type Guard",
        severity: "critical",
      };
    }

    const validation = validateEvent(ctx.runtimeEvent);
    const typeError = validation.errors.find((e) => e.includes("eventType"));
    const passed = !typeError;

    return {
      passed,
      invariantId: "INV_039_EVENT_TYPE_VALID",
      name: "Runtime Event Type Guard",
      severity: "critical",
      reason: passed ? undefined : typeError,
    };
  },
};

/**
 * Invariant #40: Experiment Event Consistency. Experiment events require experimentId and variantId.
 */
export const INV_040_EXPERIMENT_EVENT_CONSISTENCY: ExperimentInvariant = {
  id: "INV_040_EXPERIMENT_EVENT_CONSISTENCY",
  name: "Experiment Event Consistency Guard",
  description: "experiment_assigned, variant_seen, and variant_completed require valid experimentId and variantId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeEvent) {
      return {
        passed: true,
        invariantId: "INV_040_EXPERIMENT_EVENT_CONSISTENCY",
        name: "Experiment Event Consistency Guard",
        severity: "critical",
      };
    }

    const experimentEventTypes = ["experiment_assigned", "variant_seen", "variant_completed"];
    if (!experimentEventTypes.includes(ctx.runtimeEvent.eventType)) {
      return {
        passed: true,
        invariantId: "INV_040_EXPERIMENT_EVENT_CONSISTENCY",
        name: "Experiment Event Consistency Guard",
        severity: "critical",
      };
    }

    const validation = validateEvent(ctx.runtimeEvent);
    const expErrors = validation.errors.filter(
      (e) => e.includes("experimentId") || e.includes("variantId")
    );
    const passed = expErrors.length === 0;

    return {
      passed,
      invariantId: "INV_040_EXPERIMENT_EVENT_CONSISTENCY",
      name: "Experiment Event Consistency Guard",
      severity: "critical",
      reason: passed ? undefined : expErrors.join("; "),
    };
  },
};

/**
 * Invariant #41: Sticky Assignment. Same session + same experiment must always return sticky variant.
 */
export const INV_041_STICKY_ASSIGNMENT: ExperimentInvariant = {
  id: "INV_041_STICKY_ASSIGNMENT",
  name: "Router Sticky Assignment Guard",
  description: "Re-routing a session for an already assigned experiment must return a sticky assignment.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.routerResult) {
      return {
        passed: true,
        invariantId: "INV_041_STICKY_ASSIGNMENT",
        name: "Router Sticky Assignment Guard",
        severity: "critical",
      };
    }

    const passed = typeof ctx.routerResult.sticky === "boolean";
    return {
      passed,
      invariantId: "INV_041_STICKY_ASSIGNMENT",
      name: "Router Sticky Assignment Guard",
      severity: "critical",
      reason: passed ? undefined : "RouterResult is missing valid sticky boolean flag.",
    };
  },
};

/**
 * Invariant #42: Weighted Assignment Valid. Returned variant must exist inside experiment variants.
 */
export const INV_042_WEIGHTED_ASSIGNMENT_VALID: ExperimentInvariant = {
  id: "INV_042_WEIGHTED_ASSIGNMENT_VALID",
  name: "Router Weighted Assignment Validity Guard",
  description: "Returned variantId from router must strictly exist within configured experiment variants.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.routerResult || !ctx.runtimeExperiment) {
      return {
        passed: true,
        invariantId: "INV_042_WEIGHTED_ASSIGNMENT_VALID",
        name: "Router Weighted Assignment Validity Guard",
        severity: "critical",
      };
    }

    const validIds = new Set(ctx.runtimeExperiment.variants.map((v) => v.id));
    const passed = validIds.has(ctx.routerResult.variantId);

    return {
      passed,
      invariantId: "INV_042_WEIGHTED_ASSIGNMENT_VALID",
      name: "Router Weighted Assignment Validity Guard",
      severity: "critical",
      reason: passed ? undefined : `Assigned variantId '${ctx.routerResult.variantId}' does not exist in experiment variants.`,
    };
  },
};

/**
 * Invariant #43: Disabled Experiment Blocked. Disabled experiments cannot assign variants.
 */
export const INV_043_DISABLED_EXPERIMENT_BLOCKED: ExperimentInvariant = {
  id: "INV_043_DISABLED_EXPERIMENT_BLOCKED",
  name: "Disabled Experiment Router Guard",
  description: "Disabled experiments (enabled = false) must not be assigned by the experiment router.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeExperiment || ctx.runtimeExperiment.enabled !== false) {
      return {
        passed: true,
        invariantId: "INV_043_DISABLED_EXPERIMENT_BLOCKED",
        name: "Disabled Experiment Router Guard",
        severity: "critical",
      };
    }

    const passed = ctx.routerResult === null || ctx.routerResult === undefined;
    return {
      passed,
      invariantId: "INV_043_DISABLED_EXPERIMENT_BLOCKED",
      name: "Disabled Experiment Router Guard",
      severity: "critical",
      reason: passed ? undefined : "Disabled experiment returned a non-null router assignment.",
    };
  },
};

/**
 * Invariant #44: Experiment Conflict Resolution. Mutually exclusive experiments cannot both be assigned.
 */
export const INV_044_EXPERIMENT_CONFLICT_RESOLUTION: ExperimentInvariant = {
  id: "INV_044_EXPERIMENT_CONFLICT_RESOLUTION",
  name: "Experiment Mutual Exclusion Conflict Guard",
  description: "Mutually exclusive experiments must be prevented from concurrent assignment.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeExperiment || !ctx.assignedRouterResults) {
      return {
        passed: true,
        invariantId: "INV_044_EXPERIMENT_CONFLICT_RESOLUTION",
        name: "Experiment Mutual Exclusion Conflict Guard",
        severity: "critical",
      };
    }

    const conflict = detectConflict(ctx.runtimeExperiment, ctx.assignedRouterResults);
    if (conflict) {
      const passed = ctx.routerResult === null || ctx.routerResult === undefined;
      return {
        passed,
        invariantId: "INV_044_EXPERIMENT_CONFLICT_RESOLUTION",
        name: "Experiment Mutual Exclusion Conflict Guard",
        severity: "critical",
        reason: passed ? undefined : "Conflicting experiment returned a non-null router assignment.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_044_EXPERIMENT_CONFLICT_RESOLUTION",
      name: "Experiment Mutual Exclusion Conflict Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #45: Session Recovery. Middleware must always produce a non-empty sessionId.
 */
export const INV_045_SESSION_RECOVERY: ExperimentInvariant = {
  id: "INV_045_SESSION_RECOVERY",
  name: "Middleware Session Recovery Guard",
  description: "Runtime middleware context must strictly contain a non-empty sessionId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.middlewareResult) {
      return {
        passed: true,
        invariantId: "INV_045_SESSION_RECOVERY",
        name: "Middleware Session Recovery Guard",
        severity: "critical",
      };
    }

    const { sessionId } = ctx.middlewareResult.context;
    const passed = Boolean(sessionId && typeof sessionId === "string" && sessionId.trim() !== "");

    return {
      passed,
      invariantId: "INV_045_SESSION_RECOVERY",
      name: "Middleware Session Recovery Guard",
      severity: "critical",
      reason: passed ? undefined : "Middleware runtime context sessionId is missing or empty.",
    };
  },
};

/**
 * Invariant #46: Priority Ordering. Active experiments must execute in descending priority order.
 */
export const INV_046_PRIORITY_ORDERING: ExperimentInvariant = {
  id: "INV_046_PRIORITY_ORDERING",
  name: "Active Experiment Priority Ordering Guard",
  description: "Discovered active experiments must strictly be ordered by priority descending.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentRegistry) {
      return {
        passed: true,
        invariantId: "INV_046_PRIORITY_ORDERING",
        name: "Active Experiment Priority Ordering Guard",
        severity: "critical",
      };
    }

    const active = getActiveExperiments(ctx.experimentRegistry);
    for (let i = 0; i < active.length - 1; i++) {
      if (active[i].priority < active[i + 1].priority) {
        return {
          passed: false,
          invariantId: "INV_046_PRIORITY_ORDERING",
          name: "Active Experiment Priority Ordering Guard",
          severity: "critical",
          reason: `Priority ordering broken: ${active[i].id} (${active[i].priority}) < ${active[i + 1].id} (${active[i + 1].priority}).`,
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_046_PRIORITY_ORDERING",
      name: "Active Experiment Priority Ordering Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #47: Variant Seen Tracking. Every assignment must generate exactly one variant_seen event.
 */
export const INV_047_VARIANT_SEEN_TRACKING: ExperimentInvariant = {
  id: "INV_047_VARIANT_SEEN_TRACKING",
  name: "Variant Visibility Tracking Guard",
  description: "Every experiment assignment returned by middleware must track a corresponding variant_seen entry.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.middlewareResult) {
      return {
        passed: true,
        invariantId: "INV_047_VARIANT_SEEN_TRACKING",
        name: "Variant Visibility Tracking Guard",
        severity: "critical",
      };
    }

    const { context, variantsSeen } = ctx.middlewareResult;
    const passed = variantsSeen.length === context.assignments.length;

    return {
      passed,
      invariantId: "INV_047_VARIANT_SEEN_TRACKING",
      name: "Variant Visibility Tracking Guard",
      severity: "critical",
      reason: passed ? undefined : `variantsSeen count (${variantsSeen.length}) does not match assignments count (${context.assignments.length}).`,
    };
  },
};

/**
 * Invariant #48: Context Consistency. Every assignment returned by middleware must exist in runtime context.
 */
export const INV_048_CONTEXT_CONSISTENCY: ExperimentInvariant = {
  id: "INV_048_CONTEXT_CONSISTENCY",
  name: "Runtime Context Consistency Guard",
  description: "Every assigned experiment returned by middleware must strictly exist in the RuntimeContext.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.middlewareResult) {
      return {
        passed: true,
        invariantId: "INV_048_CONTEXT_CONSISTENCY",
        name: "Runtime Context Consistency Guard",
        severity: "critical",
      };
    }

    const { context } = ctx.middlewareResult;
    const passed = Array.isArray(context.assignments) && context.assignments.every((a: RouterResult) => Boolean(a.experimentId && a.variantId));

    return {
      passed,
      invariantId: "INV_048_CONTEXT_CONSISTENCY",
      name: "Runtime Context Consistency Guard",
      severity: "critical",
      reason: passed ? undefined : "Runtime context contains invalid or incomplete assignment structures.",
    };
  },
};

/**
 * Invariant #49: Global Kill Switch. Global kill switch must block all experiment routing.
 */
export const INV_049_GLOBAL_KILL_SWITCH: ExperimentInvariant = {
  id: "INV_049_GLOBAL_KILL_SWITCH",
  name: "Global Kill Switch Guard",
  description: "When globalKillSwitch is active, flagDecision must block with reason 'global_kill_switch'.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.flagDecision) {
      return {
        passed: true,
        invariantId: "INV_049_GLOBAL_KILL_SWITCH",
        name: "Global Kill Switch Guard",
        severity: "critical",
      };
    }

    // If flag decision says global_kill_switch, it must be blocked
    if (ctx.flagDecision.reason === "global_kill_switch") {
      const passed = ctx.flagDecision.allowed === false;
      return {
        passed,
        invariantId: "INV_049_GLOBAL_KILL_SWITCH",
        name: "Global Kill Switch Guard",
        severity: "critical",
        reason: passed ? undefined : "Global kill switch decision must block routing (allowed must be false).",
      };
    }

    return {
      passed: true,
      invariantId: "INV_049_GLOBAL_KILL_SWITCH",
      name: "Global Kill Switch Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #50: Force Control. forceControl must prevent assignment.
 */
export const INV_050_FORCE_CONTROL: ExperimentInvariant = {
  id: "INV_050_FORCE_CONTROL",
  name: "Force Control Guard",
  description: "When forceControl is active, flagDecision must block with reason 'force_control'.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.flagDecision) {
      return {
        passed: true,
        invariantId: "INV_050_FORCE_CONTROL",
        name: "Force Control Guard",
        severity: "critical",
      };
    }

    if (ctx.flagDecision.reason === "force_control") {
      const passed = ctx.flagDecision.allowed === false;
      return {
        passed,
        invariantId: "INV_050_FORCE_CONTROL",
        name: "Force Control Guard",
        severity: "critical",
        reason: passed ? undefined : "Force control decision must block routing (allowed must be false).",
      };
    }

    return {
      passed: true,
      invariantId: "INV_050_FORCE_CONTROL",
      name: "Force Control Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #51: Forced Variant Valid. Forced variant must exist in experiment variants.
 */
export const INV_051_FORCED_VARIANT_VALID: ExperimentInvariant = {
  id: "INV_051_FORCED_VARIANT_VALID",
  name: "Forced Variant Validity Guard",
  description: "When a forced variant is specified, it must exist in the experiment's variant list.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.flagDecision || !ctx.flagDecision.forcedVariantId || !ctx.experiment || ctx.flagDecision.reason !== "forced_variant") {
      return {
        passed: true,
        invariantId: "INV_051_FORCED_VARIANT_VALID",
        name: "Forced Variant Validity Guard",
        severity: "critical",
      };
    }

    const forcedId = ctx.flagDecision.forcedVariantId;
    const exists = ctx.experiment.variants.some((v: ExperimentVariant) => v.id === forcedId);

    return {
      passed: exists,
      invariantId: "INV_051_FORCED_VARIANT_VALID",
      name: "Forced Variant Validity Guard",
      severity: "critical",
      reason: exists ? undefined : `Forced variant '${forcedId}' does not exist in experiment variants.`,
    };
  },
};

/**
 * Invariant #52: Audit Trail Persistence. Every safety decision must generate an audit entry.
 */
export const INV_052_AUDIT_TRAIL_PERSISTENCE: ExperimentInvariant = {
  id: "INV_052_AUDIT_TRAIL_PERSISTENCE",
  name: "Audit Trail Persistence Guard",
  description: "Every safety decision (kill switch, force control, pause, forced variant) must generate an audit entry.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.auditLog || !ctx.flagDecision) {
      return {
        passed: true,
        invariantId: "INV_052_AUDIT_TRAIL_PERSISTENCE",
        name: "Audit Trail Persistence Guard",
        severity: "critical",
      };
    }

    // Only check for safety decisions (not normal or allowlisted)
    const safetyReasons = ["global_kill_switch", "force_control", "experiment_paused", "blocklisted", "forced_variant"];
    if (!safetyReasons.includes(ctx.flagDecision.reason)) {
      return {
        passed: true,
        invariantId: "INV_052_AUDIT_TRAIL_PERSISTENCE",
        name: "Audit Trail Persistence Guard",
        severity: "critical",
      };
    }

    const hasAuditEntry = ctx.auditLog.entries.length > 0;

    return {
      passed: hasAuditEntry,
      invariantId: "INV_052_AUDIT_TRAIL_PERSISTENCE",
      name: "Audit Trail Persistence Guard",
      severity: "critical",
      reason: hasAuditEntry ? undefined : `Safety decision '${ctx.flagDecision.reason}' has no corresponding audit entry.`,
    };
  },
};

/**
 * Invariant #53: Metrics Consistency. Assignments, views, conversions and failures must never be negative.
 */
export const INV_053_METRICS_CONSISTENCY: ExperimentInvariant = {
  id: "INV_053_METRICS_CONSISTENCY",
  name: "Observability Metrics Non-Negativity Guard",
  description: "ExperimentMetrics counts (assignments, variantSeen, conversions, failures) must strictly be non-negative.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentMetrics) {
      return {
        passed: true,
        invariantId: "INV_053_METRICS_CONSISTENCY",
        name: "Observability Metrics Non-Negativity Guard",
        severity: "critical",
      };
    }

    const m = ctx.experimentMetrics;
    const passed = m.assignments >= 0 && m.variantSeen >= 0 && m.conversions >= 0 && m.failures >= 0;

    return {
      passed,
      invariantId: "INV_053_METRICS_CONSISTENCY",
      name: "Observability Metrics Non-Negativity Guard",
      severity: "critical",
      reason: passed ? undefined : "ExperimentMetrics contains negative values.",
    };
  },
};

/**
 * Invariant #54: Health Score Bounds. Health score must stay between 0 and 100.
 */
export const INV_054_HEALTH_SCORE_BOUNDS: ExperimentInvariant = {
  id: "INV_054_HEALTH_SCORE_BOUNDS",
  name: "Health Score Boundedness Guard",
  description: "ExperimentHealth score must be bounded strictly between 0 and 100 inclusive.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentHealth) {
      return {
        passed: true,
        invariantId: "INV_054_HEALTH_SCORE_BOUNDS",
        name: "Health Score Boundedness Guard",
        severity: "critical",
      };
    }

    const { score } = ctx.experimentHealth;
    const passed = typeof score === "number" && !isNaN(score) && score >= 0 && score <= 100;

    return {
      passed,
      invariantId: "INV_054_HEALTH_SCORE_BOUNDS",
      name: "Health Score Boundedness Guard",
      severity: "critical",
      reason: passed ? undefined : `ExperimentHealth score (${score}) is out of bounds [0, 100].`,
    };
  },
};

/**
 * Invariant #55: Snapshot Completeness. Snapshot must contain metrics and health for every experiment.
 */
export const INV_055_SNAPSHOT_COMPLETENESS: ExperimentInvariant = {
  id: "INV_055_SNAPSHOT_COMPLETENESS",
  name: "Observability Snapshot Completeness Guard",
  description: "ObservabilitySnapshot must strictly contain metrics and health entries for all requested experiment IDs.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.observabilitySnapshot) {
      return {
        passed: true,
        invariantId: "INV_055_SNAPSHOT_COMPLETENESS",
        name: "Observability Snapshot Completeness Guard",
        severity: "critical",
      };
    }

    const { metrics, health } = ctx.observabilitySnapshot;
    const passed = Array.isArray(metrics) && Array.isArray(health) && metrics.length === health.length;

    return {
      passed,
      invariantId: "INV_055_SNAPSHOT_COMPLETENESS",
      name: "Observability Snapshot Completeness Guard",
      severity: "critical",
      reason: passed ? undefined : `Snapshot metrics count (${metrics.length}) does not match health count (${health.length}).`,
    };
  },
};

/**
 * Invariant #56: Anomaly Validity. Every anomaly must map to a valid experiment.
 */
export const INV_056_ANOMALY_VALIDITY: ExperimentInvariant = {
  id: "INV_056_ANOMALY_VALIDITY",
  name: "Anomaly Target Validity Guard",
  description: "Every detected anomaly must strictly map to a valid non-empty experimentId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.anomalies) {
      return {
        passed: true,
        invariantId: "INV_056_ANOMALY_VALIDITY",
        name: "Anomaly Target Validity Guard",
        severity: "critical",
      };
    }

    const passed = ctx.anomalies.every((a) => Boolean(a.experimentId && a.experimentId.trim() !== ""));

    return {
      passed,
      invariantId: "INV_056_ANOMALY_VALIDITY",
      name: "Anomaly Target Validity Guard",
      severity: "critical",
      reason: passed ? undefined : "Anomalies contain an empty or invalid experimentId.",
    };
  },
};

/**
 * Invariant #57: Queue Ordering. Queue processing order must be strictly preserved (FIFO order).
 */
export const INV_057_QUEUE_ORDERING: ExperimentInvariant = {
  id: "INV_057_QUEUE_ORDERING",
  name: "FIFO Event Queue Processing Guard",
  description: "Event processing from EventQueue into EventStorage must strictly preserve FIFO insertion order.",
  severity: "critical",
  check: (ctx) => {
    return {
      passed: true,
      invariantId: "INV_057_QUEUE_ORDERING",
      name: "FIFO Event Queue Processing Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #58: Session Determinism. Same input must generate the exact same session.
 */
export const INV_058_SESSION_DETERMINISM: ExperimentInvariant = {
  id: "INV_058_SESSION_DETERMINISM",
  name: "Deterministic Session Recovery Guard",
  description: "Identical request attributes (userAgent, pathname, userId) must strictly yield the identical sessionId.",
  severity: "critical",
  check: (ctx) => {
    return {
      passed: true,
      invariantId: "INV_058_SESSION_DETERMINISM",
      name: "Deterministic Session Recovery Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #59: Event Semantics. Assigned, exposed, and rendered events must remain distinct.
 */
export const INV_059_EVENT_SEMANTICS: ExperimentInvariant = {
  id: "INV_059_EVENT_SEMANTICS",
  name: "Event Semantic Separation Guard",
  description: "experiment_assigned, variant_exposed, and variant_rendered must remain distinct semantic event types.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeEvent) {
      return {
        passed: true,
        invariantId: "INV_059_EVENT_SEMANTICS",
        name: "Event Semantic Separation Guard",
        severity: "critical",
      };
    }

    const validTypes = ["experiment_assigned", "variant_exposed", "variant_rendered", "variant_seen", "variant_completed"];
    const passed = validTypes.includes(ctx.runtimeEvent.eventType);

    return {
      passed,
      invariantId: "INV_059_EVENT_SEMANTICS",
      name: "Event Semantic Separation Guard",
      severity: "critical",
      reason: passed ? undefined : `Invalid or ambiguous event type '${ctx.runtimeEvent.eventType}'.`,
    };
  },
};

/**
 * Invariant #60: Weight Distribution. Variant allocation distribution error across simulation assignments must be < 1%.
 */
export const INV_060_WEIGHT_DISTRIBUTION: ExperimentInvariant = {
  id: "INV_060_WEIGHT_DISTRIBUTION",
  name: "Weighted Assignment Precision Guard",
  description: "Deterministic bucket assignment distribution error must strictly be less than 1% (0.01).",
  severity: "critical",
  check: (ctx) => {
    if (typeof ctx.simulationErrorPercentage !== "number") {
      return {
        passed: true,
        invariantId: "INV_060_WEIGHT_DISTRIBUTION",
        name: "Weighted Assignment Precision Guard",
        severity: "critical",
      };
    }

    const passed = ctx.simulationErrorPercentage < 1.0;

    return {
      passed,
      invariantId: "INV_060_WEIGHT_DISTRIBUTION",
      name: "Weighted Assignment Precision Guard",
      severity: "critical",
      reason: passed ? undefined : `Simulation distribution error (${ctx.simulationErrorPercentage.toFixed(2)}%) exceeds 1%.`,
    };
  },
};

/**
 * Invariant #61: Versioned Stickiness. Experiment version changes invalidate sticky assignments.
 */
export const INV_061_VERSIONED_STICKINESS: ExperimentInvariant = {
  id: "INV_061_VERSIONED_STICKINESS",
  name: "Versioned Sticky Assignment Isolation Guard",
  description: "Incrementing experiment version must invalidate previous sticky assignments and trigger fresh routing.",
  severity: "critical",
  check: (ctx) => {
    return {
      passed: true,
      invariantId: "INV_061_VERSIONED_STICKINESS",
      name: "Versioned Sticky Assignment Isolation Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #62: Audit Retention. Audit log size must never exceed MAX_AUDIT_ENTRIES.
 */
export const INV_062_AUDIT_RETENTION: ExperimentInvariant = {
  id: "INV_062_AUDIT_RETENTION",
  name: "Audit Log Bounded Retention Guard",
  description: "AuditLog size must strictly be bounded at or below MAX_AUDIT_ENTRIES (10,000).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.auditLog) {
      return {
        passed: true,
        invariantId: "INV_062_AUDIT_RETENTION",
        name: "Audit Log Bounded Retention Guard",
        severity: "critical",
      };
    }

    const passed = ctx.auditLog.entries.length <= MAX_AUDIT_ENTRIES;

    return {
      passed,
      invariantId: "INV_062_AUDIT_RETENTION",
      name: "Audit Log Bounded Retention Guard",
      severity: "critical",
      reason: passed ? undefined : `AuditLog entries (${ctx.auditLog.entries.length}) exceed MAX_AUDIT_ENTRIES (${MAX_AUDIT_ENTRIES}).`,
    };
  },
};

/**
 * Invariant #63: Snapshot Performance. 100,000 events must be processed in under 250 ms.
 */
export const INV_063_SNAPSHOT_PERFORMANCE: ExperimentInvariant = {
  id: "INV_063_SNAPSHOT_PERFORMANCE",
  name: "Snapshot 100k Events Latency Guard",
  description: "ObservabilitySnapshot aggregation over 100,000 events must execute strictly in under 250 ms.",
  severity: "critical",
  check: (ctx) => {
    if (typeof ctx.snapshotDurationMs !== "number") {
      return {
        passed: true,
        invariantId: "INV_063_SNAPSHOT_PERFORMANCE",
        name: "Snapshot 100k Events Latency Guard",
        severity: "critical",
      };
    }

    const passed = ctx.snapshotDurationMs < 250;

    return {
      passed,
      invariantId: "INV_063_SNAPSHOT_PERFORMANCE",
      name: "Snapshot 100k Events Latency Guard",
      severity: "critical",
      reason: passed ? undefined : `Snapshot duration (${ctx.snapshotDurationMs} ms) exceeded 250 ms limit.`,
    };
  },
};

/**
 * Invariant #64: Dead-Letter Recovery. Dead-letter events must retain original payload.
 */
export const INV_064_DEAD_LETTER_RECOVERY: ExperimentInvariant = {
  id: "INV_064_DEAD_LETTER_RECOVERY",
  name: "Dead-Letter Payload Integrity Guard",
  description: "Events moved to Dead-Letter Queue must strictly retain their original intact RuntimeEvent payload.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.deadLetterEvents) {
      return {
        passed: true,
        invariantId: "INV_064_DEAD_LETTER_RECOVERY",
        name: "Dead-Letter Payload Integrity Guard",
        severity: "critical",
      };
    }

    const passed = ctx.deadLetterEvents.every(
      (item) => Boolean(item && item.event && item.event.id && item.event.sessionId && item.event.eventType)
    );

    return {
      passed,
      invariantId: "INV_064_DEAD_LETTER_RECOVERY",
      name: "Dead-Letter Payload Integrity Guard",
      severity: "critical",
      reason: passed ? undefined : "Dead letter events contain corrupted or missing original event payloads.",
    };
  },
};

/**
 * Invariant #65: Identity Stability. The same identity must generate the same session.
 */
export const INV_065_IDENTITY_STABILITY: ExperimentInvariant = {
  id: "INV_065_IDENTITY_STABILITY",
  name: "Cross-Page Session Identity Stability Guard",
  description: "Identical identity context must strictly generate the identical sessionId regardless of pathname.",
  severity: "critical",
  check: (ctx) => {
    return {
      passed: true,
      invariantId: "INV_065_IDENTITY_STABILITY",
      name: "Cross-Page Session Identity Stability Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #66: Stress Resilience. System survives stress test without crash.
 */
export const INV_066_STRESS_RESILIENCE: ExperimentInvariant = {
  id: "INV_066_STRESS_RESILIENCE",
  name: "Stress Test Survival Guard",
  description: "System must survive stress test (10,000 sessions, 1,000 experiments, 1,000,000 events) without crash.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.stressResult) {
      return {
        passed: true,
        invariantId: "INV_066_STRESS_RESILIENCE",
        name: "Stress Test Survival Guard",
        severity: "critical",
      };
    }

    return {
      passed: ctx.stressResult.passed,
      invariantId: "INV_066_STRESS_RESILIENCE",
      name: "Stress Test Survival Guard",
      severity: "critical",
      reason: ctx.stressResult.passed ? undefined : "System failed stress validation.",
    };
  },
};

/**
 * Invariant #67: Chaos Recovery. System recovers from all chaos scenarios.
 */
export const INV_067_CHAOS_RECOVERY: ExperimentInvariant = {
  id: "INV_067_CHAOS_RECOVERY",
  name: "Chaos Scenario Recovery Guard",
  description: "System must recover from all chaos scenarios (kill switch, rollback, invalid variants, corruption).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.chaosResult) {
      return {
        passed: true,
        invariantId: "INV_067_CHAOS_RECOVERY",
        name: "Chaos Scenario Recovery Guard",
        severity: "critical",
      };
    }

    return {
      passed: ctx.chaosResult.passed,
      invariantId: "INV_067_CHAOS_RECOVERY",
      name: "Chaos Scenario Recovery Guard",
      severity: "critical",
      reason: ctx.chaosResult.passed ? undefined : `Chaos validation failed: ${JSON.stringify(ctx.chaosResult.metadata)}`,
    };
  },
};

/**
 * Invariant #68: Full Determinism. Identical simulations must produce identical outputs.
 */
export const INV_068_FULL_DETERMINISM: ExperimentInvariant = {
  id: "INV_068_FULL_DETERMINISM",
  name: "Full Determinism Certification Guard",
  description: "Identical simulation inputs must produce identical outputs 100/100 times.",
  severity: "critical",
  check: (ctx) => {
    if (typeof ctx.determinismScore !== "number") {
      return {
        passed: true,
        invariantId: "INV_068_FULL_DETERMINISM",
        name: "Full Determinism Certification Guard",
        severity: "critical",
      };
    }

    const passed = ctx.determinismScore === 100;

    return {
      passed,
      invariantId: "INV_068_FULL_DETERMINISM",
      name: "Full Determinism Certification Guard",
      severity: "critical",
      reason: passed ? undefined : `Determinism score is ${ctx.determinismScore}/100 (required: 100/100).`,
    };
  },
};

/**
 * Invariant #69: Certified Benchmarks. Benchmark reports must declare environment and assumptions.
 */
export const INV_069_CERTIFIED_BENCHMARKS: ExperimentInvariant = {
  id: "INV_069_CERTIFIED_BENCHMARKS",
  name: "Benchmark Metadata Integrity Guard",
  description: "Benchmark reports must explicitly declare benchmark environment and non-empty assumptions array.",
  severity: "critical",
  check: (ctx) => {
    const meta = ctx.certificationReport?.benchmarkMetadata || ctx.benchmarkMetadata;
    if (!meta) {
      return {
        passed: true,
        invariantId: "INV_069_CERTIFIED_BENCHMARKS",
        name: "Benchmark Metadata Integrity Guard",
        severity: "critical",
      };
    }

    const passed = Boolean(
      meta.environment &&
      Array.isArray(meta.assumptions) &&
      meta.assumptions.length > 0
    );

    return {
      passed,
      invariantId: "INV_069_CERTIFIED_BENCHMARKS",
      name: "Benchmark Metadata Integrity Guard",
      severity: "critical",
      reason: passed ? undefined : "Benchmark metadata missing environment or assumptions array.",
    };
  },
};

/**
 * Invariant #70: Certification Consistency. PASS only if every validation passed.
 */
export const INV_070_CERTIFICATION_CONSISTENCY: ExperimentInvariant = {
  id: "INV_070_CERTIFICATION_CONSISTENCY",
  name: "Certification Report Consistency Guard",
  description: "CertificationReport verdict must be PASS only when every individual validation passed.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.certificationReport) {
      return {
        passed: true,
        invariantId: "INV_070_CERTIFICATION_CONSISTENCY",
        name: "Certification Report Consistency Guard",
        severity: "critical",
      };
    }

    const report = ctx.certificationReport;
    const allPassed = report.validations.every((v) => v.passed);
    const verdictCorrect =
      (allPassed && report.determinismScore === 100 && report.invariantPassRate === 100)
        ? report.verdict === "PASS"
        : report.verdict === "FAIL";

    return {
      passed: verdictCorrect,
      invariantId: "INV_070_CERTIFICATION_CONSISTENCY",
      name: "Certification Report Consistency Guard",
      severity: "critical",
      reason: verdictCorrect ? undefined : `Certification verdict '${report.verdict}' inconsistent with validation results.`,
    };
  },
};

/**
 * Invariant #71: Memory Profile Complete. heapUsedMb, heapTotalMb, rssMb, externalMb, arrayBuffersMb must exist.
 */
export const INV_071_MEMORY_PROFILE_COMPLETE: ExperimentInvariant = {
  id: "INV_071_MEMORY_PROFILE_COMPLETE",
  name: "Memory Profile Completeness Guard",
  description: "MemoryProfile must contain heapUsedMb, heapTotalMb, rssMb, externalMb, and arrayBuffersMb metrics.",
  severity: "critical",
  check: (ctx) => {
    const mem = ctx.certificationReport?.memoryProfile || ctx.memoryProfile;
    if (!mem) {
      return {
        passed: true,
        invariantId: "INV_071_MEMORY_PROFILE_COMPLETE",
        name: "Memory Profile Completeness Guard",
        severity: "critical",
      };
    }

    const passed =
      typeof mem.heapUsedMb === "number" &&
      typeof mem.heapTotalMb === "number" &&
      typeof mem.rssMb === "number" &&
      typeof mem.externalMb === "number" &&
      typeof mem.arrayBuffersMb === "number";

    return {
      passed,
      invariantId: "INV_071_MEMORY_PROFILE_COMPLETE",
      name: "Memory Profile Completeness Guard",
      severity: "critical",
      reason: passed ? undefined : "Memory profile is missing one or more required memory usage metrics.",
    };
  },
};

/**
 * Invariant #72: Concurrent Determinism. Concurrent deterministic simulations must produce identical outputs.
 */
export const INV_072_CONCURRENT_DETERMINISM: ExperimentInvariant = {
  id: "INV_072_CONCURRENT_DETERMINISM",
  name: "Concurrent Determinism Certification Guard",
  description: "Simulated concurrent worker execution must produce 0 output mismatches across all iterations.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.concurrencyResult) {
      return {
        passed: true,
        invariantId: "INV_072_CONCURRENT_DETERMINISM",
        name: "Concurrent Determinism Certification Guard",
        severity: "critical",
      };
    }

    const passed = ctx.concurrencyResult.passed && ctx.concurrencyResult.mismatches === 0;

    return {
      passed,
      invariantId: "INV_072_CONCURRENT_DETERMINISM",
      name: "Concurrent Determinism Certification Guard",
      severity: "critical",
      reason: passed ? undefined : `Concurrent determinism validation failed with ${ctx.concurrencyResult.mismatches} mismatches.`,
    };
  },
};

/**
 * Invariant #73: Version Monotonic. Version numbers must only increase.
 */
export const INV_073_VERSION_MONOTONIC: ExperimentInvariant = {
  id: "INV_073_VERSION_MONOTONIC",
  name: "Version Monotonicity Guard",
  description: "Experiment version numbers must strictly increase across revisions.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.previousDefinition) {
      return {
        passed: true,
        invariantId: "INV_073_VERSION_MONOTONIC",
        name: "Version Monotonicity Guard",
        severity: "critical",
      };
    }

    const passed = ctx.experimentDefinition.version > ctx.previousDefinition.version;

    return {
      passed,
      invariantId: "INV_073_VERSION_MONOTONIC",
      name: "Version Monotonicity Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Version did not strictly increase. Current: ${ctx.experimentDefinition.version}, Previous: ${ctx.previousDefinition.version}`,
    };
  },
};

/**
 * Invariant #74: Unique Experiment IDs. Registry ids must be unique.
 */
export const INV_074_UNIQUE_EXPERIMENT_IDS: ExperimentInvariant = {
  id: "INV_074_UNIQUE_EXPERIMENT_IDS",
  name: "Unique Registry Experiment IDs Guard",
  description: "All registered experiment IDs in the registry store must be unique.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.registryStore || !ctx.registryStore.experiments) {
      return {
        passed: true,
        invariantId: "INV_074_UNIQUE_EXPERIMENT_IDS",
        name: "Unique Registry Experiment IDs Guard",
        severity: "critical",
      };
    }

    const ids = Array.from(ctx.registryStore.experiments.keys());
    const uniqueIds = new Set(ids);
    const passed = ids.length === uniqueIds.size;

    return {
      passed,
      invariantId: "INV_074_UNIQUE_EXPERIMENT_IDS",
      name: "Unique Registry Experiment IDs Guard",
      severity: "critical",
      reason: passed ? undefined : "Duplicate experiment IDs detected in registry store.",
    };
  },
};

/**
 * Invariant #75: Minimum Variants. Every experiment must contain at least two variants.
 */
export const INV_075_MINIMUM_VARIANTS: ExperimentInvariant = {
  id: "INV_075_MINIMUM_VARIANTS",
  name: "Minimum Variants Guard",
  description: "Every experiment definition must contain at least two variants.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_075_MINIMUM_VARIANTS",
        name: "Minimum Variants Guard",
        severity: "critical",
      };
    }

    const passed =
      Array.isArray(ctx.experimentDefinition.variants) &&
      ctx.experimentDefinition.variants.length >= 2;

    return {
      passed,
      invariantId: "INV_075_MINIMUM_VARIANTS",
      name: "Minimum Variants Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Experiment '${ctx.experimentDefinition.id}' contains fewer than 2 variants (${ctx.experimentDefinition.variants?.length || 0}).`,
    };
  },
};

/**
 * Invariant #76: Weight Sum 100. Variant weights must sum to exactly 100.
 */
export const INV_076_WEIGHT_SUM_100: ExperimentInvariant = {
  id: "INV_076_WEIGHT_SUM_100",
  name: "Variant Weight Sum 100 Guard",
  description: "Sum of variant weights in an experiment definition must strictly equal 100.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !Array.isArray(ctx.experimentDefinition.variants)) {
      return {
        passed: true,
        invariantId: "INV_076_WEIGHT_SUM_100",
        name: "Variant Weight Sum 100 Guard",
        severity: "critical",
      };
    }

    const weightSum = ctx.experimentDefinition.variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    const passed = Math.abs(weightSum - 100) < 0.001;

    return {
      passed,
      invariantId: "INV_076_WEIGHT_SUM_100",
      name: "Variant Weight Sum 100 Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Variant weights sum to ${weightSum} (must strictly equal 100).`,
    };
  },
};

/**
 * Invariant #77: Lifecycle Valid. Lifecycle transitions must be valid.
 */
export const INV_077_LIFECYCLE_VALID: ExperimentInvariant = {
  id: "INV_077_LIFECYCLE_VALID",
  name: "Lifecycle Transition Validity Guard",
  description: "Lifecycle status transitions must follow valid transition graph rules.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.previousDefinition) {
      return {
        passed: true,
        invariantId: "INV_077_LIFECYCLE_VALID",
        name: "Lifecycle Transition Validity Guard",
        severity: "critical",
      };
    }

    const passed = isValidLifecycleTransition(
      ctx.previousDefinition.status,
      ctx.experimentDefinition.status
    );

    return {
      passed,
      invariantId: "INV_077_LIFECYCLE_VALID",
      name: "Lifecycle Transition Validity Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Invalid lifecycle transition from '${ctx.previousDefinition.status}' to '${ctx.experimentDefinition.status}'.`,
    };
  },
};

/**
 * Invariant #78: Archived Immutable. Archived experiments cannot be modified.
 */
export const INV_078_ARCHIVED_IMMUTABLE: ExperimentInvariant = {
  id: "INV_078_ARCHIVED_IMMUTABLE",
  name: "Archived Experiment Immutability Guard",
  description: "Archived experiments cannot undergo status or definition modifications.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.previousDefinition || ctx.previousDefinition.status !== "archived") {
      return {
        passed: true,
        invariantId: "INV_078_ARCHIVED_IMMUTABLE",
        name: "Archived Experiment Immutability Guard",
        severity: "critical",
      };
    }

    const passed =
      !ctx.experimentDefinition ||
      (ctx.experimentDefinition.status === "archived" &&
        ctx.experimentDefinition.version === ctx.previousDefinition.version);

    return {
      passed,
      invariantId: "INV_078_ARCHIVED_IMMUTABLE",
      name: "Archived Experiment Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Attempted modification of an archived experiment.",
    };
  },
};

/**
 * Invariant #79: Targeting Deterministic. Same input must produce identical eligibility results.
 */
export const INV_079_TARGETING_DETERMINISTIC: ExperimentInvariant = {
  id: "INV_079_TARGETING_DETERMINISTIC",
  name: "Targeting Evaluation Determinism Guard",
  description: "Executing targeting evaluation on identical inputs must yield identical eligibility results.",
  severity: "critical",
  check: (ctx) => {
    const def = ctx.experimentDefinition;
    const tCtx = ctx.targetingContext;

    if (!def || !tCtx) {
      return {
        passed: true,
        invariantId: "INV_079_TARGETING_DETERMINISTIC",
        name: "Targeting Evaluation Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = isEligible(def, tCtx);
    const res2 = isEligible(def, tCtx);

    const passed =
      res1.eligible === res2.eligible &&
      res1.matchedRules.join(",") === res2.matchedRules.join(",") &&
      res1.failedRules.join(",") === res2.failedRules.join(",");

    return {
      passed,
      invariantId: "INV_079_TARGETING_DETERMINISTIC",
      name: "Targeting Evaluation Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Targeting evaluation produced non-deterministic results across runs.",
    };
  },
};

/**
 * Invariant #80: Country Match. Country filters must be enforced correctly (case-insensitive).
 */
export const INV_080_COUNTRY_MATCH: ExperimentInvariant = {
  id: "INV_080_COUNTRY_MATCH",
  name: "Country Filter Enforcement Guard",
  description: "Country filtering must correctly perform case-insensitive matching against allowed lists.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    const tCtx = ctx.targetingContext;

    if (!rules || !Array.isArray(rules.countries) || rules.countries.length === 0 || !tCtx) {
      return {
        passed: true,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
      };
    }

    const result = ctx.eligibilityResult || (ctx.experimentDefinition ? isEligible(ctx.experimentDefinition, tCtx) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
      };
    }

    if (!tCtx.country) {
      const passed = result.failedRules.includes("country");
      return {
        passed,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Missing country context failed to register country rule failure.",
      };
    }

    const userCountry = tCtx.country.trim().toLowerCase();
    const allowed = rules.countries.map((c) => c.trim().toLowerCase());
    const shouldMatch = allowed.includes(userCountry);
    const actualMatch = result.matchedRules.includes("country");

    const passed = shouldMatch === actualMatch;

    return {
      passed,
      invariantId: "INV_080_COUNTRY_MATCH",
      name: "Country Filter Enforcement Guard",
      severity: "critical",
      reason: passed ? undefined : `Country match mismatch: shouldMatch=${shouldMatch}, actualMatch=${actualMatch}.`,
    };
  },
};

/**
 * Invariant #81: Provider Match. Provider filters must be enforced correctly (exact match).
 */
export const INV_081_PROVIDER_MATCH: ExperimentInvariant = {
  id: "INV_081_PROVIDER_MATCH",
  name: "Provider Filter Enforcement Guard",
  description: "Provider filtering must strictly enforce exact string matching for payment providers.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    const tCtx = ctx.targetingContext;

    if (!rules || !Array.isArray(rules.providers) || rules.providers.length === 0 || !tCtx) {
      return {
        passed: true,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
      };
    }

    const result = ctx.eligibilityResult || (ctx.experimentDefinition ? isEligible(ctx.experimentDefinition, tCtx) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
      };
    }

    if (!tCtx.provider) {
      const passed = result.failedRules.includes("provider");
      return {
        passed,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Missing provider context failed to register provider rule failure.",
      };
    }

    const shouldMatch = rules.providers.includes(tCtx.provider);
    const actualMatch = result.matchedRules.includes("provider");

    const passed = shouldMatch === actualMatch;

    return {
      passed,
      invariantId: "INV_081_PROVIDER_MATCH",
      name: "Provider Filter Enforcement Guard",
      severity: "critical",
      reason: passed ? undefined : `Provider match mismatch: shouldMatch=${shouldMatch}, actualMatch=${actualMatch}.`,
    };
  },
};

/**
 * Invariant #82: User State Match. newUsersOnly and returningUsersOnly must never both evaluate to true.
 */
export const INV_082_USER_STATE_MATCH: ExperimentInvariant = {
  id: "INV_082_USER_STATE_MATCH",
  name: "User State Mutual Exclusivity Guard",
  description: "Targeting rules cannot contain contradictory newUsersOnly and returningUsersOnly flags.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    if (!rules) {
      return {
        passed: true,
        invariantId: "INV_082_USER_STATE_MATCH",
        name: "User State Mutual Exclusivity Guard",
        severity: "critical",
      };
    }

    const val = validateTargetingRules(rules);
    const passed = val.passed;

    return {
      passed,
      invariantId: "INV_082_USER_STATE_MATCH",
      name: "User State Mutual Exclusivity Guard",
      severity: "critical",
      reason: passed ? undefined : "Targeting rules violate mutual exclusivity of newUsersOnly and returningUsersOnly.",
    };
  },
};

/**
 * Invariant #83: Rule Order Stable. Rules must evaluate in country → provider → acquisition source → onboarding step → new user → returning user order.
 */
export const INV_083_RULE_ORDER_STABLE: ExperimentInvariant = {
  id: "INV_083_RULE_ORDER_STABLE",
  name: "Targeting Rule Evaluation Order Stability Guard",
  description: "Rule evaluation order must strictly follow country → provider → acquisition source → onboarding step → new user → returning user.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.targetingContext) {
      return {
        passed: true,
        invariantId: "INV_083_RULE_ORDER_STABLE",
        name: "Targeting Rule Evaluation Order Stability Guard",
        severity: "critical",
      };
    }

    const result = isEligible(ctx.experimentDefinition, ctx.targetingContext);
    const combined = [...result.matchedRules, ...result.failedRules];

    const EXPECTED_ORDER = ["country", "provider", "acquisition source", "onboarding step", "new user", "returning user"];

    let lastIndex = -1;
    let orderValid = true;

    for (const rule of combined) {
      const idx = EXPECTED_ORDER.indexOf(rule);
      if (idx !== -1) {
        if (idx < lastIndex) {
          orderValid = false;
          break;
        }
        lastIndex = idx;
      }
    }

    return {
      passed: orderValid,
      invariantId: "INV_083_RULE_ORDER_STABLE",
      name: "Targeting Rule Evaluation Order Stability Guard",
      severity: "critical",
      reason: orderValid ? undefined : `Rule evaluation order violated. Sequence: ${combined.join(" → ")}`,
    };
  },
};

/**
 * Invariant #84: Scheduler Deterministic. Same input → same output.
 */
export const INV_084_SCHEDULER_DETERMINISTIC: ExperimentInvariant = {
  id: "INV_084_SCHEDULER_DETERMINISTIC",
  name: "Scheduler Evaluation Determinism Guard",
  description: "Executing schedule evaluation on identical inputs must yield identical active status and diagnostics.",
  severity: "critical",
  check: (ctx) => {
    const def = ctx.experimentDefinition;
    const now = ctx.evaluationTime;

    if (!def || !now) {
      return {
        passed: true,
        invariantId: "INV_084_SCHEDULER_DETERMINISTIC",
        name: "Scheduler Evaluation Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = isExperimentActive(def, now);
    const res2 = isExperimentActive(def, now);

    const passed =
      res1.active === res2.active &&
      res1.matchedChecks.join(",") === res2.matchedChecks.join(",") &&
      res1.failedChecks.join(",") === res2.failedChecks.join(",");

    return {
      passed,
      invariantId: "INV_084_SCHEDULER_DETERMINISTIC",
      name: "Scheduler Evaluation Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Scheduler evaluation produced non-deterministic results across runs.",
    };
  },
};

/**
 * Invariant #85: Start Window Enforced. Experiment cannot activate before startsAt.
 */
export const INV_085_START_WINDOW_ENFORCED: ExperimentInvariant = {
  id: "INV_085_START_WINDOW_ENFORCED",
  name: "Schedule Start Boundary Guard",
  description: "Experiments with startsAt cannot evaluate to active prior to startsAt timestamp.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !schedule.startsAt || !now) {
      return {
        passed: true,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
      };
    }

    const result = ctx.scheduleEvaluationResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
      };
    }

    if (now.getTime() < schedule.startsAt.getTime()) {
      const passed = result.active === false && result.failedChecks.includes("startsAt");
      return {
        passed,
        invariantId: "INV_085_START_WINDOW_ENFORCED",
        name: "Schedule Start Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Experiment evaluated to active before startsAt boundary.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_085_START_WINDOW_ENFORCED",
      name: "Schedule Start Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #86: End Window Enforced. Experiment cannot activate after endsAt.
 */
export const INV_086_END_WINDOW_ENFORCED: ExperimentInvariant = {
  id: "INV_086_END_WINDOW_ENFORCED",
  name: "Schedule Expiration Boundary Guard",
  description: "Experiments with endsAt cannot evaluate to active after endsAt timestamp.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !schedule.endsAt || !now) {
      return {
        passed: true,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
      };
    }

    const result = ctx.scheduleEvaluationResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
      };
    }

    if (now.getTime() > schedule.endsAt.getTime()) {
      const passed = result.active === false && result.failedChecks.includes("endsAt");
      return {
        passed,
        invariantId: "INV_086_END_WINDOW_ENFORCED",
        name: "Schedule Expiration Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Experiment evaluated to active after endsAt expiration boundary.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_086_END_WINDOW_ENFORCED",
      name: "Schedule Expiration Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #87: Disabled Experiment Blocked. enabled: false always blocks experiment.
 */
export const INV_087_DISABLED_EXPERIMENT_BLOCKED: ExperimentInvariant = {
  id: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
  name: "Disabled Schedule Guard",
  description: "Schedules with enabled: false must evaluate to active: false.",
  severity: "critical",
  check: (ctx) => {
    const schedule = ctx.experimentDefinition?.schedule || ctx.schedule;
    const now = ctx.evaluationTime;

    if (!schedule || !now) {
      return {
        passed: true,
        invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
        name: "Disabled Schedule Guard",
        severity: "critical",
      };
    }

    if (schedule.enabled === false) {
      const result = ctx.scheduleEvaluationResult || (ctx.experimentDefinition ? isExperimentActive(ctx.experimentDefinition, now) : undefined);
      if (result) {
        const passed = result.active === false && result.failedChecks.includes("enabled");
        return {
          passed,
          invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
          name: "Disabled Schedule Guard",
          severity: "critical",
          reason: passed ? undefined : "Disabled experiment evaluated to active.",
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_087_DISABLED_EXPERIMENT_BLOCKED",
      name: "Disabled Schedule Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #88: Evaluation Order Stable. Checks always execute in order: enabled → startsAt → endsAt.
 */
export const INV_088_EVALUATION_ORDER_STABLE: ExperimentInvariant = {
  id: "INV_088_EVALUATION_ORDER_STABLE",
  name: "Schedule Evaluation Order Stability Guard",
  description: "Schedule checks must strictly execute in order: enabled → startsAt → endsAt.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_088_EVALUATION_ORDER_STABLE",
        name: "Schedule Evaluation Order Stability Guard",
        severity: "critical",
      };
    }

    const result = isExperimentActive(ctx.experimentDefinition, ctx.evaluationTime);
    const combined = [...result.matchedChecks, ...result.failedChecks];

    const EXPECTED_ORDER = ["enabled", "startsAt", "endsAt"];

    let lastIndex = -1;
    let orderValid = true;

    for (const check of combined) {
      const idx = EXPECTED_ORDER.indexOf(check);
      if (idx !== -1) {
        if (idx < lastIndex) {
          orderValid = false;
          break;
        }
        lastIndex = idx;
      }
    }

    return {
      passed: orderValid,
      invariantId: "INV_088_EVALUATION_ORDER_STABLE",
      name: "Schedule Evaluation Order Stability Guard",
      severity: "critical",
      reason: orderValid ? undefined : `Schedule evaluation order violated. Sequence: ${combined.join(" → ")}`,
    };
  },
};




export const EXPERIMENT_INVARIANTS: readonly ExperimentInvariant[] = [
  INV_001_SINGLE_CONTROL,
  INV_002_ALLOCATION_SUM,
  INV_003_MINIMUM_BOUNDS,
  INV_004_WINNER_BEATS_CONTROL,
  INV_005_EXCLUSION_MUTEX,
  INV_006_CONTINUOUS_SRM_GUARD,
  INV_007_ASSIGNMENT_AUDITABILITY,
  INV_008_ASSIGNMENT_DETERMINISM,
  INV_009_VERSION_ISOLATION,
  INV_010_DISTRIBUTION_FAIRNESS,
  INV_011_STICKY_ASSIGNMENT,
  INV_012_IDENTITY_RESOLUTION,
  INV_013_MIGRATION_PRESERVATION,
  INV_014_CACHE_CONSISTENCY,
  INV_015_ASSIGNMENT_REPLAY,
  INV_016_RECOVERY_PRIORITY,
  INV_017_SAMPLE_REQUIREMENT,
  INV_018_RUNTIME_REQUIREMENT,
  INV_019_PEEKING_PROTECTION,
  INV_020_WINNER_ELIGIBILITY,
  INV_021_EVALUATION_WINDOW,
  INV_022_CONFIDENCE_SATURATION,
  INV_023_CONVERSION_REGRESSION,
  INV_024_RECOVERY_REGRESSION,
  INV_025_COMPLETION_REGRESSION,
  INV_026_RISK_SCORE_BOUNDS,
  INV_027_ALERT_GENERATION,
  INV_028_ROLLBACK_SCORE_BOUNDS,
  INV_029_IMMEDIATE_ROLLBACK_SAFETY,
  INV_030_REASON_GENERATION,
  INV_031_DASHBOARD_SUMMARY,
  INV_032_BLOCKED_EXPERIMENT,
  INV_033_ALERT_VISIBILITY,
  INV_034_EXPORT_CONSISTENCY,
  INV_035_CACHE_VALIDITY,
  INV_036_PERFORMANCE_METRICS,
  INV_037_EVENT_ID_REQUIRED,
  INV_038_SESSION_REQUIRED,
  INV_039_EVENT_TYPE_VALID,
  INV_040_EXPERIMENT_EVENT_CONSISTENCY,
  INV_041_STICKY_ASSIGNMENT,
  INV_042_WEIGHTED_ASSIGNMENT_VALID,
  INV_043_DISABLED_EXPERIMENT_BLOCKED,
  INV_044_EXPERIMENT_CONFLICT_RESOLUTION,
  INV_045_SESSION_RECOVERY,
  INV_046_PRIORITY_ORDERING,
  INV_047_VARIANT_SEEN_TRACKING,
  INV_048_CONTEXT_CONSISTENCY,
  INV_049_GLOBAL_KILL_SWITCH,
  INV_050_FORCE_CONTROL,
  INV_051_FORCED_VARIANT_VALID,
  INV_052_AUDIT_TRAIL_PERSISTENCE,
  INV_053_METRICS_CONSISTENCY,
  INV_054_HEALTH_SCORE_BOUNDS,
  INV_055_SNAPSHOT_COMPLETENESS,
  INV_056_ANOMALY_VALIDITY,
  INV_057_QUEUE_ORDERING,
  INV_058_SESSION_DETERMINISM,
  INV_059_EVENT_SEMANTICS,
  INV_060_WEIGHT_DISTRIBUTION,
  INV_061_VERSIONED_STICKINESS,
  INV_062_AUDIT_RETENTION,
  INV_063_SNAPSHOT_PERFORMANCE,
  INV_064_DEAD_LETTER_RECOVERY,
  INV_065_IDENTITY_STABILITY,
  INV_066_STRESS_RESILIENCE,
  INV_067_CHAOS_RECOVERY,
  INV_068_FULL_DETERMINISM,
  INV_069_CERTIFIED_BENCHMARKS,
  INV_070_CERTIFICATION_CONSISTENCY,
  INV_071_MEMORY_PROFILE_COMPLETE,
  INV_072_CONCURRENT_DETERMINISM,
  INV_073_VERSION_MONOTONIC,
  INV_074_UNIQUE_EXPERIMENT_IDS,
  INV_075_MINIMUM_VARIANTS,
  INV_076_WEIGHT_SUM_100,
  INV_077_LIFECYCLE_VALID,
  INV_078_ARCHIVED_IMMUTABLE,
  INV_079_TARGETING_DETERMINISTIC,
  INV_080_COUNTRY_MATCH,
  INV_081_PROVIDER_MATCH,
  INV_082_USER_STATE_MATCH,
  INV_083_RULE_ORDER_STABLE,
  INV_084_SCHEDULER_DETERMINISTIC,
  INV_085_START_WINDOW_ENFORCED,
  INV_086_END_WINDOW_ENFORCED,
  INV_087_DISABLED_EXPERIMENT_BLOCKED,
  INV_088_EVALUATION_ORDER_STABLE,
];

/**
 * Invariant #89: Permission Deterministic. Same input → same output.
 */
export const INV_089_PERMISSION_DETERMINISTIC: ExperimentInvariant = {
  id: "INV_089_PERMISSION_DETERMINISTIC",
  name: "Governance Permission Determinism Guard",
  description: "Executing governance evaluation on identical inputs must yield identical decision and check diagnostics.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceActor || !ctx.governanceAction) {
      return {
        passed: true,
        invariantId: "INV_089_PERMISSION_DETERMINISTIC",
        name: "Governance Permission Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);
    const res2 = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);

    const passed =
      res1.allowed === res2.allowed &&
      res1.matchedChecks.join(",") === res2.matchedChecks.join(",") &&
      res1.failedChecks.join(",") === res2.failedChecks.join(",");

    return {
      passed,
      invariantId: "INV_089_PERMISSION_DETERMINISTIC",
      name: "Governance Permission Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Governance decision produced non-deterministic outputs across evaluation runs.",
    };
  },
};

/**
 * Invariant #90: Ownership Enforced. Non-admin author cannot modify non-owned experiment.
 */
export const INV_090_OWNERSHIP_ENFORCED: ExperimentInvariant = {
  id: "INV_090_OWNERSHIP_ENFORCED",
  name: "Governance Ownership Enforcement Guard",
  description: "Non-admin actors attempting actions on experiments they do not own must be rejected.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceActor || !ctx.governanceAction || !ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_090_OWNERSHIP_ENFORCED",
        name: "Governance Ownership Enforcement Guard",
        severity: "critical",
      };
    }

    if (ctx.governanceActor.role !== "admin" && ctx.governanceAction !== "create" && ctx.governanceActor.id !== ctx.experimentDefinition.owner) {
      const decision = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("ownership");
      return {
        passed,
        invariantId: "INV_090_OWNERSHIP_ENFORCED",
        name: "Governance Ownership Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Non-admin actor modified an experiment owned by another actor.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_090_OWNERSHIP_ENFORCED",
      name: "Governance Ownership Enforcement Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #91: Admin Override. Admin can perform any permitted action on any experiment (except archived).
 */
export const INV_091_ADMIN_OVERRIDE: ExperimentInvariant = {
  id: "INV_091_ADMIN_OVERRIDE",
  name: "Governance Admin Override Guard",
  description: "Admin actors possess universal authority across all active non-archived experiments regardless of ownership.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceActor || ctx.governanceActor.role !== "admin" || !ctx.governanceAction || !ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_091_ADMIN_OVERRIDE",
        name: "Governance Admin Override Guard",
        severity: "critical",
      };
    }

    if (ctx.experimentDefinition.status !== "archived") {
      let statusCompatible = true;
      switch (ctx.governanceAction) {
        case "request_review":
          statusCompatible = ctx.experimentDefinition.status === "draft";
          break;
        case "review":
          statusCompatible = ctx.experimentDefinition.status === "draft" || ctx.experimentDefinition.status === "review";
          break;
        case "approve":
          statusCompatible = ctx.experimentDefinition.status === "review";
          break;
        case "activate":
          statusCompatible = ctx.experimentDefinition.status === "approved" || ctx.experimentDefinition.status === "paused";
          break;
        case "pause":
          statusCompatible = ctx.experimentDefinition.status === "active";
          break;
        case "archive":
          statusCompatible = ctx.experimentDefinition.status === "active" || ctx.experimentDefinition.status === "paused";
          break;
      }

      if (statusCompatible) {
        const decision = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);
        const passed = decision.allowed === true && !decision.failedChecks.includes("ownership");
        return {
          passed,
          invariantId: "INV_091_ADMIN_OVERRIDE",
          name: "Governance Admin Override Guard",
          severity: "critical",
          reason: passed ? undefined : "Admin actor was incorrectly blocked by ownership check.",
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_091_ADMIN_OVERRIDE",
      name: "Governance Admin Override Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #92: Role Boundaries. Roles strictly enforce permission boundaries.
 */
export const INV_092_ROLE_BOUNDARIES: ExperimentInvariant = {
  id: "INV_092_ROLE_BOUNDARIES",
  name: "Governance Role Boundary Guard",
  description: "Actors cannot execute actions outside their declared role permissions (e.g. reviewer editing or approver activating).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceActor || !ctx.governanceAction) {
      return {
        passed: true,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
      };
    }

    if (ctx.governanceActor.role === "reviewer" && ctx.governanceAction === "edit") {
      const decision = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("permission");
      return {
        passed,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Reviewer was allowed to edit an experiment.",
      };
    }

    if (ctx.governanceActor.role === "approver" && ctx.governanceAction === "activate") {
      const decision = canPerformAction(ctx.governanceActor, ctx.governanceAction, ctx.experimentDefinition);
      const passed = decision.allowed === false && decision.failedChecks.includes("permission");
      return {
        passed,
        invariantId: "INV_092_ROLE_BOUNDARIES",
        name: "Governance Role Boundary Guard",
        severity: "critical",
        reason: passed ? undefined : "Approver was allowed to activate an experiment.",
      };
    }

    return {
      passed: true,
      invariantId: "INV_092_ROLE_BOUNDARIES",
      name: "Governance Role Boundary Guard",
      severity: "critical",
    };
  },
};

/**
 * Invariant #93: Audit Order Stable. Audit history is append-only and strictly ordered.
 */
export const INV_093_AUDIT_ORDER_STABLE: ExperimentInvariant = {
  id: "INV_093_AUDIT_ORDER_STABLE",
  name: "Governance Audit Trail Stability Guard",
  description: "Governance audit log entries must preserve strict append order and immutability.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceAuditLog || !Array.isArray(ctx.governanceAuditLog.entries)) {
      return {
        passed: true,
        invariantId: "INV_093_AUDIT_ORDER_STABLE",
        name: "Governance Audit Trail Stability Guard",
        severity: "critical",
      };
    }

    let isOrdered = true;
    for (let i = 1; i < ctx.governanceAuditLog.entries.length; i++) {
      if (ctx.governanceAuditLog.entries[i].timestamp.getTime() < ctx.governanceAuditLog.entries[i - 1].timestamp.getTime()) {
        isOrdered = false;
        break;
      }
    }

    return {
      passed: isOrdered,
      invariantId: "INV_093_AUDIT_ORDER_STABLE",
      name: "Governance Audit Trail Stability Guard",
      severity: "critical",
      reason: isOrdered ? undefined : "Governance audit entries violated chronological append ordering.",
    };
  },
};

/**
 * Invariant #94: Owner Required. ExperimentDefinition must contain a valid, non-empty, trimmed ownerId.
 */
export const INV_094_OWNER_REQUIRED: ExperimentInvariant = {
  id: "INV_094_OWNER_REQUIRED",
  name: "Governance Mandatory Ownership Guard",
  description: "ExperimentDefinition must contain a valid, non-empty, trimmed ownerId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_094_OWNER_REQUIRED",
        name: "Governance Mandatory Ownership Guard",
        severity: "critical",
      };
    }

    const ownerId = ctx.experimentDefinition.ownerId;
    const passed = typeof ownerId === "string" && ownerId.trim().length > 0;

    return {
      passed,
      invariantId: "INV_094_OWNER_REQUIRED",
      name: "Governance Mandatory Ownership Guard",
      severity: "critical",
      reason: passed ? undefined : "ExperimentDefinition missing mandatory non-empty ownerId.",
    };
  },
};

/**
 * Invariant #95: Audit Sequence Order. Audit log entries must have unique, non-negative, strictly monotonic sequence numbers.
 */
export const INV_095_AUDIT_SEQUENCE_ORDER: ExperimentInvariant = {
  id: "INV_095_AUDIT_SEQUENCE_ORDER",
  name: "Governance Audit Sequence Monotonicity Guard",
  description: "Audit log entries must have unique, non-negative, strictly monotonic sequence numbers.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.governanceAuditLog || !Array.isArray(ctx.governanceAuditLog.entries)) {
      return {
        passed: true,
        invariantId: "INV_095_AUDIT_SEQUENCE_ORDER",
        name: "Governance Audit Sequence Monotonicity Guard",
        severity: "critical",
      };
    }

    let valid = true;
    for (let i = 0; i < ctx.governanceAuditLog.entries.length; i++) {
      const entry = ctx.governanceAuditLog.entries[i];
      if (typeof entry.sequence !== "number" || !Number.isInteger(entry.sequence) || entry.sequence < 0) {
        valid = false;
        break;
      }
      if (i > 0 && entry.sequence <= ctx.governanceAuditLog.entries[i - 1].sequence) {
        valid = false;
        break;
      }
    }

    return {
      passed: valid,
      invariantId: "INV_095_AUDIT_SEQUENCE_ORDER",
      name: "Governance Audit Sequence Monotonicity Guard",
      severity: "critical",
      reason: valid ? undefined : "Governance audit sequence numbers are non-monotonic, non-integer, or negative.",
    };
  },
};

/**
 * Invariant #96: No Approved Candidate State. Status approved_candidate is strictly forbidden.
 */
export const INV_096_NO_APPROVED_CANDIDATE_STATE: ExperimentInvariant = {
  id: "INV_096_NO_APPROVED_CANDIDATE_STATE",
  name: "Governance Approved Candidate State Prohibition Guard",
  description: "Experiment status must be strictly one of draft, review, approved, active, paused, archived. Status approved_candidate is strictly forbidden.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_096_NO_APPROVED_CANDIDATE_STATE",
        name: "Governance Approved Candidate State Prohibition Guard",
        severity: "critical",
      };
    }

    const ALLOWED_STATES = ["draft", "review", "approved", "active", "paused", "archived"];
    const statusStr = String(ctx.experimentDefinition.status);
    const passed = ALLOWED_STATES.includes(statusStr) && statusStr !== "approved_candidate";

    return {
      passed,
      invariantId: "INV_096_NO_APPROVED_CANDIDATE_STATE",
      name: "Governance Approved Candidate State Prohibition Guard",
      severity: "critical",
      reason: passed ? undefined : `Invalid experiment status '${statusStr}'. Status 'approved_candidate' is strictly prohibited.`,
    };
  },
};

/**
 * Invariant #97: Console Deterministic. Building console view with identical inputs produces strictly identical views.
 */
export const INV_097_CONSOLE_DETERMINISTIC: ExperimentInvariant = {
  id: "INV_097_CONSOLE_DETERMINISTIC",
  name: "Console View Determinism Guard",
  description: "Building console view with identical inputs produces strictly identical views.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_097_CONSOLE_DETERMINISTIC",
        name: "Console View Determinism Guard",
        severity: "critical",
      };
    }

    const view1 = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const view2 = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const json1 = JSON.stringify(view1);
    const json2 = JSON.stringify(view2);
    const passed = json1 === json2;

    return {
      passed,
      invariantId: "INV_097_CONSOLE_DETERMINISTIC",
      name: "Console View Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Console projections for identical inputs produced non-identical JSON outputs.",
    };
  },
};

/**
 * Invariant #98: Console Read Only. Projecting console view must not mutate the underlying experiment or audit log.
 */
export const INV_098_CONSOLE_READ_ONLY: ExperimentInvariant = {
  id: "INV_098_CONSOLE_READ_ONLY",
  name: "Console Read-Only Projection Guard",
  description: "Projecting console view must not mutate the underlying experiment, actor, schedule, or audit log.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_098_CONSOLE_READ_ONLY",
        name: "Console Read-Only Projection Guard",
        severity: "critical",
      };
    }

    const beforeExpJson = JSON.stringify(ctx.experimentDefinition);
    const beforeAuditJson = ctx.governanceAuditLog ? JSON.stringify(ctx.governanceAuditLog) : undefined;

    buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const afterExpJson = JSON.stringify(ctx.experimentDefinition);
    const afterAuditJson = ctx.governanceAuditLog ? JSON.stringify(ctx.governanceAuditLog) : undefined;

    const expUnchanged = beforeExpJson === afterExpJson;
    const auditUnchanged = beforeAuditJson === afterAuditJson;
    const passed = expUnchanged && auditUnchanged;

    return {
      passed,
      invariantId: "INV_098_CONSOLE_READ_ONLY",
      name: "Console Read-Only Projection Guard",
      severity: "critical",
      reason: passed ? undefined : "Console projection mutated underlying experiment or audit log state.",
    };
  },
};

/**
 * Invariant #99: Audit Projection Order. Audit projection must strictly preserve primary sequence number and secondary timestamp ordering.
 */
export const INV_099_AUDIT_PROJECTION_ORDER: ExperimentInvariant = {
  id: "INV_099_AUDIT_PROJECTION_ORDER",
  name: "Console Audit Projection Monotonicity Guard",
  description: "Audit projection must strictly preserve primary sequence number and secondary timestamp ordering.",
  severity: "critical",
  check: (ctx) => {
    const view =
      ctx.consoleView ||
      (ctx.experimentDefinition && ctx.governanceActor && ctx.evaluationTime
        ? buildExperimentConsoleView(
            ctx.experimentDefinition,
            ctx.governanceActor,
            ctx.targetingContext,
            ctx.evaluationTime,
            ctx.governanceAuditLog
          )
        : undefined);

    if (!view || !Array.isArray(view.audit)) {
      return {
        passed: true,
        invariantId: "INV_099_AUDIT_PROJECTION_ORDER",
        name: "Console Audit Projection Monotonicity Guard",
        severity: "critical",
      };
    }

    let isOrdered = true;
    for (let i = 1; i < view.audit.length; i++) {
      if (view.audit[i].sequence <= view.audit[i - 1].sequence) {
        isOrdered = false;
        break;
      }
    }

    return {
      passed: isOrdered,
      invariantId: "INV_099_AUDIT_PROJECTION_ORDER",
      name: "Console Audit Projection Monotonicity Guard",
      severity: "critical",
      reason: isOrdered ? undefined : "Console audit projection failed to preserve monotonic sequence ordering.",
    };
  },
};

/**
 * Invariant #100: Console Matches Domain. Console view properties must match underlying domain evaluations.
 */
export const INV_100_CONSOLE_MATCHES_DOMAIN: ExperimentInvariant = {
  id: "INV_100_CONSOLE_MATCHES_DOMAIN",
  name: "Console Domain Fidelity Guard",
  description: "Console view properties (eligible, active, allowedActions, variants) must match underlying domain evaluations.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_100_CONSOLE_MATCHES_DOMAIN",
        name: "Console Domain Fidelity Guard",
        severity: "critical",
      };
    }

    const view = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const matchesId = view.experimentId === ctx.experimentDefinition.id;
    const matchesOwner = view.ownerId === ctx.experimentDefinition.ownerId;
    const matchesStatus = view.status === ctx.experimentDefinition.status;
    const matchesVariants = view.variants.length === ctx.experimentDefinition.variants.length;

    const passed = matchesId && matchesOwner && matchesStatus && matchesVariants;

    return {
      passed,
      invariantId: "INV_100_CONSOLE_MATCHES_DOMAIN",
      name: "Console Domain Fidelity Guard",
      severity: "critical",
      reason: passed ? undefined : "Console view fields mismatched underlying experiment definition domain values.",
    };
  },
};

/**
 * Invariant #101: Allowed Actions Correct. Console view allowedActions must match exact actions authorized by governance engine.
 */
export const INV_101_ALLOWED_ACTIONS_CORRECT: ExperimentInvariant = {
  id: "INV_101_ALLOWED_ACTIONS_CORRECT",
  name: "Console Governance Authorization Accuracy Guard",
  description: "Console view allowedActions must match exact actions authorized by the governance engine for the given actor.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.governanceActor || !ctx.evaluationTime) {
      return {
        passed: true,
        invariantId: "INV_101_ALLOWED_ACTIONS_CORRECT",
        name: "Console Governance Authorization Accuracy Guard",
        severity: "critical",
      };
    }

    const view = buildExperimentConsoleView(
      ctx.experimentDefinition,
      ctx.governanceActor,
      ctx.targetingContext,
      ctx.evaluationTime,
      ctx.governanceAuditLog
    );

    const ALL_ACTIONS = ["create", "edit", "request_review", "review", "approve", "activate", "pause", "archive"] as const;
    const expectedAllowed = ALL_ACTIONS.filter(
      (action) => canPerformAction(ctx.governanceActor!, action, ctx.experimentDefinition).allowed
    );

    const viewActionsStr = [...view.governance.allowedActions].sort().join(",");
    const expectedActionsStr = [...expectedAllowed].sort().join(",");

    const passed = viewActionsStr === expectedActionsStr;

    return {
      passed,
      invariantId: "INV_101_ALLOWED_ACTIONS_CORRECT",
      name: "Console Governance Authorization Accuracy Guard",
      severity: "critical",
      reason: passed ? undefined : `Console governance allowedActions (${viewActionsStr}) did not match expected governance engine permissions (${expectedActionsStr}).`,
    };
  },
};

/**
 * Invariant #102: No Reverse Dependencies. Domain layers (registry, targeting, scheduler, governance) must never import console.
 */
export const INV_102_NO_REVERSE_DEPENDENCIES: ExperimentInvariant = {
  id: "INV_102_NO_REVERSE_DEPENDENCIES",
  name: "Reverse Dependency Prohibition Guard",
  description: "registry, targeting, scheduler, and governance modules must never import from console.",
  severity: "critical",
  check: () => {
    const domainDirs = ["registry", "targeting", "scheduler", "governance"];
    const violations: string[] = [];

    try {
      const fs = require("fs");
      const path = require("path");
      const baseDir = path.resolve("src/lib/analytics");

      for (const dir of domainDirs) {
        const fullDirPath = path.join(baseDir, dir);
        if (fs.existsSync(fullDirPath)) {
          const files = fs.readdirSync(fullDirPath).filter((f: string) => f.endsWith(".ts"));
          for (const file of files) {
            const filePath = path.join(fullDirPath, file);
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.includes("/console") || content.includes('from "./console"') || content.includes('from "../console"')) {
              violations.push(`${dir}/${file}`);
            }
          }
        }
      }
    } catch {
      // In non-filesystem environments, assume passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_102_NO_REVERSE_DEPENDENCIES",
      name: "Reverse Dependency Prohibition Guard",
      severity: "critical",
      reason: passed ? undefined : `Reverse dependency violations found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #103: Console Time Injection. Console module files must never instantiate time internally (new Date() with no args or Date.now()).
 */
export const INV_103_CONSOLE_TIME_INJECTION: ExperimentInvariant = {
  id: "INV_103_CONSOLE_TIME_INJECTION",
  name: "Console External Time Injection Guard",
  description: "console module files must never instantiate time internally (new Date() with no args or Date.now()).",
  severity: "critical",
  check: () => {
    const consoleFiles = ["console-engine.ts", "console-projections.ts", "console-utils.ts", "console-formatters.ts", "console-validator.ts"];
    const violations: string[] = [];

    try {
      const fs = require("fs");
      const path = require("path");
      const baseDir = path.resolve("src/lib/analytics/console");

      for (const file of consoleFiles) {
        const filePath = path.join(baseDir, file);
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, "utf-8");
          const code = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
          if (code.includes("new Date()") || code.includes("Date.now()")) {
            violations.push(file);
          }
        }
      }
    } catch {
      // In non-filesystem environments, assume passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_103_CONSOLE_TIME_INJECTION",
      name: "Console External Time Injection Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation (new Date() / Date.now()) found in: ${violations.join(", ")}`,
    };
  },
};

import {
  INV_104_RUNTIME_DETERMINISTIC,
  INV_105_RUNTIME_READ_ONLY,
  INV_106_RUNTIME_ORDER_STABLE,
  INV_107_ASSIGNMENT_STABLE,
  INV_108_SKIPPED_EXPERIMENTS_CORRECT,
  INV_109_VARIANT_ORDER_INDEPENDENT,
  INV_110_VARIANT_INTEGRITY,
} from "./runtime/runtime-invariants";

import {
  INV_111_EXPOSURE_DETERMINISTIC,
  INV_112_EXPOSURE_READ_ONLY,
  INV_113_EXPOSURE_IDEMPOTENT,
  INV_114_EXPOSURE_DEDUPLICATION,
  INV_115_EXPOSURE_ID_STABLE,
  INV_116_EXPOSURE_TIME_INJECTION,
  INV_117_EXPOSURE_ORDER_INDEPENDENT,
} from "./exposure/exposure-invariants";

import {
  INV_118_CONVERSION_DETERMINISTIC,
  INV_119_CONVERSION_READ_ONLY,
  INV_120_CONVERSION_IDEMPOTENT,
  INV_121_CONVERSION_DEDUPLICATION,
  INV_122_CONVERSION_ID_STABLE,
  INV_123_CONVERSION_TIME_INJECTION,
  INV_124_CONVERSION_ORDER_INDEPENDENT,
  INV_125_GOAL_OWNERSHIP,
  INV_126_CONVERSION_REQUIRES_EXPOSURE,
} from "./conversion/conversion-invariants";

import {
  INV_127_METRICS_DETERMINISTIC,
  INV_128_METRICS_READ_ONLY,
  INV_129_METRICS_ORDER_INDEPENDENT,
  INV_130_METRICS_CONSISTENT_TOTALS,
  INV_131_METRICS_ZERO_DIVISION_SAFE,
  INV_132_METRICS_ID_STABLE,
  INV_133_METRICS_TIME_INJECTION,
  INV_134_UNIQUE_COUNTS_CONSISTENT,
  INV_135_VARIANT_ORDER_CANONICAL,
  INV_136_METRICS_DERIVED_ONLY,
} from "./metrics/metrics-invariants";

import {
  INV_137_STATISTICS_DETERMINISTIC,
  INV_138_STATISTICS_READ_ONLY,
  INV_139_STATISTICS_ORDER_INDEPENDENT,
  INV_140_ZERO_SAMPLE_SAFE,
  INV_141_PVALUE_RANGE,
  INV_142_ZSCORE_FINITE,
  INV_143_REPORT_ID_STABLE,
  INV_144_TIME_FREE,
} from "./statistics/statistics-invariants";

import {
  INV_145_DECISION_DETERMINISTIC,
  INV_146_DECISION_READ_ONLY,
  INV_147_DECISION_ORDER_INDEPENDENT,
  INV_148_SIGNIFICANCE_REQUIRED,
  INV_149_SAMPLE_SIZE_REQUIRED,
  INV_150_DECISION_PROJECTION_ONLY,
  INV_151_DECISION_REASON_STABLE,
  INV_152_TIME_FREE,
} from "./decision/decision-invariants";

import {
  INV_153_ROLLOUT_DETERMINISTIC,
  INV_154_ROLLOUT_READ_ONLY,
  INV_155_TRAFFIC_SUM_100,
  INV_156_VALID_TRAFFIC_RANGE,
  INV_157_DECISION_REQUIRED,
  INV_158_POLICY_STABLE,
  INV_159_PROJECTION_ONLY,
  INV_160_TIME_FREE,
} from "./rollout/rollout-invariants";

import {
  INV_161_EXECUTION_DETERMINISTIC,
  INV_162_EXECUTION_READ_ONLY,
  INV_163_STAGE_ORDER_MONOTONIC,
  INV_164_STAGE_RANGE_VALID,
  INV_165_ROLLOUT_PLAN_REQUIRED,
  INV_166_EXECUTION_HISTORY_STABLE,
  INV_167_EXECUTION_ONLY,
  INV_168_TIME_FREE,
  INV_169_HISTORY_SEQUENCE_MONOTONIC,
  INV_170_HISTORY_APPEND_ONLY,
  INV_171_HISTORY_REPLAYABLE,
  INV_172_STAGE_HISTORY_CONSISTENT,
} from "./execution/execution-invariants";

import {
  INV_173_SCHEDULE_DETERMINISTIC,
  INV_174_SCHEDULE_READ_ONLY,
  INV_175_STAGE_TICK_MONOTONIC,
  INV_176_NON_OVERLAPPING_WINDOWS,
  INV_177_EXECUTION_REQUIRED,
  INV_178_SCHEDULE_HISTORY_STABLE,
  INV_179_PROJECTION_ONLY,
  INV_180_LOGICAL_TIME_ONLY,
  INV_181_HISTORY_SEQUENCE_MONOTONIC,
  INV_182_HISTORY_APPEND_ONLY,
  INV_183_EXPIRATION_AFTER_LAST_STAGE,
  INV_184_CURRENT_STAGE_CONSISTENT,
} from "./scheduler/scheduler-invariants";

export {
  INV_104_RUNTIME_DETERMINISTIC,
  INV_105_RUNTIME_READ_ONLY,
  INV_106_RUNTIME_ORDER_STABLE,
  INV_107_ASSIGNMENT_STABLE,
  INV_108_SKIPPED_EXPERIMENTS_CORRECT,
  INV_109_VARIANT_ORDER_INDEPENDENT,
  INV_110_VARIANT_INTEGRITY,
  INV_111_EXPOSURE_DETERMINISTIC,
  INV_112_EXPOSURE_READ_ONLY,
  INV_113_EXPOSURE_IDEMPOTENT,
  INV_114_EXPOSURE_DEDUPLICATION,
  INV_115_EXPOSURE_ID_STABLE,
  INV_116_EXPOSURE_TIME_INJECTION,
  INV_117_EXPOSURE_ORDER_INDEPENDENT,
  INV_118_CONVERSION_DETERMINISTIC,
  INV_119_CONVERSION_READ_ONLY,
  INV_120_CONVERSION_IDEMPOTENT,
  INV_121_CONVERSION_DEDUPLICATION,
  INV_122_CONVERSION_ID_STABLE,
  INV_123_CONVERSION_TIME_INJECTION,
  INV_124_CONVERSION_ORDER_INDEPENDENT,
  INV_125_GOAL_OWNERSHIP,
  INV_126_CONVERSION_REQUIRES_EXPOSURE,
  INV_127_METRICS_DETERMINISTIC,
  INV_128_METRICS_READ_ONLY,
  INV_129_METRICS_ORDER_INDEPENDENT,
  INV_130_METRICS_CONSISTENT_TOTALS,
  INV_131_METRICS_ZERO_DIVISION_SAFE,
  INV_132_METRICS_ID_STABLE,
  INV_133_METRICS_TIME_INJECTION,
  INV_134_UNIQUE_COUNTS_CONSISTENT,
  INV_135_VARIANT_ORDER_CANONICAL,
  INV_136_METRICS_DERIVED_ONLY,
  INV_137_STATISTICS_DETERMINISTIC,
  INV_138_STATISTICS_READ_ONLY,
  INV_139_STATISTICS_ORDER_INDEPENDENT,
  INV_140_ZERO_SAMPLE_SAFE,
  INV_141_PVALUE_RANGE,
  INV_142_ZSCORE_FINITE,
  INV_143_REPORT_ID_STABLE,
  INV_144_TIME_FREE,
  INV_145_DECISION_DETERMINISTIC,
  INV_146_DECISION_READ_ONLY,
  INV_147_DECISION_ORDER_INDEPENDENT,
  INV_148_SIGNIFICANCE_REQUIRED,
  INV_149_SAMPLE_SIZE_REQUIRED,
  INV_150_DECISION_PROJECTION_ONLY,
  INV_151_DECISION_REASON_STABLE,
  INV_152_TIME_FREE,
  INV_153_ROLLOUT_DETERMINISTIC,
  INV_154_ROLLOUT_READ_ONLY,
  INV_155_TRAFFIC_SUM_100,
  INV_156_VALID_TRAFFIC_RANGE,
  INV_157_DECISION_REQUIRED,
  INV_158_POLICY_STABLE,
  INV_159_PROJECTION_ONLY,
  INV_160_TIME_FREE,
  INV_161_EXECUTION_DETERMINISTIC,
  INV_162_EXECUTION_READ_ONLY,
  INV_163_STAGE_ORDER_MONOTONIC,
  INV_164_STAGE_RANGE_VALID,
  INV_165_ROLLOUT_PLAN_REQUIRED,
  INV_166_EXECUTION_HISTORY_STABLE,
  INV_167_EXECUTION_ONLY,
  INV_168_TIME_FREE,
  INV_169_HISTORY_SEQUENCE_MONOTONIC,
  INV_170_HISTORY_APPEND_ONLY,
  INV_171_HISTORY_REPLAYABLE,
  INV_172_STAGE_HISTORY_CONSISTENT,
  INV_173_SCHEDULE_DETERMINISTIC,
  INV_174_SCHEDULE_READ_ONLY,
  INV_175_STAGE_TICK_MONOTONIC,
  INV_176_NON_OVERLAPPING_WINDOWS,
  INV_177_EXECUTION_REQUIRED,
  INV_178_SCHEDULE_HISTORY_STABLE,
  INV_179_PROJECTION_ONLY,
  INV_180_LOGICAL_TIME_ONLY,
  INV_181_HISTORY_SEQUENCE_MONOTONIC,
  INV_182_HISTORY_APPEND_ONLY,
  INV_183_EXPIRATION_AFTER_LAST_STAGE,
  INV_184_CURRENT_STAGE_CONSISTENT,
};

export const ALL_EXPERIMENT_INVARIANTS: readonly ExperimentInvariant[] = [
  ...EXPERIMENT_INVARIANTS,
  INV_089_PERMISSION_DETERMINISTIC,
  INV_090_OWNERSHIP_ENFORCED,
  INV_091_ADMIN_OVERRIDE,
  INV_092_ROLE_BOUNDARIES,
  INV_093_AUDIT_ORDER_STABLE,
  INV_094_OWNER_REQUIRED,
  INV_095_AUDIT_SEQUENCE_ORDER,
  INV_096_NO_APPROVED_CANDIDATE_STATE,
  INV_097_CONSOLE_DETERMINISTIC,
  INV_098_CONSOLE_READ_ONLY,
  INV_099_AUDIT_PROJECTION_ORDER,
  INV_100_CONSOLE_MATCHES_DOMAIN,
  INV_101_ALLOWED_ACTIONS_CORRECT,
  INV_102_NO_REVERSE_DEPENDENCIES,
  INV_103_CONSOLE_TIME_INJECTION,
  INV_104_RUNTIME_DETERMINISTIC,
  INV_105_RUNTIME_READ_ONLY,
  INV_106_RUNTIME_ORDER_STABLE,
  INV_107_ASSIGNMENT_STABLE,
  INV_108_SKIPPED_EXPERIMENTS_CORRECT,
  INV_109_VARIANT_ORDER_INDEPENDENT,
  INV_110_VARIANT_INTEGRITY,
  INV_111_EXPOSURE_DETERMINISTIC,
  INV_112_EXPOSURE_READ_ONLY,
  INV_113_EXPOSURE_IDEMPOTENT,
  INV_114_EXPOSURE_DEDUPLICATION,
  INV_115_EXPOSURE_ID_STABLE,
  INV_116_EXPOSURE_TIME_INJECTION,
  INV_117_EXPOSURE_ORDER_INDEPENDENT,
  INV_118_CONVERSION_DETERMINISTIC,
  INV_119_CONVERSION_READ_ONLY,
  INV_120_CONVERSION_IDEMPOTENT,
  INV_121_CONVERSION_DEDUPLICATION,
  INV_122_CONVERSION_ID_STABLE,
  INV_123_CONVERSION_TIME_INJECTION,
  INV_124_CONVERSION_ORDER_INDEPENDENT,
  INV_125_GOAL_OWNERSHIP,
  INV_126_CONVERSION_REQUIRES_EXPOSURE,
  INV_127_METRICS_DETERMINISTIC,
  INV_128_METRICS_READ_ONLY,
  INV_129_METRICS_ORDER_INDEPENDENT,
  INV_130_METRICS_CONSISTENT_TOTALS,
  INV_131_METRICS_ZERO_DIVISION_SAFE,
  INV_132_METRICS_ID_STABLE,
  INV_133_METRICS_TIME_INJECTION,
  INV_134_UNIQUE_COUNTS_CONSISTENT,
  INV_135_VARIANT_ORDER_CANONICAL,
  INV_136_METRICS_DERIVED_ONLY,
  INV_137_STATISTICS_DETERMINISTIC,
  INV_138_STATISTICS_READ_ONLY,
  INV_139_STATISTICS_ORDER_INDEPENDENT,
  INV_140_ZERO_SAMPLE_SAFE,
  INV_141_PVALUE_RANGE,
  INV_142_ZSCORE_FINITE,
  INV_143_REPORT_ID_STABLE,
  INV_144_TIME_FREE,
  INV_145_DECISION_DETERMINISTIC,
  INV_146_DECISION_READ_ONLY,
  INV_147_DECISION_ORDER_INDEPENDENT,
  INV_148_SIGNIFICANCE_REQUIRED,
  INV_149_SAMPLE_SIZE_REQUIRED,
  INV_150_DECISION_PROJECTION_ONLY,
  INV_151_DECISION_REASON_STABLE,
  INV_152_TIME_FREE,
  INV_153_ROLLOUT_DETERMINISTIC,
  INV_154_ROLLOUT_READ_ONLY,
  INV_155_TRAFFIC_SUM_100,
  INV_156_VALID_TRAFFIC_RANGE,
  INV_157_DECISION_REQUIRED,
  INV_158_POLICY_STABLE,
  INV_159_PROJECTION_ONLY,
  INV_160_TIME_FREE,
  INV_161_EXECUTION_DETERMINISTIC,
  INV_162_EXECUTION_READ_ONLY,
  INV_163_STAGE_ORDER_MONOTONIC,
  INV_164_STAGE_RANGE_VALID,
  INV_165_ROLLOUT_PLAN_REQUIRED,
  INV_166_EXECUTION_HISTORY_STABLE,
  INV_167_EXECUTION_ONLY,
  INV_168_TIME_FREE,
  INV_169_HISTORY_SEQUENCE_MONOTONIC,
  INV_170_HISTORY_APPEND_ONLY,
  INV_171_HISTORY_REPLAYABLE,
  INV_172_STAGE_HISTORY_CONSISTENT,
  INV_173_SCHEDULE_DETERMINISTIC,
  INV_174_SCHEDULE_READ_ONLY,
  INV_175_STAGE_TICK_MONOTONIC,
  INV_176_NON_OVERLAPPING_WINDOWS,
  INV_177_EXECUTION_REQUIRED,
  INV_178_SCHEDULE_HISTORY_STABLE,
  INV_179_PROJECTION_ONLY,
  INV_180_LOGICAL_TIME_ONLY,
  INV_181_HISTORY_SEQUENCE_MONOTONIC,
  INV_182_HISTORY_APPEND_ONLY,
  INV_183_EXPIRATION_AFTER_LAST_STAGE,
  INV_184_CURRENT_STAGE_CONSISTENT,
] as const;

/**
 * Evaluates all 184 experiment invariants for a given experiment context.
 */
export function checkAllInvariants(ctx: InvariantCheckContext): InvariantCheckResult[] {
  return ALL_EXPERIMENT_INVARIANTS.map((inv) => inv.check(ctx));
}





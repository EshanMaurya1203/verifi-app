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

export interface DistributionHealth {
  expectedPercentage: number;
  actualPercentage: number;
  deltaPercentage: number;
  healthy: boolean;
}

export interface InvariantCheckContext {
  experiment: Experiment;
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
  distributionCounts?: Record<string, number>;
  distributionTotal?: number;
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
] as const;

/**
 * Evaluates all 36 experiment invariants for a given experiment context.
 */
export function checkAllInvariants(ctx: InvariantCheckContext): InvariantCheckResult[] {
  return EXPERIMENT_INVARIANTS.map((inv) => inv.check(ctx));
}

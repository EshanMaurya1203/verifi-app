// ─── VRF-ONBOARD-001E.12B — Experiment Contract Validators ──────────────

import type { Experiment, ExperimentStatus, ExperimentVariant } from "./experiments";

export interface ControlValidationResult {
  valid: boolean;
  controlVariantId?: string;
  reason?: string;
}

export interface AllocationValidationResult {
  valid: boolean;
  totalAllocation: number;
  reason?: string;
}

export interface LifecycleValidationResult {
  valid: boolean;
  violations: string[];
}

export interface ExclusionValidationResult {
  valid: boolean;
  conflictingExperimentIds: string[];
  reason?: string;
}

/**
 * Validates that an experiment contains exactly one control variant (isControl === true).
 */
export function validateControlVariant(experiment: {
  variants: Array<{ id: string; isControl: boolean }>;
}): ControlValidationResult {
  if (!experiment || !experiment.variants || experiment.variants.length === 0) {
    return {
      valid: false,
      reason: "Experiment must contain at least one variant.",
    };
  }

  const controlVariants = experiment.variants.filter((v) => v.isControl);

  if (controlVariants.length === 0) {
    return {
      valid: false,
      reason: "Experiment does not contain a control variant (isControl: true required).",
    };
  }

  if (controlVariants.length > 1) {
    return {
      valid: false,
      reason: `Experiment contains multiple control variants (${controlVariants
        .map((v) => v.id)
        .join(", ")}). Exactly one control variant is permitted.`,
    };
  }

  return {
    valid: true,
    controlVariantId: controlVariants[0].id,
  };
}

/**
 * Validates traffic allocations across variants.
 * Allocations must sum to exactly 100%, each variant allocation must be > 0%,
 * and at least 2 variants are required.
 */
export function validateAllocations(
  variants: Array<{ id: string; allocation: number }>
): AllocationValidationResult {
  if (!variants || variants.length < 2) {
    return {
      valid: false,
      totalAllocation: variants ? variants.reduce((s, v) => s + (v.allocation || 0), 0) : 0,
      reason: "Experiment must contain at least two variants (Control + at least 1 Treatment).",
    };
  }

  let totalAllocation = 0;
  for (const v of variants) {
    if (typeof v.allocation !== "number" || isNaN(v.allocation)) {
      return {
        valid: false,
        totalAllocation: 0,
        reason: `Variant '${v.id}' has invalid non-numeric allocation.`,
      };
    }

    if (v.allocation <= 0) {
      return {
        valid: false,
        totalAllocation: 0,
        reason: `Variant '${v.id}' allocation must be greater than 0%.`,
      };
    }

    if (v.allocation > 100) {
      return {
        valid: false,
        totalAllocation: 0,
        reason: `Variant '${v.id}' allocation cannot exceed 100%.`,
      };
    }

    totalAllocation += v.allocation;
  }

  const roundedTotal = Math.round(totalAllocation * 100) / 100;
  if (roundedTotal !== 100) {
    return {
      valid: false,
      totalAllocation: roundedTotal,
      reason: `Total traffic allocation across variants must sum to exactly 100% (currently ${roundedTotal}%).`,
    };
  }

  return {
    valid: true,
    totalAllocation: 100,
  };
}

/**
 * Enforces mandatory lifecycle preconditions before an experiment can start.
 */
export function validateExperimentStart(
  experiment: Experiment
): LifecycleValidationResult {
  const violations: string[] = [];

  if (!experiment) {
    return { valid: false, violations: ["Experiment payload is missing."] };
  }

  // 1. Status Guard
  if (experiment.status !== "draft") {
    violations.push(`Experiment must be in 'draft' status to start (current: '${experiment.status}').`);
  }

  // 2. Control Variant Guard
  const controlCheck = validateControlVariant(experiment);
  if (!controlCheck.valid && controlCheck.reason) {
    violations.push(controlCheck.reason);
  }

  // 3. Allocation Guard
  const allocationCheck = validateAllocations(experiment.variants || []);
  if (!allocationCheck.valid && allocationCheck.reason) {
    violations.push(allocationCheck.reason);
  }

  // 4. Sample Size Guard
  if (!experiment.minSampleSize || experiment.minSampleSize <= 0) {
    violations.push("minSampleSize must be defined and greater than 0.");
  }

  // 5. Maximum Duration Guard
  if (!experiment.maxDurationDays || experiment.maxDurationDays <= 0) {
    violations.push("maxDurationDays must be defined and greater than 0.");
  }

  // 6. Target Metric Guard
  if (!experiment.targetMetric) {
    violations.push("targetMetric must be specified ('conversion_rate', 'completion_duration', or 'recovery_rate').");
  }

  // 7. Ownership Guard
  if (!experiment.ownerEmail || !experiment.createdBy) {
    violations.push("Experiment owner email and creator ID must be assigned.");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Enforces mutual exclusion by checking that no other running experiment
 * shares the same exclusionGroup.
 */
export function validateExclusionGroup(
  experiment: { id: string; exclusionGroup?: string },
  runningExperiments: Array<{ id: string; status: ExperimentStatus; exclusionGroup?: string }>
): ExclusionValidationResult {
  if (!experiment || !experiment.exclusionGroup) {
    return { valid: true, conflictingExperimentIds: [] };
  }

  const conflicting = (runningExperiments || []).filter(
    (other) =>
      other.id !== experiment.id &&
      other.status === "running" &&
      other.exclusionGroup === experiment.exclusionGroup
  );

  if (conflicting.length > 0) {
    const conflictingIds = conflicting.map((c) => c.id);
    return {
      valid: false,
      conflictingExperimentIds: conflictingIds,
      reason: `Exclusion group '${experiment.exclusionGroup}' already has running experiment(s): ${conflictingIds.join(", ")}.`,
    };
  }

  return {
    valid: true,
    conflictingExperimentIds: [],
  };
}

export interface AssignmentValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates that a VariantAssignment record satisfies auditability rules:
 * non-empty assignmentHash, experimentVersion > 0, non-empty variantId,
 * non-empty experimentId, and valid assignmentReason.
 */
export function validateAssignmentAuditability(
  assignment: import("./experiments").VariantAssignment
): AssignmentValidationResult {
  if (!assignment) {
    return { valid: false, reason: "VariantAssignment payload is missing." };
  }

  if (!assignment.experimentId || assignment.experimentId.trim() === "") {
    return { valid: false, reason: "experimentId cannot be empty." };
  }

  if (typeof assignment.experimentVersion !== "number" || assignment.experimentVersion <= 0) {
    return { valid: false, reason: "experimentVersion must be > 0." };
  }

  if (!assignment.variantId || assignment.variantId.trim() === "") {
    return { valid: false, reason: "variantId cannot be empty." };
  }

  if (!assignment.assignmentHash || assignment.assignmentHash.trim() === "") {
    return { valid: false, reason: "assignmentHash cannot be empty." };
  }

  const validReasons = ["hash", "migration", "manual_override"];
  if (!validReasons.includes(assignment.assignmentReason)) {
    return {
      valid: false,
      reason: `assignmentReason must be 'hash', 'migration', or 'manual_override' (got '${assignment.assignmentReason}').`,
    };
  }

  return { valid: true };
}

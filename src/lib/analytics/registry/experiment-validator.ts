// ─── VRF-ONBOARD-003A — Experiment Definition Validator ──────────────────

import type { ExperimentDefinition } from "./experiment-types";

export interface ValidationResult {
  passed: boolean;

  errors: string[];
}

/**
 * Validates an ExperimentDefinition against mandatory schema and business rules.
 *
 * Rules:
 * ✓ id is required
 * ✓ name is required
 * ✓ owner is required
 * ✓ description is required
 * ✓ version >= 1
 * ✓ successMetric exists
 * ✓ rollbackPlan exists
 * ✓ minimum 2 variants
 * ✓ every variant weight > 0
 * ✓ sum of weights = 100
 * ✓ active experiments cannot have empty targeting
 */
export function validateExperiment(
  experiment: ExperimentDefinition
): ValidationResult {
  const errors: string[] = [];

  if (!experiment) {
    return { passed: false, errors: ["Experiment definition is required."] };
  }

  if (!experiment.id || typeof experiment.id !== "string" || experiment.id.trim() === "") {
    errors.push("Experiment id is required.");
  }

  if (!experiment.name || typeof experiment.name !== "string" || experiment.name.trim() === "") {
    errors.push("Experiment name is required.");
  }

  if (!experiment.owner || typeof experiment.owner !== "string" || experiment.owner.trim() === "") {
    errors.push("Experiment owner is required.");
  }

  if (!experiment.ownerId || typeof experiment.ownerId !== "string" || experiment.ownerId.trim() === "") {
    errors.push("Experiment ownerId is required and cannot be empty.");
  }

  if (!experiment.description || typeof experiment.description !== "string" || experiment.description.trim() === "") {
    errors.push("Experiment description is required.");
  }

  if (typeof experiment.version !== "number" || experiment.version < 1) {
    errors.push("Experiment version must be a number >= 1.");
  }

  if (!experiment.successMetric || typeof experiment.successMetric !== "string" || experiment.successMetric.trim() === "") {
    errors.push("Experiment successMetric is required.");
  }

  if (!experiment.rollbackPlan || typeof experiment.rollbackPlan !== "string" || experiment.rollbackPlan.trim() === "") {
    errors.push("Experiment rollbackPlan is required.");
  }

  // Variant rules
  if (!Array.isArray(experiment.variants) || experiment.variants.length < 2) {
    errors.push("Experiment must contain at least 2 variants.");
  } else {
    let weightSum = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      const v = experiment.variants[i];
      if (!v || !v.id || typeof v.id !== "string" || v.id.trim() === "") {
        errors.push(`Variant at index ${i} must have a valid id.`);
      }
      if (typeof v.weight !== "number" || v.weight <= 0) {
        errors.push(`Variant '${v?.id || i}' weight must be > 0.`);
      } else {
        weightSum += v.weight;
      }
    }

    if (Math.abs(weightSum - 100) > 0.001) {
      errors.push(`Sum of variant weights must equal 100 (got ${weightSum}).`);
    }
  }

  // Active experiment targeting rule
  if (experiment.status === "active") {
    const t = experiment.targeting;
    const hasCountries = Array.isArray(t?.countries) && t.countries.length > 0;
    const hasProviders = Array.isArray(t?.providers) && t.providers.length > 0;
    const hasNewUsers = typeof t?.newUsersOnly === "boolean";
    const hasStep = Array.isArray(t?.onboardingSteps) && t.onboardingSteps.length > 0;

    if (!t || (!hasCountries && !hasProviders && !hasNewUsers && !hasStep)) {
      errors.push("Active experiments cannot have empty targeting rules.");
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

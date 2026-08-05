// ─── VRF-ONBOARD-003B.1 / 003B.2 — Targeting Engine Module ─────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { TargetingContext } from "./targeting-context";
import type { EligibilityResult } from "./targeting-types";
import { validateTargetingRules } from "./targeting-validator";
import { EligibilityEvaluationError } from "./targeting-errors";
import {
  normalizeCountry,
  normalizeProvider,
  normalizeAcquisitionSource,
} from "./normalization";
import { isMissingContextValue } from "./context-utils";

/**
 * Evaluation Strategy:
 *
 * - Full evaluation
 * - No fail-fast behavior
 * - Collect all failures
 * - Deterministic rule order
 *
 * Complexity:
 *
 * O(number_of_rules)
 *
 * Current rules:
 *
 * 1. country
 * 2. provider
 * 3. acquisition source
 * 4. onboarding step
 * 5. new user
 * 6. returning user
 */
export function isEligible(
  experiment: ExperimentDefinition,
  context: TargetingContext
): EligibilityResult {
  if (!experiment) {
    throw new EligibilityEvaluationError("Experiment definition is required for targeting evaluation.");
  }
  if (!context) {
    throw new EligibilityEvaluationError("TargetingContext is required for targeting evaluation.");
  }

  const rules = experiment.targeting || {};

  // Patch 1: Runtime Contradiction Protection
  if (rules.newUsersOnly === true && rules.returningUsersOnly === true) {
    throw new EligibilityEvaluationError(
      "Contradictory targeting rules: newUsersOnly and returningUsersOnly cannot both be true."
    );
  }

  const validation = validateTargetingRules(rules);
  if (!validation.passed) {
    throw new EligibilityEvaluationError(`Invalid targeting rules: ${validation.errors.join("; ")}`);
  }

  const matchedRules: string[] = [];
  const failedRules: string[] = [];
  const failureReasons: string[] = [];

  // 1. Country (normalized case-insensitive)
  if (Array.isArray(rules.countries) && rules.countries.length > 0) {
    if (isMissingContextValue(context.country)) {
      failedRules.push("country");
      failureReasons.push("Missing country context");
    } else {
      const normUserCountry = normalizeCountry(context.country!);
      const normAllowedCountries = rules.countries.map(normalizeCountry);
      if (normAllowedCountries.includes(normUserCountry)) {
        matchedRules.push("country");
      } else {
        failedRules.push("country");
        failureReasons.push(`Country '${context.country}' not in target list`);
      }
    }
  }

  // 2. Provider (normalized exact string)
  if (Array.isArray(rules.providers) && rules.providers.length > 0) {
    if (isMissingContextValue(context.provider)) {
      failedRules.push("provider");
      failureReasons.push("Missing provider context");
    } else {
      const normUserProvider = normalizeProvider(context.provider!);
      const normAllowedProviders = rules.providers.map(normalizeProvider);
      if (normAllowedProviders.includes(normUserProvider)) {
        matchedRules.push("provider");
      } else {
        failedRules.push("provider");
        failureReasons.push(`Provider '${context.provider}' not in target list`);
      }
    }
  }

  // 3. Acquisition source (normalized case-insensitive)
  if (Array.isArray(rules.acquisitionSources) && rules.acquisitionSources.length > 0) {
    if (isMissingContextValue(context.acquisitionSource)) {
      failedRules.push("acquisition source");
      failureReasons.push("Missing acquisition source context");
    } else {
      const normUserSource = normalizeAcquisitionSource(context.acquisitionSource!);
      const normAllowedSources = rules.acquisitionSources.map(normalizeAcquisitionSource);
      if (normAllowedSources.includes(normUserSource)) {
        matchedRules.push("acquisition source");
      } else {
        failedRules.push("acquisition source");
        failureReasons.push(`Acquisition source '${context.acquisitionSource}' not in target list`);
      }
    }
  }

  // 4. Onboarding step (exact string match after trimming)
  if (Array.isArray(rules.onboardingSteps) && rules.onboardingSteps.length > 0) {
    if (isMissingContextValue(context.onboardingStep)) {
      failedRules.push("onboarding step");
      failureReasons.push("Missing onboarding step context");
    } else {
      const stepTrimmed = context.onboardingStep!.trim();
      const allowedSteps = rules.onboardingSteps.map((s) => s.trim());
      if (allowedSteps.includes(stepTrimmed)) {
        matchedRules.push("onboarding step");
      } else {
        failedRules.push("onboarding step");
        failureReasons.push(`Onboarding step '${context.onboardingStep}' not in target list`);
      }
    }
  }

  // 5. New user (context.isReturningUser === false)
  if (rules.newUsersOnly === true) {
    if (context.isReturningUser === false) {
      matchedRules.push("new user");
    } else {
      failedRules.push("new user");
      failureReasons.push("Returning users are not eligible");
    }
  }

  // 6. Returning user (context.isReturningUser === true)
  if (rules.returningUsersOnly === true) {
    if (context.isReturningUser === true) {
      matchedRules.push("returning user");
    } else {
      failedRules.push("returning user");
      failureReasons.push("New users are not eligible");
    }
  }

  const eligible = failedRules.length === 0;
  const reason = eligible ? undefined : failureReasons.join("; ");

  return {
    eligible,
    matchedRules,
    failedRules,
    reason,
  };
}

// ─── VRF-ONBOARD-003B.1 / 003B.2 — Targeting Validator Module ──────────────

import type { ExperimentTargetingRules } from "./targeting-rules";
import {
  normalizeCountry,
  normalizeProvider,
  normalizeAcquisitionSource,
} from "./normalization";
import { InvalidTargetingRuleError } from "./targeting-errors";

export interface TargetingValidationResult {
  passed: boolean;

  errors: string[];
}

/**
 * Validates ExperimentTargetingRules for structural integrity and logical contradictions.
 *
 * Rules:
 * ✓ newUsersOnly and returningUsersOnly cannot both be true
 * ✓ country list cannot contain duplicates (normalized)
 * ✓ provider list cannot contain duplicates & all providers must belong to ALLOWED_PROVIDERS
 * ✓ acquisition source list cannot contain duplicates (normalized)
 * ✓ onboarding step list cannot contain duplicates
 */
export function validateTargetingRules(
  rules: ExperimentTargetingRules
): TargetingValidationResult {
  const errors: string[] = [];

  if (!rules) {
    return { passed: true, errors: [] };
  }

  // 1. Check user state contradiction
  if (rules.newUsersOnly === true && rules.returningUsersOnly === true) {
    errors.push("Targeting contradiction: newUsersOnly and returningUsersOnly cannot both be true.");
  }

  // 2. Check duplicate countries
  if (Array.isArray(rules.countries)) {
    const seen = new Set<string>();
    for (const c of rules.countries) {
      if (typeof c === "string") {
        const norm = normalizeCountry(c);
        if (seen.has(norm)) {
          errors.push(`Duplicate country '${c}' found in targeting rules.`);
        }
        seen.add(norm);
      }
    }
  }

  // 3. Check duplicate and unknown providers
  if (Array.isArray(rules.providers)) {
    const seen = new Set<string>();
    for (const p of rules.providers) {
      if (typeof p === "string") {
        try {
          const norm = normalizeProvider(p);
          if (seen.has(norm)) {
            errors.push(`Duplicate provider '${p}' found in targeting rules.`);
          }
          seen.add(norm);
        } catch (err) {
          if (err instanceof InvalidTargetingRuleError) {
            errors.push(err.message);
          } else {
            throw err;
          }
        }
      }
    }
  }

  // 4. Check duplicate acquisition sources
  if (Array.isArray(rules.acquisitionSources)) {
    const seen = new Set<string>();
    for (const s of rules.acquisitionSources) {
      if (typeof s === "string") {
        const norm = normalizeAcquisitionSource(s);
        if (seen.has(norm)) {
          errors.push(`Duplicate acquisition source '${s}' found in targeting rules.`);
        }
        seen.add(norm);
      }
    }
  }

  // 5. Check duplicate onboarding steps
  if (Array.isArray(rules.onboardingSteps)) {
    const seen = new Set<string>();
    for (const step of rules.onboardingSteps) {
      if (typeof step === "string") {
        const norm = step.trim();
        if (seen.has(norm)) {
          errors.push(`Duplicate onboarding step '${step}' found in targeting rules.`);
        }
        seen.add(norm);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

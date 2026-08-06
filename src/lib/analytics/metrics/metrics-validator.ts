// ─── VRF-ONBOARD-004D — Metrics Validator ────────────────────────────────────

import type { ExposureEvent } from "../exposure/exposure-types";
import type { ConversionEvent } from "../conversion/conversion-types";

export interface MetricsValidationResult {
  passed: boolean;
  errors: string[];
}

/**
 * Validates a metrics aggregation request.
 * Rules:
 * 1. experimentId required non-empty string.
 * 2. generatedAt required valid Date object.
 * 3. exposures must be an array, all items belonging to experimentId.
 * 4. conversions must be an array, all items belonging to experimentId.
 */
export function validateMetricsRequest(
  experimentId: string,
  exposures: readonly ExposureEvent[],
  conversions: readonly ConversionEvent[],
  generatedAt: Date
): MetricsValidationResult {
  const errors: string[] = [];

  if (!experimentId || typeof experimentId !== "string" || experimentId.trim() === "") {
    errors.push("Metrics request requires a valid non-empty experimentId.");
  }

  if (!generatedAt || !(generatedAt instanceof Date) || isNaN(generatedAt.getTime())) {
    errors.push("Metrics request requires a valid generatedAt Date object.");
  }

  if (!Array.isArray(exposures)) {
    errors.push("Exposures input must be an array.");
  } else {
    exposures.forEach((exp, idx) => {
      if (!exp || typeof exp !== "object") {
        errors.push(`Exposure at index ${idx} is invalid.`);
      } else if (experimentId && exp.experimentId.trim() !== experimentId.trim()) {
        errors.push(
          `Exposure at index ${idx} belongs to experiment '${exp.experimentId}', expected '${experimentId}'.`
        );
      }
    });
  }

  if (!Array.isArray(conversions)) {
    errors.push("Conversions input must be an array.");
  } else {
    conversions.forEach((conv, idx) => {
      if (!conv || typeof conv !== "object") {
        errors.push(`Conversion at index ${idx} is invalid.`);
      } else if (experimentId && conv.experimentId.trim() !== experimentId.trim()) {
        errors.push(
          `Conversion at index ${idx} belongs to experiment '${conv.experimentId}', expected '${experimentId}'.`
        );
      }
    });
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

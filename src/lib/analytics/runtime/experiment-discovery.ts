/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-002C — Experiment Discovery Abstraction ────────────────

import type { RuntimeExperiment } from "./router-types";

export interface ExperimentRegistry {
  experiments: RuntimeExperiment[];
}

/**
 * Creates an in-memory ExperimentRegistry.
 */
export function createExperimentRegistry(): ExperimentRegistry {
  return {
    experiments: [],
  };
}

/**
 * Retrieves all enabled active experiments from registry sorted by priority descending.
 *
 * Rules:
 * - enabled === true
 * - sorted by priority descending (e.g. priority 10 before priority 5)
 */
export function getActiveExperiments(
  registry: ExperimentRegistry
): RuntimeExperiment[] {
  if (!registry || !registry.experiments) {
    return [];
  }

  return registry.experiments
    .filter((e) => e.enabled === true)
    .sort((a, b) => b.priority - a.priority);
}

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
// ─── VRF-ONBOARD-002Z — Concurrent Determinism Validator Engine ─────────
import type { RuntimeExperiment } from "./router-types";
import { createExperimentRegistry } from "./experiment-discovery";
import { createAssignmentStore } from "./assignment-store";
import { createEventQueue } from "./event-queue";
import { createEventStorage } from "./event-storage";
import { createDefaultFlags } from "./feature-flags";
import { createAuditLog } from "./audit-log";
import { executeMiddleware } from "./runtime-middleware";

export interface ConcurrencyValidationResult {
  workers: number;

  iterations: number;

  mismatches: number;

  passed: boolean;

  durationMs: number;
}

/**
 * Runs concurrent determinism validation simulating N worker pipelines running K iterations.
 *
 * Rules:
 * - 20 workers × 1000 iterations (or specified parameters)
 * - Identical input must strictly produce identical output across all workers and iterations
 * - mismatches must equal 0
 * - passed = true only if mismatches === 0
 */
export function runConcurrentDeterminismValidation(
  workers: number = 20,
  iterations: number = 1000
): ConcurrencyValidationResult {
  const start = Date.now();
  let mismatches = 0;

  // ── Reference experiment set ────────────────────────────────────────
  const experimentDefs: RuntimeExperiment[] = [];
  for (let i = 0; i < 20; i++) {
    experimentDefs.push({
      id: `conc_exp_${i}`,
      version: 1,
      enabled: true,
      priority: 20 - i,
      variants: [
        { id: `ctrl_${i}`, weight: 50 },
        { id: `treat_${i}`, weight: 50 },
      ],
    });
  }

  // ── Reference sessions ──────────────────────────────────────────────
  const sessionRequests = Array.from({ length: 50 }, (_, i) => ({
    sessionId: `conc_sess_${i}`,
    userId: `conc_user_${i}`,
    pathname: "/concurrency",
  }));

  // ── Golden Reference Output ────────────────────────────────────────
  const referenceOutputs: string[] = [];

  {
    const registry = createExperimentRegistry();
    for (const def of experimentDefs) {
      registry.experiments.push({ ...def });
    }
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    for (const req of sessionRequests) {
      const result = executeMiddleware(req, registry, store, queue, storage, flags, audit);
      const serialized = result.context.assignments
        .map((a) => `${a.experimentId}:${a.variantId}`)
        .sort()
        .join("|");
      referenceOutputs.push(serialized);
    }
  }

  // ── Run N workers × K iterations simulated concurrent execution ─────
  for (let w = 0; w < workers; w++) {
    for (let iter = 0; iter < iterations; iter++) {
      const registry = createExperimentRegistry();
      for (const def of experimentDefs) {
        registry.experiments.push({ ...def });
      }
      const store = createAssignmentStore();
      const queue = createEventQueue();
      const storage = createEventStorage();
      const flags = createDefaultFlags();
      const audit = createAuditLog();

      for (let s = 0; s < sessionRequests.length; s++) {
        const req = sessionRequests[s];
        const result = executeMiddleware(req, registry, store, queue, storage, flags, audit);
        const serialized = result.context.assignments
          .map((a) => `${a.experimentId}:${a.variantId}`)
          .sort()
          .join("|");

        if (serialized !== referenceOutputs[s]) {
          mismatches++;
        }
      }
    }
  }

  const durationMs = Date.now() - start;
  const passed = mismatches === 0;

  return {
    workers,
    iterations,
    mismatches,
    passed,
    durationMs,
  };
}

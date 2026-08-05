// ─── VRF-ONBOARD-002F — Determinism Certification Engine ────────────────

import type { ValidationResult } from "./validation-types";
import type { RuntimeExperiment } from "./router-types";
import { createExperimentRegistry } from "./experiment-discovery";
import { createAssignmentStore } from "./assignment-store";
import { createEventQueue } from "./event-queue";
import { createEventStorage } from "./event-storage";
import { createDefaultFlags } from "./feature-flags";
import { createAuditLog } from "./audit-log";
import { executeMiddleware } from "./runtime-middleware";
import { selectVariant } from "./experiment-router";
import { recoverSession } from "./session-recovery";

/**
 * Runs determinism certification by executing identical simulation 100 times
 * and verifying outputs are byte-for-byte identical.
 *
 * Rules:
 * - Same input → same output, 100/100 times
 * - Determinism score: 0–100
 * - Certification requires 100/100
 */
export function runDeterminismValidation(): ValidationResult {
  const start = Date.now();
  const ITERATIONS = 100;
  let matchCount = 0;

  // ── Reference experiment set ────────────────────────────────────────
  const experimentDefs: RuntimeExperiment[] = [];
  for (let i = 0; i < 50; i++) {
    experimentDefs.push({
      id: `det_exp_${i}`,
      version: 1,
      enabled: true,
      priority: 50 - i,
      variants: [
        { id: `control_${i}`, weight: 50 },
        { id: `treatment_${i}`, weight: 50 },
      ],
    });
  }

  // ── Reference sessions ──────────────────────────────────────────────
  const sessionIds = Array.from({ length: 100 }, (_, i) => `det_sess_${i}`);

  // ── Reference run (iteration 0) ─────────────────────────────────────
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

    for (const sessId of sessionIds) {
      const result = executeMiddleware(
        { sessionId: sessId, userId: `user_${sessId}`, pathname: "/determinism" },
        registry, store, queue, storage, flags, audit
      );

      // Serialize assignment results to a deterministic string
      const serialized = result.context.assignments
        .map((a) => `${a.experimentId}:${a.variantId}`)
        .sort()
        .join("|");
      referenceOutputs.push(serialized);
    }
  }

  // ── Repeat 100 times and compare ────────────────────────────────────
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const registry = createExperimentRegistry();
    for (const def of experimentDefs) {
      registry.experiments.push({ ...def });
    }
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    let iterationMatch = true;

    for (let s = 0; s < sessionIds.length; s++) {
      const sessId = sessionIds[s];
      const result = executeMiddleware(
        { sessionId: sessId, userId: `user_${sessId}`, pathname: "/determinism" },
        registry, store, queue, storage, flags, audit
      );

      const serialized = result.context.assignments
        .map((a) => `${a.experimentId}:${a.variantId}`)
        .sort()
        .join("|");

      if (serialized !== referenceOutputs[s]) {
        iterationMatch = false;
        break;
      }
    }

    if (iterationMatch) {
      matchCount++;
    }
  }

  const determinismScore = Math.round((matchCount / ITERATIONS) * 100);
  const durationMs = Date.now() - start;

  return {
    name: "Determinism Certification",
    passed: determinismScore === 100,
    durationMs,
    metadata: {
      iterations: ITERATIONS,
      matchCount,
      determinismScore,
      experiments: experimentDefs.length,
      sessions: sessionIds.length,
    },
  };
}

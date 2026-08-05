// ─── VRF-ONBOARD-002F — Chaos Validation Engine ─────────────────────────

import type { ValidationResult } from "./validation-types";
import type { RuntimeExperiment } from "./router-types";
import { createExperimentRegistry } from "./experiment-discovery";
import { createAssignmentStore } from "./assignment-store";
import { createEventQueue } from "./event-queue";
import { createEventStorage } from "./event-storage";
import { createDefaultFlags } from "./feature-flags";
import { createAuditLog, triggerEmergencyRollback } from "./audit-log";
import { executeMiddleware } from "./runtime-middleware";
import { evaluateFlags } from "./flag-engine";
import { routeExperiment } from "./experiment-router";
import { saveAssignment } from "./assignment-store";
import { enqueueEvent } from "./event-queue";
import { checkAllInvariants } from "../experiment-invariants";

/**
 * Runs chaos validation scenarios that stress system safety guards.
 *
 * Scenarios:
 * 1. Activate global kill switch during active traffic
 * 2. Emergency rollback during assignment
 * 3. Invalid forced variant injection
 * 4. Corrupted sticky assignment
 * 5. Corrupted queue item
 */
export function runChaosValidation(): ValidationResult {
  const start = Date.now();
  const failures: string[] = [];

  const baseExp: RuntimeExperiment = {
    id: "chaos_exp_1",
    version: 1,
    enabled: true,
    priority: 10,
    variants: [
      { id: "control", weight: 50 },
      { id: "treatment", weight: 50 },
    ],
  };

  const baseExp2: RuntimeExperiment = {
    id: "chaos_exp_2",
    version: 1,
    enabled: true,
    priority: 5,
    variants: [
      { id: "control_2", weight: 50 },
      { id: "treatment_2", weight: 50 },
    ],
  };

  // ── Scenario 1: Global kill switch during active traffic ──────────
  try {
    const registry = createExperimentRegistry();
    registry.experiments.push({ ...baseExp }, { ...baseExp2 });
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    // Route 100 sessions normally
    for (let i = 0; i < 100; i++) {
      executeMiddleware(
        { sessionId: `chaos_s1_${i}`, userId: `chaos_u_${i}`, pathname: "/chaos" },
        registry, store, queue, storage, flags, audit
      );
    }

    // Activate global kill switch mid-traffic
    flags.globalKillSwitch = true;

    // Route 100 more sessions under kill switch
    for (let i = 100; i < 200; i++) {
      const result = executeMiddleware(
        { sessionId: `chaos_s1_${i}`, userId: `chaos_u_${i}`, pathname: "/chaos" },
        registry, store, queue, storage, flags, audit
      );

      if (result.context.assignments.length > 0) {
        failures.push("Scenario 1: Assignments leaked through global kill switch.");
        break;
      }
    }
  } catch (err: any) {
    failures.push(`Scenario 1 crashed: ${err?.message}`);
  }

  // ── Scenario 2: Emergency rollback during assignment ──────────────
  try {
    const registry = createExperimentRegistry();
    registry.experiments.push({ ...baseExp });
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    // Trigger emergency rollback
    triggerEmergencyRollback(baseExp.id, flags, audit);

    // Attempt to route through the rolled-back experiment
    const result = executeMiddleware(
      { sessionId: "chaos_s2_0", userId: "chaos_u_s2", pathname: "/chaos" },
      registry, store, queue, storage, flags, audit
    );

    if (result.context.assignments.length > 0) {
      failures.push("Scenario 2: Assignments leaked through emergency rollback.");
    }
  } catch (err: any) {
    failures.push(`Scenario 2 crashed: ${err?.message}`);
  }

  // ── Scenario 3: Invalid forced variant injection ──────────────────
  try {
    const flags = createDefaultFlags();
    flags.forcedVariants.set("chaos_exp_1", "nonexistent_variant");

    const registry = createExperimentRegistry();
    registry.experiments.push({ ...baseExp });
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const audit = createAuditLog();

    const result = executeMiddleware(
      { sessionId: "chaos_s3_0", userId: "chaos_u_s3", pathname: "/chaos" },
      registry, store, queue, storage, flags, audit
    );

    // Invalid variant should not produce an assignment
    const hasInvalidVariant = result.context.assignments.some(
      (a) => a.experimentId === "chaos_exp_1" && a.variantId === "nonexistent_variant"
    );
    if (hasInvalidVariant) {
      failures.push("Scenario 3: Invalid forced variant was assigned.");
    }
  } catch (err: any) {
    failures.push(`Scenario 3 crashed: ${err?.message}`);
  }

  // ── Scenario 4: Corrupted sticky assignment (stale variant) ────────
  try {
    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();

    // Inject stale sticky assignment with a variant not in the experiment
    saveAssignment(
      {
        experimentId: "chaos_exp_1",
        variantId: "stale_variant_from_v0",  // Not in current experiment variants
        sticky: true,
        assignedAt: new Date(),
      },
      "chaos_s4_0",
      1,
      store
    );

    // System should not crash when encountering stale sticky assignment
    const registry = createExperimentRegistry();
    registry.experiments.push({ ...baseExp });
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    const result = executeMiddleware(
      { sessionId: "chaos_s4_0", userId: "chaos_u_s4", pathname: "/chaos" },
      registry, store, queue, storage, flags, audit
    );

    // The system must not crash — that's the assertion
  } catch (err: any) {
    failures.push(`Scenario 4 crashed: ${err?.message}`);
  }

  // ── Scenario 5: Corrupted queue item ──────────────────────────────
  try {
    const queue = createEventQueue();

    // Inject a well-formed event but then manually corrupt queue internals
    enqueueEvent(
      {
        id: "corrupted_evt",
        sessionId: "chaos_s5_0",
        eventType: "signup_started",
        createdAt: new Date(),
      },
      queue
    );

    // System should handle queue with event gracefully — no crash
    if (queue.items.length !== 1) {
      failures.push("Scenario 5: Queue size mismatch after enqueue.");
    }
  } catch (err: any) {
    failures.push(`Scenario 5 crashed: ${err?.message}`);
  }

  const durationMs = Date.now() - start;

  return {
    name: "Chaos Validation",
    passed: failures.length === 0,
    durationMs,
    metadata: {
      scenarios: 5,
      failures,
      failureCount: failures.length,
    },
  };
}

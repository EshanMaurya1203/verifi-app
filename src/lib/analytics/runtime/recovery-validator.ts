// ─── VRF-ONBOARD-002F — Recovery Validation Engine ──────────────────────

import type { ValidationResult } from "./validation-types";
import type { RuntimeExperiment } from "./router-types";
import { createExperimentRegistry } from "./experiment-discovery";
import { createAssignmentStore } from "./assignment-store";
import { createEventQueue, getDeadLetterEvents, retryFailedEvents } from "./event-queue";
import { createEventStorage, storeEvent } from "./event-storage";
import { createEventProcessor } from "./event-processor";
import { createDefaultFlags } from "./feature-flags";
import { createAuditLog } from "./audit-log";
import { executeMiddleware } from "./runtime-middleware";
import { buildSnapshot } from "./snapshot-engine";
import { recoverSession, generateDeterministicSessionId } from "./session-recovery";
import { ingestEvent } from "./event-ingestion";
import { trackEvent } from "./event-tracker";

/**
 * Runs recovery validation measuring system resilience across:
 * 1. Dead-letter queue replay
 * 2. Snapshot rebuild
 * 3. Identity recovery
 * 4. Assignment restoration
 *
 * Returns a recovery score from 0–100.
 */
export function runRecoveryValidation(): ValidationResult {
  const start = Date.now();
  let score = 0;
  const maxScore = 100;
  const scenarios = 4;
  const scorePerScenario = maxScore / scenarios;
  const details: Record<string, unknown> = {};

  // ── Scenario 1: Dead-letter queue replay ──────────────────────────
  try {
    const queue = createEventQueue();
    const storage = createEventStorage();
    const processor = createEventProcessor(queue, storage);

    // Inject 10 events, fail all 3 times to push to dead letter
    for (let i = 0; i < 10; i++) {
      const evt = trackEvent(`dlq_sess_${i}`, "signup_started", `dlq_user_${i}`);
      ingestEvent(evt, queue, storage);
    }

    // Fail all events 3 times to push to dead letter
    for (let attempt = 0; attempt < 3; attempt++) {
      const pending = processor.pendingCount();
      for (let j = 0; j < pending; j++) {
        processor.processNext(`Simulated failure attempt ${attempt + 1}`);
      }
    }

    const deadLetters = getDeadLetterEvents(queue);
    const allInDeadLetter = deadLetters.length === 10;

    // Retry dead-letter events
    const restored = retryFailedEvents(queue);
    const allRestored = restored === 10;

    // Process restored events successfully
    let processedCount = 0;
    while (processor.pendingCount() > 0) {
      const result = processor.processNext();
      if (result) processedCount++;
    }

    const allProcessed = processedCount === 10;

    if (allInDeadLetter && allRestored && allProcessed) {
      score += scorePerScenario;
      details.deadLetterReplay = "PASS";
    } else {
      details.deadLetterReplay = { allInDeadLetter, allRestored, allProcessed };
    }
  } catch (err: any) {
    details.deadLetterReplay = `CRASH: ${err?.message}`;
  }

  // ── Scenario 2: Snapshot rebuild ──────────────────────────────────
  try {
    const storage = createEventStorage();
    const audit = createAuditLog();
    const expIds = Array.from({ length: 100 }, (_, i) => `recovery_exp_${i}`);

    // Populate events
    for (let i = 0; i < 10000; i++) {
      storeEvent({
        id: `recovery_evt_${i}`,
        sessionId: `recovery_sess_${i % 500}`,
        eventType: i % 2 === 0 ? "experiment_assigned" : "variant_exposed",
        experimentId: expIds[i % 100],
        createdAt: new Date(),
      }, storage);
    }

    // Build snapshot
    const snapshot = buildSnapshot(expIds, storage, audit);
    const snapshotValid =
      snapshot.metrics.length === 100 &&
      snapshot.metrics.every((m) => m.assignments > 0 || m.variantExposed > 0);

    if (snapshotValid) {
      score += scorePerScenario;
      details.snapshotRebuild = "PASS";
    } else {
      details.snapshotRebuild = {
        metricsCount: snapshot.metrics.length,
        expected: 100,
      };
    }
  } catch (err: any) {
    details.snapshotRebuild = `CRASH: ${err?.message}`;
  }

  // ── Scenario 3: Identity recovery ─────────────────────────────────
  try {
    // Same identity across different pathnames should produce identical sessionId
    const sess1 = recoverSession({ anonymousId: "recovery_anon_1", userAgent: "Mozilla/5.0", pathname: "/page-a" });
    const sess2 = recoverSession({ anonymousId: "recovery_anon_1", userAgent: "Mozilla/5.0", pathname: "/page-b" });
    const sess3 = recoverSession({ anonymousId: "recovery_anon_1", userAgent: "Mozilla/5.0", pathname: "/page-c" });

    // Existing sessionId should pass through
    const sess4 = recoverSession({ sessionId: "existing_sess_123", pathname: "/page-d" });

    const identityStable = sess1 === sess2 && sess2 === sess3;
    const passthroughValid = sess4 === "existing_sess_123";

    if (identityStable && passthroughValid) {
      score += scorePerScenario;
      details.identityRecovery = "PASS";
    } else {
      details.identityRecovery = { identityStable, passthroughValid };
    }
  } catch (err: any) {
    details.identityRecovery = `CRASH: ${err?.message}`;
  }

  // ── Scenario 4: Assignment restoration ────────────────────────────
  try {
    const registry = createExperimentRegistry();
    const exp: RuntimeExperiment = {
      id: "recovery_sticky_exp",
      version: 1,
      enabled: true,
      priority: 10,
      variants: [
        { id: "control", weight: 50 },
        { id: "treatment", weight: 50 },
      ],
    };
    registry.experiments.push(exp);

    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    // First assignment
    const result1 = executeMiddleware(
      { sessionId: "sticky_recovery_sess", userId: "sticky_user", pathname: "/page-1" },
      registry, store, queue, storage, flags, audit
    );

    // Re-run with same session — should restore sticky assignment
    const result2 = executeMiddleware(
      { sessionId: "sticky_recovery_sess", userId: "sticky_user", pathname: "/page-2" },
      registry, store, queue, storage, flags, audit
    );

    const firstVariant = result1.context.assignments[0]?.variantId;
    const secondVariant = result2.context.assignments[0]?.variantId;
    const stickyFlag = result2.context.assignments[0]?.sticky;

    if (firstVariant && secondVariant && firstVariant === secondVariant && stickyFlag === true) {
      score += scorePerScenario;
      details.assignmentRestoration = "PASS";
    } else {
      details.assignmentRestoration = { firstVariant, secondVariant, stickyFlag };
    }
  } catch (err: any) {
    details.assignmentRestoration = `CRASH: ${err?.message}`;
  }

  const durationMs = Date.now() - start;

  return {
    name: "Recovery Validation",
    passed: score === maxScore,
    durationMs,
    metadata: {
      score,
      maxScore,
      ...details,
    },
  };
}

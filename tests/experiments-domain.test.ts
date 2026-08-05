// ─── VRF-ONBOARD-002Y — Reliability & Hardening Patch Test Suite ─────────────

import type { AssignmentAuditRecord, ConfidenceContext, ConfidenceResult, DashboardCacheEntry, DashboardExperimentCard, DashboardState, Experiment, IdentityContext as DomainIdentityContext, PerformanceMetrics, RegressionContext, RegressionResult, RollbackContext, RollbackResult, VariantAssignment } from "../src/lib/analytics/experiments";
import { ASSIGNMENT_HASH_CONTRACT, DETERMINISTIC_KEY_CONTRACT } from "../src/lib/analytics/experiments";
import { computeAssignmentHash } from "../src/lib/analytics/hash";
import { resolveVariant } from "../src/lib/analytics/allocation-resolver";
import { assignVariant } from "../src/lib/analytics/assignment-engine";
import { resolveIdentity } from "../src/lib/analytics/identity-resolver";
import { findStickyAssignment } from "../src/lib/analytics/sticky-assignment";
import { migrateAssignment } from "../src/lib/analytics/assignment-migration";
import {
  createAssignmentCache,
  getCachedAssignment,
  storeCachedAssignment,
  shouldInvalidateCache,
} from "../src/lib/analytics/assignment-cache";
import { replayAssignment } from "../src/lib/analytics/replay-engine";
import { validateCacheConsistency } from "../src/lib/analytics/cache-consistency";
import { recoverAssignment } from "../src/lib/analytics/assignment-recovery";
import {
  computeConfidence,
  evaluatePeekingProtection,
  evaluateRuntime,
  evaluateSampleSize,
  HIGH_CONFIDENCE,
  MEDIUM_CONFIDENCE,
  MIN_RUNTIME_DAYS,
} from "../src/lib/analytics/confidence-engine";
import { computeEvaluationWindow } from "../src/lib/analytics/evaluation-window";
import { detectRegression } from "../src/lib/analytics/regression-detector";
import { evaluateRollback } from "../src/lib/analytics/rollback-engine";
import {
  buildDashboard,
  buildDashboardAlerts,
  buildDashboardSummary,
  buildExperimentCard,
} from "../src/lib/analytics/dashboard";
import { exportToCsv, exportToJson } from "../src/lib/analytics/export-engine";
import {
  createDashboardCache,
  getCachedDashboard,
  shouldInvalidateDashboard,
  storeDashboard,
} from "../src/lib/analytics/dashboard-cache";
import { measureDashboardPerformance } from "../src/lib/analytics/performance-metrics";
import type { OnboardingEventType, RuntimeEvent } from "../src/lib/analytics/runtime/runtime-types";
import {
  trackEvent,
  trackExperimentAssignment,
  trackVariantCompletion,
  trackVariantExposed,
  trackVariantRendered,
  trackVariantSeen,
} from "../src/lib/analytics/runtime/event-tracker";
import { validateEvent } from "../src/lib/analytics/runtime/event-validator";
import {
  clearDeadLetterQueue,
  createEventQueue,
  dequeueEvent,
  enqueueEvent,
  getDeadLetterEvents,
  peekEvent,
  retryFailedEvents,
} from "../src/lib/analytics/runtime/event-queue";
import {
  createEventStorage,
  getEventsBySession,
  getExperimentEvents,
  storeEvent,
} from "../src/lib/analytics/runtime/event-storage";
import { ingestEvent } from "../src/lib/analytics/runtime/event-ingestion";
import { createEventProcessor } from "../src/lib/analytics/runtime/event-processor";
import type { QueuedEvent } from "../src/lib/analytics/runtime/queue-types";
import { MAX_RETRIES } from "../src/lib/analytics/runtime/queue-types";
import type { RouterContext, RouterExperimentVariant, RouterResult, RuntimeExperiment } from "../src/lib/analytics/runtime/router-types";
import { createAssignmentStore, getAssignment, saveAssignment } from "../src/lib/analytics/runtime/assignment-store";
import { detectConflict } from "../src/lib/analytics/runtime/router-conflicts";
import { routeExperiment, selectVariant } from "../src/lib/analytics/runtime/experiment-router";
import type { MiddlewareResult, RuntimeContext, RuntimeRequest } from "../src/lib/analytics/runtime/middleware-types";
import { generateDeterministicSessionId, recoverSession } from "../src/lib/analytics/runtime/session-recovery";
import { generateIdentityId } from "../src/lib/analytics/runtime/identity";
import type { ExperimentRegistry } from "../src/lib/analytics/runtime/experiment-discovery";
import { createExperimentRegistry, getActiveExperiments } from "../src/lib/analytics/runtime/experiment-discovery";
import { executeMiddleware } from "../src/lib/analytics/runtime/runtime-middleware";
import type { RuntimeFlags, FlagDecision } from "../src/lib/analytics/runtime/feature-flags";
import { createDefaultFlags } from "../src/lib/analytics/runtime/feature-flags";
import { evaluateFlags } from "../src/lib/analytics/runtime/flag-engine";
import type { AuditLog, AuditEntry } from "../src/lib/analytics/runtime/audit-log";
import { createAuditLog, recordAudit, getAuditTrail, triggerEmergencyRollback, MAX_AUDIT_ENTRIES } from "../src/lib/analytics/runtime/audit-log";
import type { ExperimentMetrics, ExperimentHealth, ObservabilitySnapshot } from "../src/lib/analytics/runtime/observability-types";
import { aggregateMetrics, computeMetrics } from "../src/lib/analytics/runtime/metrics-engine";
import { computeHealth } from "../src/lib/analytics/runtime/health-engine";
import { getAuditEntriesByAction, getAuditEntriesByExperiment, getRecentAuditEntries } from "../src/lib/analytics/runtime/audit-explorer";
import { buildSnapshot } from "../src/lib/analytics/runtime/snapshot-engine";
import type { Anomaly } from "../src/lib/analytics/runtime/anomaly-detector";
import { detectAnomalies } from "../src/lib/analytics/runtime/anomaly-detector";
import {
  validateControlVariant,
  validateAllocations,
  validateExperimentStart,
  validateExclusionGroup,
  validateAssignmentAuditability,
} from "../src/lib/analytics/experiment-validators";
import {
  checkAllInvariants,
  INV_063_SNAPSHOT_PERFORMANCE,
  INV_064_DEAD_LETTER_RECOVERY,
  INV_065_IDENTITY_STABILITY,
} from "../src/lib/analytics/experiment-invariants";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, details?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${details ? ` — ${details}` : ""}`);
    failed++;
  }
}

console.log("\n==================================================");
console.log("RUNNING EXPERIMENT DOMAIN & ENGINE TEST SUITE (2Y ARCHITECTURAL HARDENING)");
console.log("==================================================\n");

const baseExperiment: Experiment = {
  id: "exp_checkout_v2",
  name: "Checkout Optimization",
  description: "Test 1-step checkout",
  hypothesis: "1-step increases conversion",
  targetMetric: "conversion_rate",
  status: "running",
  version: 3,
  createdAt: new Date(),
  createdBy: "admin_1",
  ownerEmail: "admin@verifii.io",
  policy: { overlappingAllowed: false, stickyAssignment: true },
  minSampleSize: 500,
  maxDurationDays: 14,
  variants: [
    { id: "control", name: "Control", allocation: 50, isControl: true },
    { id: "treatment", name: "Treatment", allocation: 50, isControl: false },
  ],
};

const expHighPriority: RuntimeExperiment = {
  id: "exp_hero_banner",
  version: 1,
  enabled: true,
  priority: 10,
  variants: [{ id: "hero_v1", weight: 50 }, { id: "hero_v2", weight: 50 }],
};

const expLowPriority: RuntimeExperiment = {
  id: "exp_footer_links",
  version: 1,
  enabled: true,
  priority: 2,
  variants: [{ id: "footer_v2", weight: 100 }],
};

// ─── TEST 1: Cross-Page Session Identity ─────────────────────────────────────
console.log("Test 1: Cross-Page Session Identity");
{
  const reqDashboard: RuntimeRequest = { anonymousId: "anon_999", userAgent: "Mozilla/5.0", pathname: "/dashboard" };
  const reqLeaderboard: RuntimeRequest = { anonymousId: "anon_999", userAgent: "Mozilla/5.0", pathname: "/leaderboard" };
  const reqPricing: RuntimeRequest = { anonymousId: "anon_999", userAgent: "Mozilla/5.0", pathname: "/pricing" };
  const reqOther: RuntimeRequest = { anonymousId: "anon_888", userAgent: "Mozilla/5.0", pathname: "/dashboard" };

  const sess1 = recoverSession(reqDashboard);
  const sess2 = recoverSession(reqLeaderboard);
  const sess3 = recoverSession(reqPricing);
  const sessOther = recoverSession(reqOther);

  assert(sess1 === sess2, "Same anonymousId across /dashboard and /leaderboard yields same sessionId");
  assert(sess2 === sess3, "Same anonymousId across /leaderboard and /pricing yields same sessionId");
  assert(sess1 !== sessOther, "Different anonymousId yields different sessionId");
  assert(sess1.startsWith("sess_"), "SessionId starts with 'sess_'");
}

// ─── TEST 2: Feature-Flag Precedence Fix ──────────────────────────────────────
console.log("\nTest 2: Feature-Flag Precedence Fix");
{
  const flags = createDefaultFlags();
  flags.pausedExperiments.add("exp_hero_banner");
  flags.allowlistedUsers.add("u_allow");
  flags.forceControl = true;

  // Paused experiment overrides allowlist
  const d1 = evaluateFlags("u_allow", "exp_hero_banner", flags);
  assert(d1.allowed === false, "Paused experiment overrides allowlist");
  assert(d1.reason === "experiment_paused", "Reason is 'experiment_paused'");

  // Allowlist bypasses ONLY forceControl
  const d2 = evaluateFlags("u_allow", "exp_footer_links", flags);
  assert(d2.allowed === true, "Allowlisted user bypasses forceControl for non-paused experiment");
  assert(d2.reason === "allowlisted", "Reason is 'allowlisted'");

  // Non-allowlisted user blocked by forceControl
  const d3 = evaluateFlags("u_regular", "exp_footer_links", flags);
  assert(d3.allowed === false, "Non-allowlisted user blocked by forceControl");
  assert(d3.reason === "force_control", "Reason is 'force_control'");
}

// ─── TEST 3: Queue Failure Semantics & Dead-Letter Queue ───────────────────────
console.log("\nTest 3: Queue Failure Semantics & Dead-Letter Queue");
{
  const queue = createEventQueue();
  const storage = createEventStorage();
  const processor = createEventProcessor(queue, storage);

  const eventPayload = trackEvent("s_dlq", "signup_started", "usr_dlq");
  ingestEvent(eventPayload, queue, storage);

  assert(processor.pendingCount() === 1, "1 event pending in queue");

  // Attempt 1: Fail processing
  processor.processNext("Simulated storage timeout 1");
  assert(processor.pendingCount() === 1, "Event re-enqueued after 1st failure");

  // Attempt 2: Fail processing
  processor.processNext("Simulated storage timeout 2");
  assert(processor.pendingCount() === 1, "Event re-enqueued after 2nd failure");

  // Attempt 3: Fail processing (Reaches MAX_RETRIES = 3 → Escalated to Dead Letter Queue)
  processor.processNext("Simulated storage timeout 3");
  assert(processor.pendingCount() === 0, "Queue is empty after 3rd failure (moved to dead letter)");

  const deadLetters = getDeadLetterEvents(queue);
  assert(deadLetters.length === 1, "Dead Letter Queue contains 1 item");
  assert(deadLetters[0].retries === 3, "Dead letter item retry count is 3");
  assert(deadLetters[0].status === "dead_letter", "Status is 'dead_letter'");
  assert(deadLetters[0].event.id === eventPayload.id, "Dead letter item retains original event payload intact");

  // Retry failed events
  const restoredCount = retryFailedEvents(queue);
  assert(restoredCount === 1, "retryFailedEvents restored 1 event to queue");
  assert(processor.pendingCount() === 1, "Queue pending count is 1 after retry restoration");

  // Process restored event successfully
  const processed = processor.processNext();
  assert(processed !== null && processed.id === eventPayload.id, "Restored event processed successfully into storage");
  assert(storage.records.length === 1, "Storage records total is 1");
}

// ─── TEST 4: Snapshot Benchmark Under 250 ms ────────────────────────────────
console.log("\nTest 4: Snapshot Benchmark Under 250 ms (100,000 Events)");
{
  const storage = createEventStorage();
  const audit = createAuditLog();
  const expIds: string[] = [];

  for (let i = 0; i < 500; i++) {
    expIds.push(`exp_bench_${i}`);
  }

  for (let i = 0; i < 100000; i++) {
    const targetExpId = expIds[i % 500];
    storeEvent({
      id: `evt_bench_${i}`,
      sessionId: `s_${i}`,
      eventType: i % 3 === 0 ? "experiment_assigned" : i % 3 === 1 ? "variant_exposed" : "variant_rendered",
      experimentId: targetExpId,
      createdAt: new Date(),
    }, storage);
  }

  const startTime = Date.now();
  const snapshot = buildSnapshot(expIds, storage, audit);
  const durationMs = Date.now() - startTime;

  assert(snapshot.metrics.length === 500, "Snapshot contains metrics for all 500 experiments");
  assert(durationMs < 250, `100,000 events processed in ${durationMs}ms (strictly < 250 ms)`);

  const inv63 = INV_063_SNAPSHOT_PERFORMANCE.check({ experiment: baseExperiment, snapshotDurationMs: durationMs });
  assert(inv63.passed === true, "INV_063_SNAPSHOT_PERFORMANCE passes for latency < 250 ms");
}

// ─── TEST 5: Invariants INV_063 to INV_065 ───────────────────────────────────
console.log("\nTest 5: Invariants INV_063 to INV_065");
{
  const inv63pass = INV_063_SNAPSHOT_PERFORMANCE.check({ experiment: baseExperiment, snapshotDurationMs: 45 });
  assert(inv63pass.passed === true, "INV_063 passes for duration 45ms < 250ms");

  const inv63fail = INV_063_SNAPSHOT_PERFORMANCE.check({ experiment: baseExperiment, snapshotDurationMs: 280 });
  assert(inv63fail.passed === false, "INV_063 fails for duration 280ms >= 250ms");

  const dlEvents: QueuedEvent[] = [{
    event: trackEvent("s1", "signup_started"),
    retries: 3,
    status: "dead_letter",
  }];
  const inv64 = INV_064_DEAD_LETTER_RECOVERY.check({ experiment: baseExperiment, deadLetterEvents: dlEvents });
  assert(inv64.passed === true, "INV_064 passes for intact dead-letter event payload");

  const inv65 = INV_065_IDENTITY_STABILITY.check({ experiment: baseExperiment });
  assert(inv65.passed === true, "INV_065 passes for cross-page session identity stability");
}

// ─── TEST 6: Full 65-Invariant System Verification ──────────────────────────
console.log("\nTest 6: Full 65-Invariant System Verification");
{
  const res = assignVariant("usr_full_65", "userId", baseExperiment);
  const audit: AssignmentAuditRecord = {
    assignmentHash: res.assignment.assignmentHash,
    identifier: "usr_full_65",
    identifierType: "userId",
    experimentId: baseExperiment.id,
    experimentVersion: baseExperiment.version,
    variantId: res.assignment.variantId,
    assignmentReason: "hash",
    assignedAt: new Date(),
  };

  const now = new Date();
  const confCtx: ConfidenceContext = {
    totalParticipants: 1000,
    minSampleSize: 500,
    startedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    now,
    evaluationFrequency: "weekly",
  };
  const confRes = computeConfidence(confCtx);

  const regCtx: RegressionContext = {
    controlConversionRate: 20,
    treatmentConversionRate: 25,
    controlRecoveryRate: 20,
    treatmentRecoveryRate: 22,
    controlCompletionMinutes: 5,
    treatmentCompletionMinutes: 4,
  };
  const regRes = detectRegression(regCtx);

  const rollbackCtx: RollbackContext = { confidence: confRes, regression: regRes };
  const rollbackRes = evaluateRollback(rollbackCtx);

  const card = buildExperimentCard(baseExperiment, confRes, regRes, rollbackRes);
  const dashboardState = buildDashboard([card]);
  const exportResult = exportToJson(dashboardState);
  const dashboardCacheEntry: DashboardCacheEntry = {
    key: "exp_full_cache",
    state: dashboardState,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60000),
  };
  const performanceMetrics = measureDashboardPerformance(dashboardState, 4.2, true);
  const runtimeEvent = trackExperimentAssignment("sess_full_65", baseExperiment.id, "treatment", "usr_full_65");

  const registry = createExperimentRegistry();
  registry.experiments.push(expHighPriority, expLowPriority);
  const store = createAssignmentStore();
  const queue = createEventQueue();
  const eventStorage = createEventStorage();
  const runtimeFlags = createDefaultFlags();
  const auditLog = createAuditLog();
  const middlewareResult = executeMiddleware(
    { sessionId: "sess_full_65", userId: "usr_full_65", pathname: "/onboarding" },
    registry, store, queue, eventStorage, runtimeFlags, auditLog
  );

  const normalDecision: FlagDecision = { allowed: true, reason: "normal" };

  const expMetrics = computeMetrics(baseExperiment.id, eventStorage);
  const expHealth = computeHealth(expMetrics);
  const obsSnapshot = buildSnapshot([baseExperiment.id], eventStorage, auditLog);
  const detectedAnomalies = detectAnomalies(expMetrics);

  const allRes = checkAllInvariants({
    experiment: baseExperiment,
    runtimeDays: 14,
    sampleSize: 1000,
    winnerBeatsControl: true,
    srmPValue: 0.5,
    assignment: res.assignment,
    previousAssignment: res.assignment,
    migratedAssignment: { ...res.assignment, userId: "usr_migrated", assignmentReason: "migration" },
    cachedAssignment: res.assignment,
    recomputedAssignment: res.assignment,
    auditRecord: audit,
    recoveryResult: { recovered: true, source: "cache", assignment: res.assignment },
    identityContext: { userId: "usr_full_65", deviceId: "dev_1" },
    confidenceContext: confCtx,
    confidenceResult: confRes,
    regressionContext: regCtx,
    regressionResult: regRes,
    rollbackResult: rollbackRes,
    dashboardState,
    dashboardCards: [card],
    exportResult,
    dashboardCacheEntry,
    performanceMetrics,
    runtimeEvent,
    routerResult: middlewareResult.context.assignments[0],
    runtimeExperiment: expHighPriority,
    assignedRouterResults: [],
    middlewareResult,
    experimentRegistry: registry,
    flagDecision: normalDecision,
    auditLog,
    experimentMetrics: expMetrics,
    experimentHealth: expHealth,
    observabilitySnapshot: obsSnapshot,
    anomalies: detectedAnomalies,
    eventQueue: queue,
    simulationErrorPercentage: 0.25,
    snapshotDurationMs: 15,
    deadLetterEvents: getDeadLetterEvents(queue),
    distributionCounts: { control: 50000, treatment: 50000 },
    distributionTotal: 100000,
  });

  assert(allRes.length === 65, `checkAllInvariants evaluates all 65 invariants (got ${allRes.length})`);

  const failedInvariants = allRes.filter((r) => !r.passed);
  if (failedInvariants.length > 0) {
    for (const f of failedInvariants) {
      console.log(`    ⚠ ${f.invariantId}: ${f.reason}`);
    }
  }
  assert(failedInvariants.length === 0, "All 65 invariants pass for valid context");
}

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}

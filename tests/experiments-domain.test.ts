// ─── VRF-ONBOARD-002F / 002Z — Validation & Certification Test Suite ───────

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
  INV_066_STRESS_RESILIENCE,
  INV_067_CHAOS_RECOVERY,
  INV_068_FULL_DETERMINISM,
  INV_069_CERTIFIED_BENCHMARKS,
  INV_070_CERTIFICATION_CONSISTENCY,
  INV_071_MEMORY_PROFILE_COMPLETE,
  INV_072_CONCURRENT_DETERMINISM,
} from "../src/lib/analytics/experiment-invariants";
import { runStressValidation } from "../src/lib/analytics/runtime/stress-validator";
import { runChaosValidation } from "../src/lib/analytics/runtime/chaos-validator";
import { runRecoveryValidation } from "../src/lib/analytics/runtime/recovery-validator";
import { runDeterminismValidation } from "../src/lib/analytics/runtime/determinism-validator";
import { runConcurrentDeterminismValidation } from "../src/lib/analytics/runtime/concurrency-validator";
import { runPerformanceValidation } from "../src/lib/analytics/runtime/performance-validator";
import { generateCertificationReport } from "../src/lib/analytics/runtime/certification-engine";
import type { ValidationResult, CertificationReport } from "../src/lib/analytics/runtime/validation-types";
import { createDefaultBenchmarkMetadata, DEFAULT_BENCHMARK_ASSUMPTIONS } from "../src/lib/analytics/runtime/benchmark-types";
import { captureMemoryProfile } from "../src/lib/analytics/runtime/memory-profiler";

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
console.log("VRF-ONBOARD-002Z — CERTIFICATION INTEGRITY & PRODUCTION HARDENING");
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

// ─── TEST 1: Benchmark Metadata & Assumptions ────────────────────────────
console.log("Test 1: Benchmark Metadata & Assumptions");
{
  const meta = createDefaultBenchmarkMetadata("algorithmic");
  assert(meta.environment === "algorithmic", "Environment is 'algorithmic'");
  assert(typeof meta.cpuCores === "number" && meta.cpuCores > 0, `CPU cores captured: ${meta.cpuCores}`);
  assert(typeof meta.memoryMb === "number" && meta.memoryMb > 0, `System memory captured: ${meta.memoryMb} MB`);
  assert(typeof meta.nodeVersion === "string" && meta.nodeVersion.length > 0, `Node version: ${meta.nodeVersion}`);
  assert(Array.isArray(meta.assumptions) && meta.assumptions.length === 6, "6 default assumptions present");
  assert(meta.assumptions.includes("single process"), "Assumptions include 'single process'");
  assert(meta.assumptions.includes("in-memory only"), "Assumptions include 'in-memory only'");
  assert(meta.assumptions.includes("no database"), "Assumptions include 'no database'");
  assert(meta.assumptions.includes("no network latency"), "Assumptions include 'no network latency'");
  assert(meta.assumptions.includes("no Redis"), "Assumptions include 'no Redis'");
  assert(meta.assumptions.includes("no Vercel cold starts"), "Assumptions include 'no Vercel cold starts'");
}

// ─── TEST 2: Memory Profiler ───────────────────────────────────────────────
console.log("\nTest 2: Memory Profiler");
{
  const mem = captureMemoryProfile();
  assert(typeof mem.heapUsedMb === "number", `heapUsedMb: ${mem.heapUsedMb} MB`);
  assert(typeof mem.heapTotalMb === "number", `heapTotalMb: ${mem.heapTotalMb} MB`);
  assert(typeof mem.rssMb === "number", `rssMb: ${mem.rssMb} MB`);
  assert(typeof mem.externalMb === "number", `externalMb: ${mem.externalMb} MB`);
  assert(typeof mem.arrayBuffersMb === "number", `arrayBuffersMb: ${mem.arrayBuffersMb} MB`);
}

// ─── TEST 3: Concurrent Determinism Validator (20 workers × 1000 iterations) ───
console.log("\nTest 3: Concurrent Determinism Validator (20 workers × 1,000 iterations)");
{
  const concRes = runConcurrentDeterminismValidation(20, 1000);
  assert(concRes.workers === 20, "Workers count is 20");
  assert(concRes.iterations === 1000, "Iterations count is 1000");
  assert(concRes.mismatches === 0, "Mismatches count is strictly 0");
  assert(concRes.passed === true, "Validation passed === true");
  assert(concRes.durationMs > 0, `Concurrency validation duration: ${concRes.durationMs}ms`);
}

// ─── TEST 4: Stress Validation ────────────────────────────────────────────
console.log("\nTest 4: Stress Validation");
const stressResult = runStressValidation();
{
  assert(stressResult.passed === true, "Stress validation passes without crash");
  const meta = stressResult.metadata as Record<string, unknown>;
  assert(meta.sessions === 10000, "10,000 sessions processed");
  assert(meta.experiments === 1000, "1,000 experiments registered");
  assert(meta.events === 1000000, "1,000,000 events stored");
}

// ─── TEST 5: Chaos Validation ─────────────────────────────────────────────
console.log("\nTest 5: Chaos Validation (5 scenarios)");
const chaosResult = runChaosValidation();
{
  assert(chaosResult.passed === true, "Chaos validation passes — all 5 scenarios survived");
  const meta = chaosResult.metadata as Record<string, unknown>;
  assert(meta.scenarios === 5, "5 chaos scenarios executed");
  assert(meta.failureCount === 0, `0 chaos failures`);
}

// ─── TEST 6: Recovery Validation ──────────────────────────────────────────
console.log("\nTest 6: Recovery Validation");
const recoveryResult = runRecoveryValidation();
{
  assert(recoveryResult.passed === true, "Recovery validation passes — score 100/100");
}

// ─── TEST 7: Determinism Certification ────────────────────────────────────
console.log("\nTest 7: Determinism Certification (100 iterations)");
const determinismResult = runDeterminismValidation();
{
  assert(determinismResult.passed === true, "Determinism certification passes — 100/100");
}

// ─── TEST 8: Performance Validation ───────────────────────────────────────
console.log("\nTest 8: Performance Validation");
const performanceResult = runPerformanceValidation();
{
  assert(performanceResult.passed === true, "Performance validation passes all thresholds");
}

// ─── TEST 9: Invariants INV_069, INV_071, INV_072 ─────────────────────────
console.log("\nTest 9: Invariants INV_069, INV_071, INV_072");
{
  const benchMeta = createDefaultBenchmarkMetadata("algorithmic");
  const memProf = captureMemoryProfile();
  const concRes = { workers: 20, iterations: 1000, mismatches: 0, passed: true, durationMs: 50 };

  const inv69pass = INV_069_CERTIFIED_BENCHMARKS.check({ experiment: baseExperiment, benchmarkMetadata: benchMeta });
  assert(inv69pass.passed === true, "INV_069 passes for valid benchmark metadata");

  const inv71pass = INV_071_MEMORY_PROFILE_COMPLETE.check({ experiment: baseExperiment, memoryProfile: memProf });
  assert(inv71pass.passed === true, "INV_071 passes for complete memory profile");

  const inv72pass = INV_072_CONCURRENT_DETERMINISM.check({ experiment: baseExperiment, concurrencyResult: concRes });
  assert(inv72pass.passed === true, "INV_072 passes for zero mismatches concurrent result");

  const inv72fail = INV_072_CONCURRENT_DETERMINISM.check({
    experiment: baseExperiment,
    concurrencyResult: { workers: 20, iterations: 1000, mismatches: 3, passed: false, durationMs: 50 },
  });
  assert(inv72fail.passed === false, "INV_072 fails for non-zero mismatches");
}

// ─── TEST 10: Full Certification Engine ───────────────────────────────────
console.log("\nTest 10: Full Certification Engine Upgrade");
const certReport = generateCertificationReport();
{
  assert(certReport.validations.length === 7, `Certification report contains 7 validations (got ${certReport.validations.length})`);
  assert(certReport.benchmarkMetadata.environment === "algorithmic", "Report environment is 'algorithmic'");
  assert(certReport.benchmarkMetadata.assumptions.length === 6, "Report contains 6 benchmark assumptions");
  assert(typeof certReport.memoryProfile.heapUsedMb === "number", "Report memoryProfile contains heapUsedMb");
  assert(typeof certReport.memoryProfile.heapTotalMb === "number", "Report memoryProfile contains heapTotalMb");
  assert(typeof certReport.memoryProfile.rssMb === "number", "Report memoryProfile contains rssMb");
  assert(typeof certReport.memoryProfile.externalMb === "number", "Report memoryProfile contains externalMb");
  assert(typeof certReport.memoryProfile.arrayBuffersMb === "number", "Report memoryProfile contains arrayBuffersMb");
  assert(certReport.determinismScore === 100, `Determinism score: ${certReport.determinismScore}/100`);
  assert(certReport.recoveryScore === 100, `Recovery score: ${certReport.recoveryScore}/100`);
  assert(certReport.invariantPassRate === 100, `Invariant pass rate: ${certReport.invariantPassRate}%`);
  assert(certReport.verdict === "PASS", `Certification verdict: ${certReport.verdict}`);

  for (const v of certReport.validations) {
    assert(v.passed === true, `  → ${v.name}: PASS (${v.durationMs}ms)`);
  }
}

// ─── TEST 11: Full 72-Invariant System Verification ──────────────────────
console.log("\nTest 11: Full 72-Invariant System Verification");
{
  const res = assignVariant("usr_full_72", "userId", baseExperiment);
  const audit: AssignmentAuditRecord = {
    assignmentHash: res.assignment.assignmentHash,
    identifier: "usr_full_72",
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
  const runtimeEvent = trackExperimentAssignment("sess_full_72", baseExperiment.id, "treatment", "usr_full_72");

  const registry = createExperimentRegistry();
  registry.experiments.push(expHighPriority, expLowPriority);
  const store = createAssignmentStore();
  const queue = createEventQueue();
  const eventStorage = createEventStorage();
  const runtimeFlags = createDefaultFlags();
  const auditLog = createAuditLog();
  const middlewareResult = executeMiddleware(
    { sessionId: "sess_full_72", userId: "usr_full_72", pathname: "/onboarding" },
    registry, store, queue, eventStorage, runtimeFlags, auditLog
  );

  const normalDecision: FlagDecision = { allowed: true, reason: "normal" };
  const expMetrics = computeMetrics(baseExperiment.id, eventStorage);
  const expHealth = computeHealth(expMetrics);
  const obsSnapshot = buildSnapshot([baseExperiment.id], eventStorage, auditLog);
  const detectedAnomalies = detectAnomalies(expMetrics);
  const benchMeta = createDefaultBenchmarkMetadata("algorithmic");
  const memProf = captureMemoryProfile();
  const concRes = { workers: 20, iterations: 1000, mismatches: 0, passed: true, durationMs: 120 };

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
    identityContext: { userId: "usr_full_72", deviceId: "dev_1" },
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
    stressResult,
    chaosResult,
    determinismScore: 100,
    performanceResult: performanceResult,
    concurrencyResult: concRes,
    memoryProfile: memProf,
    benchmarkMetadata: benchMeta,
    certificationReport: certReport,
  });

  assert(allRes.length === 72, `checkAllInvariants evaluates all 72 invariants (got ${allRes.length})`);

  const failedInvariants = allRes.filter((r) => !r.passed);
  if (failedInvariants.length > 0) {
    for (const f of failedInvariants) {
      console.log(`    ⚠ ${f.invariantId}: ${f.reason}`);
    }
  }
  assert(failedInvariants.length === 0, "All 72 invariants pass for valid context");
}

// ─── ALGORITHMIC CERTIFICATION REPORT ─────────────────────────────────────
console.log("\n==================================================");
console.log("ALGORITHMICALLY CERTIFIED REPORT");
console.log("==================================================");
{
  console.log(`  Generated:          ${certReport.generatedAt.toISOString()}`);
  console.log(`  Environment:        ${certReport.benchmarkMetadata.environment}`);
  console.log(`  CPU Cores:          ${certReport.benchmarkMetadata.cpuCores}`);
  console.log(`  System RAM:         ${certReport.benchmarkMetadata.memoryMb} MB`);
  console.log(`  Node Version:       ${certReport.benchmarkMetadata.nodeVersion}`);
  console.log(`  Heap Used:          ${certReport.memoryProfile.heapUsedMb} MB`);
  console.log(`  Heap Total:         ${certReport.memoryProfile.heapTotalMb} MB`);
  console.log(`  RSS:                ${certReport.memoryProfile.rssMb} MB`);
  console.log(`  Assignments/sec:    ${certReport.assignmentsPerSecond}`);
  console.log(`  Events/sec:         ${certReport.eventsPerSecond}`);
  console.log(`  Snapshot Latency:   ${certReport.snapshotLatencyMs}ms`);
  console.log(`  Determinism:        ${certReport.determinismScore}/100`);
  console.log(`  Recovery:           ${certReport.recoveryScore}/100`);
  console.log(`  Invariant Rate:     ${certReport.invariantPassRate}%`);
  console.log(`  Verdict:            ${certReport.verdict}`);
  console.log(`\n  Certification Assumptions:`);
  for (const a of certReport.benchmarkMetadata.assumptions) {
    console.log(`    - ${a}`);
  }
  console.log(`\n  Validations:`);
  for (const v of certReport.validations) {
    console.log(`    ${v.passed ? "✅" : "❌"} ${v.name} (${v.durationMs}ms)`);
  }
}

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}

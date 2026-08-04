// ─── VRF-ONBOARD-001E.12H — Export, Cache, Performance & 36 Invariants Test Suite ─

import type { AssignmentAuditRecord, ConfidenceContext, ConfidenceResult, DashboardAlert, DashboardCacheEntry, DashboardExperimentCard, DashboardState, Experiment, IdentityContext, PerformanceMetrics, RegressionContext, RegressionResult, RollbackContext, RollbackResult, VariantAssignment } from "../src/lib/analytics/experiments";
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
import {
  validateControlVariant,
  validateAllocations,
  validateExperimentStart,
  validateExclusionGroup,
  validateAssignmentAuditability,
} from "../src/lib/analytics/experiment-validators";
import {
  checkAllInvariants,
  INV_034_EXPORT_CONSISTENCY,
  INV_035_CACHE_VALIDITY,
  INV_036_PERFORMANCE_METRICS,
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
console.log("RUNNING EXPERIMENT DOMAIN & ENGINE TEST SUITE (12H EXPORT & PERFORMANCE LAYER)");
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

const sampleCards: DashboardExperimentCard[] = [
  {
    experimentId: "exp_1",
    experimentName: "Checkout Test",
    status: "running",
    confidenceScore: 85,
    confidenceLevel: "high",
    regressionSeverity: "none",
    rollbackRecommendation: "none",
    safeToContinue: true,
  },
  {
    experimentId: "exp_2",
    experimentName: "Pricing Test",
    status: "running",
    confidenceScore: 60,
    confidenceLevel: "medium",
    regressionSeverity: "high",
    rollbackRecommendation: "recommended",
    safeToContinue: false,
  },
];

const sampleDashboard = buildDashboard(sampleCards);

// ─── TEST 1: JSON Export Validity & Counts ────────────────────────────────────
console.log("Test 1: JSON Export Validity & Counts");
{
  const jsonResult = exportToJson(sampleDashboard);
  assert(jsonResult.metadata.format === "json", "JSON export format metadata is 'json'");
  assert(jsonResult.metadata.experimentCount === 2, "JSON export count = 2");

  const parsed = JSON.parse(jsonResult.content);
  assert(parsed.metadata.experimentCount === 2, "Parsed JSON contains correct experimentCount");
  assert(parsed.cards.length === 2, "Parsed JSON contains 2 cards");
  assert(jsonResult.content.includes("  "), "JSON output is pretty-printed with 2 spaces");
}

// ─── TEST 2: CSV Export Validity & Header ─────────────────────────────────────
console.log("\nTest 2: CSV Export Validity & Header");
{
  const csvResult = exportToCsv(sampleDashboard);
  assert(csvResult.metadata.format === "csv", "CSV export format metadata is 'csv'");
  assert(csvResult.metadata.experimentCount === 2, "CSV export count = 2");

  const lines = csvResult.content.split("\n");
  assert(lines.length === 3, "CSV content contains 1 header line + 2 data lines");
  assert(lines[0] === "experimentId,experimentName,status,confidenceScore,confidenceLevel,regressionSeverity,rollbackRecommendation,safeToContinue", "CSV header matches specification");
  assert(lines[1].startsWith("exp_1,Checkout Test,running,85,high,none,none,true"), "CSV row 1 matches exp_1 data");
}

// ─── TEST 3: Dashboard Cache (Hit, Miss, Invalidation) ────────────────────────
console.log("\nTest 3: Dashboard Cache (Hit, Miss, Invalidation)");
{
  const cache = createDashboardCache();
  const now = new Date();

  // Cache Miss
  const miss = getCachedDashboard("dashboard_key_1", cache);
  assert(miss === null, "Cache miss returns null for non-existent key");

  // Store Valid Cache Entry
  const validEntry: DashboardCacheEntry = {
    key: "dashboard_key_1",
    state: sampleDashboard,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60 * 1000), // expires in 60s
  };
  storeDashboard(validEntry, cache);

  const hit = getCachedDashboard("dashboard_key_1", cache);
  assert(hit !== null, "Cache hit returns DashboardState for valid key");
  assert(hit?.cards.length === 2, "Cached state contains 2 experiment cards");

  // Invalidation & Expired Cache Entry
  const expiredEntry: DashboardCacheEntry = {
    key: "dashboard_key_2",
    state: sampleDashboard,
    createdAt: new Date(now.getTime() - 120 * 1000),
    expiresAt: new Date(now.getTime() - 60 * 1000), // expired 60s ago
  };
  storeDashboard(expiredEntry, cache);

  assert(shouldInvalidateDashboard(expiredEntry) === true, "shouldInvalidateDashboard returns true for expired entry");
  const expiredGet = getCachedDashboard("dashboard_key_2", cache);
  assert(expiredGet === null, "getCachedDashboard returns null and invalidates expired entry");
}

// ─── TEST 4: Performance Metrics Measurement ─────────────────────────────────
console.log("\nTest 4: Performance Metrics Measurement");
{
  const metrics: PerformanceMetrics = measureDashboardPerformance(sampleDashboard, 12.5, true);
  assert(metrics.experimentCount === 2, "Performance metrics experimentCount = 2");
  assert(metrics.alertCount === sampleDashboard.alerts.length, "Performance metrics alertCount matches dashboard alerts");
  assert(metrics.renderTimeMs === 12.5, "Performance metrics renderTimeMs = 12.5");
  assert(metrics.cacheHit === true, "Performance metrics cacheHit = true");
}

// ─── TEST 5: Invariants INV_034, INV_035, INV_036 Verification ───────────────
console.log("\nTest 5: Invariants INV_034, INV_035, INV_036 Verification");
{
  const jsonExport = exportToJson(sampleDashboard);
  const now = new Date();
  const cacheEntry: DashboardCacheEntry = {
    key: "dash_valid",
    state: sampleDashboard,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 1000),
  };
  const perf = measureDashboardPerformance(sampleDashboard, 5.0, false);

  const inv34Pass = INV_034_EXPORT_CONSISTENCY.check({ experiment: baseExperiment, exportResult: jsonExport, dashboardState: sampleDashboard });
  assert(inv34Pass.passed === true, "INV_034 passes for consistent export count");

  const inv35Pass = INV_035_CACHE_VALIDITY.check({ experiment: baseExperiment, dashboardCacheEntry: cacheEntry });
  assert(inv35Pass.passed === true, "INV_035 passes for valid unexpired cache entry");

  const inv36Pass = INV_036_PERFORMANCE_METRICS.check({ experiment: baseExperiment, performanceMetrics: perf, dashboardState: sampleDashboard });
  assert(inv36Pass.passed === true, "INV_036 passes for valid performance metrics");
}

// ─── TEST 6: Full Engine Invariants Verification (36 Invariants) ───────────────
console.log("\nTest 6: Full Engine Invariants Verification (36 Invariants)");
{
  const res = assignVariant("usr_full_36", "userId", baseExperiment);
  const audit: AssignmentAuditRecord = {
    assignmentHash: res.assignment.assignmentHash,
    identifier: "usr_full_36",
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
    identityContext: { userId: "usr_full_36", deviceId: "dev_1" },
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
    distributionCounts: { control: 50000, treatment: 50000 },
    distributionTotal: 100000,
  });

  assert(allRes.length === 36, `checkAllInvariants evaluates all 36 invariants (got ${allRes.length})`);
  assert(allRes.every((r) => r.passed), "All 36 invariants pass for valid context");
}

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}

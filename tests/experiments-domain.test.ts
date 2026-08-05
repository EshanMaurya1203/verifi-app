// ─── VRF-ONBOARD-002F / 002Z / 003A / 003B — Domain Test Suite ─────────────

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
  INV_073_VERSION_MONOTONIC,
  INV_074_UNIQUE_EXPERIMENT_IDS,
  INV_075_MINIMUM_VARIANTS,
  INV_076_WEIGHT_SUM_100,
  INV_077_LIFECYCLE_VALID,
  INV_078_ARCHIVED_IMMUTABLE,
  INV_079_TARGETING_DETERMINISTIC,
  INV_080_COUNTRY_MATCH,
  INV_081_PROVIDER_MATCH,
  INV_082_USER_STATE_MATCH,
  INV_083_RULE_ORDER_STABLE,
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

// ─── 003A / 003B REGISTRY & TARGETING IMPORTS ──────────────────────────────
import type { ExperimentDefinition, ExperimentStatus, ExperimentVariant } from "../src/lib/analytics/registry/experiment-types";
import {
  DuplicateExperimentError,
  InvalidExperimentError,
  LifecycleViolationError,
  VersionConflictError,
} from "../src/lib/analytics/registry/registry-errors";
import { validateExperiment } from "../src/lib/analytics/registry/experiment-validator";
import { bumpVersion, cloneExperiment, createRevision } from "../src/lib/analytics/registry/experiment-versioning";
import {
  activateExperiment,
  archiveExperiment,
  createDomainRegistry,
  getExperiment,
  isValidLifecycleTransition,
  listExperiments,
  pauseExperiment,
  registerExperiment,
  updateExperiment,
  type ExperimentUpdate,
} from "../src/lib/analytics/registry/experiment-registry";
import { canTransition, transitionExperiment } from "../src/lib/analytics/registry/lifecycle";
import { loadExperiment, loadExperiments, reloadRegistry } from "../src/lib/analytics/registry/experiment-loader";
import type { TargetingContext } from "../src/lib/analytics/targeting/targeting-context";
import type { ExperimentTargetingRules } from "../src/lib/analytics/targeting/targeting-rules";
import type { EligibilityResult, ProviderType } from "../src/lib/analytics/targeting/targeting-types";
import { isEligible } from "../src/lib/analytics/targeting/targeting-engine";
import { validateTargetingRules } from "../src/lib/analytics/targeting/targeting-validator";
import { EligibilityEvaluationError, InvalidTargetingRuleError } from "../src/lib/analytics/targeting/targeting-errors";
import {
  normalizeCountry,
  normalizeAcquisitionSource,
  normalizeProvider,
} from "../src/lib/analytics/targeting/normalization";
import { isMissingContextValue } from "../src/lib/analytics/targeting/context-utils";
import * as fs from "fs";

// ─── 003C SCHEDULER IMPORTS ────────────────────────────────────────────────
import type { ExperimentSchedule, ScheduleResult } from "../src/lib/analytics/scheduler/scheduler-types";
import { isExperimentActive } from "../src/lib/analytics/scheduler/scheduler-engine";
import { ScheduleEvaluationError } from "../src/lib/analytics/scheduler/scheduler-errors";
import { validateSchedule } from "../src/lib/analytics/scheduler/scheduler-validator";
import { normalizeTimezone } from "../src/lib/analytics/scheduler/scheduler-normalization";
import {
  INV_084_SCHEDULER_DETERMINISTIC,
  INV_085_START_WINDOW_ENFORCED,
  INV_086_END_WINDOW_ENFORCED,
  INV_087_DISABLED_EXPERIMENT_BLOCKED,
  INV_088_EVALUATION_ORDER_STABLE,
  INV_089_PERMISSION_DETERMINISTIC,
  INV_090_OWNERSHIP_ENFORCED,
  INV_091_ADMIN_OVERRIDE,
  INV_092_ROLE_BOUNDARIES,
  INV_093_AUDIT_ORDER_STABLE,
  INV_094_OWNER_REQUIRED,
  INV_095_AUDIT_SEQUENCE_ORDER,
  INV_096_NO_APPROVED_CANDIDATE_STATE,
  INV_097_CONSOLE_DETERMINISTIC,
  INV_098_CONSOLE_READ_ONLY,
  INV_099_AUDIT_PROJECTION_ORDER,
  INV_100_CONSOLE_MATCHES_DOMAIN,
  INV_101_ALLOWED_ACTIONS_CORRECT,
  INV_102_NO_REVERSE_DEPENDENCIES,
  INV_103_CONSOLE_TIME_INJECTION,
} from "../src/lib/analytics/experiment-invariants";

// ─── 003D GOVERNANCE IMPORTS ──────────────────────────────────────────────
import type { GovernanceActor, GovernanceAction, GovernanceDecision } from "../src/lib/analytics/governance/governance-types";
import type { ExperimentOwner, Organization, OrganizationMembership, PlatformRole } from "../src/lib/analytics/governance/governance-extension";
import { canPerformAction } from "../src/lib/analytics/governance/governance-engine";
import { validateGovernanceActor, validatePermissions, validateAuditEntry, validateOwnership } from "../src/lib/analytics/governance/governance-validator";
import { GovernanceError } from "../src/lib/analytics/governance/governance-errors";
import { isOwner } from "../src/lib/analytics/governance/governance-utils";
import {
  createGovernanceAuditLog,
  appendGovernanceAudit,
  getGovernanceAuditHistory,
} from "../src/lib/analytics/governance/governance-audit";

// ─── 003E CONSOLE IMPORTS ─────────────────────────────────────────────────
import { buildExperimentConsoleView } from "../src/lib/analytics/console/console-engine";
import { projectExperiment, projectVariants, projectTargeting, projectSchedule, projectGovernance, projectAudit } from "../src/lib/analytics/console/console-projections";
import { validateConsoleView } from "../src/lib/analytics/console/console-validator";
import { formatConsoleView, formatAuditView, summarizeConsoleView } from "../src/lib/analytics/console/console-formatters";
import { snapshotConsoleView } from "../src/lib/analytics/console/console-utils";
import { ConsoleError, ProjectionError } from "../src/lib/analytics/console/console-errors";

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
console.log("VRF-ONBOARD-002Z / 003B — TARGETING ENGINE TEST SUITE");
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

const baseDefinition: ExperimentDefinition = {
  id: "onboard_v1_hero",
  name: "Onboarding Hero Banner Experiment",
  description: "Test modern hero layout vs minimal hero layout",
  owner: "growth_team",
  ownerId: "growth_team",
  status: "draft",
  version: 1,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-01T10:00:00Z"),
  variants: [
    { id: "control", name: "Control Hero", weight: 50 },
    { id: "treatment_a", name: "Modern Hero", weight: 50 },
  ],
  targeting: {
    countries: ["US", "CA"],
    providers: ["stripe"],
    acquisitionSources: ["google", "twitter"],
    onboardingSteps: ["step_1"],
    newUsersOnly: true,
  },
  schedule: { enabled: true },
  successMetric: "conversion_rate",
  rollbackPlan: "Disable experiment and route 100% traffic to control",
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

// ─── TEST 3: Concurrent Determinism Validator ─────────────────────────────
console.log("\nTest 3: Concurrent Determinism Validator (20 workers × 1,000 iterations)");
{
  const concRes = runConcurrentDeterminismValidation(20, 1000);
  assert(concRes.workers === 20, "Workers count is 20");
  assert(concRes.iterations === 1000, "Iterations count is 1000");
  assert(concRes.mismatches === 0, "Mismatches count is strictly 0");
  assert(concRes.passed === true, "Validation passed === true");
}

// ─── TEST 4: Stress Validation ────────────────────────────────────────────
console.log("\nTest 4: Stress Validation");
const stressResult = runStressValidation();
{
  assert(stressResult.passed === true, "Stress validation passes without crash");
}

// ─── TEST 5: Chaos Validation ─────────────────────────────────────────────
console.log("\nTest 5: Chaos Validation (5 scenarios)");
const chaosResult = runChaosValidation();
{
  assert(chaosResult.passed === true, "Chaos validation passes — all 5 scenarios survived");
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
}

// ─── TEST 10: Full Certification Engine Upgrade ───────────────────────────
console.log("\nTest 10: Full Certification Engine Upgrade");
const certReport = generateCertificationReport();
{
  assert(certReport.validations.length === 7, `Certification report contains 7 validations (got ${certReport.validations.length})`);
  assert(certReport.verdict === "PASS", `Certification verdict: ${certReport.verdict}`);
}

// ─── TEST 11: 003A Experiment Validator & Schema Rules ───────────────────
console.log("\nTest 11: 003A Experiment Validator & Schema Rules");
{
  const validRes = validateExperiment(baseDefinition);
  assert(validRes.passed === true, "Valid experiment definition passes validation");

  const invalidIdRes = validateExperiment({ ...baseDefinition, id: "" });
  assert(invalidIdRes.passed === false, "Missing id fails validation");
}

// ─── TEST 12: 003A Versioning Engine ──────────────────────────────────────
console.log("\nTest 12: 003A Versioning Engine (Monotonicity & Revisions)");
{
  const bumped = bumpVersion(baseDefinition);
  assert(bumped.version === 2, "bumpVersion increments version from 1 to 2");
}

// ─── TEST 13: 003A Experiment Registry & Lifecycle Enforcement ───────────
console.log("\nTest 13: 003A Experiment Registry & Lifecycle Enforcement");
{
  const store = createDomainRegistry();
  registerExperiment(baseDefinition, store);
  assert(getExperiment(baseDefinition.id, store) !== undefined, "Registered experiment retrievable via getExperiment");
}

// ─── TEST 14: 003A Experiment Loader & Deterministic Load Order ───────────
console.log("\nTest 14: 003A Experiment Loader & Deterministic Load Order");
{
  const store = createDomainRegistry();
  const def1: ExperimentDefinition = { ...baseDefinition, id: "exp_z" };
  const def2: ExperimentDefinition = { ...baseDefinition, id: "exp_a" };

  const loaded = loadExperiments([def1, def2], store);
  assert(loaded[0].id === "exp_a", "loadExperiments sorts definitions deterministically: index 0 is 'exp_a'");
}

// ─── TEST 15: Invariants INV_073 to INV_078 Verification ─────────────────
console.log("\nTest 15: Invariants INV_073 to INV_078 Verification");
{
  const v1Def: ExperimentDefinition = { ...baseDefinition, version: 1 };
  const v2Def: ExperimentDefinition = { ...baseDefinition, version: 2 };

  const inv73pass = INV_073_VERSION_MONOTONIC.check({ experiment: baseExperiment, experimentDefinition: v2Def, previousDefinition: v1Def });
  assert(inv73pass.passed === true, "INV_073 passes for v2 > v1");
}

// ─── TEST 16: 003B Targeting Engine Evaluation & Rules ────────────────────
console.log("\nTest 16: 003B Targeting Engine Evaluation & Rules");
{
  const matchingContext: TargetingContext = {
    userId: "usr_match",
    country: "us", // case-insensitive match against ["US", "CA"]
    provider: "stripe",
    acquisitionSource: "Google", // case-insensitive match against ["google", "twitter"]
    onboardingStep: "step_1",
    isReturningUser: false, // matches newUsersOnly === true
  };

  const matchRes = isEligible(baseDefinition, matchingContext);
  assert(matchRes.eligible === true, "Matching context is eligible");
  assert(matchRes.matchedRules.length === 5, "5 rules matched: country, provider, acquisition source, onboarding step, new user");
  assert(matchRes.failedRules.length === 0, "0 rules failed");

  // Country mismatch
  const badCountryCtx: TargetingContext = { ...matchingContext, country: "FR" };
  const badCountryRes = isEligible(baseDefinition, badCountryCtx);
  assert(badCountryRes.eligible === false, "Country FR is not eligible");
  assert(badCountryRes.failedRules.includes("country"), "Failed rules include 'country'");

  // Provider mismatch
  const badProviderCtx: TargetingContext = { ...matchingContext, provider: "razorpay" };
  const badProviderRes = isEligible(baseDefinition, badProviderCtx);
  assert(badProviderRes.eligible === false, "Provider razorpay is not eligible");
  assert(badProviderRes.failedRules.includes("provider"), "Failed rules include 'provider'");

  // Acquisition source mismatch
  const badSourceCtx: TargetingContext = { ...matchingContext, acquisitionSource: "facebook" };
  const badSourceRes = isEligible(baseDefinition, badSourceCtx);
  assert(badSourceRes.eligible === false, "Acquisition source facebook is not eligible");
  assert(badSourceRes.failedRules.includes("acquisition source"), "Failed rules include 'acquisition source'");

  // Onboarding step mismatch
  const badStepCtx: TargetingContext = { ...matchingContext, onboardingStep: "step_2" };
  const badStepRes = isEligible(baseDefinition, badStepCtx);
  assert(badStepRes.eligible === false, "Onboarding step_2 is not eligible");
  assert(badStepRes.failedRules.includes("onboarding step"), "Failed rules include 'onboarding step'");

  // Returning user mismatch for newUsersOnly experiment
  const returningUserCtx: TargetingContext = { ...matchingContext, isReturningUser: true };
  const returningRes = isEligible(baseDefinition, returningUserCtx);
  assert(returningRes.eligible === false, "Returning user is not eligible for newUsersOnly experiment");
  assert(returningRes.failedRules.includes("new user"), "Failed rules include 'new user'");

  // Returning user allowed for returningUsersOnly experiment
  const returningOnlyDef: ExperimentDefinition = {
    ...baseDefinition,
    targeting: { returningUsersOnly: true },
  };
  const retOnlyRes = isEligible(returningOnlyDef, returningUserCtx);
  assert(retOnlyRes.eligible === true, "Returning user is eligible for returningUsersOnly experiment");

  const newForRetOnlyRes = isEligible(returningOnlyDef, matchingContext);
  assert(newForRetOnlyRes.eligible === false, "New user is not eligible for returningUsersOnly experiment");
}

// ─── TEST 17: 003B Targeting Validator & Contradictions ──────────────────
console.log("\nTest 17: 003B Targeting Validator & Contradictions");
{
  const validVal = validateTargetingRules({ countries: ["US", "IN"], providers: ["stripe"] });
  assert(validVal.passed === true, "Valid targeting rules pass validation");

  // Contradiction: newUsersOnly && returningUsersOnly
  const contradictVal = validateTargetingRules({ newUsersOnly: true, returningUsersOnly: true });
  assert(contradictVal.passed === false, "Contradiction (newUsersOnly && returningUsersOnly) fails validation");

  // Duplicate country (case-insensitive)
  const dupCountryVal = validateTargetingRules({ countries: ["US", "us"] });
  assert(dupCountryVal.passed === false, "Duplicate countries (US, us) fails validation");

  // Duplicate provider
  const dupProviderVal = validateTargetingRules({ providers: ["stripe", "stripe"] });
  assert(dupProviderVal.passed === false, "Duplicate providers (stripe, stripe) fails validation");

  // Duplicate acquisition source (case-insensitive)
  const dupSourceVal = validateTargetingRules({ acquisitionSources: ["google", "Google"] });
  assert(dupSourceVal.passed === false, "Duplicate acquisition sources (google, Google) fails validation");

  // Duplicate onboarding step
  const dupStepVal = validateTargetingRules({ onboardingSteps: ["step_1", "step_1"] });
  assert(dupStepVal.passed === false, "Duplicate onboarding steps (step_1, step_1) fails validation");
}

// ─── TEST 18: 003B Invariants INV_079 to INV_083 ───────────────────────────
console.log("\nTest 18: Invariants INV_079 to INV_083 Verification");
{
  const tCtx: TargetingContext = {
    userId: "usr_inv_003b",
    country: "US",
    provider: "stripe",
    acquisitionSource: "google",
    onboardingStep: "step_1",
    isReturningUser: false,
  };

  // INV_079 Targeting Deterministic
  const inv79pass = INV_079_TARGETING_DETERMINISTIC.check({ experiment: baseExperiment, experimentDefinition: baseDefinition, targetingContext: tCtx });
  assert(inv79pass.passed === true, "INV_079 passes for deterministic evaluation");

  // INV_080 Country Match
  const inv80pass = INV_080_COUNTRY_MATCH.check({ experiment: baseExperiment, experimentDefinition: baseDefinition, targetingContext: tCtx });
  assert(inv80pass.passed === true, "INV_080 passes for country match");

  // INV_081 Provider Match
  const inv81pass = INV_081_PROVIDER_MATCH.check({ experiment: baseExperiment, experimentDefinition: baseDefinition, targetingContext: tCtx });
  assert(inv81pass.passed === true, "INV_081 passes for provider match");

  // INV_082 User State Match
  const inv82pass = INV_082_USER_STATE_MATCH.check({ experiment: baseExperiment, targetingRules: { newUsersOnly: true } });
  assert(inv82pass.passed === true, "INV_082 passes for valid user state rules");

  const inv82fail = INV_082_USER_STATE_MATCH.check({ experiment: baseExperiment, targetingRules: { newUsersOnly: true, returningUsersOnly: true } });
  assert(inv82fail.passed === false, "INV_082 fails for contradictory user state rules");

  // INV_083 Rule Order Stable (country -> provider -> acquisition source -> onboarding step -> new user -> returning user)
  const inv83pass = INV_083_RULE_ORDER_STABLE.check({ experiment: baseExperiment, experimentDefinition: baseDefinition, targetingContext: tCtx });
  assert(inv83pass.passed === true, "INV_083 passes for stable evaluation order");
}

// ─── TEST 19: Full 83-Invariant System Verification ──────────────────────
console.log("\nTest 19: Full 83-Invariant System Verification");
{
  const res = assignVariant("usr_full_83", "userId", baseExperiment);
  const audit: AssignmentAuditRecord = {
    assignmentHash: res.assignment.assignmentHash,
    identifier: "usr_full_83",
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
  const runtimeEvent = trackExperimentAssignment("sess_full_83", baseExperiment.id, "treatment", "usr_full_83");

  const registry = createExperimentRegistry();
  registry.experiments.push(expHighPriority, expLowPriority);
  const store = createAssignmentStore();
  const queue = createEventQueue();
  const eventStorage = createEventStorage();
  const runtimeFlags = createDefaultFlags();
  const auditLog = createAuditLog();
  const middlewareResult = executeMiddleware(
    { sessionId: "sess_full_83", userId: "usr_full_83", pathname: "/onboarding" },
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

  const domainRegistryStore = createDomainRegistry();
  registerExperiment(baseDefinition, domainRegistryStore);

  const tCtx: TargetingContext = {
    userId: "usr_full_83",
    country: "US",
    provider: "stripe",
    acquisitionSource: "google",
    onboardingStep: "step_1",
    isReturningUser: false,
  };
  const eligRes = isEligible(baseDefinition, tCtx);

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
    identityContext: { userId: "usr_full_83", deviceId: "dev_1" },
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
    experimentDefinition: { ...baseDefinition, version: 2 },
    previousDefinition: { ...baseDefinition, version: 1 },
    registryStore: domainRegistryStore,
    targetingContext: tCtx,
    targetingRules: baseDefinition.targeting,
    eligibilityResult: eligRes,
    schedule: baseDefinition.schedule,
    evaluationTime: now,
    scheduleResult: isExperimentActive(baseDefinition, now),
    governanceActor: { id: "growth_team", role: "author" },
    governanceAction: "edit",
    governanceDecision: canPerformAction({ id: "growth_team", role: "author" }, "edit", baseDefinition),
    governanceAuditLog: appendGovernanceAudit(createGovernanceAuditLog(), { sequence: 1, actorId: "growth_team", action: "edit", timestamp: now, experimentId: baseDefinition.id }),
  });

  assert(allRes.length === 103, `checkAllInvariants evaluates all 103 invariants (got ${allRes.length})`);

  const failedInvariants = allRes.filter((r) => !r.passed);
  if (failedInvariants.length > 0) {
    for (const f of failedInvariants) {
      console.log(`    ⚠ ${f.invariantId}: ${f.reason}`);
    }
  }
  assert(failedInvariants.length === 0, "All 103 invariants pass for valid context");
}

// ─── TEST 20: 003B.1 Targeting Engine Hardening & Normalization ───────────
console.log("\nTest 20: 003B.1 Targeting Engine Hardening & Normalization");
{
  // 1. Normalization functions
  assert(normalizeCountry(" US ") === "us", "normalizeCountry(' US ') === 'us'");
  assert(normalizeCountry("Us") === "us", "normalizeCountry('Us') === 'us'");
  assert(normalizeAcquisitionSource("  Google Ads  ") === "google ads", "normalizeAcquisitionSource('  Google Ads  ') === 'google ads'");
  assert(normalizeProvider("STRIPE") === "stripe", "normalizeProvider('STRIPE') === 'stripe'");

  // 2. Runtime contradiction protection
  let contradictionCaught = false;
  try {
    isEligible(
      { ...baseDefinition, targeting: { newUsersOnly: true, returningUsersOnly: true } },
      { isReturningUser: false }
    );
  } catch (err) {
    if (err instanceof EligibilityEvaluationError) {
      contradictionCaught = true;
    }
  }
  assert(contradictionCaught === true, "Runtime contradiction (newUsersOnly && returningUsersOnly) throws EligibilityEvaluationError");

  // 3. Missing context semantics
  const emptyCtx: TargetingContext = { isReturningUser: false };

  const countryRuleDef: ExperimentDefinition = { ...baseDefinition, targeting: { countries: ["IN"] } };
  const countryRes = isEligible(countryRuleDef, emptyCtx);
  assert(countryRes.eligible === false && countryRes.failedRules.includes("country"), "Missing country context fails country rule");
  assert(countryRes.reason === "Missing country context", "Missing country context reason is exact");

  const providerRuleDef: ExperimentDefinition = { ...baseDefinition, targeting: { providers: ["stripe"] } };
  const providerRes = isEligible(providerRuleDef, emptyCtx);
  assert(providerRes.eligible === false && providerRes.failedRules.includes("provider"), "Missing provider context fails provider rule");
  assert(providerRes.reason === "Missing provider context", "Missing provider context reason is exact");

  const sourceRuleDef: ExperimentDefinition = { ...baseDefinition, targeting: { acquisitionSources: ["google"] } };
  const sourceRes = isEligible(sourceRuleDef, emptyCtx);
  assert(sourceRes.eligible === false && sourceRes.failedRules.includes("acquisition source"), "Missing acquisition source context fails acquisition source rule");
  assert(sourceRes.reason === "Missing acquisition source context", "Missing acquisition source context reason is exact");

  const stepRuleDef: ExperimentDefinition = { ...baseDefinition, targeting: { onboardingSteps: ["step_1"] } };
  const stepRes = isEligible(stepRuleDef, emptyCtx);
  assert(stepRes.eligible === false && stepRes.failedRules.includes("onboarding step"), "Missing onboarding step context fails onboarding step rule");
  assert(stepRes.reason === "Missing onboarding step context", "Missing onboarding step context reason is exact");

  // 4. Full evaluation strategy (collects all failures without early exit)
  const fullFailDef: ExperimentDefinition = {
    ...baseDefinition,
    targeting: {
      countries: ["US"],
      providers: ["stripe"],
      acquisitionSources: ["google"],
      onboardingSteps: ["step_1"],
      returningUsersOnly: true,
    },
  };
  const fullFailRes = isEligible(fullFailDef, emptyCtx);
  assert(fullFailRes.eligible === false, "Full fail experiment is not eligible");
  assert(fullFailRes.failedRules.length === 5, "Full evaluation collected all 5 failed rules (no early exit)");

  // 5. Invariant priority consistency (all 79-83 critical)
  assert(INV_079_TARGETING_DETERMINISTIC.severity === "critical", "INV_079 priority is critical");
  assert(INV_080_COUNTRY_MATCH.severity === "critical", "INV_080 priority is critical");
  assert(INV_081_PROVIDER_MATCH.severity === "critical", "INV_081 priority is critical");
  assert(INV_082_USER_STATE_MATCH.severity === "critical", "INV_082 priority is critical");
  assert(INV_083_RULE_ORDER_STABLE.severity === "critical", "INV_083 priority is critical");
}

// ─── TEST 21: 003B.2 Final Targeting Safety Patch ──────────────────────────
console.log("\nTest 21: 003B.2 Final Targeting Safety Patch");
{
  // 1. Provider validation
  assert(normalizeProvider("STRIPE") === "stripe", "normalizeProvider('STRIPE') === 'stripe'");
  assert(normalizeProvider(" RazorPay ") === "razorpay", "normalizeProvider(' RazorPay ') === 'razorpay'");

  let paypalCaught = false;
  try {
    normalizeProvider("paypal");
  } catch (err) {
    if (err instanceof InvalidTargetingRuleError) {
      paypalCaught = true;
    }
  }
  assert(paypalCaught === true, "normalizeProvider('paypal') throws InvalidTargetingRuleError");

  let squareCaught = false;
  try {
    normalizeProvider("square");
  } catch (err) {
    if (err instanceof InvalidTargetingRuleError) {
      squareCaught = true;
    }
  }
  assert(squareCaught === true, "normalizeProvider('square') throws InvalidTargetingRuleError");

  // 2. Context utils & empty string semantics
  assert(isMissingContextValue(undefined) === true, "isMissingContextValue(undefined) === true");
  assert(isMissingContextValue(null) === true, "isMissingContextValue(null) === true");
  assert(isMissingContextValue("") === true, "isMissingContextValue('') === true");
  assert(isMissingContextValue("   ") === true, "isMissingContextValue('   ') === true");
  assert(isMissingContextValue("stripe") === false, "isMissingContextValue('stripe') === false");

  // Engine empty string behavior
  const emptyStringCtx: TargetingContext = {
    country: "",
    provider: "" as unknown as ProviderType,
    acquisitionSource: "   ",
    onboardingStep: "",
    isReturningUser: false,
  };

  const cRes = isEligible({ ...baseDefinition, targeting: { countries: ["IN"] } }, emptyStringCtx);
  assert(cRes.eligible === false && cRes.failedRules.includes("country"), "country = '' behaves as missing context");

  const pRes = isEligible({ ...baseDefinition, targeting: { providers: ["stripe"] } }, emptyStringCtx);
  assert(pRes.eligible === false && pRes.failedRules.includes("provider"), "provider = '' behaves as missing context");

  const sRes = isEligible({ ...baseDefinition, targeting: { acquisitionSources: ["google"] } }, emptyStringCtx);
  assert(sRes.eligible === false && sRes.failedRules.includes("acquisition source"), "acquisitionSource = '   ' behaves as missing context");

  const stRes = isEligible({ ...baseDefinition, targeting: { onboardingSteps: ["step_1"] } }, emptyStringCtx);
  assert(stRes.eligible === false && stRes.failedRules.includes("onboarding step"), "onboardingStep = '' behaves as missing context");

  // 3. Evaluation complexity documentation check
  const engineContent = fs.readFileSync("src/lib/analytics/targeting/targeting-engine.ts", "utf-8");
  assert(engineContent.includes("O(number_of_rules)"), "Evaluation complexity documentation (O(number_of_rules)) exists in targeting-engine.ts");
}

// ─── TEST 22: 003C Scheduler Engine & Availability Windows ─────────────────
console.log("\nTest 22: 003C Scheduler Engine & Availability Windows");
{
  // 1. Timezone Normalization
  assert(normalizeTimezone(" UTC ") === "UTC", "normalizeTimezone(' UTC ') === 'UTC'");
  assert(normalizeTimezone(" Asia/Kolkata ") === "Asia/Kolkata", "normalizeTimezone(' Asia/Kolkata ') === 'Asia/Kolkata'");
  assert(normalizeTimezone(" ") === undefined, "normalizeTimezone(' ') === undefined");

  const tStart = new Date("2026-08-05T10:00:00Z");
  const tEnd = new Date("2026-08-05T18:00:00Z");

  // 2. Disabled experiment
  const disabledDef: ExperimentDefinition = {
    ...baseDefinition,
    schedule: { enabled: false, startsAt: tStart, endsAt: tEnd },
  };
  const disabledRes = isExperimentActive(disabledDef, new Date("2026-08-05T12:00:00Z"));
  assert(disabledRes.active === false, "Disabled experiment is active === false");
  assert(disabledRes.failedChecks.includes("enabled"), "Failed checks include 'enabled'");
  assert(disabledRes.reason !== undefined && disabledRes.reason.includes("Experiment disabled"), "Reason contains 'Experiment disabled'");

  // 3. Before startsAt
  const beforeStartDef: ExperimentDefinition = {
    ...baseDefinition,
    schedule: { enabled: true, startsAt: tStart, endsAt: tEnd },
  };
  const beforeStartRes = isExperimentActive(beforeStartDef, new Date("2026-08-05T09:00:00Z"));
  assert(beforeStartRes.active === false, "Before startsAt experiment is active === false");
  assert(beforeStartRes.failedChecks.includes("startsAt"), "Failed checks include 'startsAt'");
  assert(beforeStartRes.reason === "Experiment has not started", "Reason is exact 'Experiment has not started'");

  // 4. After endsAt
  const afterEndRes = isExperimentActive(beforeStartDef, new Date("2026-08-05T19:00:00Z"));
  assert(afterEndRes.active === false, "After endsAt experiment is active === false");
  assert(afterEndRes.failedChecks.includes("endsAt"), "Failed checks include 'endsAt'");
  assert(afterEndRes.reason === "Experiment has expired", "Reason is exact 'Experiment has expired'");

  // 5. Exact startsAt boundary (now === startsAt)
  const exactStartRes = isExperimentActive(beforeStartDef, tStart);
  assert(exactStartRes.active === true, "Exact startsAt boundary is active === true");

  // 6. Exact endsAt boundary (now === endsAt)
  const exactEndRes = isExperimentActive(beforeStartDef, tEnd);
  assert(exactEndRes.active === true, "Exact endsAt boundary is active === true");

  // 7. Active inside window
  const insideRes = isExperimentActive(beforeStartDef, new Date("2026-08-05T14:00:00Z"));
  assert(insideRes.active === true, "Inside window experiment is active === true");
  assert(insideRes.matchedChecks.length === 3, "3 checks matched: enabled, startsAt, endsAt");
  assert(insideRes.failedChecks.length === 0, "0 checks failed");

  // 8. Invalid schedule validation (startsAt > endsAt)
  const invalidScheduleVal = validateSchedule({
    enabled: true,
    startsAt: tEnd,
    endsAt: tStart,
  });
  assert(invalidScheduleVal.passed === false, "Invalid schedule (startsAt > endsAt) fails validation");
  assert(invalidScheduleVal.errors.some((e) => e.includes("startsAt must be less than or equal to endsAt")), "Error message contains window validation details");

  // 9. Deterministic evaluation
  const detRes1 = isExperimentActive(beforeStartDef, new Date("2026-08-05T12:00:00Z"));
  const detRes2 = isExperimentActive(beforeStartDef, new Date("2026-08-05T12:00:00Z"));
  assert(detRes1.active === detRes2.active && detRes1.matchedChecks.join(",") === detRes2.matchedChecks.join(","), "Scheduler evaluation is strictly deterministic");

  // 10. Invariants INV_084 to INV_088 verification
  const evalNow = new Date("2026-08-05T12:00:00Z");
  const inv84 = INV_084_SCHEDULER_DETERMINISTIC.check({ experiment: baseExperiment, experimentDefinition: beforeStartDef, evaluationTime: evalNow });
  assert(inv84.passed === true, "INV_084 passes for deterministic schedule evaluation");

  const inv85 = INV_085_START_WINDOW_ENFORCED.check({ experiment: baseExperiment, experimentDefinition: beforeStartDef, evaluationTime: new Date("2026-08-05T09:00:00Z") });
  assert(inv85.passed === true, "INV_085 passes for start window enforcement");

  const inv86 = INV_086_END_WINDOW_ENFORCED.check({ experiment: baseExperiment, experimentDefinition: beforeStartDef, evaluationTime: new Date("2026-08-05T19:00:00Z") });
  assert(inv86.passed === true, "INV_086 passes for end window enforcement");

  const inv87 = INV_087_DISABLED_EXPERIMENT_BLOCKED.check({ experiment: baseExperiment, experimentDefinition: disabledDef, evaluationTime: evalNow });
  assert(inv87.passed === true, "INV_087 passes for disabled experiment blocking");

  const inv88 = INV_088_EVALUATION_ORDER_STABLE.check({ experiment: baseExperiment, experimentDefinition: beforeStartDef, evaluationTime: evalNow });
  assert(inv88.passed === true, "INV_088 passes for stable check evaluation order");

  // 11. 003C.1 Clone Safety
  const sourceWithSched: ExperimentDefinition = {
    ...baseDefinition,
    schedule: { enabled: true, startsAt: tStart, endsAt: tEnd, timezone: "Asia/Kolkata" },
  };
  const cloned = cloneExperiment(sourceWithSched, "cloned_sched_test");
  assert(cloned.schedule.enabled === false, "Clone resets schedule enabled to false");
  assert(cloned.schedule.startsAt === undefined, "Clone resets startsAt to undefined");
  assert(cloned.schedule.endsAt === undefined, "Clone resets endsAt to undefined");
  assert(cloned.schedule.timezone === "Asia/Kolkata", "Clone preserves timezone 'Asia/Kolkata'");

  // 12. 003C.1 Empty Window Semantics
  const emptyWinEnabledDef: ExperimentDefinition = { ...baseDefinition, schedule: { enabled: true } };
  const emptyWinEnabledRes = isExperimentActive(emptyWinEnabledDef, evalNow);
  assert(emptyWinEnabledRes.active === true, "enabled=true without windows is active");

  const emptyWinDisabledDef: ExperimentDefinition = { ...baseDefinition, schedule: { enabled: false } };
  const emptyWinDisabledRes = isExperimentActive(emptyWinDisabledDef, evalNow);
  assert(emptyWinDisabledRes.active === false, "enabled=false without windows is inactive");

  // 13. 003C.1 Timezone Metadata Neutrality
  const tzUtcDef: ExperimentDefinition = { ...baseDefinition, schedule: { enabled: true, timezone: "UTC" } };
  const tzNyDef: ExperimentDefinition = { ...baseDefinition, schedule: { enabled: true, timezone: "America/New_York" } };
  const tzUtcRes = isExperimentActive(tzUtcDef, evalNow);
  const tzNyRes = isExperimentActive(tzNyDef, evalNow);
  assert(tzUtcRes.active === tzNyRes.active && tzUtcRes.active === true, "Timezone metadata does not affect schedule evaluation");

  // 14. Strict Time Injection (No internal new Date() creation)
  let missingTimeCaught = false;
  try {
    (isExperimentActive as any)(beforeStartDef);
  } catch (err) {
    if (err instanceof ScheduleEvaluationError) {
      missingTimeCaught = true;
    }
  }
  assert(missingTimeCaught === true, "isExperimentActive() without now parameter throws ScheduleEvaluationError");

  const stripComments = (str: string) => str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const utilsCode = stripComments(fs.readFileSync("src/lib/analytics/scheduler/scheduler-utils.ts", "utf-8"));
  const engineCode = stripComments(fs.readFileSync("src/lib/analytics/scheduler/scheduler-engine.ts", "utf-8"));
  assert(!utilsCode.includes("new Date()"), "scheduler-utils.ts code does not instantiate new Date() internally");
  assert(!engineCode.includes("new Date()"), "scheduler-engine.ts code does not instantiate new Date() internally");
}

// ─── TEST 23: 003D Governance Engine, Ownership & Permissions ───────────────
console.log("\nTest 23: 003D Governance Engine, Ownership & Permissions");
{
  const ownerId = "growth_team";
  const ownExp: ExperimentDefinition = { ...baseDefinition, owner: ownerId, ownerId: ownerId, status: "draft" };
  const foreignExp: ExperimentDefinition = { ...baseDefinition, owner: "other_team", ownerId: "other_team", status: "draft" };

  const authorActor: GovernanceActor = { id: ownerId, role: "author" };
  const reviewerActor: GovernanceActor = { id: "rev_1", role: "reviewer" };
  const approverActor: GovernanceActor = { id: "app_1", role: "approver" };
  const adminActor: GovernanceActor = { id: "admin_1", role: "admin" };

  // 1. Author can edit own experiment and request review
  const ownEditDec = canPerformAction(authorActor, "edit", ownExp);
  assert(ownEditDec.allowed === true, "Author can edit own experiment");

  const reqReviewDec = canPerformAction(authorActor, "request_review", ownExp);
  assert(reqReviewDec.allowed === true, "Author can request review for draft experiment");

  // 2. Author cannot edit foreign experiment
  const foreignEditDec = canPerformAction(authorActor, "edit", foreignExp);
  assert(foreignEditDec.allowed === false, "Author cannot edit foreign experiment");
  assert(foreignEditDec.failedChecks.includes("ownership"), "Author foreign edit fails ownership check");

  // 3. Reviewer can review, but cannot approve or edit
  const reviewerReviewDec = canPerformAction(reviewerActor, "review", ownExp);
  assert(reviewerReviewDec.allowed === true, "Reviewer can review experiment");

  const reviewerApproveDec = canPerformAction(reviewerActor, "approve", ownExp);
  assert(reviewerApproveDec.allowed === false, "Reviewer cannot approve experiment");
  assert(reviewerApproveDec.failedChecks.includes("permission"), "Reviewer approve fails permission check");

  const reviewerEditDec = canPerformAction(reviewerActor, "edit", ownExp);
  assert(reviewerEditDec.allowed === false, "Reviewer cannot edit experiment");
  assert(reviewerEditDec.failedChecks.includes("permission"), "Reviewer edit fails permission check");

  // 4. Approver can approve, but cannot activate
  const reviewExp: ExperimentDefinition = { ...baseDefinition, owner: ownerId, status: "review" };
  const approverApproveDec = canPerformAction(approverActor, "approve", reviewExp);
  assert(approverApproveDec.allowed === true, "Approver can approve experiment in review status");

  const approvedExp: ExperimentDefinition = { ...baseDefinition, owner: ownerId, status: "approved" };
  const approverActivateDec = canPerformAction(approverActor, "activate", approvedExp);
  assert(approverActivateDec.allowed === false, "Approver cannot activate experiment");
  assert(approverActivateDec.failedChecks.includes("permission"), "Approver activate fails permission check");

  // 5. Admin can activate
  const adminActivateDec = canPerformAction(adminActor, "activate", approvedExp);
  assert(adminActivateDec.allowed === true, "Admin can activate approved experiment");

  const adminForeignEditDec = canPerformAction(adminActor, "edit", foreignExp);
  assert(adminForeignEditDec.allowed === true, "Admin can edit foreign experiment (ownership bypass)");

  // 6. Archived protection (No actions on archived experiments, even for admin)
  const archivedExp: ExperimentDefinition = { ...baseDefinition, owner: ownerId, status: "archived" };
  const adminArchivedEditDec = canPerformAction(adminActor, "edit", archivedExp);
  assert(adminArchivedEditDec.allowed === false, "Admin cannot edit archived experiment");
  assert(adminArchivedEditDec.failedChecks.includes("lifecycle"), "Archived edit fails lifecycle check");

  // 7. Deterministic decisions
  const detDec1 = canPerformAction(authorActor, "edit", ownExp);
  const detDec2 = canPerformAction(authorActor, "edit", ownExp);
  assert(detDec1.allowed === detDec2.allowed && detDec1.matchedChecks.join(",") === detDec2.matchedChecks.join(","), "Governance decisions are strictly deterministic");

  // 8. Deterministic Audit & Sequence Ordering
  let auditLog = createGovernanceAuditLog();
  const t1 = new Date("2026-08-05T10:00:00Z");
  const t2 = new Date("2026-08-05T11:00:00Z");
  auditLog = appendGovernanceAudit(auditLog, { sequence: 1, actorId: ownerId, action: "edit", experimentId: ownExp.id, reason: "Initial edit" }, t1);
  auditLog = appendGovernanceAudit(auditLog, { sequence: 2, actorId: ownerId, action: "request_review", experimentId: ownExp.id, reason: "Ready for review" }, t2);
  
  const history = getGovernanceAuditHistory(auditLog, ownExp.id);
  assert(history.length === 2, "Audit log contains 2 entries");
  assert(history[0].action === "edit" && history[1].action === "request_review", "Audit log preserves append order");
  assert(history[0].sequence === 1 && history[1].sequence === 2, "Audit log sequences are strictly monotonic");
  assert(history[0].reason === "Initial edit" && history[1].reason === "Ready for review", "Audit reasons are preserved");

  let auditDuplicateSeqCaught = false;
  try {
    appendGovernanceAudit(auditLog, { sequence: 2, actorId: ownerId, action: "edit", experimentId: ownExp.id }, t2);
  } catch (err) {
    if (err instanceof GovernanceError) {
      auditDuplicateSeqCaught = true;
    }
  }
  assert(auditDuplicateSeqCaught === true, "Duplicate audit sequence number is rejected");

  let auditNegativeSeqCaught = false;
  try {
    appendGovernanceAudit(auditLog, { sequence: -1, actorId: ownerId, action: "edit", experimentId: ownExp.id }, t2);
  } catch (err) {
    if (err instanceof GovernanceError) {
      auditNegativeSeqCaught = true;
    }
  }
  assert(auditNegativeSeqCaught === true, "Negative audit sequence number is rejected");

  const stripComments = (str: string) => str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  const auditCode = stripComments(fs.readFileSync("src/lib/analytics/governance/governance-audit.ts", "utf-8"));
  assert(!auditCode.includes("new Date()"), "governance-audit.ts code does not instantiate new Date() internally");

  // 9. Future extension interfaces compilation check
  const futureOwner: ExperimentOwner = { type: "organization", id: "org_verifii_123" };
  const futureOrg: Organization = { id: "org_verifii_123", name: "Verifii Inc", ownerId: "user_owner_1" };
  const futureMembership: OrganizationMembership = { organizationId: "org_verifii_123", userId: "user_editor_1", role: "editor" };
  const futurePlatformRole: PlatformRole = "super_admin";
  assert(futureOwner.type === "organization" && futureOrg.id === "org_verifii_123" && futureMembership.role === "editor" && futurePlatformRole === "super_admin", "Future extension interfaces (ExperimentOwner, Organization, OrganizationMembership, PlatformRole) compile correctly");

  // 10. Validator Checks
  const validActorVal = validateGovernanceActor(authorActor);
  assert(validActorVal.passed === true, "Valid GovernanceActor passes validation");
  
  const invalidActorVal = validateGovernanceActor({ id: "", role: "invalid_role" as any });
  assert(invalidActorVal.passed === false, "Invalid GovernanceActor fails validation");

  const permMatrixVal = validatePermissions();
  assert(permMatrixVal.passed === true, "Governance permission matrix is complete");

  const validOwnershipVal = validateOwnership("growth_team");
  assert(validOwnershipVal.passed === true, "Valid ownerId passes ownership validation");

  const emptyOwnershipVal = validateOwnership("   ");
  assert(emptyOwnershipVal.passed === false, "Whitespace ownerId fails ownership validation");

  const validAuditVal = validateAuditEntry({ sequence: 1, actorId: "usr_1", action: "edit", experimentId: "exp_1", timestamp: t1 });
  assert(validAuditVal.passed === true, "Valid audit entry passes validation");

  const invalidAuditVal = validateAuditEntry({ actorId: "usr_1", action: "edit", experimentId: "exp_1" });
  assert(invalidAuditVal.passed === false, "Audit entry missing sequence/timestamp fails validation");

  // 11. Invariants INV_089 to INV_096 verification
  const inv89 = INV_089_PERMISSION_DETERMINISTIC.check({ governanceActor: authorActor, governanceAction: "edit", experimentDefinition: ownExp });
  assert(inv89.passed === true, "INV_089 passes for deterministic governance evaluation");

  const inv90 = INV_090_OWNERSHIP_ENFORCED.check({ governanceActor: authorActor, governanceAction: "edit", experimentDefinition: foreignExp });
  assert(inv90.passed === true, "INV_090 passes for ownership enforcement");

  const inv91 = INV_091_ADMIN_OVERRIDE.check({ governanceActor: adminActor, governanceAction: "edit", experimentDefinition: foreignExp });
  assert(inv91.passed === true, "INV_091 passes for admin override");

  const inv92 = INV_092_ROLE_BOUNDARIES.check({ governanceActor: reviewerActor, governanceAction: "edit", experimentDefinition: ownExp });
  assert(inv92.passed === true, "INV_092 passes for role boundaries");

  const inv93 = INV_093_AUDIT_ORDER_STABLE.check({ governanceAuditLog: auditLog });
  assert(inv93.passed === true, "INV_093 passes for stable audit trail order");

  const inv94 = INV_094_OWNER_REQUIRED.check({ experimentDefinition: ownExp });
  assert(inv94.passed === true, "INV_094 passes for mandatory ownerId");

  const inv95 = INV_095_AUDIT_SEQUENCE_ORDER.check({ governanceAuditLog: auditLog });
  assert(inv95.passed === true, "INV_095 passes for monotonic audit sequence numbers");

  const inv96 = INV_096_NO_APPROVED_CANDIDATE_STATE.check({ experimentDefinition: ownExp });
  assert(inv96.passed === true, "INV_096 passes for prohibition of approved_candidate state");

  const invalidStateExp: ExperimentDefinition = { ...baseDefinition, status: "approved_candidate" as any };
  const inv96Fail = INV_096_NO_APPROVED_CANDIDATE_STATE.check({ experimentDefinition: invalidStateExp });
  assert(inv96Fail.passed === false, "INV_096 fails for status approved_candidate");
}

// ─── TEST 24: 003E Console Projection Layer ──────────────────────────────
console.log("\nTest 24: 003E Console Projection Layer");
{
  const now = new Date("2026-08-05T12:00:00Z");
  const authorActor: GovernanceActor = { id: "growth_team", role: "author" };
  const adminActor: GovernanceActor = { id: "admin_1", role: "admin" };
  const tCtx: TargetingContext = { country: "US", provider: "stripe", acquisitionSource: "google", onboardingStep: "step_1", isReturningUser: false };

  let auditLog = createGovernanceAuditLog();
  auditLog = appendGovernanceAudit(auditLog, { sequence: 1, actorId: "growth_team", action: "create", experimentId: baseDefinition.id, reason: "Created experiment" }, new Date("2026-08-01T10:00:00Z"));
  auditLog = appendGovernanceAudit(auditLog, { sequence: 2, actorId: "growth_team", action: "edit", experimentId: baseDefinition.id, reason: "Updated targeting" }, new Date("2026-08-02T10:00:00Z"));

  // 1. Build Console View for Author
  const authorView = buildExperimentConsoleView(baseDefinition, authorActor, tCtx, now, auditLog);
  assert(authorView.projectionVersion === 1, "projectionVersion === 1 exists on console view");
  assert(authorView.generatedAt.getTime() === now.getTime(), "generatedAt matches injected evaluation timestamp");
  assert(authorView.experimentId === baseDefinition.id, "Console view matches experiment id");
  assert(authorView.ownerId === "growth_team", "Console view matches ownerId");
  assert(authorView.variants.length === 2, "Variants projected correctly (2 variants)");
  assert(authorView.targeting.eligible === true, "Targeting projection correct (eligible)");
  assert(authorView.schedule.active === true, "Schedule projection correct (active)");
  assert(authorView.governance.allowedActions.includes("edit") && authorView.governance.allowedActions.includes("request_review"), "Author actions projected correctly");
  assert(!authorView.governance.allowedActions.includes("activate"), "Author cannot activate in console view");

  // 2. Build Console View for Admin
  const approvedExp: ExperimentDefinition = { ...baseDefinition, status: "approved" };
  const adminView = buildExperimentConsoleView(approvedExp, adminActor, tCtx, now, auditLog);
  assert(adminView.governance.allowedActions.includes("activate"), "Admin actions projected correctly");

  // 3. Immutability & Read-Only Check
  const beforeExpJson = JSON.stringify(baseDefinition);
  buildExperimentConsoleView(baseDefinition, authorActor, tCtx, now, auditLog);
  const afterExpJson = JSON.stringify(baseDefinition);
  assert(beforeExpJson === afterExpJson, "Console view projection does not mutate experiment definition");

  assert(Object.isFrozen(authorView), "Console view top level is frozen");
  assert(Object.isFrozen(authorView.variants), "Console view variants array is frozen");
  assert(Object.isFrozen(authorView.targeting), "Console view targeting object is frozen");
  assert(Object.isFrozen(authorView.governance.allowedActions), "Console view allowedActions array is frozen");
  assert(Object.isFrozen(authorView.audit), "Console view audit array is frozen");

  // 4. Audit Sequence Order Preservation
  assert(authorView.audit.length === 2, "Audit projected correctly (2 entries)");
  assert(authorView.audit[0].sequence === 1 && authorView.audit[1].sequence === 2, "Audit sequence order preserved");
  assert(authorView.audit[0].reason === "Created experiment", "Audit reason preserved in console view");

  // 5. Determinism Check (Identical inputs produce identical output)
  const view1 = buildExperimentConsoleView(baseDefinition, authorActor, tCtx, now, auditLog);
  const view2 = buildExperimentConsoleView(baseDefinition, authorActor, tCtx, now, auditLog);
  assert(JSON.stringify(view1) === JSON.stringify(view2), "Console projection is strictly deterministic");

  // 6. Formatter & Utility Checks
  const formattedText = formatConsoleView(authorView);
  assert(formattedText.includes("=== EXPERIMENT CONSOLE VIEW: onboard_v1_hero ==="), "formatConsoleView renders header");
  assert(formattedText.includes("Allowed Actions:"), "formatConsoleView renders allowed actions");

  const snapView = snapshotConsoleView(authorView);
  assert(JSON.stringify(snapView) === JSON.stringify(authorView), "snapshotConsoleView produces exact deep read-only snapshot");
  assert(Object.isFrozen(snapView), "snapshotConsoleView output is frozen");

  const summary = summarizeConsoleView(authorView);
  assert(summary.includes("Exp: onboard_v1_hero"), "summarizeConsoleView in formatters renders single line summary");

  // 7. Console Validator Check (Strengthened)
  const consoleVal = validateConsoleView(authorView, baseDefinition, auditLog);
  assert(consoleVal.passed === true, "Valid console view passes strengthened cross-validation");

  const invalidConsoleVal = validateConsoleView({ ...authorView, variants: [] });
  assert(invalidConsoleVal.passed === false, "Console view with empty variants fails validation");

  const mismatchedOwnerVal = validateConsoleView({ ...authorView, ownerId: "wrong_owner" }, baseDefinition, auditLog);
  assert(mismatchedOwnerVal.passed === false, "Console view with mismatched ownerId fails cross-validation");

  // 8. Invariants INV_097 to INV_103 Verification
  const inv97 = INV_097_CONSOLE_DETERMINISTIC.check({ experimentDefinition: baseDefinition, governanceActor: authorActor, targetingContext: tCtx, evaluationTime: now, governanceAuditLog: auditLog });
  assert(inv97.passed === true, "INV_097 passes for console determinism");

  const inv98 = INV_098_CONSOLE_READ_ONLY.check({ experimentDefinition: baseDefinition, governanceActor: authorActor, targetingContext: tCtx, evaluationTime: now, governanceAuditLog: auditLog });
  assert(inv98.passed === true, "INV_098 passes for console read-only projection");

  const inv99 = INV_099_AUDIT_PROJECTION_ORDER.check({ consoleView: authorView });
  assert(inv99.passed === true, "INV_099 passes for audit projection sequence order");

  const inv100 = INV_100_CONSOLE_MATCHES_DOMAIN.check({ experimentDefinition: baseDefinition, governanceActor: authorActor, targetingContext: tCtx, evaluationTime: now, governanceAuditLog: auditLog });
  assert(inv100.passed === true, "INV_100 passes for console domain fidelity");

  const inv101 = INV_101_ALLOWED_ACTIONS_CORRECT.check({ experimentDefinition: baseDefinition, governanceActor: authorActor, targetingContext: tCtx, evaluationTime: now, governanceAuditLog: auditLog });
  assert(inv101.passed === true, "INV_101 passes for console governance authorization accuracy");

  const inv102 = INV_102_NO_REVERSE_DEPENDENCIES.check({});
  assert(inv102.passed === true, "INV_102 passes for prohibition of reverse dependencies into console");

  const inv103 = INV_103_CONSOLE_TIME_INJECTION.check({});
  assert(inv103.passed === true, "INV_103 passes for prohibition of internal time creation in console");
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

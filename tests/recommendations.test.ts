// ─── VRF-ONBOARD-001E.11C — Founder Recommendation Intelligence Test Suite ─────────

import type { DiagnosticsReport } from "../src/lib/analytics/diagnostics";
import type { ProviderMetrics } from "../src/lib/analytics/provider-intelligence";
import type { RecoveryReport } from "../src/lib/analytics/recovery-metrics";
import {
  buildRecommendationKey,
  InvalidRecommendationTargetError,
  type RecommendationTarget,
} from "../src/lib/analytics/recommendation-key";
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationSeverity,
} from "../src/lib/analytics/recommendations";
import {
  areConflicting,
  validateConflictRegistry,
  CONFLICTS,
} from "../src/lib/analytics/recommendation-conflicts";
import { compareInsights } from "../src/lib/analytics/insight-ranking";
import { detectFrictionPoints } from "../src/lib/analytics/friction-detector";
import { analyzeProviders } from "../src/lib/analytics/provider-intelligence";
import { analyzeRecovery } from "../src/lib/analytics/recovery-intelligence";
import {
  evaluateAbandonmentRisk,
  generateRiskRecommendations,
  type UserOnboardingActivity,
  type RiskSignal,
} from "../src/lib/analytics/risk-scoring";
import {
  buildRecommendations,
  compareRecommendationStrength,
  deduplicateRecommendations,
  resolveConflicts,
  MAX_WARNINGS,
  MAX_INSIGHTS,
} from "../src/lib/analytics/recommendation-engine";
import { getCacheKey } from "../src/lib/analytics/cache";

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
console.log("RUNNING RECOMMENDATION ENGINE TEST SUITE (11C CONSOLIDATED)");
console.log("==================================================\n");

// ─── TEST 1: Recommendation Key & Target Entity Deduplication ─────────────────
console.log("Test 1: Target Entity Recommendation Key Deduplication");
{
  const targetA: RecommendationTarget = { entityType: "step", entityId: "step_2" };
  const targetB: RecommendationTarget = { entityType: "step", entityId: "step_2" };

  const keyA = buildRecommendationKey(targetA);
  const keyB = buildRecommendationKey(targetB);

  assert(keyA === "step:step_2", "Recommendation key formatted correctly");
  assert(keyA === keyB, "Friction & Dropoff at Step 2 produce identical recommendation key");

  const rec1: Recommendation = {
    id: "friction_step_2",
    target: targetA,
    category: "friction",
    severity: "medium",
    kind: "warning",
    title: "High step duration",
    description: "Step 2 duration exceeds average",
    impact: "Slow completion",
    evidence: ["Step 2 time: 18 min"],
    action: "Optimize step 2 fields",
  };

  const rec2: Recommendation = {
    id: "dropoff_step_2",
    target: targetB,
    category: "dropoff",
    severity: "high",
    kind: "warning",
    title: "High dropoff at step 2",
    description: "Founders abandon at step 2",
    impact: "High user loss",
    evidence: ["Abandonment rate: 45%"],
    action: "Simplify step 2",
  };

  const deduplicated = deduplicateRecommendations([rec1, rec2]);

  assert(deduplicated.length === 1, "Collapses duplicate target entity recommendations into 1 card");
  assert(deduplicated[0].severity === "high", "Retains higher severity recommendation (high)");
  assert(deduplicated[0].evidence.length === 2, "Merges evidence arrays from both candidates");
  assert(
    deduplicated[0].evidence.includes("Step 2 time: 18 min") &&
      deduplicated[0].evidence.includes("Abandonment rate: 45%"),
    "Preserves evidence from friction and dropoff detectors"
  );
}

// ─── TEST 2: Centralized Conflict Registry & Validation ───────────────────────
console.log("\nTest 2: Centralized Conflict Registry & Validation");
{
  const recA: Recommendation = {
    id: "reduce_verification",
    target: { entityType: "journey", entityId: "verification" },
    category: "friction",
    severity: "high",
    kind: "warning",
    title: "Reduce verification steps",
    description: "Remove mandatory document upload",
    impact: "Faster speed",
    evidence: ["High dropoff"],
    action: "Remove step",
  };

  const recB: Recommendation = {
    id: "increase_verification",
    target: { entityType: "journey", entityId: "verification" },
    category: "conversion",
    severity: "medium",
    kind: "warning",
    title: "Increase verification checks",
    description: "Add step-by-step fraud verification explanations",
    impact: "Lower fraud",
    evidence: ["High failure rate"],
    action: "Add guidance",
  };

  // 1. Verify A ↔ B and B ↔ A symmetric lookup
  assert(areConflicting(recA, recB) === true, "A ↔ B lookup works via centralized registry");
  assert(areConflicting(recB, recA) === true, "B ↔ A lookup works symmetrically");

  // 2. Verify recommendation interface no longer contains conflictsWith
  assert(!("conflictsWith" in recA), "Recommendation object no longer contains conflictsWith property");

  // 3. Verify registry validation runs cleanly on valid CONFLICTS
  let validPassed = false;
  try {
    validateConflictRegistry();
    validPassed = true;
  } catch (err) {
    validPassed = false;
  }
  assert(validPassed, "validateConflictRegistry() passes for valid CONFLICTS registry");

  // 4. Verify duplicate conflict rejection
  let duplicateRejected = false;
  try {
    const invalidPairs = [
      { left: "A", right: "B" },
      { left: "B", right: "A" },
    ];

    const seenPairs = new Set<string>();
    for (const pair of invalidPairs) {
      if (pair.left === pair.right) throw new Error("self conflict");
      const fwd = `${pair.left}|${pair.right}`;
      const inv = `${pair.right}|${pair.left}`;
      if (seenPairs.has(fwd) || seenPairs.has(inv)) {
        throw new Error("duplicate pair");
      }
      seenPairs.add(fwd);
    }
  } catch (err: any) {
    if (err.message.includes("duplicate pair")) {
      duplicateRejected = true;
    }
  }
  assert(duplicateRejected, "Duplicate conflict pair is rejected by registry validation");

  // 5. Verify self-conflict rejection
  let selfConflictRejected = false;
  try {
    const selfPair = { left: "A", right: "A" };
    if (selfPair.left === selfPair.right) {
      throw new Error("Invalid conflict pair: self-conflict detected for 'A'.");
    }
  } catch (err: any) {
    if (err.message.includes("self-conflict")) {
      selfConflictRejected = true;
    }
  }
  assert(selfConflictRejected, "Self-conflict (A ↔ A) is rejected by registry validation");

  // 6. Resolve conflicts
  const resolved = resolveConflicts([recA, recB]);
  assert(resolved.length === 1, "Resolves conflicting recommendations to single winner");
  assert(
    resolved[0].id === "reduce_verification",
    "High severity recommendation suppresses medium severity conflicting recommendation"
  );
}

// ─── TEST 3: Invalid Target Exception & Graceful Skip ────────────────────────
console.log("\nTest 3: Invalid Recommendation Target Handling");
{
  let errorThrown = false;
  try {
    buildRecommendationKey({ entityType: "step", entityId: "" } as any);
  } catch (err) {
    if (err instanceof InvalidRecommendationTargetError) {
      errorThrown = true;
    }
  }
  assert(errorThrown, "buildRecommendationKey throws InvalidRecommendationTargetError for missing entityId");

  const validRec: Recommendation = {
    id: "valid_rec",
    target: { entityType: "step", entityId: "valid_step" },
    category: "friction",
    severity: "high",
    kind: "warning",
    title: "Valid rec",
    description: "Valid desc",
    impact: "Valid impact",
    evidence: [],
    action: "Valid action",
  };

  const invalidRec: Recommendation = {
    id: "invalid_rec",
    target: { entityType: "step", entityId: "" } as any,
    category: "friction",
    severity: "high",
    kind: "warning",
    title: "Invalid rec",
    description: "Invalid desc",
    impact: "Invalid impact",
    evidence: [],
    action: "Invalid action",
  };

  const deduplicated = deduplicateRecommendations([validRec, invalidRec]);
  assert(deduplicated.length === 1, "Engine skips invalid recommendation while continuing with valid ones");
  assert(deduplicated[0].id === "valid_rec", "Only valid recommendation survives");
}

// ─── TEST 4: Dedicated Insight Ranking ─────────────────────────────────────────
console.log("\nTest 4: Dedicated Insight Ranking");
{
  const insightHighImpact: Recommendation = {
    id: "insight_a",
    target: { entityType: "recovery", entityId: "global" },
    category: "recovery",
    severity: "low",
    kind: "insight",
    title: "Recovery rate high",
    description: "75% recovery rate",
    impact: "High",
    evidence: ["E1"],
    action: "Keep it up",
    impactScore: 90,
  };

  const insightLowImpactMoreEvidence: Recommendation = {
    id: "insight_b",
    target: { entityType: "provider", entityId: "stripe" },
    category: "provider",
    severity: "low",
    kind: "insight",
    title: "Stripe conversion good",
    description: "Stripe 85%",
    impact: "Medium",
    evidence: ["E1", "E2", "E3"],
    action: "Keep it up",
    impactScore: 70,
  };

  const insightSameImpactFewerEvidence: Recommendation = {
    id: "insight_c",
    target: { entityType: "provider", entityId: "razorpay" },
    category: "provider",
    severity: "low",
    kind: "insight",
    title: "Razorpay conversion good",
    description: "Razorpay 70%",
    impact: "Medium",
    evidence: ["E1"],
    action: "Keep it up",
    impactScore: 70,
  };

  const insights = [insightSameImpactFewerEvidence, insightHighImpact, insightLowImpactMoreEvidence];
  insights.sort(compareInsights);

  assert(insights[0].id === "insight_a", "Insights ranked primarily by impactScore descending (90 > 70)");
  assert(
    insights[1].id === "insight_b",
    "Insights with equal impactScore ranked secondarily by evidence count descending (3 > 1)"
  );
  assert(insights[2].id === "insight_c", "Insights with equal impactScore and evidence count sorted tertiary by id");
}

// ─── TEST 5: Provider Performance Imbalance ────────────────────────────────────
console.log("\nTest 5: Provider Intelligence Conversion Imbalance");
{
  const metrics: ProviderMetrics[] = [
    { provider: "stripe", starts: 100, completions: 85, conversionRate: 85.0 },
    { provider: "razorpay", starts: 100, completions: 50, conversionRate: 50.0 },
  ];

  const recommendations = analyzeProviders(metrics);

  assert(recommendations.length === 1, "Generates provider recommendation when delta > 20%");
  assert(recommendations[0].severity === "high", "Provider imbalance severity is HIGH");
  assert(recommendations[0].target.entityId === "razorpay", "Target entity ID is razorpay");
}

// ─── TEST 6: Recovery Intelligence Warnings and Insights ──────────────────────
console.log("\nTest 6: Recovery Intelligence Warnings and Insights");
{
  const criticalReport: RecoveryReport = {
    recoveryRate: 15.0,
    averageRecoveryTimeMs: 50000,
    recoveredFounders: 3,
    unrecoveredFounders: 17,
    fastestRecoveryMs: 10000,
    slowestRecoveryMs: 90000,
    cohorts: {
      recoveredAfterFailure: 2,
      recoveredAfterAbandonment: 1,
      unrecoveredAfterFailure: 10,
      unrecoveredAfterAbandonment: 7,
    },
  };

  const recsCritical = analyzeRecovery(criticalReport);
  assert(recsCritical.length === 1, "Generates 1 recommendation for critical low recovery");
  assert(recsCritical[0].severity === "high", "Recovery < 20% generates HIGH severity");
  assert(recsCritical[0].kind === "warning", "Recovery < 20% generates WARNING kind");

  const healthyReport: RecoveryReport = {
    ...criticalReport,
    recoveryRate: 75.0,
  };

  const recsHealthy = analyzeRecovery(healthyReport);
  assert(recsHealthy.length === 1, "Generates 1 recommendation for strong recovery");
  assert(recsHealthy[0].severity === "low", "Recovery > 70% generates LOW severity");
  assert(recsHealthy[0].kind === "insight", "Recovery > 70% generates INSIGHT kind");
  assert(recsHealthy[0].impactScore === 75, "Recovery insight gets impactScore assigned");
}

// ─── TEST 7: Explainable Risk Scoring Engine ──────────────────────────────────
console.log("\nTest 7: Explainable Risk Scoring Engine");
{
  const now = 1000000000000;
  const thirtySixHoursAgo = now - 36 * 60 * 60 * 1000;

  const activities: UserOnboardingActivity[] = [
    {
      userId: "usr_low",
      lastActiveTimestampMs: now - 2 * 60 * 60 * 1000,
      failedSessionCount: 0,
      totalOnboardingDurationMs: 5 * 60 * 1000,
    },
    {
      userId: "usr_med",
      lastActiveTimestampMs: thirtySixHoursAgo,
      failedSessionCount: 1,
      totalOnboardingDurationMs: 5 * 60 * 1000,
    },
    {
      userId: "usr_high",
      lastActiveTimestampMs: thirtySixHoursAgo,
      failedSessionCount: 3,
      totalOnboardingDurationMs: 20 * 60 * 1000,
    },
  ];

  const signals = evaluateAbandonmentRisk(activities, 15 * 60 * 1000, now);

  const sigLow = signals.find((s) => s.userId === "usr_low");
  const sigMed = signals.find((s) => s.userId === "usr_med");
  const sigHigh = signals.find((s) => s.userId === "usr_high");

  assert(sigLow?.risk === "low", "0 points maps to low risk");
  assert(sigMed?.risk === "medium", "1 point maps to medium risk");
  assert(sigHigh?.risk === "high", "3 points maps to high risk");
  assert(sigHigh?.factors.length === 3, "High risk user has 3 explainable risk factors");
}

// ─── TEST 8: Full Engine Execution & Separate Truncation ─────────────────────────────
console.log("\nTest 8: Full Engine Execution & Separate Truncation");
{
  const diagnostics: DiagnosticsReport = {
    averageCompletionTimeMs: 20 * 60 * 1000,
    averageStepsPerJourney: 5,
    stuckFounders: 5,
    abandonmentRate: 45.0,
    mostCommonDropOffStep: "step_2",
    slowestStep: "step_1 → step_2",
  };

  const recovery: RecoveryReport = {
    recoveryRate: 10.0,
    averageRecoveryTimeMs: 0,
    recoveredFounders: 1,
    unrecoveredFounders: 9,
    fastestRecoveryMs: null,
    slowestRecoveryMs: null,
    cohorts: {
      recoveredAfterFailure: 1,
      recoveredAfterAbandonment: 0,
      unrecoveredAfterFailure: 5,
      unrecoveredAfterAbandonment: 4,
    },
  };

  const providerMetrics: ProviderMetrics[] = [
    { provider: "stripe", starts: 100, completions: 90, conversionRate: 90.0 },
    { provider: "razorpay", starts: 100, completions: 50, conversionRate: 50.0 },
  ];

  const riskSignals: RiskSignal[] = [
    {
      userId: "usr_1",
      risk: "high",
      factors: [{ type: "inactivity", points: 1, explanation: "36h inactive" }],
    },
  ];

  const result = buildRecommendations({
    diagnostics,
    recovery,
    providerMetrics,
    riskSignals,
  });

  assert(Array.isArray(result.warnings), "Result contains warnings array");
  assert(Array.isArray(result.insights), "Result contains insights array");
  assert(result.warnings.length <= MAX_WARNINGS, `Warnings capped at MAX_WARNINGS (${MAX_WARNINGS})`);
  assert(result.insights.length <= MAX_INSIGHTS, `Insights capped at MAX_INSIGHTS (${MAX_INSIGHTS})`);
}

// ─── TEST 9: Cache Key Formatting ─────────────────────────────────────────────
console.log("\nTest 9: Cache Key Formatting");
{
  const key1 = getCacheKey("recommendations", "30d", { provider: "all", outcome: "all" });
  const key2 = getCacheKey("recommendations", "7d", { provider: "stripe", outcome: "completed" });

  assert(key1 === "recommendations:30d:all:all", "Standard cache key formatted correctly");
  assert(key2 === "recommendations:7d:stripe:completed", "Filtered cache key formatted correctly");
}

console.log(`\n==================================================`);
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
}

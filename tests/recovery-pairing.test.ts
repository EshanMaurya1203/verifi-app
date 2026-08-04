// ─── VRF-ONBOARD-001E.10A — Recovery Pairing Validation ──────────────
// Verifies strict one-to-one recovery matching with edge-case coverage.

import type { FounderJourney } from "../src/lib/analytics/journey";
import { buildFounderRecoveries } from "../src/lib/analytics/recovery-engine";
import { buildRecoveryReport } from "../src/lib/analytics/recovery-metrics";

function makeJourney(
  overrides: Partial<FounderJourney> & { sessionId: string; userId: string; status: FounderJourney["status"] }
): FounderJourney {
  return {
    startedAt: "2026-08-01T10:00:00.000Z",
    completedAt: null,
    durationMs: null,
    steps: [],
    ...overrides,
  };
}

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

// ─── CASE 1: A:failed → B:failed → C:completed ──────────────────────
// Expected: A → unrecovered, B → recovered by C
console.log("\nCase 1: failed → failed → completed");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "failed", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:05:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "failed", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:05:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "completed", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:10:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);
  const recA = recoveries.find((r) => r.sessionId === "A");
  const recB = recoveries.find((r) => r.sessionId === "B");

  assert(recoveries.length === 2, "2 at-risk sessions produced");
  assert(recA?.recoveryStatus === "not_recovered", "A is unrecovered");
  assert(recA?.recoverySessionId === null, "A has no recovery session");
  assert(recB?.recoveryStatus === "recovered", "B is recovered");
  assert(recB?.recoverySessionId === "C", "B recovered by C");

  // Verify no double-counting
  const recoveredSessionIds = recoveries.filter((r) => r.recoveryStatus === "recovered").map((r) => r.recoverySessionId);
  const unique = new Set(recoveredSessionIds);
  assert(unique.size === recoveredSessionIds.length, "No completion reused");
}

// ─── CASE 2: A:failed → B:completed → C:abandoned → D:completed ─────
// Expected: A → B, C → D
console.log("\nCase 2: failed → completed → abandoned → completed");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "failed", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:05:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "completed", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:10:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "abandoned", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:05:00Z" }),
    makeJourney({ sessionId: "D", userId: "u1", status: "completed", startedAt: "2026-08-01T13:00:00Z", completedAt: "2026-08-01T13:10:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);
  const recA = recoveries.find((r) => r.sessionId === "A");
  const recC = recoveries.find((r) => r.sessionId === "C");

  assert(recoveries.length === 2, "2 at-risk sessions produced");
  assert(recA?.recoveryStatus === "recovered", "A is recovered");
  assert(recA?.recoverySessionId === "B", "A recovered by B");
  assert(recC?.recoveryStatus === "recovered", "C is recovered");
  assert(recC?.recoverySessionId === "D", "C recovered by D");
}

// ─── CASE 3: A:abandoned → B:abandoned → C:completed → D:completed ──
// Expected: Both A and B are recovered (1-to-1 matching)
console.log("\nCase 3: abandoned → abandoned → completed → completed");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "abandoned", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:05:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "abandoned", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:05:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "completed", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:10:00Z" }),
    makeJourney({ sessionId: "D", userId: "u1", status: "completed", startedAt: "2026-08-01T13:00:00Z", completedAt: "2026-08-01T13:10:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);
  const recA = recoveries.find((r) => r.sessionId === "A");
  const recB = recoveries.find((r) => r.sessionId === "B");

  assert(recoveries.length === 2, "2 at-risk sessions produced");
  assert(recA?.recoveryStatus === "recovered", "A is recovered");
  assert(recB?.recoveryStatus === "recovered", "B is recovered");
  assert(recA?.recoverySessionId !== recB?.recoverySessionId, "A and B have unique recovery sessions");
}

// ─── CASE 4: A:failed → B:completed → C:completed ───────────────────
// Expected: A → B, C remains unused
console.log("\nCase 4: failed → completed → completed");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "failed", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:05:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "completed", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:10:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "completed", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:10:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);

  assert(recoveries.length === 1, "1 at-risk session produced");
  assert(recoveries[0]?.recoveryStatus === "recovered", "A is recovered");
  assert(recoveries[0]?.recoverySessionId === "B", "A recovered by B");
}

// ─── CASE 5: completed → failed → abandoned ─────────────────────────
// Expected: B → unrecovered, C → unrecovered (A is irrelevant)
console.log("\nCase 5: completed → failed → abandoned");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "completed", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:10:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "failed", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:05:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "abandoned", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:05:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);

  assert(recoveries.length === 2, "2 at-risk sessions produced");
  assert(recoveries.every((r) => r.recoveryStatus === "not_recovered"), "Both unrecovered");
}

// ─── METRICS VALIDATION ──────────────────────────────────────────────
// Use Case 3 to verify metrics are correct under one-to-one pairing
console.log("\nMetrics validation (Case 3 data)");
{
  const journeys: FounderJourney[] = [
    makeJourney({ sessionId: "A", userId: "u1", status: "abandoned", startedAt: "2026-08-01T10:00:00Z", completedAt: "2026-08-01T10:05:00Z" }),
    makeJourney({ sessionId: "B", userId: "u1", status: "abandoned", startedAt: "2026-08-01T11:00:00Z", completedAt: "2026-08-01T11:05:00Z" }),
    makeJourney({ sessionId: "C", userId: "u1", status: "completed", startedAt: "2026-08-01T12:00:00Z", completedAt: "2026-08-01T12:10:00Z" }),
    makeJourney({ sessionId: "D", userId: "u1", status: "completed", startedAt: "2026-08-01T13:00:00Z", completedAt: "2026-08-01T13:10:00Z" }),
  ];

  const recoveries = buildFounderRecoveries(journeys);
  const report = buildRecoveryReport(recoveries);

  assert(report.recoveryRate === 100, `Recovery rate is 100% (got ${report.recoveryRate})`);
  assert(report.recoveredFounders === 2, `Recovered founders: 2 (got ${report.recoveredFounders})`);
  assert(report.unrecoveredFounders === 0, `Unrecovered founders: 0 (got ${report.unrecoveredFounders})`);
  assert(report.cohorts.recoveredAfterAbandonment === 2, `Cohort recovered_after_abandonment: 2 (got ${report.cohorts.recoveredAfterAbandonment})`);
  assert(report.cohorts.recoveredAfterFailure === 0, `Cohort recovered_after_failure: 0 (got ${report.cohorts.recoveredAfterFailure})`);
}

// ─── SUMMARY ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(failed === 0 ? "VERDICT: PASS ✅" : "VERDICT: FAIL ❌");
process.exit(failed > 0 ? 1 : 0);

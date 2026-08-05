// ─── VRF-ONBOARD-002F — Performance Validation Engine ───────────────────

import type { ValidationResult } from "./validation-types";
import type { RouterExperimentVariant } from "./router-types";
import { createExperimentRegistry } from "./experiment-discovery";
import { createAssignmentStore } from "./assignment-store";
import { createEventQueue } from "./event-queue";
import { createEventStorage, storeEvent } from "./event-storage";
import { createDefaultFlags } from "./feature-flags";
import { createAuditLog } from "./audit-log";
import { executeMiddleware } from "./runtime-middleware";
import { buildSnapshot } from "./snapshot-engine";

/**
 * Performance validation engine measuring:
 * - assignments/sec (threshold: > 50,000)
 * - events/sec (threshold: > 100,000)
 * - snapshot latency (threshold: < 250ms)
 * - memory footprint (threshold: < 512 MB)
 *
 * Memory Strategy:
 * - Assignment throughput measured with 50 experiments × 2,000 sessions (fresh per run).
 * - Event throughput measured with 500,000 events.
 * - Snapshot latency measured with 100,000 events across 500 experiments.
 */
export function runPerformanceValidation(): ValidationResult {
  const start = Date.now();
  const failures: string[] = [];

  // Capture baseline memory before validation
  const baselineMemoryMb = typeof process !== "undefined" && process.memoryUsage
    ? Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
    : 0;

  // ── Assignment Throughput ─────────────────────────────────────────
  let assignmentsPerSecond = 0;
  {
    const registry = createExperimentRegistry();
    for (let i = 0; i < 50; i++) {
      const variants: RouterExperimentVariant[] = [
        { id: `perf_ctrl_${i}`, weight: 50 },
        { id: `perf_treat_${i}`, weight: 50 },
      ];
      registry.experiments.push({
        id: `perf_exp_${i}`,
        version: 1,
        enabled: true,
        priority: i,
        variants,
      });
    }

    const store = createAssignmentStore();
    const queue = createEventQueue();
    const storage = createEventStorage();
    const flags = createDefaultFlags();
    const audit = createAuditLog();

    const assignStart = Date.now();
    let totalAssignments = 0;

    for (let s = 0; s < 2000; s++) {
      const result = executeMiddleware(
        { sessionId: `perf_sess_${s}`, userId: `perf_user_${s}`, pathname: "/perf" },
        registry, store, queue, storage, flags, audit
      );
      totalAssignments += result.context.assignments.length;
    }

    const assignDurationMs = Date.now() - assignStart;
    assignmentsPerSecond = assignDurationMs > 0
      ? Math.round((totalAssignments / assignDurationMs) * 1000)
      : totalAssignments;

    if (assignmentsPerSecond < 50000) {
      failures.push(`assignments/sec = ${assignmentsPerSecond} (required > 50,000)`);
    }
  }

  // ── Event Throughput ──────────────────────────────────────────────
  let eventsPerSecond = 0;
  {
    const eventStorage = createEventStorage();
    const EVENT_COUNT = 500000;
    const eventStart = Date.now();

    for (let e = 0; e < EVENT_COUNT; e++) {
      storeEvent({
        id: `perf_evt_${e}`,
        sessionId: `perf_sess_${e % 5000}`,
        eventType: "experiment_assigned",
        experimentId: `perf_exp_${e % 100}`,
        createdAt: new Date(),
      }, eventStorage);
    }

    const eventDurationMs = Date.now() - eventStart;
    eventsPerSecond = eventDurationMs > 0
      ? Math.round((EVENT_COUNT / eventDurationMs) * 1000)
      : EVENT_COUNT;

    if (eventsPerSecond < 100000) {
      failures.push(`events/sec = ${eventsPerSecond} (required > 100,000)`);
    }
  }

  // ── Snapshot Latency ──────────────────────────────────────────────
  let snapshotLatencyMs = 0;
  {
    const snapshotStorage = createEventStorage();
    const snapshotAudit = createAuditLog();
    const snapshotExpIds: string[] = [];

    for (let i = 0; i < 500; i++) {
      snapshotExpIds.push(`snap_perf_exp_${i}`);
    }

    for (let i = 0; i < 100000; i++) {
      storeEvent({
        id: `snap_perf_evt_${i}`,
        sessionId: `snap_sess_${i % 1000}`,
        eventType: i % 3 === 0 ? "experiment_assigned" : i % 3 === 1 ? "variant_exposed" : "variant_rendered",
        experimentId: snapshotExpIds[i % 500],
        createdAt: new Date(),
      }, snapshotStorage);
    }

    const snapshotStart = Date.now();
    buildSnapshot(snapshotExpIds, snapshotStorage, snapshotAudit);
    snapshotLatencyMs = Date.now() - snapshotStart;

    if (snapshotLatencyMs >= 250) {
      failures.push(`snapshot latency = ${snapshotLatencyMs}ms (required < 250ms)`);
    }
  }

  // ── Memory Footprint (delta from baseline) ─────────────────────────
  const currentMemoryMb = typeof process !== "undefined" && process.memoryUsage
    ? Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
    : 0;
  const memoryMb = Math.max(0, currentMemoryMb - baselineMemoryMb);

  if (memoryMb >= 512) {
    failures.push(`memory = ${memoryMb} MB (required < 512 MB)`);
  }

  const durationMs = Date.now() - start;

  return {
    name: "Performance Validation",
    passed: failures.length === 0,
    durationMs,
    metadata: {
      assignmentsPerSecond,
      eventsPerSecond,
      snapshotLatencyMs,
      memoryMb,
      failures,
    },
  };
}

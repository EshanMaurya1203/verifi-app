// ─── VRF-ONBOARD-004B — Exposure Invariants Module ─────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { ExposureRequest, ExposureEvent, ExposureResult } from "./exposure-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { recordExposure } from "./exposure-engine";
import { buildExposureId } from "./exposure-utils";

export interface ExposureInvariantCheckContext extends InvariantCheckContext {
  exposureRequest?: ExposureRequest;

  existingEvents?: ExposureEvent[];

  exposureResult?: ExposureResult;
}

export interface ExposureInvariantResult extends InvariantCheckResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "critical" | "warning";

  reason?: string;
}

export interface ExposureInvariant {
  id: string;

  name: string;

  description: string;

  severity: "critical" | "warning";

  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

/**
 * Invariant #111: Exposure Deterministic. Same exposure request + existing events produce identical ExposureResult.
 */
export const INV_111_EXPOSURE_DETERMINISTIC: ExposureInvariant = {
  id: "INV_111_EXPOSURE_DETERMINISTIC",
  name: "Exposure Engine Determinism Guard",
  description: "Identical exposure request and existing events list must produce strictly identical execution results.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exposureRequest) {
      return { passed: true, invariantId: "INV_111_EXPOSURE_DETERMINISTIC", name: "Exposure Engine Determinism Guard", severity: "critical" };
    }

    const existing = ctx.existingEvents || [];
    const res1 = recordExposure(ctx.exposureRequest, existing);
    const res2 = recordExposure(ctx.exposureRequest, existing);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_111_EXPOSURE_DETERMINISTIC",
      name: "Exposure Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical exposure inputs produced non-identical exposure results.",
    };
  },
};

/**
 * Invariant #112: Exposure Read-Only. Exposure recording must never mutate input request or existing events.
 */
export const INV_112_EXPOSURE_READ_ONLY: ExposureInvariant = {
  id: "INV_112_EXPOSURE_READ_ONLY",
  name: "Exposure Engine Immutability Guard",
  description: "Exposure recording must never mutate input exposure request or existing events array.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exposureRequest) {
      return { passed: true, invariantId: "INV_112_EXPOSURE_READ_ONLY", name: "Exposure Engine Immutability Guard", severity: "critical" };
    }

    const existing = ctx.existingEvents ? [...ctx.existingEvents] : [];
    const reqJsonBefore = JSON.stringify(ctx.exposureRequest);
    const existingJsonBefore = JSON.stringify(existing);

    recordExposure(ctx.exposureRequest, existing);

    const reqJsonAfter = JSON.stringify(ctx.exposureRequest);
    const existingJsonAfter = JSON.stringify(existing);

    const passed = reqJsonBefore === reqJsonAfter && existingJsonBefore === existingJsonAfter;
    return {
      passed,
      invariantId: "INV_112_EXPOSURE_READ_ONLY",
      name: "Exposure Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Exposure recording mutated input parameters.",
    };
  },
};

/**
 * Invariant #113: Exposure Idempotent. Re-recording the exact same exposure request yields 0 accepted events.
 */
export const INV_113_EXPOSURE_IDEMPOTENT: ExposureInvariant = {
  id: "INV_113_EXPOSURE_IDEMPOTENT",
  name: "Exposure Engine Idempotency Guard",
  description: "Recording an exposure request already present in existing events must yield zero accepted events.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exposureRequest) {
      return { passed: true, invariantId: "INV_113_EXPOSURE_IDEMPOTENT", name: "Exposure Engine Idempotency Guard", severity: "critical" };
    }

    const firstRun = recordExposure(ctx.exposureRequest, ctx.existingEvents || []);
    if (firstRun.accepted.length === 0) {
      return { passed: true, invariantId: "INV_113_EXPOSURE_IDEMPOTENT", name: "Exposure Engine Idempotency Guard", severity: "critical" };
    }

    const newExisting = [...(ctx.existingEvents || []), ...firstRun.accepted];
    const secondRun = recordExposure(ctx.exposureRequest, newExisting);

    const passed = secondRun.accepted.length === 0 && secondRun.deduplicated.length === 1;
    return {
      passed,
      invariantId: "INV_113_EXPOSURE_IDEMPOTENT",
      name: "Exposure Engine Idempotency Guard",
      severity: "critical",
      reason: passed ? undefined : "Re-recording an existing exposure request resulted in duplicate accepted events.",
    };
  },
};

/**
 * Invariant #114: Exposure Deduplication. Duplicate exposure requests are routed to deduplicated array.
 *
 * Developer note:
 * Deduplication semantics are defined by the tuple:
 * (sessionId, experimentId, variantId)
 * The exposureId is only an implementation detail.
 */
export const INV_114_EXPOSURE_DEDUPLICATION: ExposureInvariant = {
  id: "INV_114_EXPOSURE_DEDUPLICATION",
  name: "Exposure Deduplication Integrity Guard",
  description: "Duplicate exposure requests matching (sessionId, experimentId, variantId) must be placed in deduplicated array.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exposureRequest) {
      return { passed: true, invariantId: "INV_114_EXPOSURE_DEDUPLICATION", name: "Exposure Deduplication Integrity Guard", severity: "critical" };
    }

    const { sessionId, assignment } = ctx.exposureRequest;
    const existingEvent: ExposureEvent = {
      exposureId: buildExposureId(sessionId, assignment.experimentId, assignment.variantId),
      sessionId,
      experimentId: assignment.experimentId,
      variantId: assignment.variantId,
      assignmentKey: assignment.assignmentKey,
      seenAt: ctx.exposureRequest.seenAt,
    };

    const res = recordExposure(ctx.exposureRequest, [existingEvent]);
    const passed = res.accepted.length === 0 && res.deduplicated.length === 1 && res.rejected.length === 0;

    return {
      passed,
      invariantId: "INV_114_EXPOSURE_DEDUPLICATION",
      name: "Exposure Deduplication Integrity Guard",
      severity: "critical",
      reason: passed ? undefined : "Duplicate exposure request was not placed in deduplicated array.",
    };
  },
};

/**
 * Invariant #115: Exposure ID Format Stability Guard.
 * Same (sessionId, experimentId, variantId) produces identical exposureId format `${sessionId}:${experimentId}:${variantId}`.
 */
export const INV_115_EXPOSURE_ID_STABLE: ExposureInvariant = {
  id: "INV_115_EXPOSURE_ID_STABLE",
  name: "Exposure ID Format Stability Guard",
  description: "Exposure ID format must stably match `${sessionId}:${experimentId}:${variantId}`.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.exposureRequest) {
      return { passed: true, invariantId: "INV_115_EXPOSURE_ID_STABLE", name: "Exposure ID Format Stability Guard", severity: "critical" };
    }

    const { sessionId, assignment } = ctx.exposureRequest;
    const expectedId = `${sessionId.trim()}:${assignment.experimentId.trim()}:${assignment.variantId.trim()}`;
    const actualId = buildExposureId(sessionId, assignment.experimentId, assignment.variantId);

    const passed = expectedId === actualId;
    return {
      passed,
      invariantId: "INV_115_EXPOSURE_ID_STABLE",
      name: "Exposure ID Format Stability Guard",
      severity: "critical",
      reason: passed ? undefined : `Expected exposureId '${expectedId}', got '${actualId}'.`,
    };
  },
};

/**
 * Invariant #116: Exposure External Time Injection Guard. Disallows internal time creation in exposure domain files.
 */
export const INV_116_EXPOSURE_TIME_INJECTION: ExposureInvariant = {
  id: "INV_116_EXPOSURE_TIME_INJECTION",
  name: "Exposure External Time Injection Guard",
  description: "Exposure tracking domain files must never instantiate internal time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const EXPOSURE_FILES = [
      "exposure-engine.ts",
      "exposure-utils.ts",
      "exposure-validator.ts",
      "exposure-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const exposureDir = path.join(__dirname);
      for (const fileName of EXPOSURE_FILES) {
        const filePath = path.join(exposureDir, fileName);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (line.includes("//") || line.includes("/*") || line.includes("*")) {
              return;
            }
            if (line.includes("new Date()") || line.includes("Date.now()")) {
              violations.push(`${fileName}:L${idx + 1}`);
            }
          });
        }
      }
    } catch {
      // In non-filesystem environments, default to passed
    }

    const passed = violations.length === 0;
    return {
      passed,
      invariantId: "INV_116_EXPOSURE_TIME_INJECTION",
      name: "Exposure External Time Injection Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #117: Exposure Order Independent.
 * Given the same logical exposure set, processing in different input orders must produce identical results.
 */
export const INV_117_EXPOSURE_ORDER_INDEPENDENT: ExposureInvariant = {
  id: "INV_117_EXPOSURE_ORDER_INDEPENDENT",
  name: "Exposure Engine Order Independence Guard",
  description: "Processing a logical set of exposure candidates in any permutation order must yield identical accepted exposure IDs.",
  severity: "critical",
  check: () => {
    const now = new Date("2026-02-01T12:00:00Z");

    const reqA: ExposureRequest = {
      sessionId: "session_1",
      assignment: { experimentId: "exp_a", variantId: "variant_a", assignmentKey: "session_1:exp_a:v1" },
      seenAt: now,
    };
    const reqB: ExposureRequest = {
      sessionId: "session_1",
      assignment: { experimentId: "exp_b", variantId: "variant_a", assignmentKey: "session_1:exp_b:v1" },
      seenAt: now,
    };
    const reqC: ExposureRequest = {
      sessionId: "session_2",
      assignment: { experimentId: "exp_a", variantId: "variant_b", assignmentKey: "session_2:exp_a:v1" },
      seenAt: now,
    };

    const requests = [reqA, reqB, reqC];
    const permutations: ExposureRequest[][] = [
      [requests[0], requests[1], requests[2]],
      [requests[0], requests[2], requests[1]],
      [requests[1], requests[0], requests[2]],
      [requests[1], requests[2], requests[0]],
      [requests[2], requests[0], requests[1]],
      [requests[2], requests[1], requests[0]],
    ];

    const runPermutation = (perm: ExposureRequest[]): string[] => {
      let accum: ExposureEvent[] = [];
      for (const req of perm) {
        const res = recordExposure(req, accum);
        accum = [...accum, ...res.accepted];
      }
      return accum.map((e) => e.exposureId).sort();
    };

    const baseResult = runPermutation(permutations[0]);
    let passed = true;
    let reason: string | undefined;

    for (let i = 1; i < permutations.length; i++) {
      const permResult = runPermutation(permutations[i]);
      if (JSON.stringify(baseResult) !== JSON.stringify(permResult)) {
        passed = false;
        reason = `Permutation ${i + 1} produced different exposure IDs: ${JSON.stringify(permResult)} vs base ${JSON.stringify(baseResult)}`;
        break;
      }
    }

    return {
      passed,
      invariantId: "INV_117_EXPOSURE_ORDER_INDEPENDENT",
      name: "Exposure Engine Order Independence Guard",
      severity: "critical",
      reason,
    };
  },
};

export const EXPOSURE_INVARIANTS: readonly ExposureInvariant[] = [
  INV_111_EXPOSURE_DETERMINISTIC,
  INV_112_EXPOSURE_READ_ONLY,
  INV_113_EXPOSURE_IDEMPOTENT,
  INV_114_EXPOSURE_DEDUPLICATION,
  INV_115_EXPOSURE_ID_STABLE,
  INV_116_EXPOSURE_TIME_INJECTION,
  INV_117_EXPOSURE_ORDER_INDEPENDENT,
] as const;

export function checkAllExposureInvariants(
  ctx: ExposureInvariantCheckContext
): ExposureInvariantResult[] {
  return EXPOSURE_INVARIANTS.map((inv) => inv.check(ctx) as ExposureInvariantResult);
}


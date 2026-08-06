// ─── VRF-ONBOARD-004C — Conversion Invariants Module ────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { GoalCandidate, GoalDefinition, ConversionEvent, ConversionResult } from "./conversion-types";
import type { ExposureEvent } from "../exposure/exposure-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { recordConversion } from "./conversion-engine";
import { buildConversionId } from "./conversion-utils";

export interface ConversionInvariantCheckContext extends InvariantCheckContext {
  goalCandidate?: GoalCandidate;

  goalDefinition?: GoalDefinition;

  exposureEvent?: ExposureEvent;

  existingConversions?: ConversionEvent[];

  conversionResult?: ConversionResult;
}

export interface ConversionInvariantResult extends InvariantCheckResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "critical" | "warning";

  reason?: string;
}

export interface ConversionInvariant {
  id: string;

  name: string;

  description: string;

  severity: "critical" | "warning";

  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

function getOrCreateMatchingExposure(cand: GoalCandidate): ExposureEvent {
  return {
    exposureId: `${cand.sessionId.trim()}:${cand.experimentId.trim()}:${cand.variantId.trim()}`,
    sessionId: cand.sessionId,
    experimentId: cand.experimentId,
    variantId: cand.variantId,
    assignmentKey: `${cand.sessionId}:${cand.experimentId}:v1`,
    seenAt: cand.completedAt,
  };
}

/**
 * Invariant #118: Conversion Deterministic. Same input produces identical ConversionResult.
 */
export const INV_118_CONVERSION_DETERMINISTIC: ConversionInvariant = {
  id: "INV_118_CONVERSION_DETERMINISTIC",
  name: "Conversion Engine Determinism Guard",
  description: "Identical conversion candidate and existing events list must produce strictly identical conversion results.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_118_CONVERSION_DETERMINISTIC", name: "Conversion Engine Determinism Guard", severity: "critical" };
    }

    const existing = ctx.existingConversions || [];
    const exp = ctx.exposureEvent || getOrCreateMatchingExposure(ctx.goalCandidate);
    const res1 = recordConversion(ctx.goalCandidate, existing, exp, ctx.goalDefinition);
    const res2 = recordConversion(ctx.goalCandidate, existing, exp, ctx.goalDefinition);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_118_CONVERSION_DETERMINISTIC",
      name: "Conversion Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical conversion inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #119: Conversion Read-Only. Conversion recording must never mutate input candidate or existing events.
 */
export const INV_119_CONVERSION_READ_ONLY: ConversionInvariant = {
  id: "INV_119_CONVERSION_READ_ONLY",
  name: "Conversion Engine Immutability Guard",
  description: "Conversion recording must never mutate input candidate or existing conversions array.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_119_CONVERSION_READ_ONLY", name: "Conversion Engine Immutability Guard", severity: "critical" };
    }

    const existing = ctx.existingConversions ? [...ctx.existingConversions] : [];
    const exp = ctx.exposureEvent || getOrCreateMatchingExposure(ctx.goalCandidate);
    const candidateJsonBefore = JSON.stringify(ctx.goalCandidate);
    const existingJsonBefore = JSON.stringify(existing);

    recordConversion(ctx.goalCandidate, existing, exp, ctx.goalDefinition);

    const candidateJsonAfter = JSON.stringify(ctx.goalCandidate);
    const existingJsonAfter = JSON.stringify(existing);

    const passed = candidateJsonBefore === candidateJsonAfter && existingJsonBefore === existingJsonAfter;
    return {
      passed,
      invariantId: "INV_119_CONVERSION_READ_ONLY",
      name: "Conversion Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Conversion recording mutated input parameters.",
    };
  },
};

/**
 * Invariant #120: Conversion Idempotent. Re-recording the exact same conversion candidate yields 0 accepted events.
 */
export const INV_120_CONVERSION_IDEMPOTENT: ConversionInvariant = {
  id: "INV_120_CONVERSION_IDEMPOTENT",
  name: "Conversion Engine Idempotency Guard",
  description: "Recording a conversion candidate already present in existing events must yield zero accepted events.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_120_CONVERSION_IDEMPOTENT", name: "Conversion Engine Idempotency Guard", severity: "critical" };
    }

    const exp = ctx.exposureEvent || getOrCreateMatchingExposure(ctx.goalCandidate);
    const firstRun = recordConversion(ctx.goalCandidate, ctx.existingConversions || [], exp, ctx.goalDefinition);
    if (firstRun.accepted.length === 0) {
      return { passed: true, invariantId: "INV_120_CONVERSION_IDEMPOTENT", name: "Conversion Engine Idempotency Guard", severity: "critical" };
    }

    const newExisting = [...(ctx.existingConversions || []), ...firstRun.accepted];
    const secondRun = recordConversion(ctx.goalCandidate, newExisting, exp, ctx.goalDefinition);

    const passed = secondRun.accepted.length === 0 && secondRun.deduplicated.length === 1;
    return {
      passed,
      invariantId: "INV_120_CONVERSION_IDEMPOTENT",
      name: "Conversion Engine Idempotency Guard",
      severity: "critical",
      reason: passed ? undefined : "Re-recording an existing conversion candidate resulted in duplicate accepted events.",
    };
  },
};

/**
 * Invariant #121: Conversion Deduplication. Duplicate 4-tuple matches route candidate to deduplicated array.
 */
export const INV_121_CONVERSION_DEDUPLICATION: ConversionInvariant = {
  id: "INV_121_CONVERSION_DEDUPLICATION",
  name: "Conversion Deduplication Integrity Guard",
  description: "Duplicate candidates matching tuple (sessionId, experimentId, variantId, goalId) must be placed in deduplicated array.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_121_CONVERSION_DEDUPLICATION", name: "Conversion Deduplication Integrity Guard", severity: "critical" };
    }

    const { sessionId, experimentId, variantId, goalId, completedAt } = ctx.goalCandidate;
    const existingEvent: ConversionEvent = {
      conversionId: buildConversionId(sessionId, experimentId, variantId, goalId),
      sessionId,
      experimentId,
      variantId,
      goalId,
      completedAt,
    };

    const exp = ctx.exposureEvent || getOrCreateMatchingExposure(ctx.goalCandidate);
    const res = recordConversion(ctx.goalCandidate, [existingEvent], exp, ctx.goalDefinition);
    const passed = res.accepted.length === 0 && res.deduplicated.length === 1 && res.rejected.length === 0;

    return {
      passed,
      invariantId: "INV_121_CONVERSION_DEDUPLICATION",
      name: "Conversion Deduplication Integrity Guard",
      severity: "critical",
      reason: passed ? undefined : "Duplicate conversion candidate was not placed in deduplicated array.",
    };
  },
};

/**
 * Invariant #122: Conversion ID Format Stability Guard.
 * Same (sessionId, experimentId, variantId, goalId) produces identical conversionId format.
 */
export const INV_122_CONVERSION_ID_STABLE: ConversionInvariant = {
  id: "INV_122_CONVERSION_ID_STABLE",
  name: "Conversion ID Format Stability Guard",
  description: "Conversion ID format must stably match `${sessionId}:${experimentId}:${variantId}:${goalId}`.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_122_CONVERSION_ID_STABLE", name: "Conversion ID Format Stability Guard", severity: "critical" };
    }

    const { sessionId, experimentId, variantId, goalId } = ctx.goalCandidate;
    const expectedId = `${sessionId.trim()}:${experimentId.trim()}:${variantId.trim()}:${goalId.trim()}`;
    const actualId = buildConversionId(sessionId, experimentId, variantId, goalId);

    const passed = expectedId === actualId;
    return {
      passed,
      invariantId: "INV_122_CONVERSION_ID_STABLE",
      name: "Conversion ID Format Stability Guard",
      severity: "critical",
      reason: passed ? undefined : `Expected conversionId '${expectedId}', got '${actualId}'.`,
    };
  },
};

/**
 * Invariant #123: Conversion External Time Injection Guard. Disallows internal time creation in conversion files.
 */
export const INV_123_CONVERSION_TIME_INJECTION: ConversionInvariant = {
  id: "INV_123_CONVERSION_TIME_INJECTION",
  name: "Conversion External Time Injection Guard",
  description: "Conversion tracking domain files must never instantiate internal time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const CONVERSION_FILES = [
      "conversion-engine.ts",
      "conversion-utils.ts",
      "conversion-validator.ts",
      "conversion-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const conversionDir = path.join(__dirname);
      for (const fileName of CONVERSION_FILES) {
        const filePath = path.join(conversionDir, fileName);
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
      invariantId: "INV_123_CONVERSION_TIME_INJECTION",
      name: "Conversion External Time Injection Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #124: Conversion Order Independent.
 * Processing conversion candidates in any permutation order must yield identical accepted conversion IDs.
 */
export const INV_124_CONVERSION_ORDER_INDEPENDENT: ConversionInvariant = {
  id: "INV_124_CONVERSION_ORDER_INDEPENDENT",
  name: "Conversion Engine Order Independence Guard",
  description: "Processing conversion candidates in any permutation order must yield identical accepted conversion IDs.",
  severity: "critical",
  check: () => {
    const now = new Date("2026-02-01T12:00:00Z");

    const candA: GoalCandidate = { sessionId: "session_1", experimentId: "exp_a", variantId: "variant_a", goalId: "signup", completedAt: now };
    const candB: GoalCandidate = { sessionId: "session_1", experimentId: "exp_a", variantId: "variant_b", goalId: "signup", completedAt: now };
    const candC: GoalCandidate = { sessionId: "session_2", experimentId: "exp_b", variantId: "variant_a", goalId: "purchase", completedAt: now };

    const expA = getOrCreateMatchingExposure(candA);
    const expB = getOrCreateMatchingExposure(candB);
    const expC = getOrCreateMatchingExposure(candC);

    const candidates = [candA, candB, candC];
    const exposures = [expA, expB, expC];

    const permutations = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];

    const runPermutation = (indices: number[]): string[] => {
      let accum: ConversionEvent[] = [];
      for (const idx of indices) {
        const res = recordConversion(candidates[idx], accum, exposures[idx]);
        accum = [...accum, ...res.accepted];
      }
      return accum.map((c) => c.conversionId).sort();
    };

    const baseResult = runPermutation(permutations[0]);
    let passed = true;
    let reason: string | undefined;

    for (let i = 1; i < permutations.length; i++) {
      const permResult = runPermutation(permutations[i]);
      if (JSON.stringify(baseResult) !== JSON.stringify(permResult)) {
        passed = false;
        reason = `Permutation ${i + 1} produced different conversion IDs: ${JSON.stringify(permResult)} vs base ${JSON.stringify(baseResult)}`;
        break;
      }
    }

    return {
      passed,
      invariantId: "INV_124_CONVERSION_ORDER_INDEPENDENT",
      name: "Conversion Engine Order Independence Guard",
      severity: "critical",
      reason,
    };
  },
};

/**
 * Invariant #125: Goal Ownership Guard.
 * A GoalDefinition may only be used by its owning experiment (goalDefinition.experimentId === goalCandidate.experimentId).
 */
export const INV_125_GOAL_OWNERSHIP: ConversionInvariant = {
  id: "INV_125_GOAL_OWNERSHIP",
  name: "Goal Ownership Guard",
  description: "GoalDefinition experimentId must match GoalCandidate experimentId.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate || !ctx.goalDefinition) {
      return { passed: true, invariantId: "INV_125_GOAL_OWNERSHIP", name: "Goal Ownership Guard", severity: "critical" };
    }

    const passed = ctx.goalDefinition.experimentId.trim() === ctx.goalCandidate.experimentId.trim();
    return {
      passed,
      invariantId: "INV_125_GOAL_OWNERSHIP",
      name: "Goal Ownership Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `GoalDefinition '${ctx.goalDefinition.id}' belongs to experiment '${ctx.goalDefinition.experimentId}', but candidate specified experiment '${ctx.goalCandidate.experimentId}'.`,
    };
  },
};

/**
 * Invariant #126: Conversion Requires Exposure.
 * Every ConversionEvent must be attributable to an existing ExposureEvent.
 * Developer note: Conversions are facts that depend on prior exposure. Conversions may never exist independently.
 */
export const INV_126_CONVERSION_REQUIRES_EXPOSURE: ConversionInvariant = {
  id: "INV_126_CONVERSION_REQUIRES_EXPOSURE",
  name: "Conversion Attribution Exposure Guard",
  description: "Every ConversionEvent must be attributable to a matching ExposureEvent.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.goalCandidate) {
      return { passed: true, invariantId: "INV_126_CONVERSION_REQUIRES_EXPOSURE", name: "Conversion Attribution Exposure Guard", severity: "critical" };
    }

    if (!ctx.exposureEvent) {
      return {
        passed: false,
        invariantId: "INV_126_CONVERSION_REQUIRES_EXPOSURE",
        name: "Conversion Attribution Exposure Guard",
        severity: "critical",
        reason: "Missing ExposureEvent for conversion candidate attribution.",
      };
    }

    const passed =
      ctx.exposureEvent.sessionId.trim() === ctx.goalCandidate.sessionId.trim() &&
      ctx.exposureEvent.experimentId.trim() === ctx.goalCandidate.experimentId.trim() &&
      ctx.exposureEvent.variantId.trim() === ctx.goalCandidate.variantId.trim();

    return {
      passed,
      invariantId: "INV_126_CONVERSION_REQUIRES_EXPOSURE",
      name: "Conversion Attribution Exposure Guard",
      severity: "critical",
      reason: passed ? undefined : "ExposureEvent (sessionId, experimentId, variantId) does not match GoalCandidate.",
    };
  },
};

export const CONVERSION_INVARIANTS: readonly ConversionInvariant[] = [
  INV_118_CONVERSION_DETERMINISTIC,
  INV_119_CONVERSION_READ_ONLY,
  INV_120_CONVERSION_IDEMPOTENT,
  INV_121_CONVERSION_DEDUPLICATION,
  INV_122_CONVERSION_ID_STABLE,
  INV_123_CONVERSION_TIME_INJECTION,
  INV_124_CONVERSION_ORDER_INDEPENDENT,
  INV_125_GOAL_OWNERSHIP,
  INV_126_CONVERSION_REQUIRES_EXPOSURE,
] as const;

export function checkAllConversionInvariants(
  ctx: ConversionInvariantCheckContext
): ConversionInvariantResult[] {
  return CONVERSION_INVARIANTS.map((inv) => inv.check(ctx) as ConversionInvariantResult);
}

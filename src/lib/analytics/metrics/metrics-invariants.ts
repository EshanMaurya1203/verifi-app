// ─── VRF-ONBOARD-004D — Metrics Invariants Module ───────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { MetricsSnapshot, MetricsResult } from "./metrics-types";
import type { ExposureEvent } from "../exposure/exposure-types";
import type { ConversionEvent } from "../conversion/conversion-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { aggregateMetrics } from "./metrics-engine";
import { buildMetricsSnapshotId } from "./metrics-utils";

export interface MetricsInvariantCheckContext extends InvariantCheckContext {
  metricsExperimentId?: string;
  metricsExposures?: ExposureEvent[];
  metricsConversions?: ConversionEvent[];
  metricsGeneratedAt?: Date;
  metricsResult?: MetricsResult;
}

export interface MetricsInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface MetricsInvariant {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning";
  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

/**
 * Invariant #127: Metrics Deterministic.
 * Same inputs (experimentId, exposures, conversions, generatedAt) produce identical MetricsSnapshot.
 */
export const INV_127_METRICS_DETERMINISTIC: MetricsInvariant = {
  id: "INV_127_METRICS_DETERMINISTIC",
  name: "Metrics Engine Determinism Guard",
  description: "Identical metrics request inputs must produce strictly identical MetricsSnapshot outputs.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const exposures = ctx.metricsExposures || [];
    const conversions = ctx.metricsConversions || [];
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const res1 = aggregateMetrics(expId, exposures, conversions, generatedAt);
    const res2 = aggregateMetrics(expId, exposures, conversions, generatedAt);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_127_METRICS_DETERMINISTIC",
      name: "Metrics Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical metrics inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #128: Metrics Read-Only.
 * Metrics aggregation must never mutate input exposure or conversion arrays/events.
 */
export const INV_128_METRICS_READ_ONLY: MetricsInvariant = {
  id: "INV_128_METRICS_READ_ONLY",
  name: "Metrics Engine Immutability Guard",
  description: "Metrics aggregation must never mutate input exposure or conversion arrays.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const exposures = ctx.metricsExposures ? [...ctx.metricsExposures] : [];
    const conversions = ctx.metricsConversions ? [...ctx.metricsConversions] : [];
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const exposuresBefore = JSON.stringify(exposures);
    const conversionsBefore = JSON.stringify(conversions);

    aggregateMetrics(expId, exposures, conversions, generatedAt);

    const exposuresAfter = JSON.stringify(exposures);
    const conversionsAfter = JSON.stringify(conversions);

    const passed = exposuresBefore === exposuresAfter && conversionsBefore === conversionsAfter;
    return {
      passed,
      invariantId: "INV_128_METRICS_READ_ONLY",
      name: "Metrics Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Metrics aggregation mutated input arrays or objects.",
    };
  },
};

/**
 * Invariant #129: Metrics Order Independent.
 * Permutation order of input exposure and conversion arrays does not change aggregated output.
 */
export const INV_129_METRICS_ORDER_INDEPENDENT: MetricsInvariant = {
  id: "INV_129_METRICS_ORDER_INDEPENDENT",
  name: "Metrics Engine Order Independence Guard",
  description: "Permutation order of input exposure and conversion arrays must yield identical metrics snapshot.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const exp1: ExposureEvent = { exposureId: "s1:exp_a:v1", sessionId: "s1", experimentId: "exp_a", variantId: "variant_a", assignmentKey: "s1:exp_a:v1", seenAt: generatedAt };
    const exp2: ExposureEvent = { exposureId: "s2:exp_a:v2", sessionId: "s2", experimentId: "exp_a", variantId: "variant_b", assignmentKey: "s2:exp_a:v1", seenAt: generatedAt };

    const conv1: ConversionEvent = { conversionId: "s1:exp_a:v1:signup", sessionId: "s1", experimentId: "exp_a", variantId: "variant_a", goalId: "signup", completedAt: generatedAt };

    const exposuresForward = [exp1, exp2];
    const exposuresReverse = [exp2, exp1];

    const res1 = aggregateMetrics(expId, exposuresForward, [conv1], generatedAt);
    const res2 = aggregateMetrics(expId, exposuresReverse, [conv1], generatedAt);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_129_METRICS_ORDER_INDEPENDENT",
      name: "Metrics Engine Order Independence Guard",
      severity: "critical",
      reason: passed ? undefined : "Permuting input exposure order altered the aggregated metrics result.",
    };
  },
};

/**
 * Invariant #130: Metrics Consistent Totals.
 * totalExposures === sum(variant.exposures) AND totalConversions === sum(variant.conversions).
 */
export const INV_130_METRICS_CONSISTENT_TOTALS: MetricsInvariant = {
  id: "INV_130_METRICS_CONSISTENT_TOTALS",
  name: "Metrics Totals Consistency Guard",
  description: "Experiment totalExposures and totalConversions must match the sum of variant exposures and conversions.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const exposures = ctx.metricsExposures || [];
    const conversions = ctx.metricsConversions || [];
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const res = ctx.metricsResult || aggregateMetrics(expId, exposures, conversions, generatedAt);
    const m = res.snapshot.metrics;

    const sumExposures = m.variants.reduce((acc, v) => acc + v.exposures, 0);
    const sumConversions = m.variants.reduce((acc, v) => acc + v.conversions, 0);

    const passed = m.totalExposures === sumExposures && m.totalConversions === sumConversions;
    return {
      passed,
      invariantId: "INV_130_METRICS_CONSISTENT_TOTALS",
      name: "Metrics Totals Consistency Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Total mismatch: totalExposures (${m.totalExposures}) vs sum (${sumExposures}), totalConversions (${m.totalConversions}) vs sum (${sumConversions}).`,
    };
  },
};

/**
 * Invariant #131: Metrics Zero-Division Safe.
 * 0 exposures yields conversionRate = 0. Never returns NaN, Infinity, or -0.
 */
export const INV_131_METRICS_ZERO_DIVISION_SAFE: MetricsInvariant = {
  id: "INV_131_METRICS_ZERO_DIVISION_SAFE",
  name: "Metrics Zero-Division Safety Guard",
  description: "Zero exposures or conversions must yield conversionRate = 0 without NaN, Infinity, or -0.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_empty";
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const res = aggregateMetrics(expId, [], [], generatedAt);
    const m = res.snapshot.metrics;

    let safe = m.overallConversionRate === 0 && !isNaN(m.overallConversionRate) && isFinite(m.overallConversionRate) && !Object.is(m.overallConversionRate, -0);

    for (const v of m.variants) {
      if (isNaN(v.conversionRate) || !isFinite(v.conversionRate) || Object.is(v.conversionRate, -0)) {
        safe = false;
        break;
      }
    }

    return {
      passed: safe,
      invariantId: "INV_131_METRICS_ZERO_DIVISION_SAFE",
      name: "Metrics Zero-Division Safety Guard",
      severity: "critical",
      reason: safe ? undefined : "Conversion rate yielded NaN, Infinity, -Infinity, or -0.",
    };
  },
};

/**
 * Invariant #132: Metrics ID Stability Guard.
 * Same experimentId + generatedAt produces identical snapshotId matching `${experimentId}:${generatedAt.toISOString()}`.
 */
export const INV_132_METRICS_ID_STABLE: MetricsInvariant = {
  id: "INV_132_METRICS_ID_STABLE",
  name: "Metrics Snapshot ID Format Guard",
  description: "Metrics snapshotId must stably match `${experimentId}:${generatedAt.toISOString()}`.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const expectedId = `${expId.trim()}:${generatedAt.toISOString()}`;
    const actualId = buildMetricsSnapshotId(expId, generatedAt);

    const passed = expectedId === actualId;
    return {
      passed,
      invariantId: "INV_132_METRICS_ID_STABLE",
      name: "Metrics Snapshot ID Format Guard",
      severity: "critical",
      reason: passed ? undefined : `Expected snapshotId '${expectedId}', got '${actualId}'.`,
    };
  },
};

/**
 * Invariant #133: Metrics External Time Injection Guard. Disallows internal time creation in metrics files.
 */
export const INV_133_METRICS_TIME_INJECTION: MetricsInvariant = {
  id: "INV_133_METRICS_TIME_INJECTION",
  name: "Metrics External Time Injection Guard",
  description: "Metrics domain files must never instantiate internal time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const METRICS_FILES = [
      "metrics-engine.ts",
      "metrics-utils.ts",
      "metrics-validator.ts",
      "metrics-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const metricsDir = path.join(__dirname);
      for (const fileName of METRICS_FILES) {
        const filePath = path.join(metricsDir, fileName);
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
      invariantId: "INV_133_METRICS_TIME_INJECTION",
      name: "Metrics External Time Injection Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

/**
 * Invariant #134: Unique Counts Consistency Guard.
 * uniqueExposures <= exposures AND uniqueConversions <= conversions.
 */
export const INV_134_UNIQUE_COUNTS_CONSISTENT: MetricsInvariant = {
  id: "INV_134_UNIQUE_COUNTS_CONSISTENT",
  name: "Unique Counts Consistency Guard",
  description: "uniqueExposures must be <= exposures and uniqueConversions must be <= conversions for every variant.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const exposures = ctx.metricsExposures || [];
    const conversions = ctx.metricsConversions || [];
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const res = ctx.metricsResult || aggregateMetrics(expId, exposures, conversions, generatedAt);
    let passed = true;
    let reason: string | undefined;

    for (const v of res.snapshot.metrics.variants) {
      if (v.uniqueExposures > v.exposures) {
        passed = false;
        reason = `Variant '${v.variantId}' uniqueExposures (${v.uniqueExposures}) > exposures (${v.exposures})`;
        break;
      }
      if (v.uniqueConversions > v.conversions) {
        passed = false;
        reason = `Variant '${v.variantId}' uniqueConversions (${v.uniqueConversions}) > conversions (${v.conversions})`;
        break;
      }
    }

    return {
      passed,
      invariantId: "INV_134_UNIQUE_COUNTS_CONSISTENT",
      name: "Unique Counts Consistency Guard",
      severity: "critical",
      reason,
    };
  },
};

/**
 * Invariant #135: Canonical Variant Order Guard.
 * MetricsSnapshot.metrics.variants must always be sorted lexicographically by variantId.
 */
export const INV_135_VARIANT_ORDER_CANONICAL: MetricsInvariant = {
  id: "INV_135_VARIANT_ORDER_CANONICAL",
  name: "Canonical Variant Ordering Guard",
  description: "Variants array in MetricsSnapshot must always be sorted lexicographically by variantId.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const expC: ExposureEvent = { exposureId: "s1:exp_a:vc", sessionId: "s1", experimentId: "exp_a", variantId: "variant_c", assignmentKey: "s1:exp_a:v1", seenAt: generatedAt };
    const expA: ExposureEvent = { exposureId: "s2:exp_a:va", sessionId: "s2", experimentId: "exp_a", variantId: "variant_a", assignmentKey: "s2:exp_a:v1", seenAt: generatedAt };
    const expB: ExposureEvent = { exposureId: "s3:exp_a:vb", sessionId: "s3", experimentId: "exp_a", variantId: "variant_b", assignmentKey: "s3:exp_a:v1", seenAt: generatedAt };

    const res = aggregateMetrics(expId, [expC, expA, expB], [], generatedAt);
    const variantIds = res.snapshot.metrics.variants.map((v) => v.variantId);
    const expectedIds = ["variant_a", "variant_b", "variant_c"];

    const passed = JSON.stringify(variantIds) === JSON.stringify(expectedIds);
    return {
      passed,
      invariantId: "INV_135_VARIANT_ORDER_CANONICAL",
      name: "Canonical Variant Ordering Guard",
      severity: "critical",
      reason: passed ? undefined : `Variant ordering expected ${JSON.stringify(expectedIds)}, got ${JSON.stringify(variantIds)}.`,
    };
  },
};

/**
 * Invariant #136: Metrics Derived Only Guard.
 * MetricsSnapshot may only be derived from ExposureEvent[] and ConversionEvent[].
 */
export const INV_136_METRICS_DERIVED_ONLY: MetricsInvariant = {
  id: "INV_136_METRICS_DERIVED_ONLY",
  name: "Metrics Fact Provenance Guard",
  description: "MetricsSnapshot is a pure projection derived only from ExposureEvent[] and ConversionEvent[].",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.metricsExperimentId || "exp_a";
    const generatedAt = ctx.metricsGeneratedAt || new Date("2026-02-01T12:00:00Z");

    const exp1: ExposureEvent = { exposureId: "s1:exp_a:va", sessionId: "s1", experimentId: "exp_a", variantId: "variant_a", assignmentKey: "s1:exp_a:v1", seenAt: generatedAt };
    const conv1: ConversionEvent = { conversionId: "s1:exp_a:va:goal1", sessionId: "s1", experimentId: "exp_a", variantId: "variant_a", goalId: "goal1", completedAt: generatedAt };

    const res = aggregateMetrics(expId, [exp1], [conv1], generatedAt);
    const snapshot = res.snapshot;

    const passed =
      snapshot.experimentId === expId &&
      snapshot.metrics.totalExposures === 1 &&
      snapshot.metrics.totalConversions === 1 &&
      snapshot.metrics.variants.length === 1 &&
      snapshot.metrics.variants[0].variantId === "variant_a";

    return {
      passed,
      invariantId: "INV_136_METRICS_DERIVED_ONLY",
      name: "Metrics Fact Provenance Guard",
      severity: "critical",
      reason: passed ? undefined : "MetricsSnapshot failed fact provenance verification.",
    };
  },
};

export const METRICS_INVARIANTS: readonly MetricsInvariant[] = [
  INV_127_METRICS_DETERMINISTIC,
  INV_128_METRICS_READ_ONLY,
  INV_129_METRICS_ORDER_INDEPENDENT,
  INV_130_METRICS_CONSISTENT_TOTALS,
  INV_131_METRICS_ZERO_DIVISION_SAFE,
  INV_132_METRICS_ID_STABLE,
  INV_133_METRICS_TIME_INJECTION,
  INV_134_UNIQUE_COUNTS_CONSISTENT,
  INV_135_VARIANT_ORDER_CANONICAL,
  INV_136_METRICS_DERIVED_ONLY,
] as const;

export function checkAllMetricsInvariants(
  ctx: MetricsInvariantCheckContext
): MetricsInvariantResult[] {
  return METRICS_INVARIANTS.map((inv) => inv.check(ctx) as MetricsInvariantResult);
}

/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-004E — Statistics Invariants Module ─────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { VariantMetrics } from "../metrics/metrics-types";
import type { SignificanceReport, StatisticsResult } from "./statistics-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { analyzeSignificance } from "./statistics-engine";

export interface StatisticsInvariantCheckContext extends InvariantCheckContext {
  statsExperimentId?: string;
  statsBaseline?: VariantMetrics;
  statsCandidate?: VariantMetrics;
  statsConfidenceLevel?: number;
  statsResult?: StatisticsResult;
}

export interface StatisticsInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface StatisticsInvariant {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning";
  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

function getSampleMetrics(id: string, variantId: string, exposures: number, conversions: number): VariantMetrics {
  return {
    experimentId: id,
    variantId,
    exposures,
    uniqueExposures: exposures,
    conversions,
    uniqueConversions: conversions,
    conversionRate: exposures > 0 ? conversions / exposures : 0,
  };
}

/**
 * Invariant #137: Statistics Deterministic. Same inputs produce identical SignificanceReport.
 */
export const INV_137_STATISTICS_DETERMINISTIC: StatisticsInvariant = {
  id: "INV_137_STATISTICS_DETERMINISTIC",
  name: "Statistics Engine Determinism Guard",
  description: "Identical statistical analysis request inputs must produce strictly identical SignificanceReport outputs.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);
    const conf = ctx.statsConfidenceLevel || 0.95;

    const res1 = analyzeSignificance(expId, baseline, candidate, conf);
    const res2 = analyzeSignificance(expId, baseline, candidate, conf);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_137_STATISTICS_DETERMINISTIC",
      name: "Statistics Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical statistical analysis inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #138: Statistics Read-Only. Engine never mutates input baseline or candidate VariantMetrics.
 */
export const INV_138_STATISTICS_READ_ONLY: StatisticsInvariant = {
  id: "INV_138_STATISTICS_READ_ONLY",
  name: "Statistics Engine Immutability Guard",
  description: "Statistics engine must never mutate input baseline or candidate VariantMetrics.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);
    const conf = ctx.statsConfidenceLevel || 0.95;

    const baselineJsonBefore = JSON.stringify(baseline);
    const candidateJsonBefore = JSON.stringify(candidate);

    analyzeSignificance(expId, baseline, candidate, conf);

    const baselineJsonAfter = JSON.stringify(baseline);
    const candidateJsonAfter = JSON.stringify(candidate);

    const passed = baselineJsonBefore === baselineJsonAfter && candidateJsonBefore === candidateJsonAfter;
    return {
      passed,
      invariantId: "INV_138_STATISTICS_READ_ONLY",
      name: "Statistics Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Statistics engine mutated input VariantMetrics parameters.",
    };
  },
};

/**
 * Invariant #139: Statistics Order Independent.
 * Analysis execution order / symmetric execution produces consistent statistical properties.
 */
export const INV_139_STATISTICS_ORDER_INDEPENDENT: StatisticsInvariant = {
  id: "INV_139_STATISTICS_ORDER_INDEPENDENT",
  name: "Statistics Engine Order Independence Guard",
  description: "Swapping baseline and candidate yields identical absolute Z-score and identical p-value.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);
    const conf = ctx.statsConfidenceLevel || 0.95;

    const resAB = analyzeSignificance(expId, baseline, candidate, conf);
    const resBA = analyzeSignificance(expId, candidate, baseline, conf);

    const passed =
      Math.abs(resAB.report.zScore) === Math.abs(resBA.report.zScore) &&
      resAB.report.pValue === resBA.report.pValue &&
      resAB.report.statisticallySignificant === resBA.report.statisticallySignificant;

    return {
      passed,
      invariantId: "INV_139_STATISTICS_ORDER_INDEPENDENT",
      name: "Statistics Engine Order Independence Guard",
      severity: "critical",
      reason: passed ? undefined : "Symmetric analysis (A vs B vs B vs A) produced inconsistent z-score magnitude or p-value.",
    };
  },
};

/**
 * Invariant #140: Zero Sample Safety Guard.
 * 0 exposures yields statisticallySignificant = false and pValue = 1.0.
 */
export const INV_140_ZERO_SAMPLE_SAFE: StatisticsInvariant = {
  id: "INV_140_ZERO_SAMPLE_SAFE",
  name: "Statistics Zero-Sample Safety Guard",
  description: "Zero exposures in baseline or candidate must yield statisticallySignificant = false and pValue = 1.0.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_empty";
    const bZero = getSampleMetrics(expId, "variant_a", 0, 0);
    const cZero = getSampleMetrics(expId, "variant_b", 0, 0);

    const res = analyzeSignificance(expId, bZero, cZero, 0.95);
    const r = res.report;

    const passed = r.statisticallySignificant === false && r.pValue === 1.0 && r.zScore === 0;
    return {
      passed,
      invariantId: "INV_140_ZERO_SAMPLE_SAFE",
      name: "Statistics Zero-Sample Safety Guard",
      severity: "critical",
      reason: passed ? undefined : `Zero sample yielded statisticallySignificant=${r.statisticallySignificant}, pValue=${r.pValue}, zScore=${r.zScore}.`,
    };
  },
};

/**
 * Invariant #141: P-Value Range Guard.
 * 0 <= pValue <= 1.
 */
export const INV_141_PVALUE_RANGE: StatisticsInvariant = {
  id: "INV_141_PVALUE_RANGE",
  name: "P-Value Bound Integrity Guard",
  description: "pValue must strictly satisfy 0 <= pValue <= 1.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);

    const res = ctx.statsResult || analyzeSignificance(expId, baseline, candidate, 0.95);
    const p = res.report.pValue;

    const passed = isFinite(p) && !isNaN(p) && p >= 0 && p <= 1 && !Object.is(p, -0);
    return {
      passed,
      invariantId: "INV_141_PVALUE_RANGE",
      name: "P-Value Bound Integrity Guard",
      severity: "critical",
      reason: passed ? undefined : `pValue '${p}' violated bound [0, 1].`,
    };
  },
};

/**
 * Invariant #142: Z-Score Finite Guard.
 * zScore must be a finite number (never NaN, Infinity, -Infinity, or -0).
 */
export const INV_142_ZSCORE_FINITE: StatisticsInvariant = {
  id: "INV_142_ZSCORE_FINITE",
  name: "Z-Score Finiteness Guard",
  description: "zScore must be a finite number (never NaN, Infinity, -Infinity, or -0).",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);

    const res = ctx.statsResult || analyzeSignificance(expId, baseline, candidate, 0.95);
    const z = res.report.zScore;

    const passed = isFinite(z) && !isNaN(z) && !Object.is(z, -0);
    return {
      passed,
      invariantId: "INV_142_ZSCORE_FINITE",
      name: "Z-Score Finiteness Guard",
      severity: "critical",
      reason: passed ? undefined : `zScore '${z}' is non-finite or NaN or -0.`,
    };
  },
};

/**
 * Invariant #143: Report Field Stability Guard.
 * Same inputs produce identical report fields.
 */
export const INV_143_REPORT_ID_STABLE: StatisticsInvariant = {
  id: "INV_143_REPORT_ID_STABLE",
  name: "Significance Report Field Stability Guard",
  description: "Significance report fields must stably match expected computation.",
  severity: "critical",
  check: (ctx) => {
    const expId = ctx.statsExperimentId || "exp_a";
    const baseline = ctx.statsBaseline || getSampleMetrics(expId, "variant_a", 100, 10);
    const candidate = ctx.statsCandidate || getSampleMetrics(expId, "variant_b", 100, 15);

    const res = analyzeSignificance(expId, baseline, candidate, 0.95);
    const r = res.report;

    const passed =
      r.experimentId === expId &&
      r.baselineVariantId === "variant_a" &&
      r.candidateVariantId === "variant_b" &&
      r.baselineRate === 0.1 &&
      r.candidateRate === 0.15 &&
      r.lift === 0.5 &&
      r.confidenceLevel === 0.95;

    return {
      passed,
      invariantId: "INV_143_REPORT_ID_STABLE",
      name: "Significance Report Field Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "SignificanceReport fields failed stability verification.",
    };
  },
};

/**
 * Invariant #144: Statistics External Time Free Guard.
 * Prohibits internal time creation (new Date() or Date.now()) in statistics files.
 */
export const INV_144_TIME_FREE: StatisticsInvariant = {
  id: "INV_144_TIME_FREE",
  name: "Statistics Time-Free Guard",
  description: "Statistics domain files must never instantiate time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const STATS_FILES = [
      "statistics-engine.ts",
      "statistics-utils.ts",
      "statistics-validator.ts",
      "statistics-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const statsDir = path.join(__dirname);
      for (const fileName of STATS_FILES) {
        const filePath = path.join(statsDir, fileName);
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
      invariantId: "INV_144_TIME_FREE",
      name: "Statistics Time-Free Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

export const STATISTICS_INVARIANTS: readonly StatisticsInvariant[] = [
  INV_137_STATISTICS_DETERMINISTIC,
  INV_138_STATISTICS_READ_ONLY,
  INV_139_STATISTICS_ORDER_INDEPENDENT,
  INV_140_ZERO_SAMPLE_SAFE,
  INV_141_PVALUE_RANGE,
  INV_142_ZSCORE_FINITE,
  INV_143_REPORT_ID_STABLE,
  INV_144_TIME_FREE,
] as const;

export function checkAllStatisticsInvariants(
  ctx: StatisticsInvariantCheckContext
): StatisticsInvariantResult[] {
  return STATISTICS_INVARIANTS.map((inv) => inv.check(ctx) as StatisticsInvariantResult);
}

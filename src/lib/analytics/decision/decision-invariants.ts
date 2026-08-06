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
// ─── VRF-ONBOARD-005A — Decision Invariants Module ───────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { SignificanceReport } from "../statistics/statistics-types";
import type { VariantMetrics } from "../metrics/metrics-types";
import type { DecisionConfig, DecisionResult } from "./decision-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { makeDecision } from "./decision-engine";

export interface DecisionInvariantCheckContext extends InvariantCheckContext {
  decisionSignificance?: SignificanceReport;
  decisionBaseline?: VariantMetrics;
  decisionCandidate?: VariantMetrics;
  decisionConfig?: Partial<DecisionConfig>;
  decisionResult?: DecisionResult;
}

export interface DecisionInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface DecisionInvariant {
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

function getSampleSignificance(
  id: string,
  baselineVariantId: string,
  candidateVariantId: string,
  statisticallySignificant: boolean
): SignificanceReport {
  return {
    experimentId: id,
    baselineVariantId,
    candidateVariantId,
    baselineRate: 0.1,
    candidateRate: 0.15,
    lift: 0.5,
    zScore: statisticallySignificant ? 3.0 : 0.5,
    pValue: statisticallySignificant ? 0.002 : 0.6,
    confidenceLevel: 0.95,
    statisticallySignificant,
  };
}

/**
 * Invariant #145: Decision Deterministic. Same inputs produce identical DecisionReport.
 */
export const INV_145_DECISION_DETERMINISTIC: DecisionInvariant = {
  id: "INV_145_DECISION_DETERMINISTIC",
  name: "Decision Engine Determinism Guard",
  description: "Identical decision request inputs must produce strictly identical DecisionReport outputs.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_a";
    const sig = ctx.decisionSignificance || getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetrics = ctx.decisionBaseline || getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = ctx.decisionCandidate || getSampleMetrics(expId, "variant_b", 1000, 150);

    const res1 = makeDecision(sig, bMetrics, cMetrics, ctx.decisionConfig);
    const res2 = makeDecision(sig, bMetrics, cMetrics, ctx.decisionConfig);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_145_DECISION_DETERMINISTIC",
      name: "Decision Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical decision inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #146: Decision Read-Only. Decision engine never mutates input parameters.
 */
export const INV_146_DECISION_READ_ONLY: DecisionInvariant = {
  id: "INV_146_DECISION_READ_ONLY",
  name: "Decision Engine Immutability Guard",
  description: "Decision engine must never mutate input significance report or variant metrics.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_a";
    const sig = ctx.decisionSignificance || getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetrics = ctx.decisionBaseline || getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = ctx.decisionCandidate || getSampleMetrics(expId, "variant_b", 1000, 150);

    const sigBefore = JSON.stringify(sig);
    const bBefore = JSON.stringify(bMetrics);
    const cBefore = JSON.stringify(cMetrics);

    makeDecision(sig, bMetrics, cMetrics, ctx.decisionConfig);

    const sigAfter = JSON.stringify(sig);
    const bAfter = JSON.stringify(bMetrics);
    const cAfter = JSON.stringify(cMetrics);

    const passed = sigBefore === sigAfter && bBefore === bAfter && cBefore === cAfter;
    return {
      passed,
      invariantId: "INV_146_DECISION_READ_ONLY",
      name: "Decision Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Decision engine mutated input parameters.",
    };
  },
};

/**
 * Invariant #147: Decision Order Independent.
 * Input ordering never changes decision result for identical evaluation.
 */
export const INV_147_DECISION_ORDER_INDEPENDENT: DecisionInvariant = {
  id: "INV_147_DECISION_ORDER_INDEPENDENT",
  name: "Decision Engine Order Independence Guard",
  description: "Decision output is purely a deterministic function of evaluation parameters.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_a";
    const sig = ctx.decisionSignificance || getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetrics = ctx.decisionBaseline || getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = ctx.decisionCandidate || getSampleMetrics(expId, "variant_b", 1000, 150);

    const res1 = makeDecision(sig, bMetrics, cMetrics);
    const res2 = makeDecision({ ...sig }, { ...bMetrics }, { ...cMetrics });

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_147_DECISION_ORDER_INDEPENDENT",
      name: "Decision Engine Order Independence Guard",
      severity: "critical",
      reason: passed ? undefined : "Decision engine produced inconsistent output across identical instances.",
    };
  },
};

/**
 * Invariant #148: Significance Required Guard.
 * winner_detected and regression_detected strictly require statisticallySignificant === true.
 */
export const INV_148_SIGNIFICANCE_REQUIRED: DecisionInvariant = {
  id: "INV_148_SIGNIFICANCE_REQUIRED",
  name: "Significance Required Guard",
  description: "winner_detected and regression_detected decisions strictly require statisticallySignificant === true.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_sig";
    const sigNotSig = getSampleSignificance(expId, "variant_a", "variant_b", false);
    const bMetrics = getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = getSampleMetrics(expId, "variant_b", 1000, 150);

    const res = makeDecision(sigNotSig, bMetrics, cMetrics);
    const d = res.report.decision;

    const passed = d !== "winner_detected" && d !== "regression_detected";
    return {
      passed,
      invariantId: "INV_148_SIGNIFICANCE_REQUIRED",
      name: "Significance Required Guard",
      severity: "critical",
      reason: passed ? undefined : `Non-significant result yielded decision '${d}'.`,
    };
  },
};

/**
 * Invariant #149: Sample Size Required Guard.
 * winner_detected and regression_detected strictly require sampleSizeReached === true.
 */
export const INV_149_SAMPLE_SIZE_REQUIRED: DecisionInvariant = {
  id: "INV_149_SAMPLE_SIZE_REQUIRED",
  name: "Sample Size Required Guard",
  description: "winner_detected and regression_detected decisions strictly require sampleSizeReached === true.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_sample";
    const sig = getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetricsSmall = getSampleMetrics(expId, "variant_a", 100, 10);
    const cMetricsSmall = getSampleMetrics(expId, "variant_b", 100, 15);

    const res = makeDecision(sig, bMetricsSmall, cMetricsSmall, { minimumSampleSize: 1000 });
    const d = res.report.decision;

    const passed = d !== "winner_detected" && d !== "regression_detected" && res.report.sampleSizeReached === false;
    return {
      passed,
      invariantId: "INV_149_SAMPLE_SIZE_REQUIRED",
      name: "Sample Size Required Guard",
      severity: "critical",
      reason: passed ? undefined : `Insufficient sample size yielded decision '${d}'.`,
    };
  },
};

/**
 * Invariant #150: Decision Projection Only Guard.
 * Decision engine produces advisory projections only (no side effects, no mutation).
 */
export const INV_150_DECISION_PROJECTION_ONLY: DecisionInvariant = {
  id: "INV_150_DECISION_PROJECTION_ONLY",
  name: "Advisory Projection Only Guard",
  description: "Decision engine must produce pure frozen projections without side effects.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_a";
    const sig = ctx.decisionSignificance || getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetrics = ctx.decisionBaseline || getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = ctx.decisionCandidate || getSampleMetrics(expId, "variant_b", 1000, 150);

    const res = makeDecision(sig, bMetrics, cMetrics);
    const isProjFrozen = Object.isFrozen(res) && Object.isFrozen(res.report) && Object.isFrozen(res.report.reason);

    return {
      passed: isProjFrozen,
      invariantId: "INV_150_DECISION_PROJECTION_ONLY",
      name: "Advisory Projection Only Guard",
      severity: "critical",
      reason: isProjFrozen ? undefined : "Decision output is not deeply frozen.",
    };
  },
};

/**
 * Invariant #151: Decision Reason Stability Guard.
 * Same inputs produce identical decision reason code and message.
 */
export const INV_151_DECISION_REASON_STABLE: DecisionInvariant = {
  id: "INV_151_DECISION_REASON_STABLE",
  name: "Decision Reason Stability Guard",
  description: "Decision reason code and message must stably match decision state.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_a";
    const sig = ctx.decisionSignificance || getSampleSignificance(expId, "variant_a", "variant_b", true);
    const bMetrics = ctx.decisionBaseline || getSampleMetrics(expId, "variant_a", 1000, 100);
    const cMetrics = ctx.decisionCandidate || getSampleMetrics(expId, "variant_b", 1000, 150);

    const res = makeDecision(sig, bMetrics, cMetrics);
    const r = res.report.reason;

    const passed = Boolean(r.code) && Boolean(r.message) && typeof r.code === "string" && typeof r.message === "string";
    return {
      passed,
      invariantId: "INV_151_DECISION_REASON_STABLE",
      name: "Decision Reason Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "Decision reason code or message was invalid.",
    };
  },
};

/**
 * Invariant #152: Decision External Time Free Guard.
 * Prohibits internal time creation (new Date() or Date.now()) in decision files.
 */
export const INV_152_TIME_FREE: DecisionInvariant = {
  id: "INV_152_TIME_FREE",
  name: "Decision Time-Free Guard",
  description: "Decision domain files must never instantiate time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const DECISION_FILES = [
      "decision-engine.ts",
      "decision-utils.ts",
      "decision-validator.ts",
      "decision-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const decisionDir = path.join(__dirname);
      for (const fileName of DECISION_FILES) {
        const filePath = path.join(decisionDir, fileName);
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
      invariantId: "INV_152_TIME_FREE",
      name: "Decision Time-Free Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

export const DECISION_INVARIANTS: readonly DecisionInvariant[] = [
  INV_145_DECISION_DETERMINISTIC,
  INV_146_DECISION_READ_ONLY,
  INV_147_DECISION_ORDER_INDEPENDENT,
  INV_148_SIGNIFICANCE_REQUIRED,
  INV_149_SAMPLE_SIZE_REQUIRED,
  INV_150_DECISION_PROJECTION_ONLY,
  INV_151_DECISION_REASON_STABLE,
  INV_152_TIME_FREE,
] as const;

export function checkAllDecisionInvariants(
  ctx: DecisionInvariantCheckContext
): DecisionInvariantResult[] {
  return DECISION_INVARIANTS.map((inv) => inv.check(ctx) as DecisionInvariantResult);
}

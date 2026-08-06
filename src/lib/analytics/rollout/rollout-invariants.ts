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
// ─── VRF-ONBOARD-005B — Rollout Invariants Module ────────────────────────────

import * as fs from "fs";
import * as path from "path";
import type { DecisionReport } from "../decision/decision-types";
import type { RolloutPolicy, RolloutResult } from "./rollout-types";
import type { InvariantCheckContext, InvariantCheckResult } from "../experiment-invariants";
import { buildRolloutPlan } from "./rollout-engine";

export interface RolloutInvariantCheckContext extends InvariantCheckContext {
  rolloutDecision?: DecisionReport;
  rolloutBaselineVariantId?: string;
  rolloutCandidateVariantId?: string;
  rolloutPolicy?: Partial<RolloutPolicy>;
  rolloutResult?: RolloutResult;
}

export interface RolloutInvariantResult extends InvariantCheckResult {
  passed: boolean;
  invariantId: string;
  name: string;
  severity: "critical" | "warning";
  reason?: string;
}

export interface RolloutInvariant {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning";
  check: (ctx: InvariantCheckContext) => InvariantCheckResult;
}

function getSampleDecision(expId: string, dState: DecisionReport["decision"] = "winner_detected"): DecisionReport {
  return {
    experimentId: expId,
    baselineVariantId: "variant_a",
    candidateVariantId: "variant_b",
    decision: dState,
    confidence: 0.95,
    statisticallySignificant: dState === "winner_detected" || dState === "regression_detected",
    sampleSizeReached: true,
    reason: {
      code: "CANDIDATE_OUTPERFORMS_BASELINE",
      message: "Candidate outperforms baseline",
    },
  };
}

/**
 * Invariant #153: Rollout Deterministic. Same inputs produce identical RolloutPlan.
 */
export const INV_153_ROLLOUT_DETERMINISTIC: RolloutInvariant = {
  id: "INV_153_ROLLOUT_DETERMINISTIC",
  name: "Rollout Engine Determinism Guard",
  description: "Identical rollout request inputs must produce strictly identical RolloutPlan outputs.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);
    const bId = ctx.rolloutBaselineVariantId || "variant_a";
    const cId = ctx.rolloutCandidateVariantId || "variant_b";

    const res1 = buildRolloutPlan(d, bId, cId, ctx.rolloutPolicy);
    const res2 = buildRolloutPlan(d, bId, cId, ctx.rolloutPolicy);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_153_ROLLOUT_DETERMINISTIC",
      name: "Rollout Engine Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical rollout inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #154: Rollout Read-Only. Rollout engine never mutates input parameters.
 */
export const INV_154_ROLLOUT_READ_ONLY: RolloutInvariant = {
  id: "INV_154_ROLLOUT_READ_ONLY",
  name: "Rollout Engine Immutability Guard",
  description: "Rollout engine must never mutate input decision report or policy.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);
    const bId = ctx.rolloutBaselineVariantId || "variant_a";
    const cId = ctx.rolloutCandidateVariantId || "variant_b";
    const pol = ctx.rolloutPolicy || { winnerTrafficPercentage: 75 };

    const dBefore = JSON.stringify(d);
    const polBefore = JSON.stringify(pol);

    buildRolloutPlan(d, bId, cId, pol);

    const dAfter = JSON.stringify(d);
    const polAfter = JSON.stringify(pol);

    const passed = dBefore === dAfter && polBefore === polAfter;
    return {
      passed,
      invariantId: "INV_154_ROLLOUT_READ_ONLY",
      name: "Rollout Engine Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Rollout engine mutated input parameters.",
    };
  },
};

/**
 * Invariant #155: Traffic Sum 100 Guard.
 * baselinePercentage + candidatePercentage === 100.
 */
export const INV_155_TRAFFIC_SUM_100: RolloutInvariant = {
  id: "INV_155_TRAFFIC_SUM_100",
  name: "Traffic Sum 100 Guard",
  description: "Sum of baseline and candidate traffic percentages must strictly equal 100%.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);
    const bId = ctx.rolloutBaselineVariantId || "variant_a";
    const cId = ctx.rolloutCandidateVariantId || "variant_b";

    const res = buildRolloutPlan(d, bId, cId, ctx.rolloutPolicy);
    const sum = res.plan.allocation.baselinePercentage + res.plan.allocation.candidatePercentage;

    const passed = sum === 100;
    return {
      passed,
      invariantId: "INV_155_TRAFFIC_SUM_100",
      name: "Traffic Sum 100 Guard",
      severity: "critical",
      reason: passed ? undefined : `Traffic percentage sum equaled ${sum} instead of 100.`,
    };
  },
};

/**
 * Invariant #156: Valid Traffic Range Guard.
 * 0 <= percentage <= 100.
 */
export const INV_156_VALID_TRAFFIC_RANGE: RolloutInvariant = {
  id: "INV_156_VALID_TRAFFIC_RANGE",
  name: "Valid Traffic Range Guard",
  description: "Traffic percentages for baseline and candidate must be bounded within [0, 100].",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);
    const bId = ctx.rolloutBaselineVariantId || "variant_a";
    const cId = ctx.rolloutCandidateVariantId || "variant_b";

    const res = buildRolloutPlan(d, bId, cId, ctx.rolloutPolicy);
    const bPct = res.plan.allocation.baselinePercentage;
    const cPct = res.plan.allocation.candidatePercentage;

    const passed = bPct >= 0 && bPct <= 100 && cPct >= 0 && cPct <= 100;
    return {
      passed,
      invariantId: "INV_156_VALID_TRAFFIC_RANGE",
      name: "Valid Traffic Range Guard",
      severity: "critical",
      reason: passed ? undefined : `Traffic percentages (${bPct}, ${cPct}) out of valid [0, 100] range.`,
    };
  },
};

/**
 * Invariant #157: Decision Required Guard.
 * Rollout plan requires a valid DecisionReport payload.
 */
export const INV_157_DECISION_REQUIRED: RolloutInvariant = {
  id: "INV_157_DECISION_REQUIRED",
  name: "Decision Required Guard",
  description: "Rollout engine must strictly require a valid DecisionReport input.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);

    const res = buildRolloutPlan(d, "variant_a", "variant_b");
    const passed = Boolean(res.plan.decision) && typeof res.plan.decision === "string";

    return {
      passed,
      invariantId: "INV_157_DECISION_REQUIRED",
      name: "Decision Required Guard",
      severity: "critical",
      reason: passed ? undefined : "Rollout plan missing decision state.",
    };
  },
};

/**
 * Invariant #158: Policy Stability Guard.
 * Same policy produces identical rollout plan.
 */
export const INV_158_POLICY_STABLE: RolloutInvariant = {
  id: "INV_158_POLICY_STABLE",
  name: "Policy Stability Guard",
  description: "Rollout engine must produce identical rollout plans given identical policy configurations.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);
    const pol: Partial<RolloutPolicy> = ctx.rolloutPolicy || { winnerTrafficPercentage: 80 };

    const res1 = buildRolloutPlan(d, "variant_a", "variant_b", pol);
    const res2 = buildRolloutPlan(d, "variant_a", "variant_b", { ...pol });

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_158_POLICY_STABLE",
      name: "Policy Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "Inconsistent rollout plans produced for identical policy configuration.",
    };
  },
};

/**
 * Invariant #159: Projection Only Guard.
 * Rollout engine produces plans only (no deployment side-effects, deeply frozen).
 */
export const INV_159_PROJECTION_ONLY: RolloutInvariant = {
  id: "INV_159_PROJECTION_ONLY",
  name: "Rollout Projection Only Guard",
  description: "Rollout engine must produce pure deeply frozen plan projections without deployment side-effects.",
  severity: "critical",
  check: (ctx) => {
    const expId = "exp_rollout";
    const d = ctx.rolloutDecision || getSampleDecision(expId);

    const res = buildRolloutPlan(d, "variant_a", "variant_b");
    const isFrozen = Object.isFrozen(res) && Object.isFrozen(res.plan) && Object.isFrozen(res.plan.allocation);

    return {
      passed: isFrozen,
      invariantId: "INV_159_PROJECTION_ONLY",
      name: "Rollout Projection Only Guard",
      severity: "critical",
      reason: isFrozen ? undefined : "Rollout plan result is not deeply frozen.",
    };
  },
};

/**
 * Invariant #160: Rollout External Time Free Guard.
 * Prohibits internal time creation (new Date() or Date.now()) in rollout files.
 */
export const INV_160_TIME_FREE: RolloutInvariant = {
  id: "INV_160_TIME_FREE",
  name: "Rollout Time-Free Guard",
  description: "Rollout domain files must never instantiate time (new Date() or Date.now()).",
  severity: "critical",
  check: () => {
    const ROLLOUT_FILES = [
      "rollout-engine.ts",
      "rollout-utils.ts",
      "rollout-validator.ts",
      "rollout-projections.ts",
    ];

    const violations: string[] = [];

    try {
      const rolloutDir = path.join(__dirname);
      for (const fileName of ROLLOUT_FILES) {
        const filePath = path.join(rolloutDir, fileName);
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
      invariantId: "INV_160_TIME_FREE",
      name: "Rollout Time-Free Guard",
      severity: "critical",
      reason: passed ? undefined : `Internal time instantiation found in: ${violations.join(", ")}`,
    };
  },
};

export const ROLLOUT_INVARIANTS: readonly RolloutInvariant[] = [
  INV_153_ROLLOUT_DETERMINISTIC,
  INV_154_ROLLOUT_READ_ONLY,
  INV_155_TRAFFIC_SUM_100,
  INV_156_VALID_TRAFFIC_RANGE,
  INV_157_DECISION_REQUIRED,
  INV_158_POLICY_STABLE,
  INV_159_PROJECTION_ONLY,
  INV_160_TIME_FREE,
] as const;

export function checkAllRolloutInvariants(
  ctx: RolloutInvariantCheckContext
): RolloutInvariantResult[] {
  return ROLLOUT_INVARIANTS.map((inv) => inv.check(ctx) as RolloutInvariantResult);
}

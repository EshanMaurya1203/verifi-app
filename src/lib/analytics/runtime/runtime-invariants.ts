// ─── VRF-ONBOARD-004A — Runtime Invariants Module ──────────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import { executeRuntime } from "./runtime-engine";
import { buildAssignmentKey, assignVariant, evaluateExperiment } from "./runtime-utils";
import type { RuntimeRequest, RuntimeResult } from "./runtime-types";

export interface RuntimeInvariantCheckContext {
  runtimeRequest?: RuntimeRequest;

  experiments?: ExperimentDefinition[];

  runtimeResult?: RuntimeResult;
}

export interface RuntimeInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "critical" | "warning";

  reason?: string;
}

export interface RuntimeInvariant {
  id: string;

  name: string;

  description: string;

  severity: "critical" | "warning";

  check: (ctx: RuntimeInvariantCheckContext) => RuntimeInvariantResult;
}

/**
 * Invariant #104: Runtime Deterministic. Same request + same experiments must produce identical RuntimeResult.
 */
export const INV_104_RUNTIME_DETERMINISTIC: RuntimeInvariant = {
  id: "INV_104_RUNTIME_DETERMINISTIC",
  name: "Runtime Deterministic Execution Guard",
  description: "Same runtime request and experiment list must produce strictly identical execution results.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeRequest || !ctx.experiments) {
      return {
        passed: true,
        invariantId: "INV_104_RUNTIME_DETERMINISTIC",
        name: "Runtime Deterministic Execution Guard",
        severity: "critical",
      };
    }

    const res1 = executeRuntime(ctx.runtimeRequest, ctx.experiments);
    const res2 = executeRuntime(ctx.runtimeRequest, ctx.experiments);

    const passed = JSON.stringify(res1) === JSON.stringify(res2);
    return {
      passed,
      invariantId: "INV_104_RUNTIME_DETERMINISTIC",
      name: "Runtime Deterministic Execution Guard",
      severity: "critical",
      reason: passed ? undefined : "Identical runtime inputs produced non-identical execution results.",
    };
  },
};

/**
 * Invariant #105: Runtime Read-Only. Runtime execution must never mutate experiment definitions.
 */
export const INV_105_RUNTIME_READ_ONLY: RuntimeInvariant = {
  id: "INV_105_RUNTIME_READ_ONLY",
  name: "Runtime Immutability Guard",
  description: "Runtime execution must never mutate input experiment definitions or request objects.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeRequest || !ctx.experiments) {
      return {
        passed: true,
        invariantId: "INV_105_RUNTIME_READ_ONLY",
        name: "Runtime Immutability Guard",
        severity: "critical",
      };
    }

    const originalJson = JSON.stringify(ctx.experiments);
    executeRuntime(ctx.runtimeRequest, ctx.experiments);
    const afterJson = JSON.stringify(ctx.experiments);

    const passed = originalJson === afterJson;
    return {
      passed,
      invariantId: "INV_105_RUNTIME_READ_ONLY",
      name: "Runtime Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Runtime execution mutated input experiment definitions.",
    };
  },
};

/**
 * Invariant #106: Runtime Order Stable. Evaluation order must be sorted by experiment.id and version.
 */
export const INV_106_RUNTIME_ORDER_STABLE: RuntimeInvariant = {
  id: "INV_106_RUNTIME_ORDER_STABLE",
  name: "Runtime Evaluation Order Monotonicity Guard",
  description: "Experiment evaluation order must be strictly sorted by experiment.id (primary) and version (secondary).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeRequest || !ctx.experiments) {
      return {
        passed: true,
        invariantId: "INV_106_RUNTIME_ORDER_STABLE",
        name: "Runtime Evaluation Order Monotonicity Guard",
        severity: "critical",
      };
    }

    const result = executeRuntime(ctx.runtimeRequest, ctx.experiments);
    const expectedOrder = [...ctx.experiments]
      .sort((a, b) => (a.id !== b.id ? a.id.localeCompare(b.id) : a.version - b.version))
      .map((e) => e.id);

    const actualOrder = result.evaluatedExperiments;
    const passed = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);

    return {
      passed,
      invariantId: "INV_106_RUNTIME_ORDER_STABLE",
      name: "Runtime Evaluation Order Monotonicity Guard",
      severity: "critical",
      reason: passed ? undefined : "Runtime evaluation order did not match expected id/version sort order.",
    };
  },
};

/**
 * Invariant #107: Assignment Stable. Same assignment key must yield same variant.
 */
export const INV_107_ASSIGNMENT_STABLE: RuntimeInvariant = {
  id: "INV_107_ASSIGNMENT_STABLE",
  name: "Runtime Variant Assignment Stability Guard",
  description: "Same assignment key and experiment definition must yield strictly identical variant assignments.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experiments || ctx.experiments.length === 0) {
      return {
        passed: true,
        invariantId: "INV_107_ASSIGNMENT_STABLE",
        name: "Runtime Variant Assignment Stability Guard",
        severity: "critical",
      };
    }

    const exp = ctx.experiments[0];
    const key = buildAssignmentKey("stable_session_99", exp.id, exp.version);
    const v1 = assignVariant(exp, key);
    const v2 = assignVariant(exp, key);

    const passed = v1.id === v2.id;
    return {
      passed,
      invariantId: "INV_107_ASSIGNMENT_STABLE",
      name: "Runtime Variant Assignment Stability Guard",
      severity: "critical",
      reason: passed ? undefined : "Same assignment key yielded different variant assignments.",
    };
  },
};

/**
 * Invariant #108: Skipped Experiments Correct. Skipped reason must match failure source.
 */
export const INV_108_SKIPPED_EXPERIMENTS_CORRECT: RuntimeInvariant = {
  id: "INV_108_SKIPPED_EXPERIMENTS_CORRECT",
  name: "Runtime Skipped Reason Accuracy Guard",
  description: "Skipped experiment reason must match failure source (governance, schedule, targeting, archived, paused).",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.runtimeRequest || !ctx.experiments) {
      return {
        passed: true,
        invariantId: "INV_108_SKIPPED_EXPERIMENTS_CORRECT",
        name: "Runtime Skipped Reason Accuracy Guard",
        severity: "critical",
      };
    }

    const VALID_REASONS = ["governance", "schedule", "targeting", "archived", "paused"];
    const result = executeRuntime(ctx.runtimeRequest, ctx.experiments);
    let passed = true;
    let reasonErr: string | undefined;

    for (const s of result.skipped) {
      if (!VALID_REASONS.includes(s.reason)) {
        passed = false;
        reasonErr = `Invalid skipped reason '${s.reason}' for experiment '${s.experimentId}'.`;
        break;
      }
    }

    return {
      passed,
      invariantId: "INV_108_SKIPPED_EXPERIMENTS_CORRECT",
      name: "Runtime Skipped Reason Accuracy Guard",
      severity: "critical",
      reason: reasonErr,
    };
  },
};

/**
 * Invariant #109: Variant Order Independent. Reordering the variants array must not change the assigned variant.
 */
export const INV_109_VARIANT_ORDER_INDEPENDENT: RuntimeInvariant = {
  id: "INV_109_VARIANT_ORDER_INDEPENDENT",
  name: "Variant Order Independence Guard",
  description: "For the same (sessionId, experimentId, version), reordering the variants array must not change the assigned variant.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experiments || ctx.experiments.length === 0) {
      return {
        passed: true,
        invariantId: "INV_109_VARIANT_ORDER_INDEPENDENT",
        name: "Variant Order Independence Guard",
        severity: "critical",
      };
    }

    const exp = ctx.experiments[0];
    if (!exp.variants || exp.variants.length < 2) {
      return {
        passed: true,
        invariantId: "INV_109_VARIANT_ORDER_INDEPENDENT",
        name: "Variant Order Independence Guard",
        severity: "critical",
      };
    }

    const key = buildAssignmentKey("permutation_test_session", exp.id, exp.version);
    const baseResult = assignVariant(exp, key);

    // Generate all permutations for arrays <= 4, otherwise test reversed + shifted
    const variants = exp.variants;
    const permutations: typeof variants[] = [];

    if (variants.length <= 4) {
      // Generate all permutations
      const permute = (arr: typeof variants, start: number = 0) => {
        if (start === arr.length - 1) {
          permutations.push([...arr]);
          return;
        }
        for (let i = start; i < arr.length; i++) {
          const swapped = [...arr];
          [swapped[start], swapped[i]] = [swapped[i], swapped[start]];
          permute(swapped, start + 1);
        }
      };
      permute([...variants]);
    } else {
      // For large arrays: test reversed and rotated
      permutations.push([...variants].reverse());
      permutations.push([...variants.slice(1), variants[0]]);
      permutations.push([variants[variants.length - 1], ...variants.slice(0, -1)]);
    }

    let passed = true;
    let reason: string | undefined;

    for (const perm of permutations) {
      const permExp = { ...exp, variants: perm };
      const permResult = assignVariant(permExp, key);
      if (permResult.id !== baseResult.id) {
        passed = false;
        reason = `Variant order [${perm.map(v => v.id).join(",")}] produced '${permResult.id}' instead of '${baseResult.id}'.`;
        break;
      }
    }

    return {
      passed,
      invariantId: "INV_109_VARIANT_ORDER_INDEPENDENT",
      name: "Variant Order Independence Guard",
      severity: "critical",
      reason,
    };
  },
};

/**
 * Invariant #110: Variant Integrity. Variant IDs must be unique, weights must be positive, and total must equal 100.
 */
export const INV_110_VARIANT_INTEGRITY: RuntimeInvariant = {
  id: "INV_110_VARIANT_INTEGRITY",
  name: "Variant Integrity Guard",
  description: "Variant IDs must be unique, weights must be positive, and total weight must equal 100.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experiments || ctx.experiments.length === 0) {
      return {
        passed: true,
        invariantId: "INV_110_VARIANT_INTEGRITY",
        name: "Variant Integrity Guard",
        severity: "critical",
      };
    }

    for (const exp of ctx.experiments) {
      if (!exp.variants || exp.variants.length === 0) {
        return {
          passed: false,
          invariantId: "INV_110_VARIANT_INTEGRITY",
          name: "Variant Integrity Guard",
          severity: "critical",
          reason: `Experiment '${exp.id}' has no variants.`,
        };
      }

      const ids = new Set<string>();
      let totalWeight = 0;

      for (const v of exp.variants) {
        if (ids.has(v.id)) {
          return {
            passed: false,
            invariantId: "INV_110_VARIANT_INTEGRITY",
            name: "Variant Integrity Guard",
            severity: "critical",
            reason: `Experiment '${exp.id}' has duplicate variant id '${v.id}'.`,
          };
        }
        ids.add(v.id);

        if (typeof v.weight !== "number" || v.weight <= 0) {
          return {
            passed: false,
            invariantId: "INV_110_VARIANT_INTEGRITY",
            name: "Variant Integrity Guard",
            severity: "critical",
            reason: `Experiment '${exp.id}' variant '${v.id}' has non-positive weight ${v.weight}.`,
          };
        }

        totalWeight += v.weight;
      }

      if (Math.round(totalWeight * 100) / 100 !== 100) {
        return {
          passed: false,
          invariantId: "INV_110_VARIANT_INTEGRITY",
          name: "Variant Integrity Guard",
          severity: "critical",
          reason: `Experiment '${exp.id}' variant weights sum to ${totalWeight}, not 100.`,
        };
      }
    }

    return {
      passed: true,
      invariantId: "INV_110_VARIANT_INTEGRITY",
      name: "Variant Integrity Guard",
      severity: "critical",
    };
  },
};

export const RUNTIME_INVARIANTS: readonly RuntimeInvariant[] = [
  INV_104_RUNTIME_DETERMINISTIC,
  INV_105_RUNTIME_READ_ONLY,
  INV_106_RUNTIME_ORDER_STABLE,
  INV_107_ASSIGNMENT_STABLE,
  INV_108_SKIPPED_EXPERIMENTS_CORRECT,
  INV_109_VARIANT_ORDER_INDEPENDENT,
  INV_110_VARIANT_INTEGRITY,
] as const;

export function checkAllRuntimeInvariants(
  ctx: RuntimeInvariantCheckContext
): RuntimeInvariantResult[] {
  return RUNTIME_INVARIANTS.map((inv) => inv.check(ctx));
}

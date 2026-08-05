// ─── VRF-ONBOARD-003B — Targeting Invariants Module ───────────────────────

import type { ExperimentDefinition } from "../registry/experiment-types";
import type { TargetingContext } from "./targeting-context";
import type { ExperimentTargetingRules } from "./targeting-rules";
import type { EligibilityResult } from "./targeting-types";
import { isEligible } from "./targeting-engine";
import { validateTargetingRules } from "./targeting-validator";

export interface TargetingInvariantCheckContext {
  experimentDefinition?: ExperimentDefinition;

  targetingRules?: ExperimentTargetingRules;

  targetingContext?: TargetingContext;

  eligibilityResult?: EligibilityResult;
}

export interface TargetingInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "warning" | "high" | "critical";

  reason?: string;
}

export interface TargetingInvariant {
  id: string;

  name: string;

  description: string;

  severity: "warning" | "high" | "critical";

  check: (context: TargetingInvariantCheckContext) => TargetingInvariantResult;
}

/**
 * Invariant #79: Targeting Deterministic. Same input must produce identical eligibility results.
 */
export const INV_079_TARGETING_DETERMINISTIC: TargetingInvariant = {
  id: "INV_079_TARGETING_DETERMINISTIC",
  name: "Targeting Evaluation Determinism Guard",
  description: "Executing targeting evaluation on identical inputs must yield identical eligibility results.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.targetingContext) {
      return {
        passed: true,
        invariantId: "INV_079_TARGETING_DETERMINISTIC",
        name: "Targeting Evaluation Determinism Guard",
        severity: "critical",
      };
    }

    const res1 = isEligible(ctx.experimentDefinition, ctx.targetingContext);
    const res2 = isEligible(ctx.experimentDefinition, ctx.targetingContext);

    const passed =
      res1.eligible === res2.eligible &&
      res1.matchedRules.join(",") === res2.matchedRules.join(",") &&
      res1.failedRules.join(",") === res2.failedRules.join(",");

    return {
      passed,
      invariantId: "INV_079_TARGETING_DETERMINISTIC",
      name: "Targeting Evaluation Determinism Guard",
      severity: "critical",
      reason: passed ? undefined : "Targeting evaluation produced non-deterministic results across runs.",
    };
  },
};

/**
 * Invariant #80: Country Match. Country filters must be enforced correctly (case-insensitive).
 */
export const INV_080_COUNTRY_MATCH: TargetingInvariant = {
  id: "INV_080_COUNTRY_MATCH",
  name: "Country Filter Enforcement Guard",
  description: "Country filtering must correctly perform case-insensitive matching against allowed lists.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    const context = ctx.targetingContext;

    if (!rules || !Array.isArray(rules.countries) || rules.countries.length === 0 || !context) {
      return {
        passed: true,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
      };
    }

    const result = ctx.eligibilityResult || (ctx.experimentDefinition ? isEligible(ctx.experimentDefinition, context) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
      };
    }

    if (!context.country) {
      const passed = result.failedRules.includes("country");
      return {
        passed,
        invariantId: "INV_080_COUNTRY_MATCH",
        name: "Country Filter Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Missing country context failed to register country rule failure.",
      };
    }

    const userCountry = context.country.trim().toLowerCase();
    const allowed = rules.countries.map((c) => c.trim().toLowerCase());
    const shouldMatch = allowed.includes(userCountry);
    const actualMatch = result.matchedRules.includes("country");

    const passed = shouldMatch === actualMatch;

    return {
      passed,
      invariantId: "INV_080_COUNTRY_MATCH",
      name: "Country Filter Enforcement Guard",
      severity: "critical",
      reason: passed ? undefined : `Country match mismatch: shouldMatch=${shouldMatch}, actualMatch=${actualMatch}.`,
    };
  },
};

/**
 * Invariant #81: Provider Match. Provider filters must be enforced correctly (exact match).
 */
export const INV_081_PROVIDER_MATCH: TargetingInvariant = {
  id: "INV_081_PROVIDER_MATCH",
  name: "Provider Filter Enforcement Guard",
  description: "Provider filtering must strictly enforce exact string matching for payment providers.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    const context = ctx.targetingContext;

    if (!rules || !Array.isArray(rules.providers) || rules.providers.length === 0 || !context) {
      return {
        passed: true,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
      };
    }

    const result = ctx.eligibilityResult || (ctx.experimentDefinition ? isEligible(ctx.experimentDefinition, context) : undefined);
    if (!result) {
      return {
        passed: true,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
      };
    }

    if (!context.provider) {
      const passed = result.failedRules.includes("provider");
      return {
        passed,
        invariantId: "INV_081_PROVIDER_MATCH",
        name: "Provider Filter Enforcement Guard",
        severity: "critical",
        reason: passed ? undefined : "Missing provider context failed to register provider rule failure.",
      };
    }

    const shouldMatch = rules.providers.includes(context.provider);
    const actualMatch = result.matchedRules.includes("provider");

    const passed = shouldMatch === actualMatch;

    return {
      passed,
      invariantId: "INV_081_PROVIDER_MATCH",
      name: "Provider Filter Enforcement Guard",
      severity: "critical",
      reason: passed ? undefined : `Provider match mismatch: shouldMatch=${shouldMatch}, actualMatch=${actualMatch}.`,
    };
  },
};

/**
 * Invariant #82: User State Match. newUsersOnly and returningUsersOnly must never both evaluate to true.
 */
export const INV_082_USER_STATE_MATCH: TargetingInvariant = {
  id: "INV_082_USER_STATE_MATCH",
  name: "User State Mutual Exclusivity Guard",
  description: "Targeting rules cannot contain contradictory newUsersOnly and returningUsersOnly flags.",
  severity: "critical",
  check: (ctx) => {
    const rules = ctx.experimentDefinition?.targeting || ctx.targetingRules;
    if (!rules) {
      return {
        passed: true,
        invariantId: "INV_082_USER_STATE_MATCH",
        name: "User State Mutual Exclusivity Guard",
        severity: "critical",
      };
    }

    const val = validateTargetingRules(rules);
    const passed = val.passed;

    return {
      passed,
      invariantId: "INV_082_USER_STATE_MATCH",
      name: "User State Mutual Exclusivity Guard",
      severity: "critical",
      reason: passed ? undefined : "Targeting rules violate mutual exclusivity of newUsersOnly and returningUsersOnly.",
    };
  },
};

/**
 * Invariant #83: Rule Order Stable. Rules must always evaluate in exact deterministic order:
 * country → provider → acquisition source → onboarding step → new user → returning user
 */
export const INV_083_RULE_ORDER_STABLE: TargetingInvariant = {
  id: "INV_083_RULE_ORDER_STABLE",
  name: "Targeting Rule Evaluation Order Stability Guard",
  description: "Rule evaluation order must strictly follow country → provider → acquisition source → onboarding step → new user → returning user.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.targetingContext) {
      return {
        passed: true,
        invariantId: "INV_083_RULE_ORDER_STABLE",
        name: "Targeting Rule Evaluation Order Stability Guard",
        severity: "critical",
      };
    }

    const result = isEligible(ctx.experimentDefinition, ctx.targetingContext);
    const combined = [...result.matchedRules, ...result.failedRules];

    const EXPECTED_ORDER = ["country", "provider", "acquisition source", "onboarding step", "new user", "returning user"];

    let lastIndex = -1;
    let orderValid = true;

    for (const rule of combined) {
      const idx = EXPECTED_ORDER.indexOf(rule);
      if (idx !== -1) {
        if (idx < lastIndex) {
          orderValid = false;
          break;
        }
        lastIndex = idx;
      }
    }

    return {
      passed: orderValid,
      invariantId: "INV_083_RULE_ORDER_STABLE",
      name: "Targeting Rule Evaluation Order Stability Guard",
      severity: "critical",
      reason: orderValid ? undefined : `Rule evaluation order violated. Evaluated sequence: ${combined.join(" → ")}`,
    };
  },
};

export const TARGETING_INVARIANTS: readonly TargetingInvariant[] = [
  INV_079_TARGETING_DETERMINISTIC,
  INV_080_COUNTRY_MATCH,
  INV_081_PROVIDER_MATCH,
  INV_082_USER_STATE_MATCH,
  INV_083_RULE_ORDER_STABLE,
] as const;

export function checkAllTargetingInvariants(
  ctx: TargetingInvariantCheckContext
): TargetingInvariantResult[] {
  return TARGETING_INVARIANTS.map((inv) => inv.check(ctx));
}

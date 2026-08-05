// ─── VRF-ONBOARD-003A — Experiment Registry Invariants Engine ────────────

import type { ExperimentDefinition } from "./experiment-types";
import type { DomainRegistryStore } from "./experiment-registry";
import { isValidLifecycleTransition } from "./experiment-registry";

export interface RegistryInvariantCheckContext {
  experimentDefinition?: ExperimentDefinition;

  previousDefinition?: ExperimentDefinition;

  registryStore?: DomainRegistryStore;
}

export interface RegistryInvariantResult {
  passed: boolean;

  invariantId: string;

  name: string;

  severity: "warning" | "high" | "critical";

  reason?: string;
}

export interface RegistryInvariant {
  id: string;

  name: string;

  description: string;

  severity: "warning" | "high" | "critical";

  check: (context: RegistryInvariantCheckContext) => RegistryInvariantResult;
}

/**
 * Invariant #73: Version Monotonic. Version numbers must only increase.
 */
export const INV_073_VERSION_MONOTONIC: RegistryInvariant = {
  id: "INV_073_VERSION_MONOTONIC",
  name: "Version Monotonicity Guard",
  description: "Experiment version numbers must strictly increase across revisions.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.previousDefinition) {
      return {
        passed: true,
        invariantId: "INV_073_VERSION_MONOTONIC",
        name: "Version Monotonicity Guard",
        severity: "critical",
      };
    }

    const passed = ctx.experimentDefinition.version > ctx.previousDefinition.version;

    return {
      passed,
      invariantId: "INV_073_VERSION_MONOTONIC",
      name: "Version Monotonicity Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Version did not strictly increase. Current: ${ctx.experimentDefinition.version}, Previous: ${ctx.previousDefinition.version}`,
    };
  },
};

/**
 * Invariant #74: Unique Experiment IDs. Registry ids must be unique.
 */
export const INV_074_UNIQUE_EXPERIMENT_IDS: RegistryInvariant = {
  id: "INV_074_UNIQUE_EXPERIMENT_IDS",
  name: "Unique Registry Experiment IDs Guard",
  description: "All registered experiment IDs in the registry store must be unique.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.registryStore || !ctx.registryStore.experiments) {
      return {
        passed: true,
        invariantId: "INV_074_UNIQUE_EXPERIMENT_IDS",
        name: "Unique Registry Experiment IDs Guard",
        severity: "critical",
      };
    }

    const ids = Array.from(ctx.registryStore.experiments.keys());
    const uniqueIds = new Set(ids);
    const passed = ids.length === uniqueIds.size;

    return {
      passed,
      invariantId: "INV_074_UNIQUE_EXPERIMENT_IDS",
      name: "Unique Registry Experiment IDs Guard",
      severity: "critical",
      reason: passed ? undefined : "Duplicate experiment IDs detected in registry store.",
    };
  },
};

/**
 * Invariant #75: Minimum Variants. Every experiment must contain at least two variants.
 */
export const INV_075_MINIMUM_VARIANTS: RegistryInvariant = {
  id: "INV_075_MINIMUM_VARIANTS",
  name: "Minimum Variants Guard",
  description: "Every experiment definition must contain at least two variants.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition) {
      return {
        passed: true,
        invariantId: "INV_075_MINIMUM_VARIANTS",
        name: "Minimum Variants Guard",
        severity: "critical",
      };
    }

    const passed =
      Array.isArray(ctx.experimentDefinition.variants) &&
      ctx.experimentDefinition.variants.length >= 2;

    return {
      passed,
      invariantId: "INV_075_MINIMUM_VARIANTS",
      name: "Minimum Variants Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Experiment '${ctx.experimentDefinition.id}' contains fewer than 2 variants (${ctx.experimentDefinition.variants?.length || 0}).`,
    };
  },
};

/**
 * Invariant #76: Weight Sum 100. Variant weights must sum to exactly 100.
 */
export const INV_076_WEIGHT_SUM_100: RegistryInvariant = {
  id: "INV_076_WEIGHT_SUM_100",
  name: "Variant Weight Sum 100 Guard",
  description: "Sum of variant weights in an experiment definition must strictly equal 100.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !Array.isArray(ctx.experimentDefinition.variants)) {
      return {
        passed: true,
        invariantId: "INV_076_WEIGHT_SUM_100",
        name: "Variant Weight Sum 100 Guard",
        severity: "critical",
      };
    }

    const weightSum = ctx.experimentDefinition.variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    const passed = Math.abs(weightSum - 100) < 0.001;

    return {
      passed,
      invariantId: "INV_076_WEIGHT_SUM_100",
      name: "Variant Weight Sum 100 Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Variant weights sum to ${weightSum} (must strictly equal 100).`,
    };
  },
};

/**
 * Invariant #77: Lifecycle Valid. Lifecycle transitions must be valid.
 */
export const INV_077_LIFECYCLE_VALID: RegistryInvariant = {
  id: "INV_077_LIFECYCLE_VALID",
  name: "Lifecycle Transition Validity Guard",
  description: "Lifecycle status transitions must follow valid transition graph rules.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.experimentDefinition || !ctx.previousDefinition) {
      return {
        passed: true,
        invariantId: "INV_077_LIFECYCLE_VALID",
        name: "Lifecycle Transition Validity Guard",
        severity: "critical",
      };
    }

    const passed = isValidLifecycleTransition(
      ctx.previousDefinition.status,
      ctx.experimentDefinition.status
    );

    return {
      passed,
      invariantId: "INV_077_LIFECYCLE_VALID",
      name: "Lifecycle Transition Validity Guard",
      severity: "critical",
      reason: passed
        ? undefined
        : `Invalid lifecycle transition from '${ctx.previousDefinition.status}' to '${ctx.experimentDefinition.status}'.`,
    };
  },
};

/**
 * Invariant #78: Archived Immutable. Archived experiments cannot be modified.
 */
export const INV_078_ARCHIVED_IMMUTABLE: RegistryInvariant = {
  id: "INV_078_ARCHIVED_IMMUTABLE",
  name: "Archived Experiment Immutability Guard",
  description: "Archived experiments cannot undergo status or definition modifications.",
  severity: "critical",
  check: (ctx) => {
    if (!ctx.previousDefinition || ctx.previousDefinition.status !== "archived") {
      return {
        passed: true,
        invariantId: "INV_078_ARCHIVED_IMMUTABLE",
        name: "Archived Experiment Immutability Guard",
        severity: "critical",
      };
    }

    // If previous was archived, current must be identical or missing
    const passed =
      !ctx.experimentDefinition ||
      (ctx.experimentDefinition.status === "archived" &&
        ctx.experimentDefinition.version === ctx.previousDefinition.version);

    return {
      passed,
      invariantId: "INV_078_ARCHIVED_IMMUTABLE",
      name: "Archived Experiment Immutability Guard",
      severity: "critical",
      reason: passed ? undefined : "Attempted modification of an archived experiment.",
    };
  },
};

export const REGISTRY_INVARIANTS: readonly RegistryInvariant[] = [
  INV_073_VERSION_MONOTONIC,
  INV_074_UNIQUE_EXPERIMENT_IDS,
  INV_075_MINIMUM_VARIANTS,
  INV_076_WEIGHT_SUM_100,
  INV_077_LIFECYCLE_VALID,
  INV_078_ARCHIVED_IMMUTABLE,
] as const;

export function checkAllRegistryInvariants(
  ctx: RegistryInvariantCheckContext
): RegistryInvariantResult[] {
  return REGISTRY_INVARIANTS.map((inv) => inv.check(ctx));
}

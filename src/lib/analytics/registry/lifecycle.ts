// ─── VRF-ONBOARD-003A.1 — Formal Lifecycle Engine Module ──────────────────

import type { ExperimentDefinition, ExperimentStatus } from "./experiment-types";
import { LifecycleViolationError } from "./registry-errors";
import type { DomainRegistryStore } from "./experiment-registry";

export const ALLOWED_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["review"],
  review: ["draft", "approved"],
  approved: ["active"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

/**
 * Pure predicate checking whether a status transition from -> to is allowed.
 * Returns true if valid transition, false otherwise.
 */
export function canTransition(from: ExperimentStatus, to: ExperimentStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Transitions an experiment to a new status in the registry store.
 *
 * Rules:
 * ✓ All status changes must go through transitionExperiment()
 * ✓ Invalid transitions throw LifecycleViolationError
 * ✓ Archived experiments are terminal (cannot transition out)
 */
export function transitionExperiment(
  id: string,
  nextStatus: ExperimentStatus,
  store: DomainRegistryStore
): ExperimentDefinition {
  if (!store || !store.experiments) {
    throw new Error("DomainRegistryStore is required.");
  }

  const existing = store.experiments.get(id);
  if (!existing) {
    throw new LifecycleViolationError(`Experiment '${id}' not found in registry store.`);
  }

  if (existing.status === nextStatus) {
    return { ...existing };
  }

  if (!canTransition(existing.status, nextStatus)) {
    throw new LifecycleViolationError(
      `Forbidden lifecycle transition for '${id}' from '${existing.status}' to '${nextStatus}'.`
    );
  }

  const now = new Date();
  const updated: ExperimentDefinition = {
    ...existing,
    status: nextStatus,
    updatedAt: now,
  };

  store.experiments.set(id, updated);
  const history = store.history.get(id) || [];
  history.push({ ...updated });
  store.history.set(id, history);

  return { ...updated };
}

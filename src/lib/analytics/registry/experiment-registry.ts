// ─── VRF-ONBOARD-003A.1 — Experiment Registry Domain Engine ──────────────

import type { ExperimentDefinition, ExperimentStatus } from "./experiment-types";
import {
  DuplicateExperimentError,
  InvalidExperimentError,
  LifecycleViolationError,
} from "./registry-errors";
import { validateExperiment } from "./experiment-validator";
import { createRevision } from "./experiment-versioning";
import { canTransition, transitionExperiment } from "./lifecycle";

export { canTransition, transitionExperiment };

export const isValidLifecycleTransition = canTransition;

export type ExperimentUpdate = Omit<Partial<ExperimentDefinition>, "status">;

export interface DomainRegistryStore {
  experiments: Map<string, ExperimentDefinition>;
  history: Map<string, ExperimentDefinition[]>;
}

/**
 * Creates an in-memory DomainRegistryStore.
 */
export function createDomainRegistry(): DomainRegistryStore {
  return {
    experiments: new Map<string, ExperimentDefinition>(),
    history: new Map<string, ExperimentDefinition[]>(),
  };
}

/**
 * Registers a new ExperimentDefinition into the registry.
 *
 * Rules:
 * ✓ Validate before registration
 * ✓ Duplicate ids rejected
 */
export function registerExperiment(
  experiment: ExperimentDefinition,
  store: DomainRegistryStore
): void {
  if (!store || !store.experiments) {
    throw new Error("DomainRegistryStore is required.");
  }

  const validation = validateExperiment(experiment);
  if (!validation.passed) {
    throw new InvalidExperimentError(`Registration failed validation: ${validation.errors.join("; ")}`);
  }

  if (store.experiments.has(experiment.id)) {
    throw new DuplicateExperimentError(`Experiment with id '${experiment.id}' is already registered.`);
  }

  store.experiments.set(experiment.id, { ...experiment });
  store.history.set(experiment.id, [{ ...experiment }]);
}

/**
 * Retrieves an experiment by id from the registry.
 */
export function getExperiment(
  id: string,
  store: DomainRegistryStore
): ExperimentDefinition | undefined {
  if (!id || !store || !store.experiments) {
    return undefined;
  }
  const exp = store.experiments.get(id);
  return exp ? { ...exp } : undefined;
}

/**
 * Retrieves all registered experiments sorted deterministically by id ascending.
 */
export function listExperiments(
  store: DomainRegistryStore
): ExperimentDefinition[] {
  if (!store || !store.experiments) {
    return [];
  }

  return Array.from(store.experiments.values())
    .map((e) => ({ ...e }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Updates an existing experiment definition content without modifying its status.
 * Status modifications MUST go through transitionExperiment(), activateExperiment(), pauseExperiment(), or archiveExperiment().
 *
 * Rules:
 * ✗ Cannot modify status via updateExperiment() (enforced by Omit<..., "status">)
 * ✓ Archived experiments cannot be modified
 * ✓ Validates revision before storing
 */
export function updateExperiment(
  id: string,
  updates: ExperimentUpdate,
  store: DomainRegistryStore
): ExperimentDefinition {
  if (!store || !store.experiments) {
    throw new Error("DomainRegistryStore is required.");
  }

  const existing = store.experiments.get(id);
  if (!existing) {
    throw new InvalidExperimentError(`Experiment '${id}' not found in registry.`);
  }

  if (existing.status === "archived") {
    throw new LifecycleViolationError(`Archived experiment '${id}' cannot be modified.`);
  }

  const revision = createRevision(existing, updates as Partial<ExperimentDefinition>);

  const validation = validateExperiment(revision);
  if (!validation.passed) {
    throw new InvalidExperimentError(`Update failed validation: ${validation.errors.join("; ")}`);
  }

  store.experiments.set(id, revision);
  const history = store.history.get(id) || [];
  history.push({ ...revision });
  store.history.set(id, history);

  return { ...revision };
}

/**
 * Transitions an experiment to 'active' status using formal lifecycle engine.
 */
export function activateExperiment(
  id: string,
  store: DomainRegistryStore
): ExperimentDefinition {
  return transitionExperiment(id, "active", store);
}

/**
 * Transitions an experiment to 'paused' status using formal lifecycle engine.
 */
export function pauseExperiment(
  id: string,
  store: DomainRegistryStore
): ExperimentDefinition {
  return transitionExperiment(id, "paused", store);
}

/**
 * Transitions an experiment to 'archived' status using formal lifecycle engine.
 */
export function archiveExperiment(
  id: string,
  store: DomainRegistryStore
): ExperimentDefinition {
  return transitionExperiment(id, "archived", store);
}

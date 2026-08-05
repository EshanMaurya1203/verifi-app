// ─── VRF-ONBOARD-003A.1 — Experiment Loader Engine ───────────────────────

import type { ExperimentDefinition } from "./experiment-types";
import {
  DuplicateExperimentError,
  InvalidExperimentError,
} from "./registry-errors";
import { validateExperiment } from "./experiment-validator";
import type { DomainRegistryStore } from "./experiment-registry";
import { registerExperiment } from "./experiment-registry";

/**
 * Validates and loads a single experiment definition into the registry store.
 */
export function loadExperiment(
  definition: ExperimentDefinition,
  store: DomainRegistryStore
): ExperimentDefinition {
  if (!definition) {
    throw new InvalidExperimentError("Experiment definition is required for loading.");
  }

  const validation = validateExperiment(definition);
  if (!validation.passed) {
    throw new InvalidExperimentError(`Cannot load invalid experiment '${definition?.id || "unknown"}': ${validation.errors.join("; ")}`);
  }

  registerExperiment(definition, store);
  return { ...definition };
}

/**
 * Loads a batch of experiment definitions into the registry store in deterministic load order.
 *
 * Rules:
 * ✓ Sort inputs by id -> version -> createdAt ascending before loading (deterministic load order)
 * ✓ Detect and reject duplicate ids BEFORE registration (in batch or against existing store)
 * ✓ Validate every experiment before registering
 */
export function loadExperiments(
  definitions: ExperimentDefinition[],
  store: DomainRegistryStore
): ExperimentDefinition[] {
  if (!Array.isArray(definitions)) {
    throw new InvalidExperimentError("Definitions array is required.");
  }

  // 1. Sort by id -> version -> createdAt for deterministic load order
  const sorted = [...definitions].sort(
    (a, b) =>
      a.id.localeCompare(b.id) ||
      a.version - b.version ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  // 2. Check for duplicate IDs BEFORE registration (in batch or against existing store)
  const seenIds = new Set<string>();
  for (const def of sorted) {
    if (seenIds.has(def.id)) {
      throw new DuplicateExperimentError(`Duplicate experiment id '${def.id}' detected in load batch.`);
    }
    if (store && store.experiments && store.experiments.has(def.id)) {
      throw new DuplicateExperimentError(`Experiment with id '${def.id}' already exists in registry store.`);
    }
    seenIds.add(def.id);
  }

  // 3. Register each experiment
  const loaded: ExperimentDefinition[] = [];
  for (const def of sorted) {
    const registered = loadExperiment(def, store);
    loaded.push(registered);
  }

  return loaded;
}

/**
 * Clears the registry store and reloads it with a new batch of definitions in deterministic order.
 */
export function reloadRegistry(
  definitions: ExperimentDefinition[],
  store: DomainRegistryStore
): ExperimentDefinition[] {
  if (!store || !store.experiments) {
    throw new Error("DomainRegistryStore is required.");
  }

  store.experiments.clear();
  store.history.clear();

  return loadExperiments(definitions, store);
}

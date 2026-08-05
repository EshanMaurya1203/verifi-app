// ─── VRF-ONBOARD-003A.1 — Experiment Versioning Engine ───────────────────

import type { ExperimentDefinition } from "./experiment-types";
import { VersionConflictError } from "./registry-errors";

/**
 * Bumps the version of an experiment by 1 (v1 → v2 → v3).
 * Updates updatedAt timestamp.
 */
export function bumpVersion(
  experiment: ExperimentDefinition
): ExperimentDefinition {
  if (!experiment || typeof experiment.version !== "number") {
    throw new VersionConflictError("Invalid experiment provided for version bump.");
  }

  return {
    ...experiment,
    version: experiment.version + 1,
    updatedAt: new Date(),
  };
}

/**
 * Creates an explicit clone of a source experiment.
 *
 * Preserve:
 * ✓ name, description, owner, successMetric, rollbackPlan
 * ✓ variants (deep copied)
 * ✓ targeting (deep copied)
 *
 * Reset:
 * ✓ id → newId (required)
 * ✓ version → 1
 * ✓ status → "draft"
 * ✓ createdAt → now
 * ✓ updatedAt → now
 * ✓ revision history (clone is a completely new experiment and does not inherit history)
 */
export function cloneExperiment(
  source: ExperimentDefinition,
  newId: string
): ExperimentDefinition {
  if (!source) {
    throw new VersionConflictError("Invalid source experiment provided for cloning.");
  }
  if (!newId || typeof newId !== "string" || newId.trim() === "") {
    throw new VersionConflictError("A valid newId must be specified when cloning an experiment.");
  }

  const now = new Date();

  return {
    id: newId,
    name: source.name,
    description: source.description,
    owner: source.owner,
    ownerId: source.ownerId || source.owner,
    status: "draft",
    version: 1,
    createdAt: now,
    updatedAt: now,
    variants: source.variants.map((v) => ({ ...v })),
    targeting: {
      ...source.targeting,
      countries: source.targeting?.countries ? [...source.targeting.countries] : undefined,
      providers: source.targeting?.providers ? [...source.targeting.providers] : undefined,
    },
    schedule: {
      enabled: false,
      startsAt: undefined,
      endsAt: undefined,
      timezone: source.schedule?.timezone,
    },
    successMetric: source.successMetric,
    rollbackPlan: source.rollbackPlan,
  };
}

/**
 * Creates a new version revision of an existing experiment.
 *
 * Rules:
 * ✓ v1 → v2 → v3
 * ✓ version MUST strictly increase (target version = experiment.version + 1)
 * ✓ preserves: id, owner, createdAt
 * ✓ updates: version (incremented), updatedAt (now)
 */
export function createRevision(
  experiment: ExperimentDefinition,
  updates: Partial<ExperimentDefinition>
): ExperimentDefinition {
  if (!experiment) {
    throw new VersionConflictError("Base experiment is required for revision.");
  }

  if (updates.version !== undefined && updates.version <= experiment.version) {
    throw new VersionConflictError(
      `Version numbers must strictly increase. Current: ${experiment.version}, Proposed: ${updates.version}`
    );
  }

  const targetVersion = updates.version !== undefined ? updates.version : experiment.version + 1;
  const now = new Date();

  return {
    ...experiment,
    ...updates,
    id: experiment.id, // Preserved
    owner: experiment.owner, // Preserved
    createdAt: experiment.createdAt, // Preserved
    version: targetVersion, // Strictly increased
    updatedAt: now, // Updated
  };
}

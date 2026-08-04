// ─── VRF-ONBOARD-001E.12C.2C — Hardened Assignment Recovery Engine ───────

import type {
  AssignmentAuditRecord,
  AssignmentRecoveryResult,
  Experiment,
  IdentityContext,
} from "./experiments";
import type { AssignmentCache } from "./assignment-cache";
import { shouldInvalidateCache, storeCachedAssignment } from "./assignment-cache";
import { replayAssignment } from "./replay-engine";
import { assignVariant } from "./assignment-engine";
import { resolveIdentity } from "./identity-resolver";

/**
 * Recovers a VariantAssignment using strict recovery priority:
 *
 * 1. cache  (if present, non-expired, and assignmentHash matches)
 * 2. replay (if valid audit record exists and produces matching assignment)
 * 3. fresh  (computes fresh deterministic assignment via assignVariant using identityContext)
 *
 * Encapsulation guarantee:
 * recoverAssignment owns identity resolution via resolveIdentity(identityContext).
 */
export function recoverAssignment(
  deterministicKey: string,
  cache: AssignmentCache,
  auditRecord: AssignmentAuditRecord | null,
  experiment: Experiment,
  identityContext: IdentityContext
): AssignmentRecoveryResult {
  if (!experiment) {
    throw new Error("Experiment payload is required for assignment recovery.");
  }
  if (!identityContext) {
    throw new Error("IdentityContext is required for assignment recovery.");
  }

  // Internally resolve identity type and value (recoverAssignment owns resolution)
  const identifierType = resolveIdentity(identityContext);
  const identifier = (identityContext[identifierType] as string) || "";

  if (!identifier || identifier.trim() === "") {
    throw new Error(`Resolved identity field '${identifierType}' is empty.`);
  }

  const validationContext = {
    identifier,
    identifierType,
    experiment,
  };

  // 1. Priority 1: Cache Lookup
  if (cache && deterministicKey) {
    const entry = cache.entries.get(deterministicKey);
    if (entry && !shouldInvalidateCache(entry, validationContext)) {
      return {
        recovered: true,
        source: "cache",
        assignment: entry.assignment,
      };
    }
  }

  // 2. Priority 2: Audit Replay
  if (auditRecord && auditRecord.experimentId === experiment.id) {
    const replayRes = replayAssignment(auditRecord, experiment);
    if (replayRes.matches) {
      if (cache && deterministicKey) {
        storeCachedAssignment(
          {
            deterministicKey,
            assignment: replayRes.replayedAssignment,
            cachedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          cache
        );
      }
      return {
        recovered: true,
        source: "replay",
        assignment: replayRes.replayedAssignment,
      };
    }
  }

  // 3. Priority 3: Fresh Computation
  const freshResult = assignVariant(identifier, identifierType, experiment);

  if (cache && deterministicKey) {
    storeCachedAssignment(
      {
        deterministicKey,
        assignment: freshResult.assignment,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      cache
    );
  }

  return {
    recovered: true,
    source: "fresh",
    assignment: freshResult.assignment,
  };
}

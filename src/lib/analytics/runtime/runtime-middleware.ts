// ─── VRF-ONBOARD-002C / 002D / 002X — Runtime Middleware Engine ──────────

import type { EventQueue } from "./event-queue";
import type { EventStorage } from "./event-storage";
import { ingestEvent } from "./event-ingestion";
import { trackVariantExposed } from "./event-tracker";
import type { ExperimentRegistry } from "./experiment-discovery";
import { getActiveExperiments } from "./experiment-discovery";
import type { AssignmentStore } from "./assignment-store";
import { routeExperiment } from "./experiment-router";
import type { RouterContext, RouterResult } from "./router-types";
import type {
  MiddlewareResult,
  RuntimeContext,
  RuntimeRequest,
} from "./middleware-types";
import { recoverSession } from "./session-recovery";
import type { RuntimeFlags } from "./feature-flags";
import { createDefaultFlags } from "./feature-flags";
import { evaluateFlags } from "./flag-engine";
import type { AuditLog } from "./audit-log";
import { createAuditLog, recordAudit } from "./audit-log";

/**
 * Master Runtime Middleware Execution Engine.
 *
 * Pipeline:
 * request → recover session → discover active experiments → evaluateFlags → route OR reject → collect assignments → emit variant_exposed → return runtime context
 *
 * VRF-ONBOARD-002X: Emits variant_exposed semantics.
 */
export function executeMiddleware(
  request: RuntimeRequest,
  registry: ExperimentRegistry,
  assignmentStore: AssignmentStore,
  queue: EventQueue,
  storage: EventStorage,
  flags?: RuntimeFlags,
  audit?: AuditLog
): MiddlewareResult {
  if (!request) {
    throw new Error("RuntimeRequest is required.");
  }

  const runtimeFlags = flags || createDefaultFlags();
  const auditLog = audit || createAuditLog();

  // 1. Session Recovery (Deterministic in VRF-ONBOARD-002X)
  const sessionId = recoverSession(request);

  // 2. Discover Active Experiments (Sorted Priority Descending)
  const activeExperiments = getActiveExperiments(registry);

  const assignments: RouterResult[] = [];
  const variantsSeen: string[] = [];
  const variantsExposed: string[] = [];
  const seenVariantKeys = new Set<string>();

  const routerCtx: RouterContext = {
    sessionId,
    userId: request.userId,
  };

  // 3. Evaluate Flags & Route Active Experiments
  for (const experiment of activeExperiments) {
    const decision = evaluateFlags(request.userId, experiment.id, runtimeFlags);

    if (!decision.allowed) {
      const actionMap: Record<string, "kill_switch_triggered" | "experiment_paused" | "force_control" | "forced_variant"> = {
        global_kill_switch: "kill_switch_triggered",
        force_control: "force_control",
        experiment_paused: "experiment_paused",
        blocklisted: "kill_switch_triggered",
      };
      const auditAction = actionMap[decision.reason];
      if (auditAction) {
        recordAudit(auditLog, {
          timestamp: new Date(),
          userId: request.userId,
          experimentId: experiment.id,
          action: auditAction,
          metadata: { reason: decision.reason },
        });
      }
      continue;
    }

    if (decision.reason === "forced_variant" && decision.forcedVariantId) {
      recordAudit(auditLog, {
        timestamp: new Date(),
        userId: request.userId,
        experimentId: experiment.id,
        action: "forced_variant",
        metadata: { forcedVariantId: decision.forcedVariantId },
      });
    }

    const result = routeExperiment(
      routerCtx,
      experiment,
      assignmentStore,
      assignments,
      queue,
      storage,
      decision.forcedVariantId
    );

    if (result) {
      assignments.push(result);

      // 4. Variant Visibility & Exposure Tracking (VRF-ONBOARD-002X)
      const variantKey = `${result.experimentId}:${result.variantId}`;
      if (!seenVariantKeys.has(variantKey)) {
        seenVariantKeys.add(variantKey);
        variantsSeen.push(result.variantId);
        variantsExposed.push(result.variantId);

        // Emit variant_exposed event via ingestion pipeline
        if (queue) {
          const exposedEvent = trackVariantExposed(
            sessionId,
            result.experimentId,
            result.variantId,
            request.userId
          );
          ingestEvent(exposedEvent, queue, storage);
        }
      }
    }
  }

  // 5. Build Request Context
  const context: RuntimeContext = {
    sessionId,
    userId: request.userId,
    assignments,
    createdAt: new Date(),
  };

  return {
    context,
    variantsSeen,
    variantsExposed,
  };
}

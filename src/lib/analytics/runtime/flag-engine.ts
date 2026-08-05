// ─── VRF-ONBOARD-002D / 002Y — Feature-Flag Evaluation Engine ──────────

import type { RuntimeFlags, FlagDecision } from "./feature-flags";

/**
 * Evaluates runtime feature flags for a given user/identity and experiment.
 *
 * Exact Precedence Order (VRF-ONBOARD-002Y):
 * 1. Global kill switch → overrides everything
 * 2. Blocklist → overrides everything except global kill switch
 * 3. Paused experiment → overrides allowlist! (Forced variant cannot bypass pause)
 * 4. Allowlist → allowlist bypasses ONLY forceControl
 * 5. Force control → blocks experiment routing
 * 6. Forced variant → overrides routing with specific variant
 * 7. Normal → allowed
 */
export function evaluateFlags(
  userId: string | undefined,
  experimentId: string,
  flags: RuntimeFlags
): FlagDecision {
  // 1. Global kill switch overrides everything
  if (flags.globalKillSwitch) {
    return {
      allowed: false,
      reason: "global_kill_switch",
    };
  }

  // 2. Blocklist overrides everything except global kill switch
  if (userId && flags.blocklistedUsers.has(userId)) {
    return {
      allowed: false,
      reason: "blocklisted",
    };
  }

  // 3. Paused experiments override allowlist!
  if (flags.pausedExperiments.has(experimentId)) {
    return {
      allowed: false,
      reason: "experiment_paused",
    };
  }

  // 4. Allowlist bypasses ONLY forceControl
  if (userId && flags.allowlistedUsers.has(userId)) {
    const forcedVariant = flags.forcedVariants.get(experimentId);
    if (forcedVariant) {
      return {
        allowed: true,
        reason: "forced_variant",
        forcedVariantId: forcedVariant,
      };
    }

    return {
      allowed: true,
      reason: "allowlisted",
    };
  }

  // 5. Force control blocks experiment routing
  if (flags.forceControl) {
    return {
      allowed: false,
      reason: "force_control",
    };
  }

  // 6. Forced variant overrides routing
  const forcedVariant = flags.forcedVariants.get(experimentId);
  if (forcedVariant) {
    return {
      allowed: true,
      reason: "forced_variant",
      forcedVariantId: forcedVariant,
    };
  }

  // 7. Normal — allowed
  return {
    allowed: true,
    reason: "normal",
  };
}

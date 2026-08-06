/**
 * VRF-ONBOARD ARCHIVE
 *
 * Status: FROZEN
 *
 * Not required for launch.
 *
 * Do not extend.
 *
 * Revisit after:
 * - 100 founders
 * - 10 paying users
 */
// ─── VRF-ONBOARD-002B / 002X — Router Domain Types ───────────────────────

export interface RouterContext {
  userId?: string;
  sessionId: string;
  country?: string;
  startupType?: string;
}

export interface RouterExperimentVariant {
  id: string;
  weight: number;
}

export interface RuntimeExperiment {
  id: string;
  name?: string;
  version: number;
  enabled: boolean;
  priority: number;
  variants: RouterExperimentVariant[];
  mutuallyExclusiveGroup?: string;
  mutuallyExclusiveWith?: string;
}

export interface RouterResult {
  experimentId: string;
  variantId: string;
  sticky: boolean;
  assignedAt: Date;
}

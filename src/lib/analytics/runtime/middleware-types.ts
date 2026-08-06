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
// ─── VRF-ONBOARD-002C / 002Y — Runtime Middleware Domain Types ────────────

import type { RouterResult } from "./router-types";

export interface RuntimeRequest {
  sessionId?: string;
  userId?: string;
  anonymousId?: string;
  userAgent?: string;
  pathname: string;
}

export interface RuntimeContext {
  sessionId: string;
  userId?: string;
  anonymousId?: string;
  assignments: RouterResult[];
  createdAt: Date;
}

export interface MiddlewareResult {
  context: RuntimeContext;
  variantsSeen: string[];
  variantsExposed: string[];
}

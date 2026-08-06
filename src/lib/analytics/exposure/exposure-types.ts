// ─── VRF-ONBOARD-004B — Exposure Tracking Types ──────────────────────────────

import type { RuntimeAssignment } from "../runtime/runtime-types";

export interface ExposureRequest {
  sessionId: string;

  assignment: RuntimeAssignment;

  seenAt: Date;
}

export interface ExposureEvent {
  exposureId: string;

  sessionId: string;

  experimentId: string;

  variantId: string;

  assignmentKey: string;

  seenAt: Date;
}

export interface ExposureResult {
  accepted: readonly ExposureEvent[];

  deduplicated: readonly ExposureEvent[];

  rejected: readonly ExposureEvent[];
}

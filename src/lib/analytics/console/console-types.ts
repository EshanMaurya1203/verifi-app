// ─── VRF-ONBOARD-003E / 003E.1 — Console Types ──────────────────────────────

export type DeepReadonly<T> = T extends Function
  ? T
  : T extends Array<infer U>
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export interface VariantConsoleView {
  id: string;

  name: string;

  weight: number;
}

export interface TargetingConsoleView {
  eligible: boolean;

  matchedRules: readonly string[];

  failedRules: readonly string[];
}

export interface ScheduleConsoleView {
  active: boolean;

  matchedChecks: readonly string[];

  failedChecks: readonly string[];
}

export interface GovernanceConsoleView {
  allowedActions: readonly string[];
}

export interface AuditConsoleView {
  sequence: number;

  actorId: string;

  action: string;

  timestamp: Date;

  reason?: string;
}

export interface ExperimentConsoleView {
  projectionVersion: 1;

  generatedAt: Date;

  experimentId: string;

  name: string;

  ownerId: string;

  status: string;

  version: number;

  createdAt: Date;

  updatedAt: Date;

  variants: readonly VariantConsoleView[];

  targeting: TargetingConsoleView;

  schedule: ScheduleConsoleView;

  governance: GovernanceConsoleView;

  audit: readonly AuditConsoleView[];
}

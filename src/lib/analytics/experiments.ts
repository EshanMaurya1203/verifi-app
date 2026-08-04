// ─── VRF-ONBOARD-001E.12B / 12E — Experimentation Domain Models ─────────

export type ExperimentStatus =
  | "draft"
  | "running"
  | "completed"
  | "rolled_back";

export type IdentifierType =
  | "userId"
  | "deviceId"
  | "sessionId";

export interface IdentityContext {
  userId?: string;
  deviceId?: string;
  sessionId?: string;
}

export interface StickyAssignmentResult {
  found: boolean;
  assignment?: VariantAssignment;
  source?: "userId" | "deviceId" | "sessionId";
}

export interface AssignmentMigrationResult {
  migrated: boolean;
  previousIdentifierType?: "deviceId" | "sessionId";
  newIdentifierType?: "userId";
  assignment?: VariantAssignment;
}

export interface ReplayResult {
  matches: boolean;
  originalAssignment: VariantAssignment;
  replayedAssignment: VariantAssignment;
}

export interface AssignmentRecoveryResult {
  recovered: boolean;
  source: "cache" | "replay" | "fresh";
  assignment: VariantAssignment;
}

export type ConfidenceLevel =
  | "low"
  | "medium"
  | "high";

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  sampleSizeSatisfied: boolean;
  runtimeSatisfied: boolean;
  peekingProtected: boolean;
  winnerEligible: boolean;
}

export interface ConfidenceContext {
  totalParticipants: number;
  minSampleSize: number;
  startedAt: Date;
  now: Date;
  evaluationFrequency:
    | "daily"
    | "weekly";
}

export type RegressionSeverity =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface RegressionContext {
  controlConversionRate: number;
  treatmentConversionRate: number;

  controlRecoveryRate: number;
  treatmentRecoveryRate: number;

  controlCompletionMinutes: number;
  treatmentCompletionMinutes: number;
}

export interface RegressionResult {
  regressionDetected: boolean;
  severity: RegressionSeverity;
  riskScore: number;
  conversionDelta: number;
  recoveryDelta: number;
  completionDelta: number;
  alerts: string[];
}

export type RollbackRecommendation =
  | "none"
  | "monitor"
  | "consider"
  | "recommended"
  | "immediate";

export interface RollbackContext {
  confidence: ConfidenceResult;
  regression: RegressionResult;
}

export interface RollbackResult {
  recommendation: RollbackRecommendation;
  rollbackScore: number;
  safeToContinue: boolean;
  reasons: string[];
}

export interface DashboardExperimentCard {
  experimentId: string;
  experimentName: string;
  status: ExperimentStatus;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  regressionSeverity: RegressionSeverity;
  rollbackRecommendation: RollbackRecommendation;
  safeToContinue: boolean;
}

export interface DashboardAlert {
  type:
    | "confidence"
    | "regression"
    | "rollback";
  severity:
    | "info"
    | "warning"
    | "critical";
  message: string;
}

export interface DashboardSummary {
  totalExperiments: number;
  runningExperiments: number;
  healthyExperiments: number;
  riskyExperiments: number;
  blockedExperiments: number;
}

export interface DashboardState {
  summary: DashboardSummary;
  cards: DashboardExperimentCard[];
  alerts: DashboardAlert[];
}

export type ExportFormat =
  | "json"
  | "csv";

export interface ExportMetadata {
  exportedAt: Date;
  format: ExportFormat;
  experimentCount: number;
}

export interface ExportResult {
  metadata: ExportMetadata;
  content: string;
}

export interface DashboardCacheEntry {
  key: string;
  state: DashboardState;
  createdAt: Date;
  expiresAt: Date;
}

export interface DashboardCache {
  entries: Map<string, DashboardCacheEntry>;
}

export interface PerformanceMetrics {
  experimentCount: number;
  alertCount: number;
  renderTimeMs: number;
  cacheHit: boolean;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  allocation: number; // Target percentage (e.g. 50 for 50%)
  isControl: boolean; // Identifies baseline control variant
  payload?: Record<string, unknown>; // Configuration overrides for UI/API
}

export interface AssignmentPolicy {
  overlappingAllowed: boolean;
  stickyAssignment: boolean;
  exclusionGroup?: string;
  targetCategory?: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  targetMetric: "conversion_rate" | "completion_duration" | "recovery_rate";
  baselineConversionRate?: number;
  status: ExperimentStatus;
  version: number;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  variants: ExperimentVariant[];

  // Ownership & Governance
  createdBy: string;
  ownerEmail: string;

  // Traffic & Policy Controls
  policy: AssignmentPolicy;
  exclusionGroup?: string;
  minSampleSize: number;
  maxDurationDays: number;

  // Archival & Audit Logs
  archivedAt?: Date;
  archivedBy?: string;
  rollbackReason?: string;
}

export interface VariantAssignment {
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  experimentId: string;
  experimentVersion: number;
  variantId: string;
  assignedAt: Date;
  assignmentHash: string; // Deterministic audit hash for replay and debugging
  assignmentReason:
    | "hash"
    | "migration"
    | "manual_override";
}

export interface AssignmentResult {
  assignment: VariantAssignment;
  deterministicKey: string; // Stable string format `${identifier}:${experimentId}:v${experimentVersion}`
}

export interface AssignmentHashContract {
  algorithm: string;
  inputs: string[];
  deterministic: boolean;
  versionAware: boolean;
}

export const ASSIGNMENT_HASH_CONTRACT: AssignmentHashContract = {
  algorithm: "murmur3",
  inputs: [
    "identifier",
    "experimentId",
    "experimentVersion",
  ],
  deterministic: true,
  versionAware: true,
};

export interface DeterministicKeyContract {
  inputs: [
    "identifier",
    "experimentId",
    "experimentVersion",
  ];
  separator: ":";
  versionAware: true;
}

export const DETERMINISTIC_KEY_CONTRACT: DeterministicKeyContract = {
  inputs: [
    "identifier",
    "experimentId",
    "experimentVersion",
  ],
  separator: ":",
  versionAware: true,
};

export interface AssignmentAuditRecord {
  assignmentHash: string;
  identifier: string;
  identifierType: IdentifierType;
  experimentId: string;
  experimentVersion: number;
  variantId: string;
  assignmentReason:
    | "hash"
    | "migration"
    | "manual_override";
  assignedAt: Date;
}

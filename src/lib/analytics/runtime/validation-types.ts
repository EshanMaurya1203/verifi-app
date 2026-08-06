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
// ─── VRF-ONBOARD-002F / 002Z — Validation & Certification Domain Types ────

import type { BenchmarkMetadata } from "./benchmark-types";
import type { MemoryProfile } from "./memory-profiler";

export interface ValidationResult {
  name: string;

  passed: boolean;

  durationMs: number;

  metadata?: Record<string, unknown>;
}

export interface CertificationReport {
  generatedAt: Date;

  validations: ValidationResult[];

  benchmarkMetadata: BenchmarkMetadata;

  memoryProfile: MemoryProfile;

  assignmentsPerSecond: number;

  eventsPerSecond: number;

  snapshotLatencyMs: number;

  determinismScore: number;

  recoveryScore: number;

  invariantPassRate: number;

  verdict: "PASS" | "FAIL";
}

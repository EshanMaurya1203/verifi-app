// ─── VRF-ONBOARD-001E.12D.1 — Hardened Confidence Engine ─────────────────

import type { ConfidenceContext, ConfidenceLevel, ConfidenceResult } from "./experiments";
import { computeEvaluationWindow } from "./evaluation-window";

export const MIN_RUNTIME_DAYS = 7;
export const HIGH_CONFIDENCE = 80;
export const MEDIUM_CONFIDENCE = 50;

/**
 * Evaluates whether total participants satisfy the experiment's minSampleSize.
 */
export function evaluateSampleSize(
  participants: number,
  minSampleSize: number
): boolean {
  if (typeof participants !== "number" || typeof minSampleSize !== "number") {
    return false;
  }
  if (minSampleSize <= 0) return true;
  return participants >= minSampleSize;
}

/**
 * Evaluates whether experiment runtime satisfies the mandatory 7-day minimum.
 */
export function evaluateRuntime(
  startedAt: Date,
  now: Date
): boolean {
  if (!startedAt || !now) return false;
  const elapsedMs = now.getTime() - startedAt.getTime();
  if (elapsedMs < 0) return false;
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return elapsedDays >= MIN_RUNTIME_DAYS;
}

/**
 * Evaluates whether peeking protection is satisfied by delegating to discrete EvaluationWindow boundaries.
 */
export function evaluatePeekingProtection(
  context: ConfidenceContext
): boolean {
  const window = computeEvaluationWindow(context);
  return window.canEvaluate;
}

/**
 * Computes the overall confidence score (0–100), level (low/medium/high), and winner eligibility
 * using nonlinear square-root saturation rules.
 *
 * Scoring Formula (Nonlinear Saturation):
 * - Sample Size Points: 40 * sqrt(participants / minSampleSize), capped at 40
 * - Runtime Points: 40 * sqrt(elapsedDays / MIN_RUNTIME_DAYS), capped at 40
 * - Peeking Points: 20 if peeking window satisfied, 0 otherwise
 */
export function computeConfidence(
  context: ConfidenceContext
): ConfidenceResult {
  if (!context) {
    throw new Error("ConfidenceContext payload is required.");
  }

  const { totalParticipants, minSampleSize, startedAt, now } = context;

  const sampleSizeSatisfied = evaluateSampleSize(totalParticipants, minSampleSize);
  const runtimeSatisfied = evaluateRuntime(startedAt, now);
  const peekingProtected = evaluatePeekingProtection(context);

  // 1. Nonlinear Sample Size Points (max 40)
  const sampleRatio = minSampleSize > 0 ? totalParticipants / minSampleSize : 1;
  const samplePoints = Math.min(40, 40 * Math.sqrt(sampleRatio));

  // 2. Nonlinear Runtime Points (max 40)
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  const runtimeRatio = elapsedDays / MIN_RUNTIME_DAYS;
  const runtimePoints = Math.min(40, 40 * Math.sqrt(runtimeRatio));

  // 3. Peeking Points (max 20)
  const peekingPoints = peekingProtected ? 20 : 0;

  const rawScore = Math.round(samplePoints + runtimePoints + peekingPoints);
  const score = Math.max(0, Math.min(100, rawScore));

  let level: ConfidenceLevel = "low";
  if (score >= HIGH_CONFIDENCE) {
    level = "high";
  } else if (score >= MEDIUM_CONFIDENCE) {
    level = "medium";
  }

  const winnerEligible = sampleSizeSatisfied && runtimeSatisfied && peekingProtected;

  return {
    score,
    level,
    sampleSizeSatisfied,
    runtimeSatisfied,
    peekingProtected,
    winnerEligible,
  };
}

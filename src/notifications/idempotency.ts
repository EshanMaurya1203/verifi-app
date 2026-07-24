/**
 * Idempotency Infrastructure for Verifii Notification Layer (NTF-000A).
 * 
 * Rules:
 * 1. Notifications are idempotent.
 * 2. Idempotency is ALWAYS derived from canonical business events (e.g., verification_log.id, user_id).
 * 3. NEVER derive idempotency keys from external webhook IDs, provider session IDs, or request timestamps.
 * 4. Replay of canonical events must produce deterministic, identical idempotency keys to prevent duplicate delivery.
 */

import type { NotificationType } from "./types";

/**
 * Options for generating an idempotency key.
 */
export interface GenerateIdempotencyKeyParams {
  notificationType: NotificationType;
  entityId: string | number;
  scope?: string;
}

/**
 * Generates a deterministic idempotency key from a canonical business entity.
 * 
 * Example: `generateIdempotencyKey({ notificationType: "WELCOME", entityId: "user_123" })`
 * Output: `ntf_welcome_user_123`
 */
export function generateIdempotencyKey(params: GenerateIdempotencyKeyParams): string {
  const { notificationType, entityId, scope } = params;
  const cleanType = notificationType.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const cleanEntity = String(entityId).trim();
  
  if (scope) {
    const cleanScope = scope.toLowerCase().replace(/[^a-z0-9_]/g, "");
    return `ntf_${cleanType}_${cleanScope}_${cleanEntity}`;
  }
  
  return `ntf_${cleanType}_${cleanEntity}`;
}

/**
 * Specifically derives notification idempotency key from a canonical `verification_logs` record ID.
 * Aligns strictly with Gap 3 & ADR-019.
 * 
 * Example: `generateCanonicalVerificationIdempotencyKey("VERIFICATION_COMPLETED", 4052)`
 * Output: `ntf_verification_completed_log_4052`
 */
export function generateCanonicalVerificationIdempotencyKey(
  type: NotificationType,
  verificationLogId: string | number
): string {
  return generateIdempotencyKey({
    notificationType: type,
    entityId: verificationLogId,
    scope: "log",
  });
}

/**
 * Validates whether an idempotency key conforms to standard notification layer format.
 */
export function validateIdempotencyKey(key: string): boolean {
  if (typeof key !== "string" || key.trim().length === 0) {
    return false;
  }
  // Must be between 5 and 128 chars and contain alphanumeric/underscore/dash chars
  const keyRegex = /^[a-zA-Z0-9_\-:.]{5,128}$/;
  return keyRegex.test(key);
}

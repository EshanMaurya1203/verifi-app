// ─── VRF-ONBOARD-002A / 002X — Runtime Event Ingestion Domain Types ──────

export type OnboardingEventType =
  | "landing_page_viewed"
  | "signup_started"
  | "signup_completed"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_abandoned"
  | "onboarding_completed"
  | "stripe_connected"
  | "stripe_sync_success"
  | "stripe_sync_failed"
  | "razorpay_connected"
  | "razorpay_sync_success"
  | "razorpay_sync_failed"
  | "proof_uploaded"
  | "verification_submitted"
  | "verification_approved"
  | "verification_rejected"
  | "experiment_assigned"
  | "variant_exposed"
  | "variant_rendered"
  | "variant_seen"
  | "variant_completed";

export interface RuntimeEvent {
  id: string;
  userId?: string;
  sessionId: string;
  eventType: OnboardingEventType;
  experimentId?: string;
  variantId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

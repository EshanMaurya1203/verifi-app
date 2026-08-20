export const ONBOARDING_ANALYTICS_EVENTS = {
  onboarding_started: "onboarding_started",
  step_1_completed: "step_1_completed",
  step_2_completed: "step_2_completed",
  step_3_completed: "step_3_completed",
  submission_completed: "submission_completed",
  submission_failed: "submission_failed",
  draft_restored: "draft_restored",
  draft_discarded: "draft_discarded",
} as const;

export type OnboardingAnalyticsEvent =
  (typeof ONBOARDING_ANALYTICS_EVENTS)[keyof typeof ONBOARDING_ANALYTICS_EVENTS];

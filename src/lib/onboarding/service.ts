import { supabaseServer } from "@/lib/supabase-server";
import { dispatchNotification, generateIdempotencyKey } from "@/notifications";
import { logger, LogEvent } from "@/lib/logger";

export async function handleFirstStartupCreated(
  userId: string,
  userEmail: string,
  userName: string,
  startupName: string,
  startupId: number
) {
  const startTime = Date.now();
  const eventId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();
  let notificationDispatched = false;

  logger.info("Onboarding workflow started", {
    event: LogEvent.ONBOARDING_STARTED,
    userId,
    startupId,
    eventId,
    correlationId,
    source: "onboarding.service",
    version: 1,
  });

  try {
    const { count, error } = await supabaseServer
      .from("startup_submissions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to fetch startup count for onboarding", {
        userId,
        error: error.message,
        eventId,
        correlationId,
      });
      return;
    }

    // Since the new startup was just inserted, a count of 1 means this is the first.
    if (count === 1) {
      logger.info("First startup detected, triggering welcome notification", {
        event: LogEvent.FIRST_STARTUP_DETECTED,
        userId,
        startupId,
        eventId,
        correlationId,
        source: "onboarding.service",
        version: 1,
      });

      const dispatchResult = await dispatchNotification({
        type: "WELCOME",
        metadata: {
          eventId,
          occurredAt: new Date(),
          source: "onboarding.service",
          version: 1,
          correlationId,
          idempotencyKey: generateIdempotencyKey({
            notificationType: "WELCOME",
            entityId: userId,
          }),
        },
        payload: {
          founderName: userName,
          startupName: startupName,
          email: userEmail,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/dashboard`,
          verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/dashboard`,
          supportEmail: "support@verifii.in",
          currentYear: new Date().getFullYear(),
        },
      });

      if (dispatchResult.success) {
        notificationDispatched = true;
        logger.info("Welcome notification dispatched successfully", {
          event: LogEvent.WELCOME_NOTIFICATION_DISPATCHED,
          userId,
          eventId,
          correlationId,
          source: "onboarding.service",
          version: 1,
        });
      } else {
        logger.error("Welcome notification failed to dispatch", {
          event: LogEvent.WELCOME_NOTIFICATION_FAILED,
          userId,
          eventId,
          correlationId,
          source: "onboarding.service",
          version: 1,
          error: "Dispatch result success was false",
        });
      }

      const durationMs = Date.now() - startTime;
      logger.info("Onboarding workflow completed", {
        event: LogEvent.ONBOARDING_COMPLETED,
        userId,
        startupId,
        startupName,
        eventId,
        correlationId,
        durationMs,
        notificationDispatched,
        source: "onboarding.service",
        version: 1,
      });
    } else {
      logger.info("Subsequent startup creation, skipping welcome", {
        userId,
        count,
        eventId,
        correlationId,
      });
    }
  } catch (err) {
    logger.error("Exception during onboarding handleFirstStartupCreated", {
      userId,
      error: err instanceof Error ? err.message : String(err),
      eventId,
      correlationId,
      source: "onboarding.service",
      version: 1,
    });
  }
}

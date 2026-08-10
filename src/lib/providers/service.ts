/**
 * Provider Connection Domain Service — NTF-001
 * 
 * Handles canonical provider connected notification dispatches.
 * Aligns strictly with ADR-019, ADR-020, ADR-023, ADR-024.
 */

import { supabaseServer } from "@/lib/supabase-server";
import { dispatchNotification, generateIdempotencyKey, generateCanonicalVerificationIdempotencyKey } from "@/notifications";
import { logger, LogEvent } from "@/lib/logger";

export interface ProviderConnectionParams {
  startupId: number;
  userId?: string;
  userEmail?: string;
  founderName?: string;
  startupName?: string;
  provider: "stripe" | "razorpay" | string;
}

/**
 * Dispatches a canonical PROVIDER_CONNECTED notification.
 * 
 * Characteristics:
 * 1. Sent exactly once per provider per startup (enforced via idempotency key: ntf_provider_connected_${provider}_${startupId}).
 * 2. Sent ONLY after credentials validated and provider_connections persisted.
 * 3. Best-effort side effect (ADR-023): failures do not roll back provider connection.
 */
export async function handleProviderConnected(params: ProviderConnectionParams): Promise<boolean> {
  const { startupId, provider } = params;
  const eventId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();

  try {
    const cleanProvider = provider.toLowerCase();
    const providerDisplayName =
      cleanProvider === "stripe"
        ? "Stripe"
        : cleanProvider === "razorpay"
        ? "Razorpay"
        : provider.charAt(0).toUpperCase() + provider.slice(1);

    let userEmail = params.userEmail;
    let founderName = params.founderName;
    let startupName = params.startupName;
    let userId = params.userId;

    // Resolve founder & startup details if missing
    if (!userEmail || !startupName) {
      const { data: startup } = await supabaseServer
        .from("startup_submissions")
        .select("startup_name, user_id")
        .eq("id", startupId)
        .maybeSingle();

      if (startup) {
        startupName = startupName ?? startup.startup_name;
        userId = userId ?? startup.user_id;

        if (userId && !userEmail) {
          const { data: user } = await supabaseServer
            .from("users")
            .select("email, full_name")
            .eq("id", userId)
            .maybeSingle();

          if (user) {
            userEmail = user.email;
            founderName = founderName ?? user.full_name;
          }
        }
      }
    }

    if (!userEmail) {
      logger.warn("[ProviderConnection] Missing user email for provider connection notification", {
        event: LogEvent.PROVIDER_CONNECTION_FAILURE,
        startupId,
        provider: cleanProvider,
        eventId,
      });
      return false;
    }

    const idempotencyKey = generateIdempotencyKey({
      notificationType: "PROVIDER_CONNECTED",
      entityId: startupId,
      scope: cleanProvider,
    });

    logger.info(`[ProviderConnection] Dispatching PROVIDER_CONNECTED notification for ${providerDisplayName}`, {
      event: LogEvent.NOTIFICATION_DISPATCH_STARTED,
      startupId,
      userId,
      provider: cleanProvider,
      idempotencyKey,
      eventId,
      correlationId,
    });

    const dispatchResult = await dispatchNotification({
      type: "PROVIDER_CONNECTED",
      metadata: {
        eventId,
        occurredAt: new Date(),
        source: "provider.connection.service",
        version: 1,
        correlationId,
        idempotencyKey,
      },
      payload: {
        founderName,
        startupName,
        email: userEmail,
        providerName: cleanProvider,
        providerDisplayName,
        connectionTimestamp: new Date(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/dashboard`,
        supportEmail: "support@verifii.in",
        currentYear: new Date().getFullYear(),
      },
    });

    if (dispatchResult.success) {
      logger.info(`[ProviderConnection] PROVIDER_CONNECTED notification dispatched successfully for ${providerDisplayName}`, {
        event: LogEvent.CHANNEL_DELIVERY_COMPLETED,
        startupId,
        userId,
        provider: cleanProvider,
        correlationId,
        eventId,
      });
    } else {
      logger.error(`[ProviderConnection] PROVIDER_CONNECTED notification failed dispatch for ${providerDisplayName}`, {
        event: LogEvent.CHANNEL_DELIVERY_FAILED,
        startupId,
        userId,
        provider: cleanProvider,
        correlationId,
        eventId,
      });
    }

    return dispatchResult.success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[ProviderConnection] Uncaught exception during PROVIDER_CONNECTED dispatch", {
      event: LogEvent.CHANNEL_DELIVERY_FAILED,
      startupId,
      provider,
      error: errorMsg,
      eventId,
      correlationId,
    });
    return false;
  }
}

export interface ProviderSyncFailedParams {
  startupId: number;
  userId?: string;
  userEmail?: string;
  founderName?: string;
  startupName?: string;
  provider: "stripe" | "razorpay" | string;
  failureReason?: string;
  reconnectUrl?: string;
}

/**
 * Dispatches a canonical PROVIDER_SYNC_FAILED notification.
 * 
 * Rules:
 * 1. Sent ONLY when provider sync fails with a non-recoverable error requiring founder attention (e.g. revoked API key, invalid auth).
 * 2. Does NOT fire for transient HTTP errors / timeouts / retries.
 * 3. Deduplicated via foundation idempotency key: `ntf_provider_sync_failed_${cleanProvider}_${startupId}`.
 * 4. Best-effort side effect (ADR-023).
 */
export async function handleProviderSyncFailed(params: ProviderSyncFailedParams): Promise<boolean> {
  const { startupId, provider, failureReason, reconnectUrl } = params;
  const eventId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();

  try {
    const cleanProvider = provider.toLowerCase();
    const providerDisplayName =
      cleanProvider === "stripe"
        ? "Stripe"
        : cleanProvider === "razorpay"
        ? "Razorpay"
        : provider.charAt(0).toUpperCase() + provider.slice(1);

    let userEmail = params.userEmail;
    let founderName = params.founderName;
    let startupName = params.startupName;
    let userId = params.userId;

    // Resolve founder & startup details if missing
    if (!userEmail || !startupName) {
      const { data: startup } = await supabaseServer
        .from("startup_submissions")
        .select("startup_name, user_id")
        .eq("id", startupId)
        .maybeSingle();

      if (startup) {
        startupName = startupName ?? startup.startup_name;
        userId = userId ?? startup.user_id;

        if (userId && !userEmail) {
          const { data: user } = await supabaseServer
            .from("users")
            .select("email, full_name")
            .eq("id", userId)
            .maybeSingle();

          if (user) {
            userEmail = user.email;
            founderName = founderName ?? user.full_name;
          }
        }
      }
    }

    if (!userEmail) {
      logger.warn("[ProviderSyncFailed] Missing user email for provider sync failed notification", {
        event: LogEvent.PROVIDER_CONNECTION_FAILURE,
        startupId,
        provider: cleanProvider,
        eventId,
      });
      return false;
    }

    const sanitizedReason =
      failureReason ??
      `Authentication with ${providerDisplayName} failed or was revoked. Please verify your API credentials or reconnect your account.`;

    const idempotencyKey = generateIdempotencyKey({
      notificationType: "PROVIDER_SYNC_FAILED",
      entityId: startupId,
      scope: cleanProvider,
    });

    logger.info(`[ProviderSyncFailed] Dispatching PROVIDER_SYNC_FAILED notification for ${providerDisplayName}`, {
      event: LogEvent.NOTIFICATION_DISPATCH_STARTED,
      startupId,
      userId,
      provider: cleanProvider,
      idempotencyKey,
      eventId,
      correlationId,
    });

    const targetReconnectUrl =
      reconnectUrl ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/dashboard`;

    const dispatchResult = await dispatchNotification({
      type: "PROVIDER_SYNC_FAILED",
      metadata: {
        eventId,
        occurredAt: new Date(),
        source: "provider.sync.service",
        version: 1,
        correlationId,
        idempotencyKey,
      },
      payload: {
        founderName,
        startupName,
        email: userEmail,
        providerName: cleanProvider,
        providerDisplayName,
        failureReason: sanitizedReason,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/dashboard`,
        reconnectUrl: targetReconnectUrl,
        supportEmail: "support@verifii.in",
        currentYear: new Date().getFullYear(),
      },
    });

    if (dispatchResult.success) {
      logger.info(`[ProviderSyncFailed] PROVIDER_SYNC_FAILED notification dispatched successfully for ${providerDisplayName}`, {
        event: LogEvent.CHANNEL_DELIVERY_COMPLETED,
        startupId,
        userId,
        provider: cleanProvider,
        correlationId,
        eventId,
      });
    } else {
      logger.error(`[ProviderSyncFailed] PROVIDER_SYNC_FAILED notification failed dispatch for ${providerDisplayName}`, {
        event: LogEvent.CHANNEL_DELIVERY_FAILED,
        startupId,
        userId,
        provider: cleanProvider,
        correlationId,
        eventId,
      });
    }

    return dispatchResult.success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[ProviderSyncFailed] Uncaught exception during PROVIDER_SYNC_FAILED dispatch", {
      event: LogEvent.CHANNEL_DELIVERY_FAILED,
      startupId,
      provider,
      error: errorMsg,
      eventId,
      correlationId,
    });
    return false;
  }
}

export interface VerificationCompletedParams {
  startupId: number;
  verificationLogId: number | string;
  verificationScore?: number;
}

/**
 * Dispatches a canonical VERIFICATION_COMPLETED notification.
 * 
 * Characteristics:
 * 1. Sent after authoritative server-side verification completes and verification_logs entry is persisted.
 * 2. Idempotent via canonical verification_log ID (ntf_verification_completed_log_${verificationLogId}).
 * 3. Primary transaction isolated — failure will never abort or invalidate the verification API/pipeline.
 */
export async function handleVerificationCompleted(params: VerificationCompletedParams): Promise<boolean> {
  const { startupId, verificationLogId } = params;
  const eventId = crypto.randomUUID();
  const correlationId = crypto.randomUUID();

  try {
    const { data: startup } = await supabaseServer
      .from("startup_submissions")
      .select("slug, startup_name, trust_score, user_id")
      .eq("id", startupId)
      .maybeSingle();

    if (!startup || !startup.user_id) {
      logger.warn("[VerificationCompleted] Startup or user_id missing", { startupId });
      return false;
    }

    const { data: user } = await supabaseServer
      .from("users")
      .select("email, full_name")
      .eq("id", startup.user_id)
      .maybeSingle();

    if (!user || !user.email) {
      logger.warn("[VerificationCompleted] User email missing", { userId: startup.user_id });
      return false;
    }

    const idempotencyKey = generateCanonicalVerificationIdempotencyKey(
      "VERIFICATION_COMPLETED",
      verificationLogId
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in";
    const profileUrl = `${appUrl}/startup/${encodeURIComponent(startup.slug || String(startupId))}`;
    const score = params.verificationScore ?? startup.trust_score ?? 100;

    const dispatchResult = await dispatchNotification({
      type: "VERIFICATION_COMPLETED",
      metadata: {
        eventId,
        occurredAt: new Date(),
        source: "verification.pipeline",
        version: 1,
        correlationId,
        idempotencyKey,
      },
      payload: {
        founderName: user.full_name || "Founder",
        startupName: startup.startup_name || "Startup",
        email: user.email,
        verificationScore: score,
        profileUrl,
      },
    });

    if (dispatchResult.success) {
      logger.info(`[VerificationCompleted] VERIFICATION_COMPLETED notification dispatched successfully for startup ${startupId}`, {
        event: LogEvent.CHANNEL_DELIVERY_COMPLETED,
        startupId,
        verificationLogId,
        correlationId,
        eventId,
      });
    } else {
      logger.error(`[VerificationCompleted] VERIFICATION_COMPLETED notification failed dispatch for startup ${startupId}`, {
        event: LogEvent.CHANNEL_DELIVERY_FAILED,
        startupId,
        verificationLogId,
        correlationId,
        eventId,
      });
    }

    return dispatchResult.success;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[VerificationCompleted] Uncaught exception during VERIFICATION_COMPLETED dispatch", {
      event: LogEvent.CHANNEL_DELIVERY_FAILED,
      startupId,
      error: errorMsg,
      eventId,
      correlationId,
    });
    return false;
  }
}


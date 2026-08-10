/**
 * TEMPORARY LAUNCH EVIDENCE GATE 1 PRODUCTION EMAIL TEST ENDPOINT
 * 
 * Purpose: Empirically verify Resend production email delivery pipeline
 * re-using existing notification infrastructure without database mutations.
 * 
 * Security Controls:
 * 1. Requires authenticated admin user via getAuthenticatedUser() + isAdmin().
 * 2. Requires process.env.EMAIL_PRODUCTION_TEST_ENABLED === "true".
 * 3. Recipient is NOT caller-controlled (reads EMAIL_PRODUCTION_TEST_RECIPIENT || admin email).
 * 4. Zero database writes (no startup/subscription/billing/provider state changes).
 * 5. Deterministic idempotency key: ntf_prod_test_<recipient>_<YYYY-MM-DD>.
 * 6. Rate limited via Upstash Redis (max 3 calls per hour).
 * 7. Zero exposed secret keys in logs or API response.
 * 8. Re-uses existing dispatchNotification() -> emailAdapter -> sendEmail() pipeline.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { dispatchNotification, generateIdempotencyKey } from "@/notifications";
import { logger, LogEvent } from "@/lib/logger";

export async function POST(req: Request) {
  // ── 1. Rate Limiting ──────────────────────────────────────────────────────
  const identifier = getClientIdentifier(req);
  const { allowed } = await checkRateLimit(identifier, 3600000, 3, { failOpen: false });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Maximum 3 test dispatches per hour." }, { status: 429 });
  }

  try {
    // ── 2. Environment Flag Authorization ────────────────────────────────────
    const isTestEnabled = process.env.EMAIL_PRODUCTION_TEST_ENABLED === "true";
    if (!isTestEnabled) {
      return NextResponse.json(
        { error: "Production email testing is disabled. Set EMAIL_PRODUCTION_TEST_ENABLED=true in Vercel environment." },
        { status: 403 }
      );
    }

    // ── 3. Authenticated Admin Authorization ──────────────────────────────────
    const user = await getAuthenticatedUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: "Unauthorized admin access required" }, { status: 403 });
    }

    // ── 4. Non-Caller-Controlled Server-Side Recipient Resolution ────────────
    const recipientEmail = process.env.EMAIL_PRODUCTION_TEST_RECIPIENT || user.email;
    const recipientDomain = recipientEmail.split("@")[1] || "unknown";
    const maskedRecipient = recipientEmail.replace(/^(.)(.*)(@.*)$/, "$1***$3");

    // ── 5. Deterministic Idempotency Key ─────────────────────────────────────
    const todayDate = new Date().toISOString().split("T")[0];
    const idempotencyKey = generateIdempotencyKey({
      notificationType: "PRODUCTION_EMAIL_TEST",
      entityId: `gate1_${recipientEmail}_${todayDate}`,
    });

    const eventId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    logger.info("[Gate 1 Test] Initiating production email test dispatch", {
      event: LogEvent.NOTIFICATION_DISPATCH_STARTED,
      recipientDomain,
      eventId,
      correlationId,
      source: "ADMIN_GATE1_TEST",
    });

    // ── 6. Re-use Existing Notification Architecture ────────────────────────
    const dispatchResult = await dispatchNotification({
      type: "PRODUCTION_EMAIL_TEST",
      metadata: {
        eventId,
        occurredAt: new Date(),
        source: "ADMIN",
        version: 1,
        correlationId,
        idempotencyKey,
      },
      idempotencyKey,
      payload: {
        email: recipientEmail,
        adminName: user.user_metadata?.full_name || user.email.split("@")[0] || "Administrator",
        environment: process.env.NODE_ENV || "production",
        timestampFormatted: new Date().toUTCString(),
      },
    });

    if (!dispatchResult.success) {
      const emailChannel = dispatchResult.channels.find(c => c.channel === "EMAIL");
      logger.error("[Gate 1 Test] Email test dispatch failed", {
        event: LogEvent.EMAIL_DELIVERY_FAILED,
        error: emailChannel?.error,
        eventId,
        correlationId,
      });

      return NextResponse.json(
        {
          success: false,
          error: emailChannel?.error || "Email delivery failed",
          channels: dispatchResult.channels,
        },
        { status: 500 }
      );
    }

    const emailChannel = dispatchResult.channels.find(c => c.channel === "EMAIL");

    logger.info("[Gate 1 Test] Production email test dispatched successfully", {
      event: LogEvent.EMAIL_DELIVERY_COMPLETED,
      messageId: emailChannel?.providerMessageId,
      recipientDomain,
      eventId,
      correlationId,
    });

    return NextResponse.json({
      success: true,
      eventType: "PRODUCTION_EMAIL_TEST",
      recipientDomain,
      maskedRecipient,
      timestamp: new Date().toISOString(),
      messageId: emailChannel?.providerMessageId || null,
      channels: dispatchResult.channels,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("[Gate 1 Test] Exception during test email dispatch", {
      event: LogEvent.EMAIL_DELIVERY_FAILED,
      error: errorMsg,
    });

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

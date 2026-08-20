import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { logger, LogEvent } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { dispatchNotification } from "@/notifications/dispatcher";
import { generateIdempotencyKey } from "@/notifications/idempotency";
import { cancelAllUserSubscriptions } from "@/lib/billing/subscription-cancellation";
import {
  consumeAndVerifyReauthProof,
  getReauthProofToken,
  REAUTH_PROOF_COOKIE_NAME,
} from "@/lib/reauth-proof";

export async function DELETE(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(identifier, 60000, 3);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // ── Security Check: Re-Authentication Proof Enforcement ───────────────
    // VRF-005 / TEST 03 Invariant: Account deletion requires fresh, valid,
    // unexpired, user-bound, single-use re-authentication proof.
    const proofToken = await getReauthProofToken(request);

    const proofVerification = await consumeAndVerifyReauthProof(
      proofToken,
      user.id,
      "delete-account"
    );

    if (!proofVerification.valid) {
      const statusCode = proofVerification.status || 403;
      logger.warn("Account deletion rejected: re-authentication failed", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        reason: proofVerification.reason,
        statusCode,
      });
      const errorResponse = NextResponse.json(
        {
          error:
            statusCode === 503
              ? "Security verification service temporarily unavailable"
              : "Re-authentication required",
        },
        { status: statusCode }
      );
      errorResponse.cookies.set(REAUTH_PROOF_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return errorResponse;
    }

    // ── Step 1: Capture Notification Payload BEFORE Any Deletion ────────
    // All data required for the ACCOUNT_DELETED notification must be
    // resolved now, because auth.users and startup_submissions will be
    // permanently purged in subsequent steps.
    const userEmail = user.email;
    const founderName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined;

    // Capture startup name (first startup, if any) for email personalization
    const { data: startups } = await supabaseServer
      .from("startup_submissions")
      .select("startup_name")
      .eq("user_id", user.id)
      .limit(1);

    const startupName = startups?.[0]?.startup_name ?? undefined;

    // ── Step 2: Cancel/Verify Provider Subscriptions (HARD BARRIER) ──────
    // VRF-005 Invariant: Account deletion MUST NOT permanently delete the
    // account if a provider-backed Razorpay subscription capable of future
    // charging has not been successfully cancelled and verified terminal.
    const cancelResult = await cancelAllUserSubscriptions(user.id, { immediate: true });

    if (!cancelResult.success) {
      logger.error("Account deletion aborted: failed to cancel provider subscriptions", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: cancelResult.error,
      });
      return NextResponse.json(
        { error: "Failed to cancel active billing subscriptions. Account deletion aborted for billing safety." },
        { status: 500 }
      );
    }

    // ── Step 3: Delete Local Subscriptions (Post-Provider Cancellation) ──
    // Subscriptions must be deleted before anonymizing billing_audit_logs,
    // because trg_audit_subscriptions generates an audit row on DELETE.
    const { error: subDeleteError } = await supabaseServer
      .from("subscriptions")
      .delete()
      .eq("user_id", user.id);

    if (subDeleteError) {
      logger.error("Failed to delete local subscription records", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: subDeleteError.message,
      });
      return NextResponse.json({ error: "Failed to cleanup subscription data" }, { status: 500 });
    }

    // ── Step 4: Anonymize Billing Audit Logs (Preserve Financial History) ──
    // Sets user_id to NULL to preserve financial audit trail without blocking Auth deletion.
    const { error: auditError } = await supabaseServer
      .from("billing_audit_logs")
      .update({ user_id: null })
      .eq("user_id", user.id);

    if (auditError) {
      logger.error("Failed to anonymize billing audit logs", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: auditError.message,
      });
      return NextResponse.json({ error: "Failed to anonymize billing audit records" }, { status: 500 });
    }

    // ── Step 5: Anonymize Subscription Events (Preserve Event History) ────
    const { error: subEventsError } = await supabaseServer
      .from("subscription_events")
      .update({ user_id: null })
      .eq("user_id", user.id);

    if (subEventsError) {
      logger.error("Failed to anonymize subscription events", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: subEventsError.message,
      });
      return NextResponse.json({ error: "Failed to anonymize subscription events" }, { status: 500 });
    }

    // ── Step 6: Delete Transient Onboarding Events ───────────────────────
    const { error: onboardingError } = await supabaseServer
      .from("onboarding_events")
      .delete()
      .eq("user_id", user.id);

    if (onboardingError) {
      logger.error("Failed to cleanup onboarding events", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: onboardingError.message,
      });
      return NextResponse.json({ error: "Failed to cleanup onboarding data" }, { status: 500 });
    }

    // ── Step 7: Delete Application Data (Startup & Cascades) ─────────────
    // Cascading records (provider_connections, revenue, etc.) are removed by DB constraints.
    const { error: appDataError } = await supabaseServer
      .from("startup_submissions")
      .delete()
      .eq("user_id", user.id);

    if (appDataError) {
      logger.error("Failed to delete application data during account deletion", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: appDataError.message,
      });
      return NextResponse.json({ error: "Failed to cleanup application data" }, { status: 500 });
    }

    // ── Step 8: Pre-Auth-Deletion Invariant Verification ─────────────────
    // Confirm no blocking user references remain before invoking Auth API
    const [subCheck, auditCheck, eventCheck, onbCheck, startupCheck] = await Promise.all([
      supabaseServer.from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseServer.from("billing_audit_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseServer.from("subscription_events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseServer.from("onboarding_events").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseServer.from("startup_submissions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const remainingCounts = {
      subscriptions: subCheck.count ?? 0,
      billing_audit_logs: auditCheck.count ?? 0,
      subscription_events: eventCheck.count ?? 0,
      onboarding_events: onbCheck.count ?? 0,
      startup_submissions: startupCheck.count ?? 0,
    };

    if (
      subCheck.error ||
      auditCheck.error ||
      eventCheck.error ||
      onbCheck.error ||
      startupCheck.error ||
      remainingCounts.subscriptions > 0 ||
      remainingCounts.billing_audit_logs > 0 ||
      remainingCounts.subscription_events > 0 ||
      remainingCounts.onboarding_events > 0 ||
      remainingCounts.startup_submissions > 0
    ) {
      logger.error("Pre-auth-deletion verification failed: residual references remain", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        counts: remainingCounts,
        errors: {
          sub: subCheck.error?.message,
          audit: auditCheck.error?.message,
          event: eventCheck.error?.message,
          onb: onbCheck.error?.message,
          startup: startupCheck.error?.message,
        },
      });
      return NextResponse.json(
        { error: "Account cleanup verification failed. Account deletion aborted for referential safety." },
        { status: 500 }
      );
    }

    // ── Step 9: Delete Supabase Auth User LAST ───────────────────────────
    const { error: authError } = await supabaseServer.auth.admin.deleteUser(user.id);
    if (authError) {
      logger.error("Failed to delete auth user", {
        event: LogEvent.ACCOUNT_DELETION_FAILED,
        userId: user.id,
        error: authError.message,
      });
      return NextResponse.json({ error: "Failed to delete account credentials" }, { status: 500 });
    }

    logger.info("Account deleted successfully", { event: LogEvent.ACCOUNT_DELETED, userId: user.id });

    // ── Step 10: Dispatch ACCOUNT_DELETED Notification (Best-Effort) ────
    // Dispatched ONLY after both app data and auth user are permanently
    // deleted. Uses pre-captured payload — no post-deletion auth queries.
    // ADR-023: notification failure must never affect the deletion response.
    if (userEmail) {
      try {
        const eventId = crypto.randomUUID();
        const correlationId = crypto.randomUUID();
        const idempotencyKey = generateIdempotencyKey({
          notificationType: "ACCOUNT_DELETED",
          entityId: user.id,
          scope: "account",
        });

        await dispatchNotification({
          type: "ACCOUNT_DELETED",
          metadata: {
            eventId,
            occurredAt: new Date(),
            source: "account.deletion.handler",
            version: 1,
            correlationId,
            idempotencyKey,
          },
          payload: {
            founderName,
            email: userEmail,
            startupName,
            feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/feedback`,
            supportEmail: "support@verifii.in",
            currentYear: new Date().getFullYear(),
          },
        });

        logger.info("[AccountDeletion] ACCOUNT_DELETED notification dispatched", {
          event: LogEvent.NOTIFICATION_DISPATCH_STARTED,
          userId: user.id,
          correlationId,
          eventId,
        });
      } catch (notifErr) {
        // ADR-023: Non-blocking — notification failure must never prevent
        // the deletion response from succeeding.
        const errorMsg = notifErr instanceof Error ? notifErr.message : String(notifErr);
        logger.error("[AccountDeletion] ACCOUNT_DELETED notification dispatch failed", {
          event: LogEvent.CHANNEL_DELIVERY_FAILED,
          userId: user.id,
          error: errorMsg,
        });
      }
    }

    const successResponse = NextResponse.json({ success: true });
    successResponse.cookies.set(REAUTH_PROOF_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return successResponse;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Exception during account deletion", { event: LogEvent.ACCOUNT_DELETION_FAILED, error: errorMsg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

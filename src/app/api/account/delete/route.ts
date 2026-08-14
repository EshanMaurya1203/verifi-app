import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { logger, LogEvent } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { dispatchNotification } from "@/notifications/dispatcher";
import { generateIdempotencyKey } from "@/notifications/idempotency";
import { cancelAllUserSubscriptions } from "@/lib/billing/subscription-cancellation";

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

    // ── Step 3: Delete Application Data ─────────────────────────────────
    // Verify Ownership implicitly by restricting deletion to rows owned by the user.
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

    // ── Step 4: Delete Supabase Auth User LAST ──────────────────────────
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

    // ── Step 5: Dispatch ACCOUNT_DELETED Notification (Best-Effort) ─────
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Exception during account deletion", { event: LogEvent.ACCOUNT_DELETION_FAILED, error: errorMsg });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

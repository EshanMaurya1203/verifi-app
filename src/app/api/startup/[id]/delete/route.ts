import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { logger, LogEvent } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import {
  consumeAndVerifyReauthProof,
  getReauthProofToken,
  REAUTH_PROOF_COOKIE_NAME,
} from "@/lib/reauth-proof";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(identifier, 60000, 3);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const resolvedParams = await params;
    const startupId = resolvedParams.id;

    const { authenticated, owned, startup } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned || !startup) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    // ── Security Check: Re-Authentication Proof Enforcement ───────────────
    // TEST 03 Invariant: Startup deletion requires fresh, valid,
    // unexpired, user-bound, startup-bound, single-use re-authentication proof.
    const proofToken = await getReauthProofToken(request);

    const proofVerification = await consumeAndVerifyReauthProof(
      proofToken,
      startup.user_id,
      `delete-startup:${startupId}`
    );

    if (!proofVerification.valid) {
      logger.warn("Startup deletion rejected: re-authentication required", {
        event: LogEvent.STARTUP_DELETION_FAILED,
        startupId: Number(startupId),
        userId: startup.user_id,
        reason: proofVerification.reason,
      });
      const errorResponse = NextResponse.json(
        { error: "Re-authentication required" },
        { status: 403 }
      );
      errorResponse.cookies.set(REAUTH_PROOF_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      return errorResponse;
    }

    const { error: deleteError } = await supabaseServer
      .from("startup_submissions")
      .delete()
      .eq("id", startupId);

    if (deleteError) {
      logger.error("Failed to delete startup", { event: LogEvent.STARTUP_DELETION_FAILED, startupId: Number(startupId), error: deleteError.message });
      return NextResponse.json({ error: "Failed to delete startup" }, { status: 500 });
    }

    logger.info("Startup deleted successfully", { event: LogEvent.STARTUP_DELETED, startupId: Number(startupId) });

    const successResponse = NextResponse.json({ success: true });
    successResponse.cookies.set(REAUTH_PROOF_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return successResponse;
  } catch (err: any) {
    logger.error("Exception during startup deletion", { event: LogEvent.STARTUP_DELETION_FAILED, error: err.message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


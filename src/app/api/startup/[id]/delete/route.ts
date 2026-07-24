import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { logger, LogEvent } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const { allowed } = checkRateLimit(identifier, 60000, 3);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const resolvedParams = await params;
    const startupId = resolvedParams.id;

    const { authenticated, owned, startup } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Exception during startup deletion", { event: LogEvent.STARTUP_DELETION_FAILED, error: err.message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

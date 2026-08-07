import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { logger, LogEvent } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; provider: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(identifier, 60000, 5);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const resolvedParams = await params;
    const { id: startupId, provider } = resolvedParams;

    if (!["stripe", "razorpay"].includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const { authenticated, owned } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    // Atomic disconnect: Mark as failed and invalidate API key.
    // Preserves historical revenue data instead of deleting the row.
    const { error: disconnectError } = await supabaseServer
      .from("provider_connections")
      .update({
        status: "failed",
        api_key_encrypted: "DISCONNECTED_RETAINED_DATA",
      })
      .eq("startup_id", startupId)
      .eq("provider", provider);

    if (disconnectError) {
      logger.error("Failed to disconnect provider", { event: LogEvent.PROVIDER_DISCONNECT_FAILED, startupId: Number(startupId), provider, error: disconnectError.message });
      return NextResponse.json({ error: "Failed to disconnect provider" }, { status: 500 });
    }

    logger.info("Provider disconnected successfully", { event: LogEvent.PROVIDER_DISCONNECTED, startupId: Number(startupId), provider });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error("Exception during provider disconnect", { event: LogEvent.PROVIDER_DISCONNECT_FAILED, error: err.message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

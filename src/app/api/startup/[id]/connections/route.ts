import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";

export interface ProviderConnectionResponse {
  provider: string;
  status: string;
  last_sync_at: string | null;
  latest_revenue: number;
  verification_state: string;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { id } = await params;
    const startupId = id;

    // Security check 1: Require authentication and verify ownership
    const { authenticated, owned } = await verifyStartupOwnership(startupId);

    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Security check 2: Strict ownership enforcement (return 403 if not owned)
    // Removed isDemo fallback to ensure connections API is strictly protected
    if (!owned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Security check 3: Explicitly select ONLY required safe fields
    // NEVER expose api_key_encrypted, account_id, or internal metadata
    const { data: connections, error } = await supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at, latest_revenue")
      .eq("startup_id", startupId);

    if (error) {
      console.error("[Connections API] Database error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch connections" }, { status: 500 });
    }

    // Map to strictly typed response
    const providers: ProviderConnectionResponse[] = (connections || []).map(c => ({
      provider: c.provider,
      status: c.status,
      last_sync_at: c.last_synced_at,
      latest_revenue: Number(c.latest_revenue) || 0,
      verification_state: c.status === "connected" ? "verified" : "pending_sync"
    }));

    const totalMRR = providers.reduce((sum, p) => sum + p.latest_revenue, 0);

    return NextResponse.json({ success: true, providers, totalMRR });
  } catch (error) {
    console.error("[Connections API] Internal error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch connections" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const startupId = id;

    // Fetch active connections
    const { data: connections } = await supabaseAdmin
      .from("provider_connections")
      .select("provider, latest_revenue, last_synced_at")
      .eq("startup_id", startupId)
      .eq("status", "connected");

    const providers = (connections || []).map(c => ({
      provider: c.provider,
      amount: c.latest_revenue || 0,
      last_synced_at: c.last_synced_at
    }));

    const totalMRR = providers.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({ success: true, providers, totalMRR });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch connections" }, { status: 500 });
  }
}

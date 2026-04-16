import { getSupabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { calculateMRR } from "@/lib/revenue-verify";
import { calculateTrustScore } from "@/lib/trust";
import { decrypt } from "@/lib/encryption";

export async function GET(req: Request) {
  // Security check for Vercel Cron
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = getSupabaseServer();

  // Fetch all active Razorpay connections
  const { data: connections, error: connError } = await supabase
    .from("payment_connections")
    .select("*")
    .eq("provider", "razorpay")
    .eq("is_active", true);

  if (connError) {
    console.error("Failed to fetch connections:", connError);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const results = {
    processed_connections: 0,
    new_snapshots: 0,
    errors: [] as string[]
  };

  for (const conn of connections || []) {
    try {
      const razorpay = new Razorpay({
        key_id: conn.account_id,
        key_secret: decrypt(conn.access_token),
      });

      // Fetch last 50 payments
      const payments = await razorpay.payments.all({ count: 50 });

      for (const p of payments.items) {
        if (p.status !== "captured") continue;

        // Using upsert with external_id conflict resolution to avoid duplicates
        const { error: upsertError } = await supabase.from("revenue_snapshots").upsert({
          startup_id: conn.startup_id,
          provider: "razorpay",
          amount: p.amount, // stored in paise
          currency: p.currency,
          status: p.status,
          external_id: p.id,
          created_at: new Date(p.created_at * 1000).toISOString(),
        }, { onConflict: "external_id" });

        if (!upsertError) {
          results.new_snapshots++;
        }
      }
      results.processed_connections++;

      // Recalculate and update metrics
      const mrr = await calculateMRR(conn.startup_id);
      const { trust_score } = await calculateTrustScore(conn.startup_id);

      await supabase
        .from("startup_submissions")
        .update({ mrr, trust_score, payment_connected: true })
        .eq("id", conn.startup_id);

    } catch (err: any) {
      console.error(`Sync error for startup ${conn.startup_id}:`, err);
      results.errors.push(`Startup ${conn.startup_id}: ${err.message}`);
    }
  }

  return NextResponse.json({ 
    success: true, 
    processed: results.processed_connections,
    snapshots_synced: results.new_snapshots,
    errors_encountered: results.errors.length
  });
}

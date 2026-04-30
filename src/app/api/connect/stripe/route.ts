import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Temporary Simulation Route (/api/connect/stripe)
 * 
 * Inserts a demo connection into payment_connections for startup_id = 1.
 * This is for testing the connection flow end-to-end without full OAuth.
 */
export async function POST() {
  try {
    const { error } = await supabaseServer
      .from("payment_connections")
      .upsert({
        startup_id: 1,
        provider: "stripe",
        account_id: "demo_account_" + Date.now(),
        access_token: "demo_token_xyz_123",
        is_active: true
      });

    if (error) {
      console.error("[ConnectStripe] DB Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Stripe connected successfully" });
  } catch (error) {
    console.error("[ConnectStripe] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { error } = await supabaseServer
      .from("payment_connections")
      .delete()
      .eq("startup_id", 1);

    if (error) throw error;
    return NextResponse.json({ success: true, message: "Connections cleared" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

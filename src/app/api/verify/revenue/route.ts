import { NextResponse } from "next/server";
import { verifyStripeRevenue, verifyRazorpayRevenue } from "@/lib/revenue-verify";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, apiKey, keyId, keySecret, startup_id } = body;

    // 1. Try to get keys from request body
    let finalId = keyId || (apiKey?.includes(":") ? apiKey.split(":")[0] : null);
    let finalSecret = keySecret || (apiKey?.includes(":") ? apiKey.split(":")[1] : null);
    let finalStripeKey = apiKey;

    // 2. If missing, and we have a startup_id, look up in database
    if (startup_id && (!finalId || !finalSecret || (provider === "stripe" && !finalStripeKey))) {
      const { data: connection } = await supabaseAdmin
        .from("payment_connections")
        .select("*")
        .eq("startup_id", startup_id)
        .eq("provider", provider)
        .eq("is_active", true)
        .single();
      
      if (connection) {
        if (provider === "razorpay") {
          finalId = connection.account_id;
          finalSecret = decrypt(connection.access_token);
        } else if (provider === "stripe") {
          finalStripeKey = decrypt(connection.access_token);
        }
      }
    }

    // 3. Fallback to platform keys if explicitly requested or still missing
    if (body.usePlatformKeys) {
      if (provider === "razorpay") {
        finalId = finalId || process.env.RAZORPAY_KEY_ID;
        finalSecret = finalSecret || process.env.RAZORPAY_KEY_SECRET;
      } else if (provider === "stripe") {
        finalStripeKey = finalStripeKey || process.env.STRIPE_SECRET_KEY;
      }
    }

    let result;

    if (provider === "stripe") {
      if (!finalStripeKey) return NextResponse.json({ success: false, error: "Stripe key missing" }, { status: 400 });
      result = await verifyStripeRevenue(finalStripeKey);
    } else if (provider === "razorpay") {
      if (!finalId || !finalSecret) {
        return NextResponse.json(
          { success: false, error: "Razorpay credentials missing. Please link your account first." },
          { status: 400 }
        );
      }
      result = await verifyRazorpayRevenue(finalId, finalSecret);
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid provider" },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // 4. Record snapshots if verification is successful and startup_id is provided
    if (result.success && startup_id && result.items && result.items.length > 0) {
      const snapshots = result.items.map((item: any) => {
        if (provider === "razorpay") {
          return {
            startup_id,
            provider,
            amount: item.amount,
            currency: item.currency || "INR",
            status: item.status,
            external_id: item.id,
            created_at: new Date(item.created_at * 1000).toISOString(),
          };
        } else {
          return {
            startup_id,
            provider,
            amount: item.amount,
            currency: item.currency?.toUpperCase() || "USD",
            status: "captured",
            external_id: item.id,
            created_at: new Date(item.created * 1000).toISOString(),
          };
        }
      });

      const { error: snapshotError } = await supabaseAdmin
        .from("revenue_snapshots")
        .insert(snapshots);
      
      if (snapshotError) {
        console.error("Snapshot recording error:", snapshotError);
      }
    }

    return NextResponse.json({
      success: true,
      revenue: result.totalAmount,
      currency: result.currency,
    });
  } catch (error: any) {
    console.error("Verification API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { RazorpayProvider } from "@/lib/providers/razorpay";
import { runProviderSync } from "@/lib/providers/sync";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { key_id, key_secret, startup_id } = await req.json();

    if (!key_id || !key_secret || !startup_id) {
      return NextResponse.json({ success: false, error: "Missing keys or startup ID" }, { status: 400 });
    }

    const provider = new RazorpayProvider(key_id, key_secret);
    
    // Test API call implicitly happens in runProviderSync or we can do it explicitly
    // but fetchPayments will throw if keys are invalid.

    const result = await runProviderSync(startup_id, "razorpay", provider, {
      razorpayKeyId: key_id,
      razorpayKeySecret: key_secret
    });

    return NextResponse.json({
      success: true,
      message: "Razorpay connected and initial sync complete",
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions
    });

  } catch (err: any) {
    console.error("Razorpay sync error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Connection failed"
    }, { status: 400 });
  }
}

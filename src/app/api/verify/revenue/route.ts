import { NextResponse } from "next/server";
import { verifyStripeRevenue, verifyRazorpayRevenue } from "@/lib/revenue-verify";

export async function POST(req: Request) {
  try {
    const { provider, apiKey, keyId, keySecret } = await req.json();

    if (!provider || (!apiKey && !keyId)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    let result;

    if (provider === "stripe") {
      result = await verifyStripeRevenue(apiKey);
    } else if (provider === "razorpay") {
      // Handle the case where they might have sent combined apiKey or separate ones
      const id = keyId || (apiKey?.includes(":") ? apiKey.split(":")[0] : null);
      const secret = keySecret || (apiKey?.includes(":") ? apiKey.split(":")[1] : null);

      if (!id || !secret) {
        return NextResponse.json(
          { success: false, error: "Razorpay requires Key ID and Key Secret (formatted as ID:SECRET)" },
          { status: 400 }
        );
      }
      result = await verifyRazorpayRevenue(id, secret);
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

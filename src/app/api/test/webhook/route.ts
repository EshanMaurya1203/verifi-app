import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  console.log("REAL EVENT TEST");

  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_123",
          amount: 50000,
          currency: "INR",
          status: "captured",
          created_at: Math.floor(Date.now() / 1000),
          notes: {
            startup_id: "19"
          }
        }
      }
    }
  });
  
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("❌ RAZORPAY_WEBHOOK_SECRET is missing in environment variables");
    return new Response("Server configuration error: RAZORPAY_WEBHOOK_SECRET is missing", { status: 500 });
  }

  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  console.log("Payload sent:", body);
  console.log("🔑 Generated signature:", signature);

  try {
    const response = await fetch("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: body,
    });

    const result = await response.text();
    console.log("Webhook response:", result);

    return new Response(result, {
      status: response.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    return new Response(`Test failed: ${error.message}`, { status: 500 });
  }
}


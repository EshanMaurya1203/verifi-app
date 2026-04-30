import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const payload = {
    event: "payment.refunded",
    payload: {
      payment: {
        entity: {
          id: "pay_test_123", // 👈 existing payment
          amount: 50000,      // ₹500
          notes: { startup_id: "19" }
        }
      }
    }
  };

  const body = JSON.stringify(payload);

  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  const res = await fetch("http://localhost:3000/api/razorpay/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature
    },
    body
  });

  const text = await res.text();
  console.log("Refund test response:", text);

  return new Response(text);
}

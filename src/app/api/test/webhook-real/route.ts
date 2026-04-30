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
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_real_" + Date.now(),
          amount: 500000, // ₹5000 spike
          currency: "INR",
          status: "captured",
          notes: { startup_id: "19" }
        }
      }
    }
  };

  const body = JSON.stringify(payload);

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return new Response("Missing RAZORPAY_WEBHOOK_SECRET", { status: 500 });
  }

  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  console.log("--- REAL PAYMENT TEST ---");
  console.log("Payload:", body);
  console.log("Signature:", signature);

  const res = await fetch("http://localhost:3000/api/razorpay/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature
    },
    body
  });

  const responseText = await res.text();
  console.log("REAL PAYMENT TEST response:", responseText);

  return new Response(JSON.stringify({
    message: "REAL PAYMENT TEST",
    status: res.status,
    response: responseText
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { updateRevenueAndSnapshot } from "@/lib/webhook-handler";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  console.log("🚀 TEST ROUTE HIT");

  await updateRevenueAndSnapshot(19, 500, "razorpay", "test_1");
  await updateRevenueAndSnapshot(19, 200, "razorpay", "test_2");

  return new Response("done");
}
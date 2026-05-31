import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import Razorpay from "razorpay";

import { getAuthenticatedUser } from "@/lib/auth-server";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { provider, apiKey, keyId, keySecret } = await req.json();

    if (provider === "stripe") {
      if (!apiKey) return NextResponse.json({ error: "Missing Stripe key" }, { status: 400 });
      const stripe = new Stripe(apiKey, { apiVersion: "2023-10-16" as any });
      
      const subscriptions = await stripe.subscriptions.list({
        status: "active",
        expand: ["data.default_payment_method"],
      });

      let mrr = 0;
      for (const sub of subscriptions.data) {
        const item = sub.items.data[0];
        if (item && item.plan && item.plan.amount) {
          const amount = item.plan.amount;
          const interval = item.plan.interval;
          const quantity = item.quantity || 1;

          let monthlyAmount = amount;
          if (interval === "year") monthlyAmount = amount / 12;
          if (interval === "week") monthlyAmount = amount * 4;
          
          mrr += (monthlyAmount / 100) * quantity;
        }
      }
      
      return NextResponse.json({ success: true, revenue: mrr, currency: "USD" });
    }

    if (provider === "razorpay") {
      if (!keyId || !keySecret) {
        return NextResponse.json({ error: "Missing Razorpay credentials" }, { status: 400 });
      }
      const { createRazorpayClient, fetchRazorpayCapturedPayments } = await import(
        "@/lib/razorpay-sync"
      );
      const rzp = createRazorpayClient(keyId, keySecret);
      const captured = await fetchRazorpayCapturedPayments(rzp);
      const total = captured.reduce((sum, p) => sum + p.amount / 100, 0);

      return NextResponse.json({ success: true, revenue: total, currency: "INR" });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (err: any) {
    console.error("One-off verification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Razorpay from "razorpay";
import { getUserPlan } from "@/lib/subscriptions";

/**
 * Creates a Razorpay Subscription checkout session for SaaS billing.
 * Commercial Model: Pro monthly (₹999/mo). Free verification requires no checkout.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = await checkRateLimit(identifier, 60000, 5); // strict rate limit for checkouts
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan_code, billing_cycle } = body;

  // Strict 2-tier check: Only Pro monthly is available for paid subscription checkout
  if (plan_code !== "pro" || billing_cycle !== "monthly") {
    return NextResponse.json(
      { error: "Invalid plan or billing cycle. Only Pro monthly is available." },
      { status: 400 }
    );
  }

  const planId = process.env.RAZORPAY_PLAN_PRO_MONTHLY;
  if (!planId) {
    console.error("[Billing Checkout] Missing RAZORPAY_PLAN_PRO_MONTHLY configuration");
    return NextResponse.json({ error: "Server configuration error: Missing plan ID" }, { status: 500 });
  }

  // Check if user already has an active subscription to avoid duplicates
  const currentPlan = await getUserPlan(user.id);
  if (currentPlan && currentPlan.status !== "expired" && currentPlan.plan_code !== "viewer") {
    return NextResponse.json({ 
      error: "Active subscription exists. Please cancel existing subscription first." 
    }, { status: 400 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Razorpay billing keys are not configured" },
      { status: 500 }
    );
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  try {
    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 120, // 10 years of monthly billing
      notes: {
        user_id: user.id,
        plan_code: "pro",
        billing_cycle: "monthly"
      }
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      short_url: subscription.short_url,
    });
  } catch (error: any) {
    console.error("[Checkout] Failed to create Razorpay subscription:", error);
    return NextResponse.json({ error: "Failed to initialize checkout" }, { status: 500 });
  }
}

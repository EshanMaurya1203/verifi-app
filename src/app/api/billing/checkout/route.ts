import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Razorpay from "razorpay";
import { getUserPlan } from "@/lib/subscriptions";

const RAZORPAY_PLAN_MAP: Record<string, Record<string, string | undefined>> = {
  founder: {
    monthly: process.env.RAZORPAY_PLAN_FOUNDER_MONTHLY,
    annual: process.env.RAZORPAY_PLAN_FOUNDER_ANNUAL,
  },
  pro: {
    monthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY,
    annual: process.env.RAZORPAY_PLAN_PRO_ANNUAL,
  }
};

/**
 * Creates a Razorpay Subscription checkout session for SaaS billing.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 60000, 5); // strict rate limit for checkouts
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

  if (!plan_code || !billing_cycle || !RAZORPAY_PLAN_MAP[plan_code]) {
    return NextResponse.json({ error: "Invalid plan or billing cycle" }, { status: 400 });
  }

  const planId = RAZORPAY_PLAN_MAP[plan_code][billing_cycle];
  if (!planId) {
    console.error(`[Billing Checkout] Missing Razorpay plan ID configuration for ${plan_code} ${billing_cycle}`);
    return NextResponse.json({ error: "Server configuration error: Missing plan ID" }, { status: 500 });
  }

  // Check if user already has an active subscription to avoid duplicates
  const currentPlan = await getUserPlan(user.id);
  if (currentPlan && currentPlan.status === "active" && currentPlan.plan_code !== "viewer") {
    // Prevent subscribing if they already have an active sub (they should use change-plan)
    return NextResponse.json({ 
      error: "Active subscription exists. Please use change plan or cancel first." 
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
      total_count: billing_cycle === 'annual' ? 10 : 120, // 10 years or 10 years of months
      notes: {
        user_id: user.id,
        plan_code: plan_code,
        billing_cycle: billing_cycle
      }
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      // For hosted integration, we might return short_url
      short_url: subscription.short_url,
    });
  } catch (error: any) {
    console.error("[Checkout] Failed to create Razorpay subscription:", error);
    return NextResponse.json({ error: "Failed to initialize checkout" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import Razorpay from "razorpay";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

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
 * Consolidated endpoint for upgrades, downgrades, and billing cycle changes.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 60000, 5);
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
    return NextResponse.json({ error: "Invalid target plan or billing cycle" }, { status: 400 });
  }

  const newPlanId = RAZORPAY_PLAN_MAP[plan_code][billing_cycle];
  if (!newPlanId) {
    console.error(`[Billing Change Plan] Missing Razorpay plan ID configuration for ${plan_code} ${billing_cycle}`);
    return NextResponse.json({ error: "Server configuration error: Missing plan ID" }, { status: 500 });
  }

  // Get active subscription from local DB
  const { data: sub, error: subError } = await supabaseServer
    .from("subscriptions")
    .select("id, razorpay_subscription_id, status, plan_code, billing_cycle")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subError || !sub) {
    return NextResponse.json({ error: "No active subscription found to change." }, { status: 404 });
  }

  if (sub.plan_code === plan_code && sub.billing_cycle === billing_cycle) {
    return NextResponse.json({ error: "Already on the target plan and billing cycle." }, { status: 400 });
  }

  if (!sub.razorpay_subscription_id) {
    return NextResponse.json({ error: "Missing Razorpay subscription id." }, { status: 400 });
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
    const razorpaySub = await razorpay.subscriptions.fetch(sub.razorpay_subscription_id);
    const paymentMethod = (razorpaySub as { payment_method?: string }).payment_method;

    if (paymentMethod === "upi" || paymentMethod === "emandate") {
      const subscription = await razorpay.subscriptions.create({
        plan_id: newPlanId,
        customer_notify: 1,
        total_count: billing_cycle === "annual" ? 10 : 120,
        notes: {
          user_id: user.id,
          plan_code,
          billing_cycle,
          replaces_subscription_id: sub.razorpay_subscription_id,
        },
      });

      return NextResponse.json({
        success: true,
        subscription_id: subscription.id,
        short_url: subscription.short_url,
      });
    }

    // Card subscriptions: update immediately with proration
    await razorpay.subscriptions.update(sub.razorpay_subscription_id, {
      plan_id: newPlanId,
      schedule_change_at: "now",
      customer_notify: 1,
    });

    return NextResponse.json({ success: true, status: "pending_webhook" });
  } catch (error: any) {
    console.error("[Billing Change Plan] Failed to change Razorpay subscription:", error);
    return NextResponse.json({ error: "Failed to process plan change" }, { status: 500 });
  }
}

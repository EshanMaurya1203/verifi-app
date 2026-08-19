import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";

/**
 * Plan Change Endpoint (/api/billing/change-plan)
 *
 * In the launch 2-tier model (Free ₹0 / Pro ₹999/mo):
 * - Upgrades from Free -> Pro are processed via /api/billing/checkout.
 * - Downgrades from Pro -> Free are processed via /api/billing/cancel.
 *
 * Legacy Founder and Annual plans are completely deprecated and rejected.
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = await checkRateLimit(identifier, 60000, 5);
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

  // Explicitly reject obsolete founder or annual requests
  if (plan_code === "founder" || billing_cycle === "annual") {
    return NextResponse.json(
      { error: "The requested plan or billing cycle is obsolete and no longer supported." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { 
      error: "Plan switching between paid tiers is unavailable in the 2-tier model. To subscribe to Pro, use checkout; to cancel, use the subscription cancellation flow." 
    },
    { status: 400 }
  );
}

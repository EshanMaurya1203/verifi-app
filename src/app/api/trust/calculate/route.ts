import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";

import { verifyStartupOwnership } from "@/lib/auth-server";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { startup_id } = await req.json();

    if (!startup_id) {
      return NextResponse.json({ error: "Missing startup_id" }, { status: 400 });
    }

    // Enforce authentication and strict startup ownership validation
    const { authenticated, owned, user } = await verifyStartupOwnership(startup_id);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user!.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required for trust calculation" },
        { status: 403 }
      );
    }

    const result = await computeTrustScore(startup_id);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Trust calculation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

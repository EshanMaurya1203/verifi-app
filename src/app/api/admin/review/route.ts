import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/isAdmin";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { id, action, rejection_reason, confidence_score } = body;

    // Extract auth token from request to verify the caller
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!isAdmin(user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }



    const updateData: Record<string, unknown> = {
      verification_status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      confidence_score:
        action === "approve"
          ? confidence_score || 80
          : 0,
    };

    if (action === "reject") {
      updateData.rejection_reason = rejection_reason || "Not valid";
    }

    const { error } = await supabaseServer
      .from("startup_submissions")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("admin review error", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

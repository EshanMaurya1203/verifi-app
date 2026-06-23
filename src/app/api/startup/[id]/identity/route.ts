import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const startupId = resolvedParams.id;

    // Enforce authentication and strict startup ownership validation
    const { authenticated, owned, startup } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    const body = await request.json();
    const { founder_name, founder_avatar, startup_logo, founder_bio, is_public } = body;

    const { data, error } = await supabaseServer
      .from("startup_submissions")
      .update({
        founder_name,
        founder_avatar,
        startup_logo,
        founder_bio,
        is_public
      })
      .eq("id", startupId)
      .select()
      .single();

    if (error) {
      console.error("[Update Identity] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, startup: data });
  } catch (err: any) {
    console.error("[Update Identity] Exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    
    const { founder_name, founder_avatar, startup_logo, founder_bio } = body;

    const { data, error } = await supabaseAdmin
      .from("startup_submissions")
      .update({
        founder_name,
        founder_avatar,
        startup_logo,
        founder_bio
      })
      .eq("id", resolvedParams.id)
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

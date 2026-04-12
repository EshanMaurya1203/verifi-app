import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { count, error } = await supabaseAdmin
    .from("startup_submissions")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("startup submissions count error", error.message);
    return NextResponse.json(
      { count: 0, error: "Unable to fetch submission count" },
      { status: 500 }
    );
  }

  return NextResponse.json({ count: count ?? 0 });
}

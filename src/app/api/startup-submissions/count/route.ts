import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const { count, error } = await supabaseServer
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

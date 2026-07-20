import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/isAdmin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // 1. Get authenticated user
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the submission
    const { data: submission, error: submissionError } = await supabaseServer
      .from("startup_submissions")
      .select("user_id, proof_url")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!submission.proof_url) {
      return NextResponse.json({ error: "No proof uploaded" }, { status: 404 });
    }

    // 3. Verify access (Must be the owner or an admin)
    const isOwner = submission.user_id === user.id;
    const adminUser = isAdmin(user.email);

    if (!isOwner && !adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Use the canonical proof_url directly
    const filePath = submission.proof_url;

    // 5. Generate the signed URL (valid for 60 seconds)
    const { data, error } = await supabaseServer.storage
      .from("proofs")
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      console.error("Signed URL generation failed:", error);
      return NextResponse.json(
        { error: "Failed to generate access URL" },
        { status: 500 }
      );
    }

    // 6. Redirect to the signed URL
    return NextResponse.redirect(data.signedUrl);
  } catch (err: any) {
    console.error("Proof API Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

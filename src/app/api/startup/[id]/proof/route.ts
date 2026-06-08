import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/isAdmin";

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
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser();

    if (authError || !user) {
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

    // 4. Parse the file path from the proof_url (in case it's a legacy public URL)
    let filePath = submission.proof_url;
    if (filePath.includes("/public/proofs/")) {
      filePath = filePath.split("/public/proofs/")[1];
    } else if (filePath.includes("/proofs/")) {
      // Handle cases where the URL might just have /proofs/ in it
      const parts = filePath.split("/proofs/");
      filePath = parts[parts.length - 1];
    }

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

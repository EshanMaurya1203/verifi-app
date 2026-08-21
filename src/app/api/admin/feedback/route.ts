import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { supabaseServer } from "@/lib/supabase-server";
import { z } from "zod";

const updateStatusSchema = z.object({
  feedback_id: z.string().uuid("Invalid feedback ID."),
  status: z.enum(["open", "in_progress", "resolved"], {
    message: "Status must be open, in_progress, or resolved.",
  }),
});

/**
 * GET /api/admin/feedback
 * Fetch all user feedback with threaded replies (Admin only).
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        {
          status: 403,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const categoryFilter = searchParams.get("category");

    let query = supabaseServer
      .from("feedback")
      .select(
        "id, user_id, user_email, category, message, status, created_at, updated_at, feedback_replies(id, author_user_id, author_email, is_admin, body, created_at)"
      )
      .order("created_at", { ascending: false });

    if (statusFilter && ["open", "in_progress", "resolved"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    if (categoryFilter && ["bug", "feature", "ui_ux", "general"].includes(categoryFilter)) {
      query = query.eq("category", categoryFilter);
    }

    const { data: feedbackList, error } = await query;

    if (error) {
      console.error("[Admin Feedback API] GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch admin feedback queue." },
        {
          status: 500,
          headers: {
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    const formatted = (feedbackList || []).map((item) => ({
      ...item,
      feedback_replies: Array.isArray(item.feedback_replies)
        ? [...item.feedback_replies].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        : [],
    }));

    return NextResponse.json(
      { feedback: formatted },
      {
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("[Admin Feedback API] GET exception:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      {
        status: 500,
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}

/**
 * PATCH /api/admin/feedback
 * Update status of a feedback item (Admin only).
 */
export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const parseResult = updateStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid status payload." },
        { status: 400 }
      );
    }

    const { feedback_id, status } = parseResult.data;

    const { error: updateError } = await supabaseServer
      .from("feedback")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feedback_id);

    if (updateError) {
      console.error("[Admin Feedback API] Status update error:", updateError);
      return NextResponse.json({ error: "Failed to update feedback status." }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback_id, status });
  } catch (err: any) {
    console.error("[Admin Feedback API] PATCH exception:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

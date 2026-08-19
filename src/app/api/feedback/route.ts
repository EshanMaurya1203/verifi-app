import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { dispatchNotification } from "@/notifications";
import { z } from "zod";

const createFeedbackSchema = z.object({
  category: z.enum(["bug", "feature", "ui_ux", "general"], {
    message: "Category must be one of: bug, feature, ui_ux, general",
  }),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters long.")
    .max(3000, "Message cannot exceed 3000 characters."),
});

/**
 * GET /api/feedback
 * Returns the authenticated user's feedback history and threaded replies.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: feedbackList, error } = await supabaseServer
      .from("feedback")
      .select(
        "id, category, message, status, created_at, updated_at, feedback_replies(id, author_user_id, author_email, is_admin, body, created_at)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Feedback API] GET error:", error);
      return NextResponse.json({ error: "Failed to fetch feedback history." }, { status: 500 });
    }

    // Sort replies chronologically inside each feedback
    const formatted = (feedbackList || []).map((item) => ({
      ...item,
      feedback_replies: Array.isArray(item.feedback_replies)
        ? [...item.feedback_replies].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          )
        : [],
    }));

    return NextResponse.json({ feedback: formatted });
  } catch (err: any) {
    console.error("[Feedback API] GET exception:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Authenticated user submits feedback.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    // Abuse prevention & rate limiting
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(
      `feedback:submit:${user.id}:${identifier}`,
      60000,
      5,
      { failOpen: true }
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many feedback submissions. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const parseResult = createFeedbackSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid feedback data." },
        { status: 400 }
      );
    }

    const { category, message } = parseResult.data;

    // Secure server-side insertion
    const { data: newFeedback, error: insertError } = await supabaseServer
      .from("feedback")
      .insert({
        user_id: user.id,
        user_email: user.email,
        category,
        message,
        status: "open",
      })
      .select()
      .single();

    if (insertError || !newFeedback) {
      console.error("[Feedback API] DB insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save feedback. Please try again later." },
        { status: 500 }
      );
    }

    // Trigger Admin notification asynchronously
    try {
      await dispatchNotification({
        type: "FEEDBACK_SUBMITTED",
        metadata: {
          eventId: `evt_fb_${newFeedback.id}_${Date.now()}`,
          occurredAt: new Date(),
          source: "feedback.submit",
          version: 1,
        },
        payload: {
          feedbackId: newFeedback.id,
          userEmail: user.email,
          category: newFeedback.category,
          message: newFeedback.message,
          submittedAtFormatted: new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          }),
          adminInboxUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/admin/feedback`,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (notifErr) {
      console.error("[Feedback API] Notification dispatch error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      feedback: {
        ...newFeedback,
        feedback_replies: [],
      },
    });
  } catch (err: any) {
    console.error("[Feedback API] POST exception:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

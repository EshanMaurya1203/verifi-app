import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/isAdmin";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { dispatchNotification } from "@/notifications";
import { z } from "zod";

const createReplySchema = z.object({
  feedback_id: z.string().uuid("Invalid feedback ID."),
  body: z
    .string()
    .trim()
    .min(2, "Reply cannot be empty.")
    .max(5000, "Reply cannot exceed 5000 characters."),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
});

/**
 * POST /api/admin/feedback/reply
 * Admin replies to a feedback thread and optionally updates its status.
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    // Abuse prevention
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(
      `feedback:reply:${user.id}:${identifier}`,
      60000,
      20,
      { failOpen: true }
    );
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait." }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
    }

    const parseResult = createReplySchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid reply payload." },
        { status: 400 }
      );
    }

    const { feedback_id, body, status } = parseResult.data;

    // Fetch existing feedback record
    const { data: targetFeedback, error: fetchError } = await supabaseServer
      .from("feedback")
      .select("*")
      .eq("id", feedback_id)
      .single();

    if (fetchError || !targetFeedback) {
      return NextResponse.json({ error: "Feedback submission not found." }, { status: 404 });
    }

    // Insert new reply record
    const { data: replyRecord, error: insertError } = await supabaseServer
      .from("feedback_replies")
      .insert({
        feedback_id: targetFeedback.id,
        author_user_id: user.id,
        author_email: user.email || "admin@verifii.in",
        is_admin: true,
        body,
      })
      .select()
      .single();

    if (insertError || !replyRecord) {
      console.error("[Admin Reply API] DB insert error:", insertError);
      return NextResponse.json({ error: "Failed to store reply." }, { status: 500 });
    }

    // Update parent feedback status & timestamp
    const nextStatus = status || targetFeedback.status;
    await supabaseServer
      .from("feedback")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetFeedback.id);

    // Dispatch email notification to the user
    try {
      await dispatchNotification({
        type: "FEEDBACK_REPLIED",
        metadata: {
          eventId: `evt_reply_${replyRecord.id}_${Date.now()}`,
          occurredAt: new Date(),
          source: "feedback.admin.reply",
          version: 1,
        },
        payload: {
          feedbackId: targetFeedback.id,
          userEmail: targetFeedback.user_email,
          category: targetFeedback.category,
          messageSnippet:
            targetFeedback.message.length > 120
              ? targetFeedback.message.slice(0, 117) + "..."
              : targetFeedback.message,
          replyBody: body,
          repliedAtFormatted: new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
          }),
          feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.verifii.in"}/feedback`,
          currentYear: new Date().getFullYear(),
        },
      });
    } catch (notifErr) {
      console.error("[Admin Reply API] User notification dispatch error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      reply: replyRecord,
      status: nextStatus,
    });
  } catch (err: any) {
    console.error("[Admin Reply API] POST exception:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

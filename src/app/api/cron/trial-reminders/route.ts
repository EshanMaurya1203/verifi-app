import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { dispatchNotification } from "@/notifications/dispatcher";

/**
 * Cron route: Send Trial Expiring Reminders
 * GET /api/cron/trial-reminders
 *
 * Runs daily via Vercel Cron.
 * Protected by Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const threeDaysLaterIso = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trialingSubs, error: subError } = await supabaseServer
    .from("subscriptions")
    .select("id, user_id, plan_code, trial_end, status")
    .eq("status", "trialing")
    .not("trial_end", "is", null)
    .gt("trial_end", nowIso)
    .lte("trial_end", threeDaysLaterIso);

  if (subError) {
    console.error("[Cron Trial Reminders] Failed to query trialing subscriptions:", subError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const subsList = trialingSubs || [];
  processed = subsList.length;

  for (const sub of subsList) {
    try {
      if (!sub.user_id || !sub.trial_end) {
        skipped++;
        continue;
      }

      const trialEndDate = new Date(sub.trial_end);
      const trialEndDay = trialEndDate.toISOString().split("T")[0];
      const idempotencyKey = `ntf_trial_expiring_${sub.id}_${trialEndDay}`;

      const { data: userData } = await supabaseServer.auth.admin.getUserById(sub.user_id);
      const userEmail = userData?.user?.email;

      if (!userEmail) {
        skipped++;
        continue;
      }

      const founderName =
        userData?.user?.user_metadata?.full_name ||
        userData?.user?.user_metadata?.name ||
        userEmail.split("@")[0];

      const { data: startup } = await supabaseServer
        .from("startup_submissions")
        .select("startup_name")
        .eq("user_id", sub.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startupName = startup?.startup_name || "Your Startup";
      const formattedPlan = (sub.plan_code || "founder").toUpperCase();
      const trialEndFormatted = trialEndDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.verifii.in";

      const dispatchResult = await dispatchNotification({
        type: "TRIAL_EXPIRING",
        metadata: {
          eventId: crypto.randomUUID(),
          occurredAt: new Date(),
          source: "CRON",
          version: 1,
          idempotencyKey,
        },
        idempotencyKey,
        payload: {
          email: userEmail,
          founderName,
          startupName,
          planName: formattedPlan,
          trialEndFormatted,
          billingUrl: `${baseUrl}/dashboard/settings/billing`,
        },
      });

      if (dispatchResult.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[Cron Trial Reminders] Error processing sub ${sub.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    sent,
    skipped,
    failed,
  });
}

import { supabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";
import { detectFraud } from "@/lib/fraud";

/**
 * Shared handler for real-time revenue updates from webhooks.
 *
 * Called by both Stripe and Razorpay webhook routes when a payment succeeds.
 * Uses payment_id for event-level idempotency — duplicate calls are safely ignored.
 *
 * Execution order (CRITICAL — do not reorder):
 * [1] Idempotency check
 * [2] Abuse detection (BEFORE transaction insert, using pre-insert counts)
 * [3] Compute clean_events
 * [4] Insert transaction
 * [5] Compute MRR
 * [6] Compute trust score
 * [7] Snapshot
 * [8] Single atomic update to startup_submissions
 */
export async function updateRevenueAndSnapshot(
  startupId: number,
  amount: number,
  provider: string,
  paymentId: string
) {
  console.log("🔥 STEP 0: FUNCTION STARTED", {
    startupId,
    amount,
    provider,
    paymentId
  });

  // ─── STEP 1: IDEMPOTENCY CHECK ────────────────────────────────────────────
  const { data: existingTx, error: existingError } = await supabaseServer
    .from("revenue_transactions")
    .select("id")
    .eq("payment_id", paymentId)
    .limit(1);

  if (existingError) {
    console.error("❌ Idempotency check failed:", existingError);
    throw existingError;
  }

  if (existingTx && existingTx.length > 0) {
    console.log("🟡 Duplicate payment ignored:", paymentId);
    return;
  }

  // ─── STEP 2: FETCH CURRENT STATE ─────────────────────────────────────────
  const { data: currentStartup, error: fetchError } = await supabaseServer
    .from("startup_submissions")
    .select("*")
    .eq("id", startupId)
    .single();

  console.log("STEP 2 RESULT:", { currentStartup, fetchError });

  if (fetchError || !currentStartup) {
    console.error("❌ Fetch failed:", fetchError);
    throw fetchError ?? new Error("Startup not found");
  }

  // ─── STEP 3: ABUSE DETECTION (before insert so counts are not inflated) ──
  const { data: recentHistory } = await supabaseServer
    .from("revenue_transactions")
    .select("amount, created_at")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(4);

  const previousTransactions = (recentHistory ?? []).map(row => Number(row.amount));
  const timestamps = (recentHistory ?? []).map(row => new Date(row.created_at).getTime());

  const fraud = detectFraud({
    amount,
    previousTransactions,
    timestamps,
    now: Date.now()
  });

  // ─── STEP 4: CLEAN EVENTS & PENALTY ─────────────────────────────────────
  const isClean = !fraud.isFraud && amount >= 100;
  const currentCleanEvents = Number(currentStartup.clean_events) || 0;
  const newCleanEvents = isClean ? currentCleanEvents + 1 : 0;

  let newPenaltyCount = Number(currentStartup.penalty_count) || 0;
  let lastPenaltyAt = currentStartup.last_penalty_at;

  if (fraud.isFraud) {
    newPenaltyCount += 1;
    lastPenaltyAt = new Date().toISOString();
    console.warn(`Abuse detected (${fraud.reason}), penalty applied. Count: ${newPenaltyCount}`);
  } else if (isClean) {
    console.log(`Clean event incremented → ${newCleanEvents}`);
  } else {
    console.log("🟡 Non-fraud micro-payment or ignore.");
  }

  if (!isClean && !fraud.isFraud) {
    console.log("⚠️ Clean events RESET to 0 (non-clean activity)");
  }

  // ─── STEP 5: INSERT TRANSACTION ──────────────────────────────────────────
  const { error: txError } = await supabaseServer
    .from("revenue_transactions")
    .insert({
      startup_id: startupId,
      payment_id: paymentId,
      amount,
      provider
    });

  if (txError) {
    if (txError.message?.toLowerCase().includes("duplicate")) {
      console.log("🟡 Race-condition duplicate, aborting:", paymentId);
      return;
    }
    console.error("Transaction insert failed:", txError);
    throw txError;
  }

  console.log(`✅ Processed payment ${paymentId} → startup ${startupId}: +₹${amount}`);

  // ─── STEP 6: MRR CALCULATION ─────────────────────────────────────────────
  let mrr_breakdown = (currentStartup?.mrr_breakdown as any) || {};
  mrr_breakdown[provider] = (mrr_breakdown[provider] || 0) + Number(amount);
  if (mrr_breakdown[provider] < 0) mrr_breakdown[provider] = 0;

  let totalMrr = Object.values(mrr_breakdown).reduce((a: number, b: any) => a + Number(b), 0);
  if (totalMrr < 0) totalMrr = 0;

  // ─── STEP 7: TRUST SCORE ─────────────────────────────────────────────────
  let scoreResultUpdateData: any = {};
  if (amount >= 100) {
    console.log("Recomputing trust score for startup:", startupId);

    const projectedStartup = {
      ...currentStartup,
      mrr: totalMrr,
      mrr_breakdown,
      clean_events: newCleanEvents,
      penalty_count: newPenaltyCount,
      last_penalty_at: lastPenaltyAt
    };

    const scoreResult = await computeTrustScore(startupId, {
      startup: projectedStartup,
      persist: false  // CRITICAL: no partial update from scoring
    });
    scoreResultUpdateData = scoreResult.updateData || {};
  } else {
    console.log("Ignoring micro-payment for trust:", amount);
  }

  // ─── STEP 8: SNAPSHOT (no early-return, just skip insert if duplicate) ───
  const { data: lastSnapshot } = await supabaseServer
    .from("revenue_snapshots")
    .select("total_revenue")
    .eq("startup_id", startupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastSnapshot || lastSnapshot.total_revenue !== totalMrr) {
    const { error: snapshotError } = await supabaseServer
      .from("revenue_snapshots")
      .insert({
        startup_id: startupId,
        total_revenue: totalMrr,
        provider_breakdown: mrr_breakdown
      });

    if (snapshotError) {
      console.error("❌ Snapshot failed:", snapshotError);
      throw snapshotError;
    }
  } else {
    console.log("Skipping duplicate snapshot");
  }

  // ─── STEP 9: SINGLE ATOMIC UPDATE ────────────────────────────────────────
  const updatePayload = {
    clean_events: newCleanEvents,
    mrr: totalMrr,
    mrr_breakdown: mrr_breakdown,
    penalty_count: newPenaltyCount,
    last_penalty_at: lastPenaltyAt,
    ...scoreResultUpdateData  // trust_score, trust_tier, verification_status,
                               // trust_breakdown, penalty_count, last_penalty_at
  };

  console.log("FINAL UPDATE PAYLOAD:", updatePayload);

  const { error: finalUpdateError } = await supabaseServer
    .from("startup_submissions")
    .update(updatePayload)
    .eq("id", startupId);

  if (finalUpdateError) {
    console.error("❌ Final update failed:", finalUpdateError);
    throw finalUpdateError;
  }

  // ─── VALIDATION LOG ───────────────────────────────────────────────────────
  const { data: postUpdateRow } = await supabaseServer
    .from("startup_submissions")
    .select("clean_events")
    .eq("id", startupId)
    .single();

  console.log("POST-UPDATE CLEAN EVENTS:", postUpdateRow);

  console.log("✅ FUNCTION SUCCESS");
}

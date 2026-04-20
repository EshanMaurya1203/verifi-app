import { getSupabaseServer } from "./supabase-server";

/**
 * Fraud Detection Engine
 * Analyzes revenue patterns to identify potential gaming of the audit system.
 */
export async function detectFraud(startup_id: number) {
  const supabase = getSupabaseServer();
  
  // 1. Fetch latest and previous snapshots
  const { data: snapshots } = await supabase
    .from("revenue_transactions")
    .select("*")
    .eq("startup_id", startup_id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!snapshots || snapshots.length === 0) return;

  const current = snapshots[0];
  const previous = snapshots[1];

  // --- RULES ---

  // 1. REVENUE SPIKE DETECTION (Latest snapshot > 3x previous)
  if (previous && previous.amount > 0 && current.amount > (previous.amount * 3)) {
    await logFraud(startup_id, "revenue_spike", 4, {
      current: current.amount,
      previous: previous.amount,
      multiple: current.amount / previous.amount
    });
  }

  // 2. ZERO ACTIVITY AFTER HIGH REVENUE (Previous > 50k and now 0)
  if (previous && previous.amount > 50000 && current.amount === 0) {
    await logFraud(startup_id, "sudden_drop", 3, {
      previous: previous.amount,
      current: current.amount
    });
  }

  // 3. TOO MANY SMALL PAYMENTS (FAKE LOOP)
  // We check the payments that contributed to this snapshot
  // (Assuming we can fetch payments from providers or if they are stored as items)
  // Since we store aggregate amount in snapshots, we'd ideally check raw data.
  // For now, let's peek at the last verification metadata if available.
  const { data: lastLog } = await supabase
    .from("verification_logs")
    .select("metadata")
    .eq("startup_id", startup_id)
    .eq("event", "razorpay_sync_success")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastLog && lastLog.metadata && lastLog.metadata.micro_payment_count > 50) {
    await logFraud(startup_id, "micro_transactions", 5, {
      count: lastLog.metadata.micro_payment_count
    });
  }

  // 4. INCONSISTENT MONTHLY PATTERN (Variance check)
  if (snapshots.length >= 3) {
    const amounts = snapshots.map(s => Number(s.amount));
    const mean = amounts.reduce((a, b) => a + b) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    
    // If StdDev is more than 2x the mean, pattern is highly irregular
    if (stdDev > (mean * 2)) {
      await logFraud(startup_id, "inconsistent_revenue", 3, { stdDev, mean });
    }
  }
}

async function logFraud(startup_id: number, type: string, severity: number, metadata: any) {
  const supabase = getSupabaseServer();
  
  // Store fraud signal
  await supabase.from("fraud_signals").insert({
    startup_id,
    signal_type: type,
    severity,
    metadata
  });

  // Log in general verification logs
  await supabase.from("verification_logs").insert({
    startup_id,
    event: "fraud_detected",
    metadata: { signal_type: type, severity, details: metadata }
  });

  console.warn(`[FRAUD] Detected ${type} for startup ${startup_id} (Severity: ${severity})`);
}

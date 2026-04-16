import { getSupabaseServer } from "./supabase-server";

export interface TrustScoreResult {
  trust_score: number;
  confidence: string;
}

export async function calculateTrustScore(startup_id: number): Promise<TrustScoreResult> {
  const supabase = getSupabaseServer();
  let score = 0;

  // Fetch full startup record
  const { data: startup } = await supabase
    .from("startup_submissions")
    .select("*")
    .eq("id", startup_id)
    .single();

  if (!startup) {
    return { trust_score: 0, confidence: "0%" };
  }

  // 1. payment_connected (+50)
  if (startup.payment_connected) {
    score += 50;
  }

  // 2. revenue data exists (+20)
  // Check if there's any snapshot recorded
  const { count } = await supabase
    .from("revenue_snapshots")
    .select("*", { count: 'exact', head: true })
    .eq("startup_id", startup_id);

  if (count && count > 0) {
    score += 20;
  }

  // 3. website (+10)
  if (startup.website && startup.website.includes(".") && !startup.website.includes("@")) {
    score += 10;
  }

  // 4. founder verified (+20)
  if (startup.verification_status === "approved" || startup.verification_status === "identity_verified") {
    score += 20;
  }

  // Update record
  await supabase
    .from("startup_submissions")
    .update({ trust_score: score })
    .eq("id", startup_id);

  return {
    trust_score: score,
    confidence: `${score}%`
  };
}

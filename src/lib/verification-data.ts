import { supabaseServer } from "@/lib/supabase-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
  VerificationStateResult,
} from "@/lib/verification-state";

export function isDemoStartupUserId(userId: string | null | undefined): boolean {
  return !!userId?.startsWith("00000000-0000-0000-0000-");
}

export async function computeVerificationStateForStartup(
  startupId: number,
  options?: { isDemoProfile?: boolean }
): Promise<VerificationStateResult> {
  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at, latest_revenue")
      .eq("startup_id", startupId),
    supabaseServer
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startupId),
    supabaseServer
      .from("startup_submissions")
      .select("penalty_count, user_id, verification_type, proof_url")
      .eq("id", startupId)
      .maybeSingle(),
  ]);

  const isDemo =
    options?.isDemoProfile ??
    isDemoStartupUserId(startupRes.data?.user_id);

  return computeVerificationState(
    buildVerificationStateInput({
      revenueTransactions: revenueRes.data || [],
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: Number(startupRes.data?.penalty_count) || 0,
      isDemoProfile: isDemo,
      verificationType: startupRes.data?.verification_type,
      hasProofUpload: !!startupRes.data?.proof_url,
    })
  );
}

export async function computeVerificationStatesForStartups(
  startupIds: number[],
  demoUserIds: Map<number, string | null>
): Promise<Map<number, VerificationStateResult>> {
  const results = new Map<number, VerificationStateResult>();
  if (startupIds.length === 0) return results;

  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("startup_id, amount, created_at")
      .in("startup_id", startupIds)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("provider_connections")
      .select("startup_id, provider, status, last_synced_at, latest_revenue")
      .in("startup_id", startupIds),
    supabaseServer
      .from("fraud_signals")
      .select("startup_id, signal_type")
      .in("startup_id", startupIds),
    supabaseServer
      .from("startup_submissions")
      .select("id, penalty_count, user_id, verification_type, proof_url")
      .in("id", startupIds),
  ]);

  const revenueByStartup = new Map<number, { amount: number; created_at: string }[]>();
  for (const row of revenueRes.data || []) {
    const list = revenueByStartup.get(row.startup_id) || [];
    list.push({ amount: row.amount, created_at: row.created_at });
    revenueByStartup.set(row.startup_id, list);
  }

  const providersByStartup = new Map<
    number,
    { provider: string; status: string; last_synced_at: string | null; latest_revenue?: number }[]
  >();
  for (const row of providerRes.data || []) {
    const list = providersByStartup.get(row.startup_id) || [];
    list.push({
      provider: row.provider,
      status: row.status,
      last_synced_at: row.last_synced_at,
      latest_revenue: row.latest_revenue,
    });
    providersByStartup.set(row.startup_id, list);
  }

  const fraudByStartup = new Map<number, { signal_type: string }[]>();
  for (const row of fraudRes.data || []) {
    const list = fraudByStartup.get(row.startup_id) || [];
    list.push({ signal_type: row.signal_type });
    fraudByStartup.set(row.startup_id, list);
  }

  const penaltyByStartup = new Map<number, number>();
  for (const row of startupRes.data || []) {
    penaltyByStartup.set(row.id, Number(row.penalty_count) || 0);
    demoUserIds.set(row.id, row.user_id);
  }

  for (const id of startupIds) {
    const startupRow = (startupRes.data || []).find((r) => r.id === id);
    const state = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: revenueByStartup.get(id) || [],
        providerConnections: providersByStartup.get(id) || [],
        fraudSignals: fraudByStartup.get(id) || [],
        penaltyCount: penaltyByStartup.get(id) || 0,
        isDemoProfile: isDemoStartupUserId(demoUserIds.get(id)),
        verificationType: startupRow?.verification_type,
        hasProofUpload: !!startupRow?.proof_url,
      })
    );
    results.set(id, state);
  }

  return results;
}

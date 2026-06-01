import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { calculateTrustScore } from "@/lib/scoring";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
} from "@/lib/verification-state";
import { isDemoStartupUserId } from "@/lib/verification-data";

/**
 * Startup Overview API (/api/startup/[id]/overview)
 *
 * Owner-only: aggregates metadata, connections, revenue, and verification state
 * for the founder verification dashboard.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const startupId = Number(rawId);

  if (isNaN(startupId)) {
    return NextResponse.json({ error: "Invalid startup ID" }, { status: 400 });
  }

  const ownership = await verifyStartupOwnership(startupId);
  if (!ownership.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!ownership.owned && !ownership.isDemo) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const [startupRes, connectionsRes, revenueRes, fraudRes, txnRes] =
      await Promise.all([
        supabaseServer
          .from("startup_submissions")
          .select(
            "id, startup_name, trust_score, penalty_count, verification_type, proof_url, user_id"
          )
          .eq("id", startupId)
          .single(),
        supabaseServer
          .from("provider_connections")
          .select("provider, status, last_synced_at, latest_revenue")
          .eq("startup_id", startupId),
        supabaseServer
          .from("revenue_snapshots")
          .select("total_revenue, created_at")
          .eq("startup_id", startupId)
          .order("created_at", { ascending: true })
          .limit(30),
        supabaseServer
          .from("fraud_signals")
          .select("signal_type")
          .eq("startup_id", startupId),
        supabaseServer
          .from("revenue_transactions")
          .select("amount, created_at, provider")
          .eq("startup_id", startupId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

    if (startupRes.error || !startupRes.data) {
      return NextResponse.json({ error: "Startup not found" }, { status: 404 });
    }

    const revenue = (revenueRes.data || []).map((snap) => ({
      timestamp: new Date(snap.created_at).getTime(),
      amount: Number(snap.total_revenue) || 0,
    }));

    const fraudSignals = {
      rate_limit_violations: (fraudRes.data || []).filter(
        (f) => f.signal_type === "rate_limit"
      ).length,
      spike_events: (fraudRes.data || []).filter(
        (f) => f.signal_type === "revenue_spike"
      ).length,
      penalty_count: Number(startupRes.data?.penalty_count) || 0,
    };

    const trustScore = calculateTrustScore(revenue, fraudSignals);

    const verificationState = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: txnRes.data || [],
        providerConnections: (connectionsRes.data || []).map((row) => ({
          provider: row.provider,
          status: row.status,
          last_synced_at: row.last_synced_at,
          latest_revenue: row.latest_revenue,
        })),
        fraudSignals: fraudRes.data || [],
        penaltyCount: Number(startupRes.data.penalty_count) || 0,
        isDemoProfile: isDemoStartupUserId(startupRes.data.user_id),
        verificationType: startupRes.data.verification_type,
        hasProofUpload: !!startupRes.data.proof_url,
      })
    );

    const overview = {
      startup: {
        id: startupRes.data.id,
        name: startupRes.data.startup_name,
        trust_score: trustScore,
      },
      connections: (connectionsRes.data || []).map((row) => ({
        provider: row.provider,
        connected: row.status === "connected",
        last_sync: row.last_synced_at
          ? new Date(row.last_synced_at).getTime()
          : null,
        mrr: Number(row.latest_revenue) || 0,
      })),
      revenue,
      verification: {
        verification_confidence: verificationState.verificationConfidence,
        confidence_tier: verificationState.confidenceTier,
        data_source: verificationState.dataSourceLabel,
        verification_method: verificationState.verificationMethodLabel,
        last_sync_at: verificationState.lastSyncAt,
        has_verification_evidence: verificationState.hasVerificationEvidence,
      },
      authenticity: {
        level:
          verificationState.consistencyLevel === "Consistent"
            ? "Organic"
            : verificationState.consistencyLevel === "Moderate"
              ? "Moderate"
              : "Refining",
        consistency_score: verificationState.consistencyScore,
        flags: verificationState.consistencyFlags,
      },
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("[StartupOverview] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

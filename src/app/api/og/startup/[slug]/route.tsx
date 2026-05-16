import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase-server";
import { computeVerificationState } from "@/lib/verification-state";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // 1. Fetch startup basic info
    const { data: startup, error: startupError } = await supabaseServer
      .from("startup_submissions")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (startupError || !startup) {
      return new Response("Startup not found", { status: 404 });
    }

    const startupId = startup.id;

    // 2. Fetch related data for verification state
    const [revenueRes, fraudRes, providerRes] = await Promise.all([
      supabaseServer
        .from("revenue_transactions")
        .select("amount, created_at, provider")
        .eq("startup_id", startupId),
      supabaseServer
        .from("fraud_signals")
        .select("signal_type")
        .eq("startup_id", startupId),
      supabaseServer
        .from("provider_connections")
        .select("provider, status, last_synced_at, last_mrr")
        .eq("startup_id", startupId)
    ]);

    // 3. Compute the full verification state
    const state = computeVerificationState({
      revenueTransactions: (revenueRes.data || []).map(t => ({
        amount: t.amount,
        timestamp: new Date(t.created_at).getTime(),
      })),
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: 0, // Fallback
    });

    const mrr = Math.round(state.providerBreakdown.reduce((acc, p) => acc + p.amount, 0) || startup.mrr || 0);
    const trustScore = Math.round(state.trustScore);
    
    let trustTier = "Active Audit";
    let tierColor = "#94a3b8"; // slate-400
    if (trustScore > 85) {
      trustTier = "Forensic Grade";
      tierColor = "#10b981"; // emerald-500
    } else if (trustScore > 65) {
      trustTier = "High Integrity";
      tierColor = "#6366f1"; // indigo-500
    }

    const verificationLabel = state.verificationStatus.replace("_", " ");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            backgroundImage: "radial-gradient(circle at 50% 50%, #171717 0%, #0a0a0a 100%)",
            padding: "80px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {/* Border Glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)`,
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "40px",
              padding: "60px",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {/* Verifi Logo Top Right */}
            <div
              style={{
                position: "absolute",
                top: "40px",
                right: "40px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "#6366f1", display: "flex" }} />
              <span style={{ fontSize: "20px", fontWeight: "bold", color: "#fff", letterSpacing: "-0.5px" }}>Verifi</span>
            </div>

            {/* Content */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", flex: 1, justifyContent: "center" }}>
              {/* Startup Logo Placeholder */}
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "24px",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "40px",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {startup.startup_name?.[0] || "S"}
              </div>

              <h1
                style={{
                  fontSize: "64px",
                  fontWeight: "900",
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-2px",
                }}
              >
                {startup.startup_name}
              </h1>

              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "16px",
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: tierColor }} />
                  <span style={{ color: "#fff", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>
                    {trustTier}
                  </span>
                </div>
                
                <div
                  style={{
                    backgroundColor: state.verificationStatus === "VERIFIED" ? "rgba(16, 185, 129, 0.05)" : "rgba(245, 158, 11, 0.05)",
                    border: state.verificationStatus === "VERIFIED" ? "1px solid rgba(16, 185, 129, 0.1)" : "1px solid rgba(245, 158, 11, 0.1)",
                    borderRadius: "16px",
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: state.verificationStatus === "VERIFIED" ? "#10b981" : "#f59e0b", fontSize: "16px", fontWeight: "bold", textTransform: "uppercase" }}>
                    {verificationLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Footer */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: "auto",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                paddingTop: "30px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "#525252", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "2px" }}>
                  Verified Monthly Revenue
                </span>
                <span style={{ color: "#fff", fontSize: "48px", fontWeight: "900", letterSpacing: "-1px" }}>
                  ${mrr.toLocaleString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {state.providersConnected.map((pm: string) => (
                  <div
                    key={pm}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "6px 14px",
                      color: "#737373",
                      fontSize: "12px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                    }}
                  >
                    {pm}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    console.error("OG Generation Error:", e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}

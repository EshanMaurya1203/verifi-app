import { ImageResponse } from "next/og";
import { supabaseServer } from "@/lib/supabase-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
} from "@/lib/verification-state";
import { isDemoStartupUserId } from "@/lib/verification-data";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    let startupName = "";
    let isVerified = false;
    let tierColor = "";
    let trustTier = "";
    let mrr = 0;
    let providersConnected: string[] = [];

    if (slug === "default") {
      startupName = "Verifi Platform";
      isVerified = true;
      trustTier = "Payment Verified";
      tierColor = "#b9ff4b";
      mrr = 57428000; // ₹5.7 Cr collective verification volume
      providersConnected = ["stripe", "razorpay", "paddle"];
    } else {
      // 1. Fetch startup basic info
      const { data: startup, error: startupError } = await supabaseServer
        .from("startup_submissions")
        .select("id, startup_name, mrr, penalty_count, user_id, verification_type, proof_url")
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
          .select("provider, status, last_synced_at, latest_revenue")
          .eq("startup_id", startupId)
      ]);

      // 3. Compute the full verification state
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: revenueRes.data || [],
          providerConnections: providerRes.data || [],
          fraudSignals: fraudRes.data || [],
          penaltyCount: Number(startup.penalty_count) || 0,
          isDemoProfile: isDemoStartupUserId(startup.user_id),
          verificationType: startup.verification_type,
          hasProofUpload: !!startup.proof_url,
        })
      );

      mrr = Math.round(state.providerBreakdown.reduce((acc, p) => acc + p.amount, 0) || startup.mrr || 0);
      
      const tier = state.confidenceTier;
      isVerified = state.hasVerificationEvidence;

      trustTier = "Self Reported";
      tierColor = "#a1a1aa"; // slate-400 for high-contrast neutral

      if (tier === "REVENUE_VERIFIED") {
        trustTier = "Revenue Verified";
        tierColor = "#b9ff4b"; // Standard neon lime-green
      } else if (tier === "PAYMENT_CONNECTED") {
        trustTier = "Payment Connected";
        tierColor = "#f59e0b"; // amber-500
      }

      startupName = startup.startup_name;
      providersConnected = state.providersConnected;
    }

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
            backgroundColor: "#080808",
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(185, 255, 75, 0.06) 0%, #080808 100%)",
            padding: "80px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {/* Top Border Glow Accent */}
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
              backgroundColor: "rgba(15, 15, 15, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 20px 50px rgba(185, 255, 75, 0.03)",
              borderRadius: "32px",
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
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "#b9ff4b", display: "flex" }} />
              <span style={{ fontSize: "20px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px" }}>Verifi</span>
            </div>

            {/* Content Body */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", flex: 1, justifyContent: "center" }}>
              {/* Startup Logo/Icon Circular Frame */}
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "24px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "40px",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {startupName?.[0] || "S"}
              </div>

              <h1
                style={{
                  fontSize: "72px",
                  fontWeight: "900",
                  color: "#fff",
                  margin: 0,
                  letterSpacing: "-3px",
                }}
              >
                {startupName}
              </h1>

              {/* Robust high-trust verified badge pill */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                {isVerified ? (
                  <div
                    style={{
                      backgroundColor: "rgba(185, 255, 75, 0.1)",
                      border: "1px solid rgba(185, 255, 75, 0.3)",
                      borderRadius: "16px",
                      padding: "10px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#b9ff4b" }} />
                    <span style={{ color: "#b9ff4b", fontSize: "14px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px" }}>
                      API Verified
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "16px",
                      padding: "10px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#a1a1aa" }} />
                    <span style={{ color: "#a1a1aa", fontSize: "14px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Self Reported
                    </span>
                  </div>
                )}
                
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "16px",
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: tierColor, fontSize: "14px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {trustTier}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Footer Section */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginTop: "auto",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                paddingTop: "30px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "#a1a1aa", fontSize: "13px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "2px" }}>
                  Verified Monthly Revenue
                </span>
                <span style={{ color: "#b9ff4b", fontSize: "56px", fontWeight: "900", letterSpacing: "-1.5px" }}>
                  ₹{mrr.toLocaleString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {providersConnected.map((pm: string) => (
                  <div
                    key={pm}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "10px",
                      padding: "6px 14px",
                      color: "#e5e5e5",
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

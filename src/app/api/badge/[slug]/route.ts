import { supabaseServer } from "@/lib/supabase-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
} from "@/lib/verification-state";
import { isDemoStartupUserId } from "@/lib/verification-data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme") || "dark";

  // 1. Resolve Startup (match public profile lookup by slug)
  let query = supabaseServer.from("startup_submissions").select("*");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    query = query.eq("slug", slug);
  }

  const { data: startup } = await query.maybeSingle();

  if (!startup) {
    return new Response("Not Found", { status: 404 });
  }

  // 2. Fetch verification data to get current status
  const [revenueRes, fraudRes, providerRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startup.id)
      .limit(100),
    supabaseServer
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startup.id),
    supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at")
      .eq("startup_id", startup.id)
      .eq("status", "connected")
  ]);

  const verificationState = computeVerificationState(
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

  // 3. Determine colors and labels
  const isDark = theme === "dark";
  const bgColor = isDark ? "#09090b" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(9,9,11,0.06)";
  const textColor = isDark ? "#ffffff" : "#09090b";
  const subTextColor = isDark ? "#71717a" : "#71717a";
  
  let tierLabel = "Self Reported";
  let tierColor = "#71717a"; // Neutral-500
  const tier = verificationState.confidenceTier;
  if (tier === "REVENUE_VERIFIED") {
    tierLabel = "Revenue Verified";
    tierColor = "#b9ff4b";
  } else if (tier === "PAYMENT_CONNECTED") {
    tierLabel = "Payment Connected";
    tierColor = "#f59e0b"; // Amber
  }

  // Prevent overlap for long names: truncate rawName if > 15 chars, and dynamically adjust font size
  const rawName = startup.startup_name;
  const startupName = rawName.length > 15 ? rawName.substring(0, 14) + "..." : rawName;
  const nameFontSize = startupName.length > 12 ? "11" : "13";

  // 4. Generate SVG
  const svg = `
    <svg width="300" height="80" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="80" rx="16" fill="${bgColor}"/>
      <rect x="0.5" y="0.5" width="299" height="79" rx="15.5" stroke="${borderColor}"/>
      
      <!-- Verifi Icon (centered & premium checkmark) -->
      <rect x="18" y="18" width="44" height="44" rx="11" fill="#b9ff4b"/>
      <path d="M28 40 L34 46 L45 32" stroke="#080808" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      
      <!-- Content -->
      <text x="72" y="34" font-family="Inter, sans-serif" font-size="${nameFontSize}" font-weight="800" fill="${textColor}" style="text-transform: uppercase; letter-spacing: 0.05em;">${startupName}</text>
      <text x="72" y="50" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${subTextColor}" style="text-transform: uppercase; letter-spacing: 0.05em;">Verified on Verifi</text>
      
      <!-- Tier Badge (perfectly aligned with no text overflow) -->
      <rect x="174" y="30" width="110" height="20" rx="10" fill="${tierColor}15"/>
      <text x="229" y="43.5" font-family="Inter, sans-serif" font-size="10" font-weight="800" fill="${tierColor}" text-anchor="middle" style="text-transform: uppercase; letter-spacing: 0.05em;">${tierLabel}</text>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

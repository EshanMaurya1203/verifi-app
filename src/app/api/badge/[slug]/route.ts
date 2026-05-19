import { supabaseServer } from "@/lib/supabase-server";
import { computeVerificationState } from "@/lib/verification-state";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme") || "dark";

  // 1. Resolve Startup
  let query = supabaseServer.from("startup_submissions").select("*");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    // Check both slug and startup_name for maximum compatibility
    query = query.or(`slug.eq.${slug},startup_name.ilike.${slug}`);
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

  const revenue = (revenueRes.data || []).map(event => ({
    timestamp: new Date(event.created_at).getTime(),
    amount: Number(event.amount) || 0
  }));

  const verificationState = computeVerificationState({
    revenueTransactions: revenue,
    providerConnections: providerRes.data || [],
    fraudSignals: fraudRes.data || [],
    penaltyCount: Number(startup.penalty_count) || 0
  });

  // 3. Determine colors and labels
  const isDark = theme === "dark";
  const bgColor = isDark ? "#09090b" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(9,9,11,0.06)";
  const textColor = isDark ? "#ffffff" : "#09090b";
  const subTextColor = isDark ? "#71717a" : "#71717a";
  
  let tierLabel = "Self Reported";
  let tierColor = "#71717a"; // Neutral-500
  const tier = verificationState.confidenceTier;
  if (tier === "HIGH_CONFIDENCE") {
    tierLabel = "Payment Verified";
    tierColor = "#10b981"; // Emerald
  } else if (tier === "REVENUE_VERIFIED") {
    tierLabel = "Revenue Verified";
    tierColor = "#6366f1"; // Indigo
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
      <rect x="18" y="18" width="44" height="44" rx="11" fill="#6366f1"/>
      <path d="M28 40 L34 46 L45 32" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      
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

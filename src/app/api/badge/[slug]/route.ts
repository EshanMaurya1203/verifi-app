import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { computeVerificationState } from "@/lib/verification-state";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("theme") || "dark";

  // 1. Resolve Startup
  let query = supabaseAdmin.from("startup_submissions").select("*");
  if (!isNaN(Number(slug))) {
    query = query.eq("id", Number(slug));
  } else {
    query = query.ilike("startup_name", slug);
  }
  
  const { data: startup } = await query.maybeSingle();

  if (!startup) {
    return new Response("Not Found", { status: 404 });
  }

  // 2. Fetch verification data to get current status
  const [revenueRes, fraudRes, providerRes] = await Promise.all([
    supabaseAdmin
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startup.id)
      .limit(100),
    supabaseAdmin
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startup.id),
    supabaseAdmin
      .from("provider_connections")
      .select("provider, status")
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
  const bgColor = isDark ? "#0a0a0a" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const textColor = isDark ? "#ffffff" : "#0a0a0a";
  const subTextColor = isDark ? "#737373" : "#525252";
  
  let tierLabel = "Active Audit";
  let tierColor = "#f59e0b"; // Amber
  if (verificationState.trustScore > 85) {
    tierLabel = "Forensic Grade";
    tierColor = "#10b981"; // Emerald
  } else if (verificationState.trustScore > 65) {
    tierLabel = "High Integrity";
    tierColor = "#6366f1"; // Indigo
  } else if (verificationState.verificationStatus === "UNVERIFIED") {
    tierLabel = "Unverified";
    tierColor = "#ef4444"; // Red
  }

  // 4. Generate SVG
  const svg = `
    <svg width="300" height="80" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="80" rx="16" fill="${bgColor}"/>
      <rect x="0.5" y="0.5" width="299" height="79" rx="15.5" stroke="${borderColor}"/>
      
      <!-- Verifi Icon -->
      <rect x="20" y="20" width="40" height="40" rx="8" fill="#6366f1"/>
      <path d="M34 50L31.5 47.5L32.5 46.5L34 48L37.5 44.5L38.5 45.5L34 50Z" fill="white"/>
      <path d="M40 32V35C40 37.7614 37.7614 40 35 40H32C29.2386 40 27 37.7614 27 35V32C27 29.2386 29.2386 27 32 27H35C37.7614 27 40 29.2386 40 32Z" stroke="white" stroke-width="1.5"/>
      
      <!-- Content -->
      <text x="75" y="32" font-family="Inter, sans-serif" font-size="14" font-weight="900" fill="${textColor}" style="text-transform: uppercase; letter-spacing: 0.05em;">${startup.startup_name}</text>
      <text x="75" y="52" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="${subTextColor}" style="text-transform: uppercase; letter-spacing: 0.1em;">Verified on Verifi</text>
      
      <!-- Tier Badge -->
      <rect x="180" y="30" width="100" height="20" rx="10" fill="${tierColor}20"/>
      <text x="230" y="44" font-family="Inter, sans-serif" font-size="8" font-weight="900" fill="${tierColor}" text-anchor="middle" style="text-transform: uppercase; letter-spacing: 0.1em;">${tierLabel}</text>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

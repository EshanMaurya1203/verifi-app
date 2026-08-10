import { supabaseServer } from "@/lib/supabase-server";
import { canStartupBePublic } from "@/lib/visibility";
import { isDemoStartupUserId } from "@/lib/verification-data";
import { formatCurrency, formatGrowth } from "@/lib/formatters";
import type { LeaderboardItem, StartupCard } from "@/components/home/StartupDataProvider";

export interface HomepageInitialData {
  leaderboard: LeaderboardItem[];
  recentlyListedData: StartupCard[];
  trendingData: StartupCard[];
  verifiedStartupCount: number;
  verifiedRevenueTotal: number;
}

export async function getHomepageInitialData(): Promise<HomepageInitialData | null> {
  try {
    const [submissionsRes, startupsRes] = await Promise.all([
      supabaseServer
        .from("startup_submissions")
        .select("id, slug, startup_name, name, biz_type, mrr, arr, growth, payment_connected, trust_score, notes, created_at, user_id, verification_status")
        .eq("is_public", true)
        .order("trust_score", { ascending: false }),
      supabaseServer
        .from("startup_submissions")
        .select("id, user_id, is_public, payment_connected, verification_status")
        .eq("is_public", true)
        .eq("payment_connected", true)
    ]);

    if (submissionsRes.error || !submissionsRes.data) {
      return null;
    }

    const list = submissionsRes.data;

    // Top 5 startups for main leaderboard
    const top5: LeaderboardItem[] = list
      .slice()
      .sort((a, b) => (Number(b.mrr) || 0) - (Number(a.mrr) || 0))
      .slice(0, 5)
      .map((s, idx) => ({
        rank: idx + 1,
        slug: s.slug || String(s.id),
        name: s.startup_name,
        founder: s.name || "Anonymous",
        mrr: formatCurrency(Number(s.mrr) || 0, "INR", { compact: true }),
        trust_score: Number(s.trust_score) || 0,
      }));

    // Recently listed
    const recent: StartupCard[] = list
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4)
      .map((s) => ({
        initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
        name: s.startup_name,
        slug: s.slug || String(s.id),
        category: s.biz_type,
        description: s.notes || "No description provided.",
        mrr: formatCurrency(Number(s.mrr) || 0, "INR", { compact: true }),
        growth: s.growth ? formatGrowth(Number(s.growth), 2) : "Stable",
        badge: s.payment_connected ? "Payment Connected" : "Self Reported",
      }));

    // Trending
    const trending: StartupCard[] = list
      .slice()
      .filter((s) => s.growth !== undefined && s.growth !== null && Number(s.growth) > 0)
      .sort((a, b) => (Number(b.growth) || 0) - (Number(a.growth) || 0))
      .slice(0, 3)
      .map((s) => ({
        initials: s.startup_name ? s.startup_name.substring(0, 2).toUpperCase() : "ST",
        name: s.startup_name,
        slug: s.slug || String(s.id),
        category: s.biz_type,
        description: s.notes || "No description provided.",
        mrr: formatCurrency(Number(s.mrr) || 0, "INR", { compact: true }),
        growth: s.growth ? formatGrowth(Number(s.growth), 2) + " MoM" : "",
        badge: "Trending",
      }));

    // Compute trust metrics
    const eligibleStartups = (startupsRes.data || []).filter((sub) => {
      if (sub.is_public !== true) return false;
      if (sub.payment_connected !== true) return false;
      if (!canStartupBePublic(sub).eligible) return false;
      if (isDemoStartupUserId(sub.user_id)) return false;
      if (sub.verification_status === "flagged") return false;
      return true;
    });

    const verifiedStartupCount = eligibleStartups.length;
    let verifiedRevenueTotal = 0;

    if (eligibleStartups.length > 0) {
      const eligibleIds = eligibleStartups.map((s) => s.id);
      const { data: snapshots } = await supabaseServer
        .from("revenue_snapshots")
        .select("startup_id, total_revenue, created_at")
        .in("startup_id", eligibleIds)
        .eq("provider", "combined")
        .order("created_at", { ascending: false });

      if (snapshots) {
        const latestSnapshotPerStartup = new Map<string | number, number>();
        for (const snap of snapshots) {
          if (!latestSnapshotPerStartup.has(snap.startup_id)) {
            latestSnapshotPerStartup.set(snap.startup_id, Number(snap.total_revenue) || 0);
          }
        }
        for (const revenue of latestSnapshotPerStartup.values()) {
          verifiedRevenueTotal += revenue;
        }
      }
    }

    return {
      leaderboard: top5,
      recentlyListedData: recent,
      trendingData: trending,
      verifiedStartupCount,
      verifiedRevenueTotal,
    };
  } catch (err) {
    console.error("[HomepageData] Error fetching initial data:", err);
    return null;
  }
}

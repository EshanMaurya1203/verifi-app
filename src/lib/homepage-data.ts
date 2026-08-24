import { supabaseServer } from "@/lib/supabase-server";
import {
  computeVerificationStatesForStartups,
  isDemoStartupUserId,
} from "@/lib/verification-data";
import { getStartupMetrics } from "@/lib/revenue-aggregation";
import { formatCurrency, formatGrowth } from "@/lib/formatters";
import type { LeaderboardItem, StartupCard } from "@/components/home/StartupDataProvider";

export interface HomepageInitialData {
  leaderboard: LeaderboardItem[];
  recentlyListedData: StartupCard[];
  trendingData: StartupCard[];
  verifiedStartupCount: number;
  verifiedRevenueTotal: number;
}

/**
 * Fetches homepage data using the same authoritative verification engine
 * as the real leaderboard (src/app/leaderboard/page.tsx).
 *
 * A startup appears on public homepage projections ONLY when:
 *   - is_public = true
 *   - payment_connected = true
 *   - verification_status != "flagged"
 *   - NOT a demo startup
 *   - hasVerificationEvidence === true (from computeVerificationStatesForStartups)
 *
 * Revenue comes from authoritative provider-backed sources, never from
 * founder-entered startup_submissions.mrr.
 */
export async function getHomepageInitialData(): Promise<HomepageInitialData | null> {
  try {
    // ── Step A: Fetch candidate public submissions with DB-level boundaries ──
    const { data: candidates, error: candidateError } = await supabaseServer
      .from("startup_submissions")
      .select(
        "id, slug, startup_name, name, biz_type, growth, payment_connected, trust_score, notes, created_at, user_id, verification_status"
      )
      .eq("is_public", true)
      .eq("payment_connected", true);

    if (candidateError || !candidates) {
      console.error("[HomepageData] Error fetching candidates:", candidateError);
      return null;
    }

    // ── Step B: Exclude demo and flagged startups ──
    const nonDemoCandidates = candidates.filter(
      (s) => s.verification_status !== "flagged" && !isDemoStartupUserId(s.user_id)
    );

    if (nonDemoCandidates.length === 0) {
      return {
        leaderboard: [],
        recentlyListedData: [],
        trendingData: [],
        verifiedStartupCount: 0,
        verifiedRevenueTotal: 0,
      };
    }

    // ── Step C: Pass through the authoritative verification engine ──
    // This is the SAME function used by the real leaderboard page.
    const startupIds = nonDemoCandidates
      .map((s) => Number(s.id))
      .filter(Number.isFinite);
    const demoUserIds = new Map<number, string | null>();

    const verificationByStartup = await computeVerificationStatesForStartups(
      startupIds,
      demoUserIds
    );

    // ── Step D: Keep ONLY startups with authoritative verification evidence ──
    const verifiedCandidates = nonDemoCandidates.filter((sub) => {
      const vState = verificationByStartup.get(Number(sub.id));
      return vState?.hasVerificationEvidence === true;
    });

    if (verifiedCandidates.length === 0) {
      return {
        leaderboard: [],
        recentlyListedData: [],
        trendingData: [],
        verifiedStartupCount: 0,
        verifiedRevenueTotal: 0,
      };
    }

    // ── Step E: Attach authoritative verified revenue to each candidate ──
    // Uses the SAME revenue calculation as the real leaderboard:
    //   providerBreakdown.reduce(...) || getStartupMetrics(id).mrr
    const candidatesWithRevenue = await Promise.all(
      verifiedCandidates.map(async (row) => {
        const vState = verificationByStartup.get(Number(row.id));

        // Primary: provider-backed revenue from verification engine
        let verifiedRevenue = vState?.providerBreakdown.reduce(
          (sum, p) => sum + p.amount,
          0
        ) || 0;

        // Fallback: authoritative snapshot-based metrics (same as leaderboard)
        if (verifiedRevenue === 0) {
          try {
            const metrics = await getStartupMetrics(row.id);
            verifiedRevenue = Number(metrics?.mrr || 0);
          } catch (e) {
            console.error("[HomepageData] Metrics failed for startup:", row.id, e);
          }
        }

        // Growth from authoritative metrics
        let authoritativeGrowth = 0;
        try {
          const metrics = await getStartupMetrics(row.id);
          authoritativeGrowth = metrics?.growthPercentage || 0;
        } catch {
          // Growth stays 0 on failure
        }

        return {
          ...row,
          verifiedRevenue,
          authoritativeGrowth,
        };
      })
    );

    // ── Step F: Build Leaderboard Preview ──
    // Sorted by authoritative verified revenue descending, growth as tiebreaker
    const leaderboard: LeaderboardItem[] = candidatesWithRevenue
      .slice()
      .sort((a, b) => {
        if (a.verifiedRevenue !== b.verifiedRevenue)
          return b.verifiedRevenue - a.verifiedRevenue;
        return b.authoritativeGrowth - a.authoritativeGrowth;
      })
      .slice(0, 5)
      .map((s, idx) => ({
        rank: idx + 1,
        slug: s.slug || String(s.id),
        name: s.startup_name,
        founder: s.name || "Anonymous",
        mrr: formatCurrency(s.verifiedRevenue, "INR", { compact: true }),
        trust_score: Number(s.trust_score) || 0,
      }));

    // ── Step G: Build Recently Verified ──
    // Only verified startups, ordered by created_at descending
    const recentlyListedData: StartupCard[] = candidatesWithRevenue
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 4)
      .map((s) => ({
        initials: s.startup_name
          ? s.startup_name.substring(0, 2).toUpperCase()
          : "ST",
        name: s.startup_name,
        slug: s.slug || String(s.id),
        category: s.biz_type,
        description: s.notes || "No description provided.",
        mrr: formatCurrency(s.verifiedRevenue, "INR", { compact: true }),
        growth: s.authoritativeGrowth
          ? formatGrowth(s.authoritativeGrowth, 2)
          : "Stable",
        badge: "Verified",
      }));

    // ── Step H: Build Trending ──
    // Only verified startups with positive authoritative growth
    const trendingData: StartupCard[] = candidatesWithRevenue
      .slice()
      .filter((s) => s.authoritativeGrowth > 0)
      .sort((a, b) => b.authoritativeGrowth - a.authoritativeGrowth)
      .slice(0, 3)
      .map((s) => ({
        initials: s.startup_name
          ? s.startup_name.substring(0, 2).toUpperCase()
          : "ST",
        name: s.startup_name,
        slug: s.slug || String(s.id),
        category: s.biz_type,
        description: s.notes || "No description provided.",
        mrr: formatCurrency(s.verifiedRevenue, "INR", { compact: true }),
        growth: formatGrowth(s.authoritativeGrowth, 2) + " MoM",
        badge: "Trending",
      }));

    // ── Step I: Trust Metrics ──
    // Consistent with the verified candidate set above
    const verifiedStartupCount = candidatesWithRevenue.length;
    const verifiedRevenueTotal = candidatesWithRevenue.reduce(
      (sum, s) => sum + s.verifiedRevenue,
      0
    );

    return {
      leaderboard,
      recentlyListedData,
      trendingData,
      verifiedStartupCount,
      verifiedRevenueTotal,
    };
  } catch (err) {
    console.error("[HomepageData] Error fetching initial data:", err);
    return null;
  }
}

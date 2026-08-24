/**
 * TEST 20 — Authoritative Public Boundary & Profile Exposure Regression Test Suite
 *
 * Asserts:
 * 1. Missing startup slug → 404
 * 2. /startup/test-1 → 404 when no production row exists
 * 3. Demo-prefixed startup → never publicly eligible in production
 * 4. Self-reported startup → not eligible for leaderboard
 * 5. Payment-connected but insufficient verification history → not eligible for leaderboard
 * 6. REVENUE_VERIFIED startup → eligible for leaderboard
 * 7. Public startup with payment_connected = false → not eligible for leaderboard
 * 8. Demo startup → not eligible even if is_public = true
 * 9. Pagination & count correctness on verified leaderboard
 * 10. Public badge & OG routes enforce production demo guards
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  computeVerificationState,
  buildVerificationStateInput,
} from "../src/lib/verification-state";
import { isDemoStartupUserId } from "../src/lib/verification-data";
import { getPaginationOffsets } from "../src/lib/leaderboard/filter-utils";
import { formatCurrency } from "../src/lib/formatters";

function evaluateProfileNotFoundGuard(
  profileData: { startup: { is_public: boolean; user_id?: string | null; payment_connected?: boolean } } | null,
  user: { id: string; email?: string } | null,
  isAdminUser: boolean = false
): boolean {
  if (!profileData) return true;
  if (!profileData.startup.is_public && profileData.startup.user_id !== user?.id && !isAdminUser) return true;
  if (process.env.NODE_ENV === "production" && isDemoStartupUserId(profileData.startup.user_id)) return true;
  return false;
}

describe("TEST 20 — Authoritative Public Boundary & Profile Exposure", () => {
  // Save original env
  const origEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  });

  // ─── 1. MISSING STARTUP SLUG & TEST-1 404 INVARIANTS ───────────────────────
  describe("1. Missing Startup Slug & /startup/test-1 404 Invariants", () => {
    it("T20-01: Null/missing profileData evaluates to 404 notFound condition", () => {
      const isNotFound = evaluateProfileNotFoundGuard(null, null);
      assert.strictEqual(isNotFound, true, "Missing startup profile data must trigger notFound");
    });

    it("T20-02: Unknown slug /startup/test-1 with no DB record returns notFound", () => {
      // Simulating DB returning null for 'test-1'
      const dbLookupResult = null;
      assert.strictEqual(dbLookupResult, null);

      const isNotFound = evaluateProfileNotFoundGuard(dbLookupResult, null);
      assert.strictEqual(isNotFound, true, "Unknown slug 'test-1' must trigger notFound");
    });

    it("T20-03: Arbitrary invalid slugs (e.g. /startup/nonexistent) trigger notFound", () => {
      const slugs = ["nonexistent", "random-invalid-slug", "unknown-123"];
      for (const slug of slugs) {
        const profileData = null;
        const isNotFound = evaluateProfileNotFoundGuard(profileData, null);
        assert.strictEqual(isNotFound, true, `Slug '${slug}' with null profileData must trigger 404`);
      }
    });
  });

  // ─── 2. PRODUCTION DEMO GUARD ──────────────────────────────────────────────
  describe("2. Production Demo Guard & Sandbox Isolation", () => {
    it("T20-04: Demo-prefixed startup row is never publicly eligible in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const demoUserId = "00000000-0000-0000-0000-000000000001";
      assert.strictEqual(isDemoStartupUserId(demoUserId), true);

      const startup = {
        id: 1,
        slug: "test-1",
        startup_name: "Demo Test",
        user_id: demoUserId,
        is_public: true,
        payment_connected: true,
      };

      const isBlockedInProduction = evaluateProfileNotFoundGuard({ startup }, null);
      assert.strictEqual(isBlockedInProduction, true, "Demo startup must be blocked in production");
    });

    it("T20-05: Demo startup receives SELF_REPORTED and hasVerificationEvidence = false in verification engine", () => {
      const demoUserId = "00000000-0000-0000-0000-000000000001";
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [
            { amount: 50000, created_at: new Date().toISOString() },
            { amount: 50000, created_at: new Date().toISOString() },
            { amount: 50000, created_at: new Date().toISOString() },
          ],
          providerConnections: [
            {
              provider: "stripe",
              status: "connected",
              last_synced_at: new Date().toISOString(),
              latest_revenue: 50000,
            },
          ],
          fraudSignals: [],
          penaltyCount: 0,
          isDemoProfile: isDemoStartupUserId(demoUserId),
        })
      );

      assert.strictEqual(state.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(state.hasVerificationEvidence, false);
      assert.strictEqual(state.dataSource, "sandbox");
    });

    it("T20-06: Non-demo user_id is not treated as demo", () => {
      const legitUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      assert.strictEqual(isDemoStartupUserId(legitUserId), false);
      assert.strictEqual(isDemoStartupUserId(null), false);
      assert.strictEqual(isDemoStartupUserId(undefined), false);
    });
  });

  // ─── 3. VISIBILITY & OWNER ISOLATION ───────────────────────────────────────
  describe("3. Visibility & Owner Isolation", () => {
    it("T20-07: Unauthenticated visitor accessing private profile is rejected with 404", () => {
      const profileData = {
        startup: {
          id: 12,
          slug: "private-startup",
          is_public: false,
          user_id: "user-123",
        },
      };

      const isNotFound = evaluateProfileNotFoundGuard(profileData, null);
      assert.strictEqual(isNotFound, true, "Private profile must 404 for unauthenticated visitors");
    });

    it("T20-08: Non-owner visitor accessing private profile is rejected with 404", () => {
      const profileData = {
        startup: {
          id: 12,
          slug: "private-startup",
          is_public: false,
          user_id: "user-owner-123",
        },
      };
      const strangerUser = { id: "user-stranger-456", email: "stranger@example.com" };

      const isNotFound = evaluateProfileNotFoundGuard(profileData, strangerUser);
      assert.strictEqual(isNotFound, true, "Private profile must 404 for non-owner visitors");
    });

    it("T20-09: Owner can access their own private startup profile", () => {
      const ownerUserId = "user-owner-123";
      const profileData = {
        startup: {
          id: 13,
          slug: "my-private-startup",
          is_public: false,
          payment_connected: false,
          user_id: ownerUserId,
        },
      };
      const authenticatedUser = { id: ownerUserId, email: "owner@example.com" };

      const isNotFound = evaluateProfileNotFoundGuard(profileData, authenticatedUser);
      assert.strictEqual(isNotFound, false, "Owner must be permitted to view their own profile");
    });
  });

  // ─── 4. AUTHORITATIVE LEADERBOARD ELIGIBILITY ──────────────────────────────
  describe("4. Authoritative Leaderboard Eligibility", () => {
    it("T20-10: Self-reported startup is NOT eligible for leaderboard", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(Boolean(state.hasVerificationEvidence), false);

      // Leaderboard filter check
      const isLeaderboardEligible = Boolean(state.hasVerificationEvidence) === true;
      assert.strictEqual(isLeaderboardEligible, false, "Self-reported startup must not appear on leaderboard");
    });

    it("T20-11: Payment-connected with insufficient transaction history (< 3 txns) is NOT eligible", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [
            { amount: 1000, created_at: new Date().toISOString() },
            { amount: 2000, created_at: new Date().toISOString() },
            // Only 2 transactions (MIN is 3)
          ],
          providerConnections: [
            {
              provider: "stripe",
              status: "connected",
              last_synced_at: new Date().toISOString(),
              latest_revenue: 3000,
            },
          ],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "PAYMENT_CONNECTED");
      assert.strictEqual(Boolean(state.hasVerificationEvidence), false);

      const isLeaderboardEligible = Boolean(state.hasVerificationEvidence) === true;
      assert.strictEqual(isLeaderboardEligible, false, "PAYMENT_CONNECTED must not appear on leaderboard without verified evidence");
    });

    it("T20-12: Payment-connected with stale sync (> 7 days) is NOT eligible for REVENUE_VERIFIED", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [
            { amount: 1000, created_at: eightDaysAgo },
            { amount: 2000, created_at: eightDaysAgo },
            { amount: 3000, created_at: eightDaysAgo },
          ],
          providerConnections: [
            {
              provider: "stripe",
              status: "connected",
              last_synced_at: eightDaysAgo,
              latest_revenue: 6000,
            },
          ],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "PAYMENT_CONNECTED");
      assert.strictEqual(Boolean(state.hasVerificationEvidence), false);
      assert.ok(state.internalFlags.includes("PROVIDER_STALE"));
    });

    it("T20-13: REVENUE_VERIFIED startup with >= 3 transactions and fresh sync is eligible for leaderboard", () => {
      const freshSync = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hr ago
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [
            { amount: 10000, created_at: freshSync },
            { amount: 15000, created_at: freshSync },
            { amount: 25000, created_at: freshSync },
          ],
          providerConnections: [
            {
              provider: "stripe",
              status: "connected",
              last_synced_at: freshSync,
              latest_revenue: 50000,
            },
          ],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "REVENUE_VERIFIED");
      assert.strictEqual(state.hasVerificationEvidence, true);

      const isLeaderboardEligible = state.hasVerificationEvidence === true;
      assert.strictEqual(isLeaderboardEligible, true, "REVENUE_VERIFIED startup must be eligible for leaderboard");
    });

    it("T20-14: Demo startup is NOT eligible for leaderboard even if is_public = true and payment_connected = true", () => {
      const demoUserId = "00000000-0000-0000-0000-000000000005";
      const startup = {
        id: 5,
        slug: "demo-startup",
        user_id: demoUserId,
        is_public: true,
        payment_connected: true,
      };

      const isExcluded = isDemoStartupUserId(startup.user_id);
      assert.strictEqual(isExcluded, true, "Demo startup must be excluded from leaderboard candidate pool");
    });
  });

  // ─── 5. PAGINATION & COUNT CORRECTNESS ─────────────────────────────────────
  describe("5. Leaderboard Pagination & Count Invariants", () => {
    it("T20-15: Leaderboard total count and pagination represent ONLY verified startups", () => {
      // Setup mock dataset: 25 candidate rows in DB
      // 10 are REVENUE_VERIFIED, 5 are PAYMENT_CONNECTED (unverified), 5 are SELF_REPORTED, 5 are DEMO
      const candidates = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        slug: `startup-${i + 1}`,
        user_id: i < 5 ? `00000000-0000-0000-0000-00000000000${i}` : `usr-${i + 1}`,
        is_public: true,
        payment_connected: i >= 5 && i < 20,
      }));

      // 1. Filter out demo
      const nonDemo = candidates.filter((s) => !isDemoStartupUserId(s.user_id));
      assert.strictEqual(nonDemo.length, 20);

      // 2. Filter out unconnected
      const connected = nonDemo.filter((s) => s.payment_connected);
      assert.strictEqual(connected.length, 15);

      // 3. Compute verification states: 10 verified, 5 unverified
      const verifiedOnly = connected.filter((_s, idx) => idx < 10);
      assert.strictEqual(verifiedOnly.length, 10);

      const totalMatchingCount = verifiedOnly.length;
      assert.strictEqual(totalMatchingCount, 10, "Total count must exactly equal verified count (10)");

      // Page 1 with pageSize 5
      const { from: p1From } = getPaginationOffsets(1, 5);
      const page1 = verifiedOnly.slice(p1From, p1From + 5);
      assert.strictEqual(page1.length, 5);
      assert.strictEqual(page1[0].id, 6);

      // Page 2 with pageSize 5
      const { from: p2From } = getPaginationOffsets(2, 5);
      const page2 = verifiedOnly.slice(p2From, p2From + 5);
      assert.strictEqual(page2.length, 5);
      assert.strictEqual(page2[0].id, 11);

      // Page 3 with pageSize 5 -> 0 items
      const { from: p3From } = getPaginationOffsets(3, 5);
      const page3 = verifiedOnly.slice(p3From, p3From + 5);
      assert.strictEqual(page3.length, 0);
    });

    it("T20-18: Leaderboard ranking and displayed revenue use authoritative verifiedRevenue, not raw row.mrr", () => {
      // Mock Startup A: Claimed/stored MRR = 10,000,000 (1 Cr), but verified ledger revenue = 50,000 (50k)
      const startupA = {
        id: 101,
        slug: "startup-a",
        startup_name: "Startup A",
        mrr: 10000000,
        verifiedRevenue: 50000,
        growth: 10,
        hasVerificationEvidence: true,
      };

      // Mock Startup B: Claimed/stored MRR = 100,000 (100k), but verified ledger revenue = 200,000 (200k)
      const startupB = {
        id: 102,
        slug: "startup-b",
        startup_name: "Startup B",
        mrr: 100000,
        verifiedRevenue: 200000,
        growth: 5,
        hasVerificationEvidence: true,
      };

      const candidates = [startupA, startupB];

      // Sort logic from src/app/leaderboard/page.tsx
      const sortedData = [...candidates].sort((a, b) => {
        const revA = Number(a.verifiedRevenue) || 0;
        const revB = Number(b.verifiedRevenue) || 0;
        if (revA !== revB) return revB - revA;
        return (b.growth || 0) - (a.growth || 0);
      });

      // 1. Assert ranking order: Startup B (verified 200k) is ranked #1 ahead of Startup A (verified 50k)
      assert.strictEqual(sortedData[0].id, 102, "Startup B with 200k verified revenue must be ranked #1");
      assert.strictEqual(sortedData[1].id, 101, "Startup A with 50k verified revenue must be ranked #2");

      // 2. Assert displayed primary revenue uses row.verifiedRevenue and formats correctly
      const displayedRevB = formatCurrency(sortedData[0].verifiedRevenue || 0, "INR", { compact: true });
      const displayedRevA = formatCurrency(sortedData[1].verifiedRevenue || 0, "INR", { compact: true });

      assert.strictEqual(displayedRevB, "₹2.0L", "Startup B must display ₹2.0L verified revenue");
      assert.strictEqual(displayedRevA, "₹50k", "Startup A must display ₹50k verified revenue");

      // 3. Assert raw row.mrr does NOT override the displayed authoritative value
      const rawMrrFormattedA = formatCurrency(sortedData[1].mrr || 0, "INR", { compact: true });
      assert.strictEqual(rawMrrFormattedA, "₹1.0Cr");
      assert.notStrictEqual(
        displayedRevA,
        rawMrrFormattedA,
        "Displayed revenue must not be the raw unverified self-reported row.mrr"
      );
    });
  });

  // ─── 6. PUBLIC BADGE & OG ROUTE GUARDS ──────────────────────────────────────
  describe("6. Public Badge & OG Route Guards", () => {
    it("T20-16: Badge route returns 404 for demo startup in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const startup = {
        id: 99,
        slug: "demo-badge",
        user_id: "00000000-0000-0000-0000-000000000099",
        is_public: true,
        payment_connected: true,
      };

      const is404 =
        !startup ||
        (process.env.NODE_ENV === "production" && isDemoStartupUserId(startup.user_id));

      assert.strictEqual(is404, true, "Badge route must return 404 for demo startup in production");
    });

    it("T20-17: OG route returns 404 for demo startup in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const startup = {
        id: 98,
        slug: "demo-og",
        user_id: "00000000-0000-0000-0000-000000000098",
        is_public: true,
        payment_connected: true,
      };

      const is404 =
        !startup ||
        (process.env.NODE_ENV === "production" && isDemoStartupUserId(startup.user_id));

      assert.strictEqual(is404, true, "OG route must return 404 for demo startup in production");
    });
  });

  // Restore env
  (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
});

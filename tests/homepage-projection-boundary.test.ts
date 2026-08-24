/**
 * Homepage Projection Boundary Tests
 *
 * Directly exercises the REAL production function:
 *   getHomepageInitialData() from "@/lib/homepage-data"
 *
 * Mocks only external database/provider dependencies (Supabase, verification
 * engine, and snapshot metrics) to ensure 100% deterministic local execution
 * without real API keys or network traffic.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ─── Module Interception Setup ──────────────────────────────────────────────

interface MockSubmissionRow {
  id: number;
  slug: string;
  startup_name: string;
  name: string;
  biz_type: string;
  growth: number | null;
  payment_connected: boolean;
  trust_score: number;
  notes: string | null;
  created_at: string;
  user_id: string;
  verification_status: string | null;
  is_public: boolean;
  mrr?: number; // Optional: to prove production code does not depend on stored mrr
}

let inMemorySubmissions: MockSubmissionRow[] = [];
const inMemoryVerificationMap = new Map<number, unknown>();
const inMemoryMetricsMap = new Map<number, { mrr: number; arr: number; growthPercentage: number }>();

// 1. Mock Supabase Server
const supabaseServerPath = require.resolve("../src/lib/supabase-server");
const mockSupabaseServer = {
  from: (table: string) => {
    const filters: Array<{ column: string; value: any; op: string }> = [];
    const chain: any = {
      select: () => chain,
      eq: (column: string, value: any) => {
        filters.push({ column, value, op: "eq" });
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      then: (resolve: (val: any) => void) => {
        let dataSet: any[] = [];
        if (table === "startup_submissions") {
          dataSet = [...inMemorySubmissions];
        }
        for (const f of filters) {
          if (f.op === "eq") {
            dataSet = dataSet.filter((item) => item[f.column] === f.value);
          }
        }
        return resolve({ data: dataSet, error: null });
      },
    };
    return chain;
  },
};

require.cache[supabaseServerPath] = {
  id: supabaseServerPath,
  filename: supabaseServerPath,
  loaded: true,
  exports: {
    supabaseServer: mockSupabaseServer,
    getSupabaseServer: () => mockSupabaseServer,
  },
} as NodeModule;

// 2. Mock Verification Data
const verificationDataPath = require.resolve("../src/lib/verification-data");
require.cache[verificationDataPath] = {
  id: verificationDataPath,
  filename: verificationDataPath,
  loaded: true,
  exports: {
    isDemoStartupUserId: (userId: string | null | undefined): boolean => {
      return !!userId?.startsWith("00000000-0000-0000-0000-");
    },
    computeVerificationStatesForStartups: async (
      startupIds: number[],
      _demoUserIds: Map<number, string | null>
    ) => {
      const result = new Map<number, any>();
      for (const id of startupIds) {
        if (inMemoryVerificationMap.has(id)) {
          result.set(id, inMemoryVerificationMap.get(id));
        }
      }
      return result;
    },
    computeVerificationStateForStartup: async () => ({}),
  },
} as NodeModule;

// 3. Mock Revenue Aggregation (Snapshot-based metrics fallback)
const revenueAggregationPath = require.resolve("../src/lib/revenue-aggregation");
require.cache[revenueAggregationPath] = {
  id: revenueAggregationPath,
  filename: revenueAggregationPath,
  loaded: true,
  exports: {
    getStartupMetrics: async (startupId: number) => {
      if (inMemoryMetricsMap.has(startupId)) {
        return inMemoryMetricsMap.get(startupId)!;
      }
      return { mrr: 0, arr: 0, growthPercentage: 0 };
    },
  },
} as NodeModule;

// ─── Import REAL Production Function ─────────────────────────────────────────

const { getHomepageInitialData } = require("../src/lib/homepage-data");

// ─── Reusable Verification State Fixtures ─────────────────────────────────────

const VERIFIED_STATE = {
  confidenceTier: "REVENUE_VERIFIED",
  hasVerificationEvidence: true,
  providerBreakdown: [
    { provider: "stripe", amount: 50000, percentage: 100 },
  ],
  verificationConfidence: 95,
  providersConnected: ["stripe"],
  duplicateProtectionActive: true,
  fraudChecksPassed: true,
  consistencyLevel: "STRONG",
  consistencyScore: 95,
  consistencyFlags: [],
  trustScore: 92,
  lastSyncAt: new Date().toISOString(),
  transactionCount: 10,
  hasConnectedProviders: true,
  verificationDepth: 3,
  internalFlags: [],
  verificationStatus: "verified",
  verificationMethod: "api",
  verificationMethodLabel: "API Verified",
  dataSource: "stripe",
  dataSourceLabel: "Stripe",
};

const PAYMENT_CONNECTED_STATE = {
  ...VERIFIED_STATE,
  confidenceTier: "PAYMENT_CONNECTED",
  hasVerificationEvidence: false,
  transactionCount: 1,
  providerBreakdown: [
    { provider: "stripe", amount: 5000, percentage: 100 },
  ],
};

const SELF_REPORTED_STATE = {
  ...VERIFIED_STATE,
  confidenceTier: "SELF_REPORTED",
  hasVerificationEvidence: false,
  hasConnectedProviders: false,
  providersConnected: [],
  providerBreakdown: [],
  transactionCount: 0,
  trustScore: 10,
  lastSyncAt: null,
};

function makeSubmission(overrides: Partial<MockSubmissionRow> = {}): MockSubmissionRow {
  const id = overrides.id ?? 1;
  return {
    id,
    slug: overrides.slug ?? String(id),
    startup_name: overrides.startup_name ?? `Startup ${id}`,
    name: "Test Founder",
    biz_type: "SaaS",
    growth: null,
    payment_connected: true,
    trust_score: 80,
    notes: "A test startup",
    created_at: new Date().toISOString(),
    user_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    verification_status: null,
    is_public: true,
    ...overrides,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Homepage Projection Boundary (Direct getHomepageInitialData)", () => {
  beforeEach(() => {
    inMemorySubmissions = [];
    inMemoryVerificationMap.clear();
    inMemoryMetricsMap.clear();
  });

  // TEST 1: payment_connected = false → excluded
  it("TEST 1: A public startup with payment_connected=false does NOT appear in getHomepageInitialData", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 1,
        payment_connected: false,
        is_public: true,
      }),
    ];
    inMemoryVerificationMap.set(1, SELF_REPORTED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.recentlyListedData.length, 0);
    assert.equal(result.trendingData.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 2: payment_connected = true but hasVerificationEvidence = false (PAYMENT_CONNECTED tier) → excluded
  it("TEST 2: A public startup with payment_connected=true but hasVerificationEvidence=false does NOT appear", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 2,
        payment_connected: true,
        is_public: true,
      }),
    ];
    inMemoryVerificationMap.set(2, PAYMENT_CONNECTED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.recentlyListedData.length, 0);
    assert.equal(result.trendingData.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 3: Legacy self-reported startup with stored mrr > 0 → excluded
  it("TEST 3: A legacy self-reported startup with stored mrr > 0 and no verification evidence does NOT appear", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 3,
        payment_connected: false,
        is_public: true,
        mrr: 50000,
      }),
    ];
    inMemoryVerificationMap.set(3, SELF_REPORTED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.recentlyListedData.length, 0);
    assert.equal(result.trendingData.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 4: Demo startup → excluded regardless of verification state
  it("TEST 4: A demo startup does NOT appear regardless of verification state", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 4,
        payment_connected: true,
        is_public: true,
        user_id: "00000000-0000-0000-0000-000000000001", // Demo UUID
      }),
    ];
    inMemoryVerificationMap.set(4, VERIFIED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.recentlyListedData.length, 0);
    assert.equal(result.trendingData.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 5: Flagged startup → excluded regardless of verification state
  it("TEST 5: A flagged startup does NOT appear regardless of verification state", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 5,
        payment_connected: true,
        is_public: true,
        verification_status: "flagged",
      }),
    ];
    inMemoryVerificationMap.set(5, VERIFIED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.recentlyListedData.length, 0);
    assert.equal(result.trendingData.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 6: Fully verified startup → DOES appear
  it("TEST 6: A startup with is_public=true, payment_connected=true, and hasVerificationEvidence=true DOES appear", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 6,
        startup_name: "Acme Analytics",
        payment_connected: true,
        is_public: true,
      }),
    ];
    inMemoryVerificationMap.set(6, VERIFIED_STATE);

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 1);
    assert.equal(result.leaderboard[0].name, "Acme Analytics");
    assert.equal(result.recentlyListedData.length, 1);
    assert.equal(result.recentlyListedData[0].name, "Acme Analytics");
    assert.equal(result.verifiedStartupCount, 1);
    assert.equal(result.verifiedRevenueTotal, 50000);
  });

  // TEST 7: Leaderboard ranking uses authoritative verified revenue, NOT stored mrr (Specific Requirement 5)
  it("TEST 7: getHomepageInitialData ranks Startup B (₹2L verified, ₹1k stored) ABOVE Startup A (₹30k verified, ₹5L stored)", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 10,
        startup_name: "Startup A",
        mrr: 500000, // High stored mrr — MUST NOT WIN
        payment_connected: true,
        is_public: true,
      }),
      makeSubmission({
        id: 11,
        startup_name: "Startup B",
        mrr: 1000, // Low stored mrr — MUST WIN DUE TO ₹2L VERIFIED REVENUE
        payment_connected: true,
        is_public: true,
      }),
    ];

    inMemoryVerificationMap.set(10, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "stripe", amount: 30000, percentage: 100 }],
    });
    inMemoryVerificationMap.set(11, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "stripe", amount: 200000, percentage: 100 }],
    });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 2);

    // Startup B must be rank 1 with 200000 verified revenue
    assert.equal(result.leaderboard[0].name, "Startup B");
    assert.equal(result.leaderboard[0].rank, 1);

    // Startup A must be rank 2 with 30000 verified revenue
    assert.equal(result.leaderboard[1].name, "Startup A");
    assert.equal(result.leaderboard[1].rank, 2);
  });

  // TEST 8: verifiedStartupCount matches the number of authoritative eligible verified startups
  it("TEST 8: verifiedStartupCount in getHomepageInitialData matches ONLY verified, non-demo, non-flagged startups", async () => {
    inMemorySubmissions = [
      makeSubmission({ id: 20, payment_connected: true, is_public: true }),
      makeSubmission({ id: 21, payment_connected: true, is_public: true }),
      makeSubmission({ id: 22, payment_connected: false, is_public: true }), // disconnected
      makeSubmission({ id: 23, payment_connected: true, is_public: true }),
      makeSubmission({
        id: 24,
        payment_connected: true,
        is_public: true,
        user_id: "00000000-0000-0000-0000-000000000042", // demo
      }),
    ];

    inMemoryVerificationMap.set(20, VERIFIED_STATE);
    inMemoryVerificationMap.set(21, SELF_REPORTED_STATE); // unverified
    inMemoryVerificationMap.set(22, VERIFIED_STATE);
    inMemoryVerificationMap.set(23, VERIFIED_STATE);
    inMemoryVerificationMap.set(24, VERIFIED_STATE); // demo

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.verifiedStartupCount, 2);
    assert.equal(result.leaderboard.length, 2);
  });

  // TEST 9: verifiedRevenueTotal does not include revenue from unverified startups
  it("TEST 9: verifiedRevenueTotal in getHomepageInitialData includes ONLY provider revenue and excludes unverified stored mrr", async () => {
    inMemorySubmissions = [
      makeSubmission({ id: 30, payment_connected: true, is_public: true, mrr: 100000 }),
      makeSubmission({ id: 31, payment_connected: true, is_public: true, mrr: 200000 }),
    ];

    inMemoryVerificationMap.set(30, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "stripe", amount: 75000, percentage: 100 }],
    });
    inMemoryVerificationMap.set(31, SELF_REPORTED_STATE); // unverified despite 200k stored mrr

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.verifiedStartupCount, 1);
    assert.equal(result.verifiedRevenueTotal, 75000);
  });

  // TEST 10: No public homepage card exposes "SELF REPORTED" as a verification badge
  it("TEST 10: No public homepage card in getHomepageInitialData exposes 'Self Reported' badge", async () => {
    inMemorySubmissions = [
      makeSubmission({ id: 40, payment_connected: true, is_public: true }),
    ];
    inMemoryVerificationMap.set(40, VERIFIED_STATE);
    inMemoryMetricsMap.set(40, { mrr: 50000, arr: 600000, growthPercentage: 12.5 });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);

    const PROHIBITED_BADGES = ["Self Reported", "SELF_REPORTED", "self-reported", "Self-Reported"];

    for (const card of result.recentlyListedData) {
      assert.equal(card.badge, "Verified");
      assert.ok(!PROHIBITED_BADGES.includes(card.badge));
    }

    for (const card of result.trendingData) {
      assert.equal(card.badge, "Trending");
      assert.ok(!PROHIBITED_BADGES.includes(card.badge));
    }
  });

  // TEST 11: Specific Requirement 6: Startup with stored mrr = 999999 but hasVerificationEvidence = false
  it("TEST 11 (Req 6): Startup with stored mrr=999999 and hasVerificationEvidence=false contributes NOTHING to homepage", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 50,
        startup_name: "Fake Giant",
        mrr: 999999,
        payment_connected: true,
        is_public: true,
      }),
    ];
    inMemoryVerificationMap.set(50, {
      ...SELF_REPORTED_STATE,
      hasVerificationEvidence: false,
    });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0, "Must not appear in leaderboard");
    assert.equal(result.recentlyListedData.length, 0, "Must not appear in recentlyListedData");
    assert.equal(result.trendingData.length, 0, "Must not appear in trendingData");
    assert.equal(result.verifiedStartupCount, 0, "Must contribute 0 to verifiedStartupCount");
    assert.equal(result.verifiedRevenueTotal, 0, "Must contribute 0 to verifiedRevenueTotal");
  });

  // TEST 12: Specific Requirement 10: Fallback to getStartupMetrics().mrr when providerBreakdown is empty/0
  it("TEST 12 (Req 10): Uses getStartupMetrics().mrr as fallback when providerBreakdown is empty for verified startup", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 60,
        startup_name: "Fallback Startup",
        payment_connected: true,
        is_public: true,
      }),
    ];
    inMemoryVerificationMap.set(60, {
      ...VERIFIED_STATE,
      hasVerificationEvidence: true,
      providerBreakdown: [], // empty breakdown
    });
    inMemoryMetricsMap.set(60, {
      mrr: 45000, // authoritative snapshot metric
      arr: 540000,
      growthPercentage: 8.0,
    });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 1);
    assert.equal(result.leaderboard[0].name, "Fallback Startup");
    assert.equal(result.verifiedStartupCount, 1);
    assert.equal(result.verifiedRevenueTotal, 45000);
  });

  // TEST 13: Specific Requirement 11: startup_submissions.mrr is completely omitted from submission data
  it("TEST 13 (Req 11): getHomepageInitialData works when startup_submissions.mrr column is omitted from DB row", async () => {
    inMemorySubmissions = [
      {
        id: 70,
        slug: "no-mrr-col",
        startup_name: "No MRR Column",
        name: "Founder X",
        biz_type: "b2b_saas",
        growth: null,
        payment_connected: true,
        trust_score: 85,
        notes: "Clean startup",
        created_at: new Date().toISOString(),
        user_id: "user-clean-70",
        verification_status: null,
        is_public: true,
        // mrr is completely omitted
      },
    ];
    inMemoryVerificationMap.set(70, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "stripe", amount: 80000, percentage: 100 }],
    });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 1);
    assert.equal(result.verifiedRevenueTotal, 80000);
  });

  // TEST 14: EDGE: Startup with no verification state in map → does NOT appear
  it("TEST 14 (EDGE): A startup missing from verification map does NOT appear in homepage", async () => {
    inMemorySubmissions = [
      makeSubmission({
        id: 99,
        payment_connected: true,
        is_public: true,
      }),
    ];
    // Map is empty

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.leaderboard.length, 0);
    assert.equal(result.verifiedStartupCount, 0);
    assert.equal(result.verifiedRevenueTotal, 0);
  });

  // TEST 15: COMPOSITE: Mixed set of startups
  it("TEST 15 (COMPOSITE): Full pipeline filters out non-public, disconnected, flagged, demo, and unverified startups", async () => {
    inMemorySubmissions = [
      makeSubmission({ id: 100, payment_connected: true, is_public: true }), // VERIFIED ✓
      makeSubmission({ id: 101, payment_connected: true, is_public: true }), // PAYMENT_CONNECTED ✗
      makeSubmission({ id: 102, payment_connected: false, is_public: true }), // no connection ✗
      makeSubmission({ id: 103, payment_connected: true, is_public: false }), // not public ✗
      makeSubmission({ id: 104, payment_connected: true, is_public: true, verification_status: "flagged" }), // flagged ✗
      makeSubmission({ id: 105, payment_connected: true, is_public: true, user_id: "00000000-0000-0000-0000-aaa" }), // demo ✗
      makeSubmission({ id: 106, payment_connected: true, is_public: true }), // VERIFIED ✓
    ];

    inMemoryVerificationMap.set(100, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "stripe", amount: 100000, percentage: 100 }],
    });
    inMemoryVerificationMap.set(101, PAYMENT_CONNECTED_STATE);
    inMemoryVerificationMap.set(102, VERIFIED_STATE);
    inMemoryVerificationMap.set(103, VERIFIED_STATE);
    inMemoryVerificationMap.set(104, VERIFIED_STATE);
    inMemoryVerificationMap.set(105, VERIFIED_STATE);
    inMemoryVerificationMap.set(106, {
      ...VERIFIED_STATE,
      providerBreakdown: [{ provider: "razorpay", amount: 50000, percentage: 100 }],
    });

    const result = await getHomepageInitialData();
    assert.ok(result !== null);
    assert.equal(result.verifiedStartupCount, 2);
    assert.equal(result.verifiedRevenueTotal, 150000);
    assert.equal(result.leaderboard.length, 2);

    const slugs = result.leaderboard.map((s: any) => s.slug).sort();
    assert.deepEqual(slugs, ["100", "106"]);
  });
});

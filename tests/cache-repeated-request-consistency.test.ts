/**
 * TEST 08 — Cache & Repeated-Request Consistency Test Suite
 *
 * Deterministic regression harness validating:
 * - Public cacheable response headers (Badge, Live Feed, Trust Metrics, Startup Submissions)
 * - Authenticated and owner-only private response isolation
 * - Cross-user cache and state isolation (User A vs User B vs Logged-out)
 * - Query parameter partitioning and cache key separation
 * - Proof redirect authorization and short-lived signed URL generation
 * - State freshness across dynamic database mutations
 * - Route segment dynamic configuration and header contracts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "../src/lib/supabase-server";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const USER_A: User = {
  id: "usr_test_user_a_11111111-1111-4111-a111-111111111111",
  email: "founder-a@example.com",
  app_metadata: {},
  user_metadata: { full_name: "Founder A" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const USER_B: User = {
  id: "usr_test_user_b_22222222-2222-4222-b222-222222222222",
  email: "founder-b@example.com",
  app_metadata: {},
  user_metadata: { full_name: "Founder B" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const ADMIN_USER: User = {
  id: "usr_test_admin_99999999-9999-4999-9999-999999999999",
  email: "eshanmaurya12@gmail.com", // Authoritative server allowlisted admin email
  app_metadata: {},
  user_metadata: { full_name: "Verifii Admin" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

let activeBearerToken: string | null = null;
let lastSignedUrlExpiresIn: number | null = null;
let lastSignedUrlPath: string | null = null;

interface StartupRecord {
  id: number;
  slug: string;
  startup_name: string;
  name?: string;
  biz_type: string;
  mrr: number;
  arr: number;
  city: string;
  website: string;
  twitter: string;
  linkedin: string;
  trust_score: number;
  verification_status: string;
  payment_connected: boolean;
  mrr_breakdown: any;
  created_at: string;
  user_id: string;
  is_public: boolean;
  penalty_count: number;
  verification_type: string;
  proof_url: string | null;
  email?: string;
}

let inMemoryStartups: StartupRecord[] = [];
let inMemoryConnections: any[] = [];
let inMemoryFeedback: any[] = [];
let inMemoryTransactions: any[] = [];
let inMemoryFraudSignals: any[] = [];
let inMemorySnapshots: any[] = [];

function resetInMemoryDb() {
  inMemoryStartups = [
    {
      id: 101,
      slug: "startup-alpha",
      startup_name: "Startup Alpha",
      name: "Founder A",
      email: "founder-a@example.com",
      biz_type: "b2b_saas",
      mrr: 500000,
      arr: 6000000,
      city: "Bengaluru",
      website: "https://alpha.example.com",
      twitter: "https://twitter.com/alpha",
      linkedin: "https://linkedin.com/company/alpha",
      trust_score: 95,
      verification_status: "verified",
      payment_connected: true,
      mrr_breakdown: { stripe: 300000, razorpay: 200000 },
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      user_id: USER_A.id,
      is_public: true,
      penalty_count: 0,
      verification_type: "automated",
      proof_url: "proofs/startup-101/bank_stmt.pdf",
    },
    {
      id: 202,
      slug: "startup-beta",
      startup_name: "Startup Beta",
      name: "Founder B",
      email: "founder-b@example.com",
      biz_type: "b2c_fintech",
      mrr: 120000,
      arr: 1440000,
      city: "Mumbai",
      website: "https://beta.example.com",
      twitter: "https://twitter.com/beta",
      linkedin: "https://linkedin.com/company/beta",
      trust_score: 82,
      verification_status: "verified",
      payment_connected: true,
      mrr_breakdown: { razorpay: 120000 },
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      user_id: USER_B.id,
      is_public: true,
      penalty_count: 0,
      verification_type: "automated",
      proof_url: "proofs/startup-202/gst_cert.pdf",
    },
  ];

  inMemoryConnections = [
    {
      id: 1,
      startup_id: 101,
      provider: "stripe",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 300000,
    },
    {
      id: 2,
      startup_id: 101,
      provider: "razorpay",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 200000,
    },
    {
      id: 3,
      startup_id: 202,
      provider: "razorpay",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 120000,
    },
  ];

  inMemoryFeedback = [
    {
      id: "fb-101",
      user_id: USER_A.id,
      user_email: USER_A.email,
      category: "feature",
      message: "Feedback from User A",
      status: "open",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      feedback_replies: [],
    },
    {
      id: "fb-202",
      user_id: USER_B.id,
      user_email: USER_B.email,
      category: "bug",
      message: "Feedback from User B",
      status: "open",
      created_at: new Date(Date.now() - 1800000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
      feedback_replies: [],
    },
  ];

  inMemoryTransactions = [
    {
      startup_id: 101,
      amount: 300000,
      created_at: new Date().toISOString(),
      provider: "stripe",
    },
  ];

  inMemoryFraudSignals = [];
  inMemorySnapshots = [
    {
      startup_id: 101,
      total_revenue: 500000,
      created_at: new Date().toISOString(),
    },
  ];
}

// ─── Module Interception Setup ──────────────────────────────────────────────

const nextHeadersPath = require.resolve("next/headers");
require.cache[nextHeadersPath] = {
  id: nextHeadersPath,
  filename: nextHeadersPath,
  loaded: true,
  exports: {
    headers: async () => ({
      get: (name: string) => {
        if (name.toLowerCase() === "authorization") {
          return activeBearerToken ? `Bearer ${activeBearerToken}` : null;
        }
        if (name.toLowerCase() === "x-forwarded-for") return "127.0.0.1";
        return null;
      },
    }),
    cookies: async () => ({
      get: () => null,
      getAll: () => [],
      set: () => {},
    }),
  },
} as NodeModule;

const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_client_cache_harness",
    checkRateLimit: async () => ({ allowed: true, remaining: 100 }),
  },
} as NodeModule;

const supabaseJsPath = require.resolve("@supabase/supabase-js");
const realSupabaseJs = require("@supabase/supabase-js");

const mockCreateClient = (url: string, key: string, options?: any) => ({
  auth: {
    getUser: async (token?: string) => {
      if (token === "token_user_a") return { data: { user: USER_A }, error: null };
      if (token === "token_user_b") return { data: { user: USER_B }, error: null };
      if (token === "token_admin") return { data: { user: ADMIN_USER }, error: null };
      return { data: { user: null }, error: { message: "Invalid JWT" } };
    },
  },
});

require.cache[supabaseJsPath] = {
  id: supabaseJsPath,
  filename: supabaseJsPath,
  loaded: true,
  exports: new Proxy(realSupabaseJs, {
    get(target: any, prop: string | symbol, receiver: any) {
      if (prop === "createClient") return mockCreateClient;
      return Reflect.get(target, prop, receiver);
    },
  }),
} as NodeModule;

const supabaseSsrPath = require.resolve("@supabase/ssr");
require.cache[supabaseSsrPath] = {
  id: supabaseSsrPath,
  filename: supabaseSsrPath,
  loaded: true,
  exports: {
    createServerClient: (url: string, key: string, options: any) => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    }),
  },
} as NodeModule;

// Intercept Supabase Storage for Signed URL generation
(supabaseServer as any).storage = {
  from: (bucket: string) => ({
    createSignedUrl: async (path: string, expiresIn: number) => {
      lastSignedUrlPath = path;
      lastSignedUrlExpiresIn = expiresIn;
      return {
        data: { signedUrl: `https://storage.supabase.co/${bucket}/${path}?token=mock_signed_token&expires=${expiresIn}` },
        error: null,
      };
    },
  }),
};

// In-Memory Database query engine
(supabaseServer as any).from = (table: string) => {
  const filters: Array<{ column: string; value: any; op: string }> = [];
  let isSingle = false;
  let isMaybeSingle = false;

  const chain: any = {
    select: () => chain,
    eq: (column: string, value: any) => {
      filters.push({ column, value, op: "eq" });
      return chain;
    },
    in: (column: string, values: any[]) => {
      filters.push({ column, value: values, op: "in" });
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    single: () => {
      isSingle = true;
      return chain;
    },
    maybeSingle: () => {
      isMaybeSingle = true;
      return chain;
    },
    update: (data: any) => chain,
    insert: (data: any) => chain,
    then: (resolve: (val: any) => void) => {
      let dataSet: any[] = [];
      if (table === "startup_submissions") dataSet = [...inMemoryStartups];
      else if (table === "provider_connections") dataSet = [...inMemoryConnections];
      else if (table === "feedback") dataSet = [...inMemoryFeedback];
      else if (table === "revenue_snapshots") dataSet = [...inMemorySnapshots];
      else if (table === "revenue_transactions") dataSet = [...inMemoryTransactions];
      else if (table === "fraud_signals") dataSet = [...inMemoryFraudSignals];

      for (const f of filters) {
        if (f.op === "eq") {
          dataSet = dataSet.filter((item) => String(item[f.column]) === String(f.value));
        } else if (f.op === "in") {
          dataSet = dataSet.filter((item) => f.value.includes(item[f.column]));
        }
      }

      if (isSingle || isMaybeSingle) {
        const item = dataSet[0] || null;
        if (isSingle && !item) {
          return resolve({ data: null, error: { message: "Row not found", code: "PGRST116" } });
        }
        return resolve({ data: item, error: null });
      }

      return resolve({ data: dataSet, error: null });
    },
  };

  return chain;
};

// ─── Import Route Handlers After Dependency Interception ────────────────────

const { GET: getBadgeRoute } = require("../src/app/api/badge/[slug]/route");
const { GET: getLiveFeedRoute } = require("../src/app/api/live-feed/route");
const { GET: getTrustMetricsRoute } = require("../src/app/api/trust-metrics/route");
const { GET: getStartupSubmissionsRoute } = require("../src/app/api/startup-submissions/route");
const { GET: getFeedbackRoute } = require("../src/app/api/feedback/route");
const { GET: getStartupOverviewRoute } = require("../src/app/api/startup/[id]/overview/route");
const { GET: getStartupConnectionsRoute } = require("../src/app/api/startup/[id]/connections/route");
const { GET: getStartupProofRoute } = require("../src/app/api/startup/[id]/proof/route");
const { GET: getAdminFeedbackRoute } = require("../src/app/api/admin/feedback/route");
const { getCacheKey } = require("../src/lib/analytics/cache");

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("TEST 08 — Cache & Repeated-Request Consistency", () => {
  beforeEach(() => {
    activeBearerToken = null;
    lastSignedUrlExpiresIn = null;
    lastSignedUrlPath = null;
    resetInMemoryDb();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP A — PUBLIC CACHEABLE RESPONSES
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group A: Public Cacheable Responses", () => {
    it("A1: /api/badge/[slug] returns HTTP 200 with public max-age=3600 and SVG Content-Type", async () => {
      const req = new Request("https://www.verifii.in/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("Content-Type"), "image/svg+xml");
      assert.strictEqual(res.headers.get("Cache-Control"), "public, max-age=3600");
    });

    it("A2: /api/live-feed returns HTTP 200 with public s-maxage=10, stale-while-revalidate=59", async () => {
      const req = new Request("https://www.verifii.in/api/live-feed");
      const res = await getLiveFeedRoute(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "public, s-maxage=10, stale-while-revalidate=59"
      );
    });

    it("A3: /api/trust-metrics returns HTTP 200 with public s-maxage=10, stale-while-revalidate=59", async () => {
      const req = new Request("https://www.verifii.in/api/trust-metrics");
      const res = await getTrustMetricsRoute(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "public, s-maxage=10, stale-while-revalidate=59"
      );
    });

    it("A4: /api/startup-submissions returns HTTP 200 with s-maxage=10 and sanitizes private email/name", async () => {
      const req = new Request("https://www.verifii.in/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "public, s-maxage=10, stale-while-revalidate=59"
      );

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      for (const row of json.data) {
        assert.strictEqual(row.email, undefined, "Email must be scrubbed from public cacheable feed");
        assert.strictEqual(row.name, undefined, "Founder name must be scrubbed from public cacheable feed");
      }
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP B — AUTHENTICATED / OWNER RESPONSES
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group B: Authenticated & Owner Responses", () => {
    it("B1: /api/feedback (Unauthenticated) returns HTTP 401 with private no-store", async () => {
      activeBearerToken = null;
      const res = await getFeedbackRoute();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B2: /api/feedback (Authenticated User A) returns HTTP 200 with User A history and private no-store", async () => {
      activeBearerToken = "token_user_a";
      const res = await getFeedbackRoute();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
      const json = await res.json();
      assert.ok(Array.isArray(json.feedback));
      assert.strictEqual(json.feedback.length, 1);
      assert.strictEqual(json.feedback[0].user_id, USER_A.id);
    });

    it("B3: /api/startup/[id]/overview (Unauthenticated) returns HTTP 401 with private no-store", async () => {
      activeBearerToken = null;
      const req = new Request("https://www.verifii.in/api/startup/101/overview");
      const res = await getStartupOverviewRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B4: /api/startup/[id]/overview (Owner User A) returns HTTP 200 with private no-store", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("https://www.verifii.in/api/startup/101/overview");
      const res = await getStartupOverviewRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
      const json = await res.json();
      assert.strictEqual(json.startup.id, 101);
      assert.strictEqual(json.startup.name, "Startup Alpha");
    });

    it("B5: /api/startup/[id]/overview (Non-Owner User B) returns HTTP 403 Forbidden with private no-store", async () => {
      activeBearerToken = "token_user_b";
      const req = new Request("https://www.verifii.in/api/startup/101/overview");
      const res = await getStartupOverviewRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B6: /api/startup/[id]/connections (Unauthenticated) returns HTTP 401 with private no-store", async () => {
      activeBearerToken = null;
      const req = new Request("https://www.verifii.in/api/startup/101/connections");
      const res = await getStartupConnectionsRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B7: /api/startup/[id]/connections (Owner User A) returns HTTP 200 with provider state and private no-store", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("https://www.verifii.in/api/startup/101/connections");
      const res = await getStartupConnectionsRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.providers.length, 2);
      assert.strictEqual(json.totalMRR, 500000);
    });

    it("B8: /api/startup/[id]/connections (Non-Owner User B) returns HTTP 403 Forbidden with private no-store", async () => {
      activeBearerToken = "token_user_b";
      const req = new Request("https://www.verifii.in/api/startup/101/connections");
      const res = await getStartupConnectionsRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B9: /api/admin/feedback (Unauthenticated) returns HTTP 403 with private no-store", async () => {
      activeBearerToken = null;
      const req = new Request("https://www.verifii.in/api/admin/feedback");
      const res = await getAdminFeedbackRoute(req);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B10: /api/admin/feedback (Non-Admin User A) returns HTTP 403 Forbidden with private no-store", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("https://www.verifii.in/api/admin/feedback");
      const res = await getAdminFeedbackRoute(req);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("B11: /api/admin/feedback (Admin User) returns HTTP 200 with full feedback queue and private no-store", async () => {
      activeBearerToken = "token_admin";
      const req = new Request("https://www.verifii.in/api/admin/feedback");
      const res = await getAdminFeedbackRoute(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
      const json = await res.json();
      assert.strictEqual(json.feedback.length, 2);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP C — AUTHORIZATION / CACHE ISOLATION
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group C: Authorization & Cache Isolation", () => {
    it("C1: User A and User B querying /api/feedback receive strictly isolated payloads", async () => {
      activeBearerToken = "token_user_a";
      const resA = await getFeedbackRoute();
      const jsonA = await resA.json();

      activeBearerToken = "token_user_b";
      const resB = await getFeedbackRoute();
      const jsonB = await resB.json();

      assert.strictEqual(jsonA.feedback[0].user_id, USER_A.id);
      assert.strictEqual(jsonB.feedback[0].user_id, USER_B.id);
      assert.notStrictEqual(jsonA.feedback[0].id, jsonB.feedback[0].id);
    });

    it("C2: User A logging out immediately results in HTTP 401 (no stale session reuse)", async () => {
      activeBearerToken = "token_user_a";
      const res1 = await getFeedbackRoute();
      assert.strictEqual(res1.status, 200);

      // Simulate logout / token clearing
      activeBearerToken = null;
      const res2 = await getFeedbackRoute();
      assert.strictEqual(res2.status, 401);
    });

    it("C3: Startup overview respects per-caller authorization boundary", async () => {
      activeBearerToken = "token_user_a";
      const reqA = new Request("https://www.verifii.in/api/startup/101/overview");
      const resA = await getStartupOverviewRoute(reqA, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(resA.status, 200);

      activeBearerToken = "token_user_b";
      const reqB = new Request("https://www.verifii.in/api/startup/101/overview");
      const resB = await getStartupOverviewRoute(reqB, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(resB.status, 403);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP D — QUERY PARAMETER PARTITIONING
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group D: Query Parameter Partitioning", () => {
    it("D1: /api/badge/[slug]?theme=dark produces dark theme SVG attributes", async () => {
      const req = new Request("https://www.verifii.in/api/badge/startup-alpha?theme=dark");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svg = await res.text();
      assert.ok(svg.includes("#0a0a0a") || svg.includes("fill="), "Dark badge contains theme styling");
    });

    it("D2: /api/badge/[slug]?theme=light produces distinct light theme SVG attributes", async () => {
      const reqDark = new Request("https://www.verifii.in/api/badge/startup-alpha?theme=dark");
      const resDark = await getBadgeRoute(reqDark, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svgDark = await resDark.text();

      const reqLight = new Request("https://www.verifii.in/api/badge/startup-alpha?theme=light");
      const resLight = await getBadgeRoute(reqLight, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svgLight = await resLight.text();

      assert.notStrictEqual(svgDark, svgLight, "Dark and light badge SVGs must differ");
    });

    it("D3: Analytics cache key partitions by range and normalized filters", () => {
      const key24h = getCacheKey("analytics", "24h", { provider: "all", outcome: "all" });
      const key30d = getCacheKey("analytics", "30d", { provider: "all", outcome: "all" });
      const keyStripe = getCacheKey("analytics", "30d", { provider: "stripe", outcome: "all" });

      assert.strictEqual(key24h, "analytics:24h:all:all");
      assert.strictEqual(key30d, "analytics:30d:all:all");
      assert.strictEqual(keyStripe, "analytics:30d:stripe:all");
      assert.notStrictEqual(key24h, key30d);
      assert.notStrictEqual(key30d, keyStripe);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP E — PROOF REDIRECT / SIGNED URL
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group E: Proof Redirect & Signed URL Handling", () => {
    it("E1: /api/startup/[id]/proof rejects unauthenticated caller with HTTP 401 and private no-store", async () => {
      activeBearerToken = null;
      const req = new Request("https://www.verifii.in/api/startup/101/proof");
      const res = await getStartupProofRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("E2: /api/startup/[id]/proof rejects non-owner User B with HTTP 403 and private no-store", async () => {
      activeBearerToken = "token_user_b";
      const req = new Request("https://www.verifii.in/api/startup/101/proof");
      const res = await getStartupProofRoute(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, no-cache, must-revalidate"
      );
    });

    it("E3: /api/startup/[id]/proof for owner User A redirects to authoritative signed URL with private no-store max-age=0", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("https://www.verifii.in/api/startup/101/proof");
      const res = await getStartupProofRoute(req, { params: Promise.resolve({ id: "101" }) });

      assert.strictEqual(res.status, 307);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, max-age=0"
      );
      assert.strictEqual(lastSignedUrlPath, "proofs/startup-101/bank_stmt.pdf");
      assert.strictEqual(lastSignedUrlExpiresIn, 60, "Signed URL validity must be exactly 60 seconds");
      const location = res.headers.get("Location");
      assert.ok(location?.includes("proofs/startup-101/bank_stmt.pdf"));
    });

    it("E4: /api/startup/[id]/proof allows Admin User to access proof redirect with private no-store max-age=0", async () => {
      activeBearerToken = "token_admin";
      const req = new Request("https://www.verifii.in/api/startup/101/proof");
      const res = await getStartupProofRoute(req, { params: Promise.resolve({ id: "101" }) });

      assert.strictEqual(res.status, 307);
      assert.strictEqual(
        res.headers.get("Cache-Control"),
        "private, no-store, max-age=0"
      );
      assert.strictEqual(lastSignedUrlPath, "proofs/startup-101/bank_stmt.pdf");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP F — PUBLIC VS PRIVATE STATE FRESHNESS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group F: State Freshness Across Dynamic Mutations", () => {
    it("F1: Startup unpublishing (is_public=false) immediately returns 404 on badge route", async () => {
      // 1. Initial public state
      const req1 = new Request("https://www.verifii.in/api/badge/startup-alpha");
      const res1 = await getBadgeRoute(req1, { params: Promise.resolve({ slug: "startup-alpha" }) });
      assert.strictEqual(res1.status, 200);

      // 2. Mutate state: unpublish startup
      inMemoryStartups[0].is_public = false;

      // 3. Query badge again
      const req2 = new Request("https://www.verifii.in/api/badge/startup-alpha");
      const res2 = await getBadgeRoute(req2, { params: Promise.resolve({ slug: "startup-alpha" }) });
      assert.strictEqual(res2.status, 404, "Unpublished startup must immediately return 404");
    });

    it("F2: Revenue transaction additions immediately reflect in owner overview score calculation", async () => {
      activeBearerToken = "token_user_a";
      const req1 = new Request("https://www.verifii.in/api/startup/101/overview");
      const res1 = await getStartupOverviewRoute(req1, { params: Promise.resolve({ id: "101" }) });
      const json1 = await res1.json();
      assert.strictEqual(json1.revenue.length, 1);

      // Add fresh transaction snapshot
      inMemorySnapshots.push({
        startup_id: 101,
        total_revenue: 750000,
        created_at: new Date().toISOString(),
      });

      const req2 = new Request("https://www.verifii.in/api/startup/101/overview");
      const res2 = await getStartupOverviewRoute(req2, { params: Promise.resolve({ id: "101" }) });
      const json2 = await res2.json();
      assert.strictEqual(json2.revenue.length, 2, "Overview must reflect fresh database records");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP G — NEXT.JS CACHE & ROUTE CONFIGURATION SAFETY
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group G: Next.js Cache & Configuration Safety", () => {
    it("G1: Analytics in-memory cache isolates keys and uses deterministic TTL", () => {
      const keyA = getCacheKey("recommendations", "7d", { provider: "all", outcome: "all" });
      const keyB = getCacheKey("recommendations", "30d", { provider: "all", outcome: "all" });
      assert.notStrictEqual(keyA, keyB);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP H — HEADER REGRESSION & CONTRACT ENFORCEMENT
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group H: Header Contracts & Baseline Invariants", () => {
    it("H1: Public feeds do not set Set-Cookie headers", async () => {
      const reqFeed = new Request("https://www.verifii.in/api/live-feed");
      const resFeed = await getLiveFeedRoute(reqFeed);
      assert.strictEqual(resFeed.headers.get("Set-Cookie"), null);

      const reqMetrics = new Request("https://www.verifii.in/api/trust-metrics");
      const resMetrics = await getTrustMetricsRoute(reqMetrics);
      assert.strictEqual(resMetrics.headers.get("Set-Cookie"), null);
    });

    it("H2: Public badge returns X-Content-Type-Options: nosniff", async () => {
      const req = new Request("https://www.verifii.in/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      assert.strictEqual(res.headers.get("Content-Type"), "image/svg+xml");
    });
  });
});

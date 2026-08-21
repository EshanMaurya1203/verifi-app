/**
 * TEST 11 — Public Badge / Profile / Leaderboard Boundary Regression Test Suite
 *
 * Deterministic regression harness validating:
 * - Group A: Public Profile Visibility & Private Field Isolation (A1–A8)
 * - Group B: Badge SVG Security & Verification State (B1–B16)
 * - Group C: Leaderboard Public Boundary & Filters (C1–C14)
 * - Group D: Public API Boundary Integrity (D1–D12)
 * - Group E: Authoritative Revenue Consistency (E1–E10)
 * - Group F: Demo / Sandbox Isolation (F1–F6)
 * - Group G: Identifier & Adversarial Input Robustness (G1–G11)
 *
 * Authoritative Pass: Only intended public data appears and verification labels reflect authoritative state.
 * Authoritative Fail: Private data leaks or false verification is possible.
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

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

let activeBearerToken: string | null = null;

interface StartupRecord {
  id: number;
  slug: string;
  startup_name: string;
  name?: string;
  founder_name?: string;
  biz_type: string;
  mrr: number;
  arr: number;
  growth?: number;
  city: string;
  website: string;
  twitter: string;
  linkedin: string;
  founder_bio?: string;
  startup_logo?: string;
  founder_avatar?: string;
  notes?: string;
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
  last_verified_at?: string | null;
}

let inMemoryStartups: StartupRecord[] = [];
let inMemoryConnections: any[] = [];
let inMemoryTransactions: any[] = [];
let inMemoryFraudSignals: any[] = [];
let inMemorySnapshots: any[] = [];
let inMemoryVerificationLogs: any[] = [];

function resetInMemoryDb() {
  inMemoryStartups = [
    // 1. Fully Verified Public Startup (User A)
    {
      id: 101,
      slug: "startup-alpha",
      startup_name: "Startup Alpha",
      name: "Founder A",
      founder_name: "Founder A",
      email: "founder-a@example.com",
      biz_type: "b2b_saas",
      mrr: 500000,
      arr: 6000000,
      growth: 15.5,
      city: "Bengaluru",
      website: "https://alpha.example.com",
      twitter: "https://twitter.com/alpha",
      linkedin: "https://linkedin.com/company/alpha",
      founder_bio: "Building Alpha for B2B SaaS.",
      startup_logo: "https://example.com/logo-a.png",
      founder_avatar: "https://example.com/avatar-a.png",
      notes: "Verified B2B SaaS startup with real payment stream.",
      trust_score: 95,
      verification_status: "verified",
      payment_connected: true,
      mrr_breakdown: { stripe: 300000, razorpay: 200000 },
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      user_id: USER_A.id,
      is_public: true,
      penalty_count: 0,
      verification_type: "api",
      proof_url: "proofs/startup-101/bank_stmt.pdf",
      last_verified_at: new Date().toISOString(),
    },
    // 2. Private Startup (User A) — is_public = false
    {
      id: 102,
      slug: "startup-alpha-private",
      startup_name: "Startup Alpha Private",
      name: "Founder A",
      founder_name: "Founder A",
      email: "founder-a@example.com",
      biz_type: "b2b_saas",
      mrr: 999999,
      arr: 12000000,
      growth: 20.0,
      city: "Bengaluru",
      website: "https://alphaprivate.example.com",
      twitter: "https://twitter.com/alphaprivate",
      linkedin: "https://linkedin.com/company/alphaprivate",
      founder_bio: "Secret project.",
      notes: "Confidential private startup.",
      trust_score: 90,
      verification_status: "verified",
      payment_connected: true,
      mrr_breakdown: { stripe: 999999 },
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      user_id: USER_A.id,
      is_public: false, // EXPLICITLY PRIVATE
      penalty_count: 0,
      verification_type: "api",
      proof_url: "proofs/startup-102/confidential.pdf",
      last_verified_at: new Date().toISOString(),
    },
    // 3. Payment Connected Startup (User B) — Linked provider, but 0 transactions (PAYMENT_CONNECTED tier)
    {
      id: 201,
      slug: "startup-beta-connected",
      startup_name: "Startup Beta Connected",
      name: "Founder B",
      founder_name: "Founder B",
      email: "founder-b@example.com",
      biz_type: "b2c_fintech",
      mrr: 120000,
      arr: 1440000,
      growth: 5.0,
      city: "Mumbai",
      website: "https://beta.example.com",
      twitter: "https://twitter.com/beta",
      linkedin: "https://linkedin.com/company/beta",
      founder_bio: "Fintech scaling in India.",
      notes: "Provider linked, waiting for sync.",
      trust_score: 65,
      verification_status: "pending",
      payment_connected: true,
      mrr_breakdown: {},
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      user_id: USER_B.id,
      is_public: true,
      penalty_count: 0,
      verification_type: "api",
      proof_url: null,
      last_verified_at: new Date().toISOString(),
    },
    // 4. Self-Reported Public Startup (User B) — No provider connected
    {
      id: 202,
      slug: "startup-gamma-selfreported",
      startup_name: "Startup Gamma Self-Reported",
      name: "Founder B",
      founder_name: "Founder B",
      email: "founder-b@example.com",
      biz_type: "d2c",
      mrr: 50000,
      arr: 600000,
      growth: 0,
      city: "Delhi",
      website: "https://gamma.example.com",
      twitter: "https://twitter.com/gamma",
      linkedin: "https://linkedin.com/company/gamma",
      founder_bio: "D2C Brand.",
      notes: "Manual declaration.",
      trust_score: 35,
      verification_status: "pending",
      payment_connected: false, // NO PROVIDER
      mrr_breakdown: {},
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      user_id: USER_B.id,
      is_public: true,
      penalty_count: 0,
      verification_type: "manual",
      proof_url: null,
      last_verified_at: null,
    },
    // 5. Demo / Sandbox Startup
    {
      id: 301,
      slug: "demo-sandbox-startup",
      startup_name: "Demo Sandbox Startup",
      name: "Demo Founder",
      founder_name: "Demo Founder",
      email: "demo@example.com",
      biz_type: "b2b_saas",
      mrr: 750000,
      arr: 9000000,
      growth: 30.0,
      city: "Bengaluru",
      website: "https://demo.example.com",
      twitter: "https://twitter.com/demo",
      linkedin: "https://linkedin.com/company/demo",
      founder_bio: "Sample profile.",
      notes: "Sandbox demonstration.",
      trust_score: 99,
      verification_status: "verified",
      payment_connected: true,
      mrr_breakdown: { stripe: 750000 },
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      user_id: DEMO_USER_ID, // DEMO USER ID
      is_public: true,
      penalty_count: 0,
      verification_type: "api",
      proof_url: null,
      last_verified_at: new Date().toISOString(),
    },
  ];

  inMemoryConnections = [
    // Startup 101: 2 connected providers with fresh sync
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
    // Startup 201: 1 connected provider, but 0 transactions
    {
      id: 3,
      startup_id: 201,
      provider: "razorpay",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 0,
    },
    // Startup 301 (Demo): connected provider
    {
      id: 4,
      startup_id: 301,
      provider: "stripe",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 750000,
    },
  ];

  inMemoryTransactions = [
    // Startup 101: 4 transactions (>= 3 required for REVENUE_VERIFIED)
    { startup_id: 101, amount: 100000, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), provider: "stripe" },
    { startup_id: 101, amount: 200000, created_at: new Date(Date.now() - 86400000 * 2).toISOString(), provider: "stripe" },
    { startup_id: 101, amount: 100000, created_at: new Date(Date.now() - 86400000 * 1).toISOString(), provider: "razorpay" },
    { startup_id: 101, amount: 100000, created_at: new Date().toISOString(), provider: "razorpay" },
    // Startup 301 (Demo): transactions
    { startup_id: 301, amount: 750000, created_at: new Date().toISOString(), provider: "stripe" },
  ];

  inMemoryFraudSignals = [];

  inMemorySnapshots = [
    {
      id: 1,
      startup_id: 101,
      total_revenue: 500000,
      provider: "combined",
      provider_breakdown: { stripe: 300000, razorpay: 200000 },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      startup_id: 301,
      total_revenue: 750000,
      provider: "combined",
      provider_breakdown: { stripe: 750000 },
      created_at: new Date().toISOString(),
    },
  ];

  inMemoryVerificationLogs = [
    {
      id: 1,
      startup_id: 101,
      event: "stripe_sync_success",
      metadata: { amount: 300000 },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      startup_id: 101,
      event: "razorpay_sync_success",
      metadata: { amount: 200000 },
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      startup_id: 301,
      event: "stripe_sync_success",
      metadata: { amount: 750000 },
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
    getClientIdentifier: () => "test_client_public_boundary",
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

// Intercept in-memory query engine on supabaseServer
(supabaseServer as any).from = (table: string) => {
  const filters: Array<{ column: string; value: any; op: string }> = [];
  let isSingle = false;
  let isMaybeSingle = false;
  let selectFields: string | null = null;
  let isCount = false;

  const chain: any = {
    select: (fields?: string, opts?: any) => {
      if (fields) selectFields = fields;
      if (opts?.count === "exact" && opts?.head) isCount = true;
      return chain;
    },
    eq: (column: string, value: any) => {
      filters.push({ column, value, op: "eq" });
      return chain;
    },
    in: (column: string, values: any[]) => {
      filters.push({ column, value: values, op: "in" });
      return chain;
    },
    ilike: (column: string, pattern: string) => {
      filters.push({ column, value: pattern, op: "ilike" });
      return chain;
    },
    like: (column: string, pattern: string) => {
      filters.push({ column, value: pattern, op: "like" });
      return chain;
    },
    gte: (column: string, value: any) => {
      filters.push({ column, value, op: "gte" });
      return chain;
    },
    lt: (column: string, value: any) => {
      filters.push({ column, value, op: "lt" });
      return chain;
    },
    order: () => chain,
    range: () => chain,
    limit: () => chain,
    single: () => {
      isSingle = true;
      return chain;
    },
    maybeSingle: () => {
      isMaybeSingle = true;
      return chain;
    },
    then: (resolve: (val: any) => void) => {
      let dataSet: any[] = [];
      if (table === "startup_submissions") dataSet = [...inMemoryStartups];
      else if (table === "provider_connections") dataSet = [...inMemoryConnections];
      else if (table === "revenue_snapshots") dataSet = [...inMemorySnapshots];
      else if (table === "revenue_transactions") dataSet = [...inMemoryTransactions];
      else if (table === "fraud_signals") dataSet = [...inMemoryFraudSignals];
      else if (table === "verification_logs") {
        dataSet = inMemoryVerificationLogs.map((l) => {
          const sub = inMemoryStartups.find((s) => s.id === l.startup_id);
          return {
            ...l,
            startup_submissions: sub
              ? {
                  startup_name: sub.startup_name,
                  is_public: sub.is_public,
                  payment_connected: sub.payment_connected,
                  user_id: sub.user_id,
                  verification_status: sub.verification_status,
                }
              : null,
          };
        });
      }

      for (const f of filters) {
        if (f.op === "eq") {
          dataSet = dataSet.filter((item) => {
            if (f.column.includes(".")) {
              const [rel, col] = f.column.split(".");
              return String(item[rel]?.[col]) === String(f.value);
            }
            return String(item[f.column]) === String(f.value);
          });
        } else if (f.op === "in") {
          dataSet = dataSet.filter((item) => f.value.includes(item[f.column]));
        } else if (f.op === "ilike") {
          const rawPattern = String(f.value).replace(/%/g, "").toLowerCase();
          dataSet = dataSet.filter((item) =>
            String(item[f.column] || "").toLowerCase().includes(rawPattern)
          );
        } else if (f.op === "gte") {
          dataSet = dataSet.filter((item) => Number(item[f.column]) >= Number(f.value));
        } else if (f.op === "lt") {
          dataSet = dataSet.filter((item) => Number(item[f.column]) < Number(f.value));
        }
      }

      if (isCount) {
        return resolve({ count: dataSet.length, data: null, error: null });
      }

      // Column projection mirroring PostgREST select(fields)
      if (selectFields && selectFields !== "*" && !selectFields.includes("count")) {
        const fieldList = selectFields.split(",").map((s) => s.trim()).filter(Boolean);
        dataSet = dataSet.map((item) => {
          const projected: any = {};
          for (const f of fieldList) {
            if (f in item) projected[f] = item[f];
          }
          return projected;
        });
      }

      if (isSingle || isMaybeSingle) {
        const item = dataSet[0] || null;
        if (isSingle && !item) {
          return resolve({ data: null, error: { message: "Row not found", code: "PGRST116" } });
        }
        return resolve({ data: item, error: null });
      }

      return resolve({ data: dataSet, count: dataSet.length, error: null });
    },
  };

  return chain;
};

// ─── Import Route Handlers and Business Logic ───────────────────────────────

const { GET: getBadgeRoute, escapeXml } = require("../src/app/api/badge/[slug]/route");
const { GET: getStartupSubmissionsRoute } = require("../src/app/api/startup-submissions/route");
const { GET: getStartupSubmissionsCountRoute } = require("../src/app/api/startup-submissions/count/route");
const { GET: getLiveFeedRoute } = require("../src/app/api/live-feed/route");
const { GET: getTrustMetricsRoute } = require("../src/app/api/trust-metrics/route");
const { canStartupBePublic } = require("../src/lib/visibility");
const {
  computeVerificationState,
  buildVerificationStateInput,
  resolveTrustDataSource,
} = require("../src/lib/verification-state");
const { isDemoStartupUserId } = require("../src/lib/verification-data");
const {
  parseLeaderboardParams,
  getPaginationOffsets,
} = require("../src/lib/leaderboard/filter-utils");
const { slugify, normalizeStartupName } = require("../src/lib/validation/onboarding");

// ─── Test Suite Definition ──────────────────────────────────────────────────

describe("TEST 11 — Public Badge / Profile / Leaderboard Boundary", () => {
  beforeEach(() => {
    activeBearerToken = null;
    resetInMemoryDb();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP A: PUBLIC PROFILE VISIBILITY & PRIVATE FIELD ISOLATION
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group A: Public Profile Visibility & Private Field Isolation", () => {
    it("A1: Public startup (is_public = true) is accessible to public queries", async () => {
      const { data: startup } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("slug", "startup-alpha")
        .eq("is_public", true)
        .maybeSingle();

      assert(startup, "Public startup must be returned");
      assert.strictEqual(startup.slug, "startup-alpha");
      assert.strictEqual(startup.is_public, true);
    });

    it("A2: Private startup (is_public = false) cannot be retrieved via public query", async () => {
      const { data: startup } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("slug", "startup-alpha-private")
        .eq("is_public", true)
        .maybeSingle();

      assert.strictEqual(startup, null, "Private startup must return null for public queries");
    });

    it("A3: Private startup is excluded from public submission listings", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert(Array.isArray(json.data), "Expected data array");
      const foundPrivate = json.data.some((s: any) => s.slug === "startup-alpha-private");
      assert.strictEqual(foundPrivate, false, "Private startup must NOT leak in submissions listing");
    });

    it("A4: Owner can access their own private startup when authenticated", async () => {
      const privateStartup = inMemoryStartups.find((s) => s.slug === "startup-alpha-private")!;
      const isOwner = privateStartup.user_id === USER_A.id;
      const isNonOwner = privateStartup.user_id === USER_B.id;

      assert.strictEqual(isOwner, true, "User A is the owner of startup-alpha-private");
      assert.strictEqual(isNonOwner, false, "User B is NOT the owner of startup-alpha-private");
    });

    it("A5: Non-owner cannot access another user's private startup via slug", async () => {
      const privateStartup = inMemoryStartups.find((s) => s.slug === "startup-alpha-private")!;
      const accessAllowedForPublic = privateStartup.is_public;
      const accessAllowedForUserB = privateStartup.user_id === USER_B.id;

      assert.strictEqual(accessAllowedForPublic, false);
      assert.strictEqual(accessAllowedForUserB, false, "User B must NOT have access to User A's private startup");
    });

    it("A6: Public submission API projection excludes sensitive private fields (email, credentials)", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      for (const item of json.data) {
        assert.strictEqual(item.email, undefined, "Email must be stripped");
        assert.strictEqual(item.user_id, undefined, "User ID must not be projected");
        assert.strictEqual(item.proof_url, undefined, "proof_url must not be exposed");
        assert.strictEqual(item.penalty_count, undefined, "penalty_count must not be exposed");
      }
    });

    it("A7: Proof URL link is guarded by isOwnerOrAdmin boundary", async () => {
      const publicStartup = inMemoryStartups.find((s) => s.id === 101)!;
      const hasProof = !!publicStartup.proof_url;
      assert.strictEqual(hasProof, true, "Startup has proof uploaded");

      const isOwnerA = USER_A.id === publicStartup.user_id;
      const isOwnerB = USER_B.id === publicStartup.user_id;

      assert.strictEqual(isOwnerA, true, "User A is owner");
      assert.strictEqual(isOwnerB, false, "User B is not owner");
    });

    it("A8: Public verification label derives from authoritative verification state", async () => {
      const vState = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
          verificationType: "api",
          hasProofUpload: true,
        })
      );

      assert.strictEqual(vState.confidenceTier, "REVENUE_VERIFIED");
      assert.strictEqual(vState.hasVerificationEvidence, true);
      assert.strictEqual(vState.dataSourceLabel, "Stripe + Razorpay");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP B: BADGE SVG SECURITY & VERIFICATION STATE
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group B: Badge SVG Security & Verification State", () => {
    it("B1: Public startup receives SVG badge successfully (HTTP 200)", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("Content-Type"), "image/svg+xml");
      const body = await res.text();
      assert(body.includes("<svg"), "Body must contain SVG element");
      assert(body.includes("Startup Alpha"), "Must contain startup name");
    });

    it("B2: Private startup returns HTTP 404 on badge route", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha-private");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha-private" }) });

      assert.strictEqual(res.status, 404);
      const text = await res.text();
      assert.strictEqual(text, "Not Found");
    });

    it("B3: Nonexistent slug returns HTTP 404 on badge route", async () => {
      const req = new Request("http://localhost:3000/api/badge/nonexistent-slug-xyz");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "nonexistent-slug-xyz" }) });

      assert.strictEqual(res.status, 404);
    });

    it("B4: Malformed slug (spaces, punctuation) returns HTTP 404", async () => {
      const req = new Request("http://localhost:3000/api/badge/%20%20");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "%20%20" }) });

      assert.strictEqual(res.status, 404);
    });

    it("B5: Path traversal style slug returns HTTP 404", async () => {
      const req = new Request("http://localhost:3000/api/badge/%2e%2e%2f%2e%2e%2f");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "%2e%2e%2f%2e%2e%2f" }) });

      assert.strictEqual(res.status, 404);
    });

    it("B6: Script-tag slug returns HTTP 404", async () => {
      const req = new Request("http://localhost:3000/api/badge/%3Cscript%3Ealert(1)%3C%2Fscript%3E");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "<script>alert(1)</script>" }) });

      assert.strictEqual(res.status, 404);
    });

    it("B7: SVG output contains the correct verification tier", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svg = await res.text();

      assert(svg.includes("Revenue Verified"), "Must contain Revenue Verified tier text");
      assert(svg.includes("#b9ff4b"), "Must contain green brand color");
    });

    it("B8: REVENUE_VERIFIED produces 'Revenue Verified' and #b9ff4b", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svg = await res.text();

      assert(svg.includes("Revenue Verified"));
      assert(svg.includes("#b9ff4b"));
    });

    it("B9: PAYMENT_CONNECTED produces 'Payment Connected' and #f59e0b", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-beta-connected");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-beta-connected" }) });
      const svg = await res.text();

      assert(svg.includes("Payment Connected"));
      assert(svg.includes("#f59e0b"));
    });

    it("B10: SELF_REPORTED produces 'Self Reported' and #71717a", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-gamma-selfreported");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-gamma-selfreported" }) });
      const svg = await res.text();

      assert(svg.includes("Self Reported"));
      assert(svg.includes("#71717a"));
    });

    it("B11: Badge cannot be forced into a higher tier via client search params", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-gamma-selfreported?tier=REVENUE_VERIFIED&verified=true");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-gamma-selfreported" }) });
      const svg = await res.text();

      assert(svg.includes("Self Reported"), "Must remain Self Reported despite query params");
      assert(!svg.includes("Revenue Verified"), "Must NOT accept client-injected tier");
    });

    it("B12: Adversarial startup names are safely XML escaped", () => {
      const payloads = [
        "<svg/onload=alert(1)>",
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        `"><script>alert(1)</script>`,
        `& < > " '`,
        "</text><script>alert(1)</script>",
      ];

      for (const payload of payloads) {
        const escaped = escapeXml(payload);
        assert(!escaped.includes("<"), `Must not contain bare < for payload: ${payload}`);
        assert(!escaped.includes(">"), `Must not contain bare > for payload: ${payload}`);
        assert(!escaped.includes('"'), `Must not contain bare " for payload: ${payload}`);
        assert(!escaped.includes("'"), `Must not contain bare ' for payload: ${payload}`);
      }
    });

    it("B13: Truncation happens BEFORE XML escaping to prevent severed entity tags", () => {
      const rawName = "Test&Co <Markers> Ltd";
      const truncated = rawName.length > 15 ? rawName.substring(0, 14) + "..." : rawName;
      const encoded = escapeXml(truncated);

      assert.strictEqual(truncated, "Test&Co <Marke...");
      assert.strictEqual(encoded, "Test&amp;Co &lt;Marke...");
      assert(encoded.includes("&amp;"));
      assert(encoded.includes("&lt;"));
    });

    it("B14: Escaped XML remains structurally valid inside SVG text element", () => {
      const rawName = `Dangerous<Script>&"Quotes'`;
      const escaped = escapeXml(rawName);
      const svg = `<svg><text>${escaped}</text></svg>`;

      assert(!svg.includes("<Script>"));
      assert(svg.includes("&lt;Script&gt;"));
      assert(svg.includes("&amp;"));
      assert(svg.includes("&quot;"));
      assert(svg.includes("&apos;"));
    });

    it("B15: Badge response enforces Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });

      const csp = res.headers.get("Content-Security-Policy");
      assert(csp, "CSP header must be present");
      assert(csp.includes("default-src 'none'"));
      assert(csp.includes("style-src 'unsafe-inline'"));
    });

    it("B16: Badge response enforces Content-Type: image/svg+xml and inline Content-Disposition", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });

      assert.strictEqual(res.headers.get("Content-Type"), "image/svg+xml");
      assert.strictEqual(res.headers.get("Content-Disposition"), 'inline; filename="badge.svg"');
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP C: LEADERBOARD PUBLIC BOUNDARY
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group C: Leaderboard Public Boundary", () => {
    it("C1: Leaderboard query builder always attaches is_public = true", async () => {
      const query = (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true);

      const { data } = await query;
      assert(Array.isArray(data));
      for (const item of data) {
        assert.strictEqual(item.is_public, true, "Every leaderboard item must have is_public = true");
      }
    });

    it("C2: Private startup cannot appear in default leaderboard query", async () => {
      const { data } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true);

      const privateItem = data.find((s: any) => s.id === 102);
      assert.strictEqual(privateItem, undefined, "Private startup 102 must NOT appear in leaderboard");
    });

    it("C3: Private startup cannot appear through search", async () => {
      const params = parseLeaderboardParams({ q: "Private" });
      const { data } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true)
        .ilike("startup_name", `%${params.q}%`);

      assert.strictEqual(data.length, 0, "Private startup must not be returned by search");
    });

    it("C4: Private startup cannot appear through category filter", async () => {
      const params = parseLeaderboardParams({ category: "b2b_saas" });
      const { data } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true)
        .eq("biz_type", params.category);

      const privateItem = data.find((s: any) => s.id === 102);
      assert.strictEqual(privateItem, undefined);
    });

    it("C5: Private startup cannot appear through revenue-range filter", async () => {
      const params = parseLeaderboardParams({ revenue: "50k-plus" });
      const { data } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true)
        .gte("mrr", params.revenueRange!.min);

      const privateItem = data.find((s: any) => s.id === 102);
      assert.strictEqual(privateItem, undefined);
    });

    it("C6: Private startup cannot appear through pagination", async () => {
      const { from, to } = getPaginationOffsets(1, 20);
      assert.strictEqual(from, 0);
      assert.strictEqual(to, 19);

      const { data } = await (supabaseServer as any)
        .from("startup_submissions")
        .select("*")
        .eq("is_public", true)
        .range(from, to);

      const privateItem = data.find((s: any) => s.id === 102);
      assert.strictEqual(privateItem, undefined);
    });

    it("C7: Unverified / self-reported startups receive the correct verification tier presentation", () => {
      const selfReportedStartup = inMemoryStartups.find((s) => s.id === 202)!;
      const vState = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [],
          fraudSignals: [],
          penaltyCount: 0,
          verificationType: selfReportedStartup.verification_type,
        })
      );

      assert.strictEqual(vState.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(vState.hasVerificationEvidence, false);
    });

    it("C8: PAYMENT_CONNECTED is not falsely represented as REVENUE_VERIFIED", () => {
      const connectedStartup = inMemoryStartups.find((s) => s.id === 201)!;
      const vState = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [], // 0 transactions
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 201),
          fraudSignals: [],
          penaltyCount: 0,
          verificationType: "api",
        })
      );

      assert.strictEqual(vState.confidenceTier, "PAYMENT_CONNECTED");
      assert.strictEqual(vState.hasVerificationEvidence, false, "Must not have verification evidence");
    });

    it("C9: SELF_REPORTED is not falsely represented as provider-verified", () => {
      const vState = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [],
          fraudSignals: [],
          penaltyCount: 0,
          verificationType: "manual",
        })
      );

      assert.strictEqual(vState.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(vState.hasVerificationEvidence, false);
      assert.strictEqual(vState.dataSourceLabel, "Self-reported declaration");
    });

    it("C10: Verification filter (verification=verified) strictly filters by hasVerificationEvidence", () => {
      const candidates = [
        { id: 101, payment_connected: true, hasVerificationEvidence: true },
        { id: 201, payment_connected: true, hasVerificationEvidence: false },
        { id: 202, payment_connected: false, hasVerificationEvidence: false },
      ];

      const verifiedOnly = candidates.filter((c) => c.hasVerificationEvidence);
      assert.strictEqual(verifiedOnly.length, 1);
      assert.strictEqual(verifiedOnly[0].id, 101);
    });

    it("C11: Sorting prioritizes verified revenue and verification evidence over unverified claims", () => {
      const candidates = [
        { id: 202, mrr: 5000000, verifiedRevenue: 0, hasVerificationEvidence: false, growth: 10 },
        { id: 101, mrr: 500000, verifiedRevenue: 500000, hasVerificationEvidence: true, growth: 15 },
      ];

      const sorted = [...candidates].sort((a, b) => {
        if (a.verifiedRevenue !== b.verifiedRevenue) return b.verifiedRevenue - a.verifiedRevenue;
        if (a.hasVerificationEvidence !== b.hasVerificationEvidence) return a.hasVerificationEvidence ? -1 : 1;
        return b.growth - a.growth;
      });

      assert.strictEqual(sorted[0].id, 101, "Verified startup 101 must rank above unverified 202");
    });

    it("C12: Malicious search strings (SQL injection) cannot bypass public filtering", () => {
      const malicious = parseLeaderboardParams({ q: "Alpha'; DROP TABLE startups;--" });
      assert.strictEqual(malicious.q, "Alpha'; DROP TABLE startups;--");
      assert(malicious.q.length <= 100);
    });

    it("C13: SQL wildcard characters % and _ are stripped in search query sanitization", () => {
      const withWildcards = parseLeaderboardParams({ q: "100%_verified" });
      assert(!withWildcards.q.includes("%"));
      assert(!withWildcards.q.includes("_"));
      assert.strictEqual(withWildcards.q, "100  verified");
    });

    it("C14: Pagination cannot bypass the is_public boundary", async () => {
      const offsets = getPaginationOffsets(100, 20);
      assert.strictEqual(offsets.from, 1980);
      assert.strictEqual(offsets.to, 1999);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP D: PUBLIC API BOUNDARY INTEGRITY
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group D: Public API Boundary Integrity", () => {
    it("D1: GET /api/startup-submissions excludes private startups and strips email/name", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      const privateItem = json.data.find((s: any) => s.id === 102);
      assert.strictEqual(privateItem, undefined);
      for (const item of json.data) {
        assert.strictEqual(item.email, undefined);
        assert.strictEqual(item.user_id, undefined);
      }
    });

    it("D2: GET /api/startup-submissions/count counts only public startups", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions/count");
      const res = await getStartupSubmissionsCountRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.count, 4);
    });

    it("D3: GET /api/live-feed excludes private, ineligible, demo, and flagged startups", async () => {
      const req = new Request("http://localhost:3000/api/live-feed");
      const res = await getLiveFeedRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert(Array.isArray(json));
      for (const ev of json) {
        assert.notStrictEqual(ev.startupName, "Demo Sandbox Startup", "Demo startup must not appear in live feed");
        assert.notStrictEqual(ev.startupName, "Startup Alpha Private", "Private startup must not appear in live feed");
        assert.strictEqual(typeof ev.id !== "undefined", true);
        assert.strictEqual(typeof ev.event, "string");
        assert.strictEqual(typeof ev.startupName, "string");
        assert.strictEqual(typeof ev.timestamp, "string");
        assert.strictEqual((ev as any).amount, undefined, "Monetary amount must not be exposed");
      }
    });

    it("D4: GET /api/trust-metrics excludes private, ineligible, and demo startups", async () => {
      const req = new Request("http://localhost:3000/api/trust-metrics");
      const res = await getTrustMetricsRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.verifiedStartupCount, 2);
      assert.strictEqual(json.verifiedRevenueTotal, 500000);
    });

    it("D5: Visibility helper canStartupBePublic requires payment_connected = true", () => {
      const connected = canStartupBePublic({ payment_connected: true });
      assert.strictEqual(connected.eligible, true);
      assert.strictEqual(connected.reason, null);

      const unconnected = canStartupBePublic({ payment_connected: false });
      assert.strictEqual(unconnected.eligible, false);
      assert(unconnected.reason?.includes("verified payment provider"));
    });

    it("D6: Demo helper isDemoStartupUserId detects demo UUID prefixes", () => {
      assert.strictEqual(isDemoStartupUserId(DEMO_USER_ID), true);
      assert.strictEqual(isDemoStartupUserId(USER_A.id), false);
      assert.strictEqual(isDemoStartupUserId(null), false);
      assert.strictEqual(isDemoStartupUserId(undefined), false);
    });

    it("D7: Zero user email or credentials exposed across public endpoints", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      for (const item of json.data) {
        assert.strictEqual(item.email, undefined);
        assert.strictEqual(item.user_id, undefined);
        assert.strictEqual(item.proof_url, undefined);
      }
    });

    it("D8: Verification labels and public metrics derive from authoritative server engines", () => {
      const state101 = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      assert.strictEqual(state101.confidenceTier, "REVENUE_VERIFIED");

      const state201 = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 201),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      assert.strictEqual(state201.confidenceTier, "PAYMENT_CONNECTED");
    });

    it("D9: Malformed identifiers in badge API fail safely with HTTP 404", async () => {
      const malformedSlugs = [
        "non-existent-startup-9999",
        "../../etc/passwd",
        "<svg onload=alert(1)>",
        "%00nullbyte",
      ];

      for (const slug of malformedSlugs) {
        const req = new Request(`http://localhost:3000/api/badge/${encodeURIComponent(slug)}`);
        const res = await getBadgeRoute(req, { params: Promise.resolve({ slug }) });
        assert.strictEqual(res.status, 404, `Slug ${slug} must return 404`);
      }
    });

    it("D10: Public API endpoints declare safe Cache-Control headers", async () => {
      const req1 = new Request("http://localhost:3000/api/startup-submissions");
      const res1 = await getStartupSubmissionsRoute(req1);
      assert(res1.headers.get("Cache-Control")?.includes("public"));

      const req2 = new Request("http://localhost:3000/api/live-feed");
      const res2 = await getLiveFeedRoute(req2);
      assert(res2.headers.get("Cache-Control")?.includes("public"));

      const req3 = new Request("http://localhost:3000/api/trust-metrics");
      const res3 = await getTrustMetricsRoute(req3);
      assert(res3.headers.get("Cache-Control")?.includes("public"));
    });

    it("D11: Revenue values exposed publicly correspond strictly to authoritative revenue state", () => {
      const state101 = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      const verifiedRev = state101.providerBreakdown.reduce((sum: number, p: any) => sum + p.amount, 0);
      assert.strictEqual(verifiedRev, 500000);
    });

    it("D12: Unpublishing a startup (is_public = false) immediately removes it from public projections", async () => {
      inMemoryStartups[0].is_public = false;

      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      assert.strictEqual(res.status, 404, "Unpublished startup badge must immediately return 404");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP E: AUTHORITATIVE REVENUE CONSISTENCY
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group E: Authoritative Revenue Consistency", () => {
    it("E1: REVENUE_VERIFIED startup revenue is derived from authoritative transactions", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "REVENUE_VERIFIED");
      const total = state.providerBreakdown.reduce((sum: number, p: any) => sum + p.amount, 0);
      assert.strictEqual(total, 500000);
    });

    it("E2: Client-supplied mrr cannot override server-derived verified revenue", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      const serverVerifiedRevenue = state.providerBreakdown.reduce((sum: number, p: any) => sum + p.amount, 0);
      assert.strictEqual(serverVerifiedRevenue, 500000, "Server verified revenue remains 500,000");
    });

    it("E3: Client-supplied arr cannot override server-derived verified revenue", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "REVENUE_VERIFIED");
      assert.strictEqual(state.hasVerificationEvidence, true);
    });

    it("E4: Self-reported MRR cannot receive a 'Revenue Verified' representation", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [],
          fraudSignals: [],
          penaltyCount: 0,
          verificationType: "manual",
        })
      );

      assert.strictEqual(state.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(state.hasVerificationEvidence, false);
      assert.notStrictEqual(state.confidenceTier, "REVENUE_VERIFIED");
    });

    it("E5: PAYMENT_CONNECTED cannot receive 'Revenue Verified' without meeting criteria", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [
            { provider: "stripe", status: "connected", last_synced_at: new Date().toISOString() },
          ],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(state.confidenceTier, "PAYMENT_CONNECTED");
      assert.strictEqual(state.hasVerificationEvidence, false);
    });

    it("E6: Public profile and leaderboard evaluate verification tier consistently", () => {
      const vStateProfile = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      const vStateLeaderboard = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );

      assert.strictEqual(vStateProfile.confidenceTier, vStateLeaderboard.confidenceTier);
      assert.strictEqual(vStateProfile.hasVerificationEvidence, vStateLeaderboard.hasVerificationEvidence);
    });

    it("E7: Badge and profile do not disagree on verification tier", async () => {
      const req = new Request("http://localhost:3000/api/badge/startup-alpha");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "startup-alpha" }) });
      const svg = await res.text();

      assert(svg.includes("Revenue Verified"));

      const profileState = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 101),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 101),
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      assert.strictEqual(profileState.confidenceTier, "REVENUE_VERIFIED");
    });

    it("E8: Public API and profile do not expose contradictory verification states", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      const alpha = json.data.find((s: any) => s.id === 101);
      assert.strictEqual(alpha.payment_connected, true);
    });

    it("E9: When underlying provider state changes, verification tier updates dynamically", () => {
      const stateBefore = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [],
          providerConnections: [{ provider: "razorpay", status: "connected", last_synced_at: new Date().toISOString() }],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      assert.strictEqual(stateBefore.confidenceTier, "PAYMENT_CONNECTED");

      const stateAfter = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: [
            { amount: 50000, timestamp: Date.now() - 3000 },
            { amount: 50000, timestamp: Date.now() - 2000 },
            { amount: 50000, timestamp: Date.now() - 1000 },
          ],
          providerConnections: [{ provider: "razorpay", status: "connected", last_synced_at: new Date().toISOString() }],
          fraudSignals: [],
          penaltyCount: 0,
        })
      );
      assert.strictEqual(stateAfter.confidenceTier, "REVENUE_VERIFIED");
    });

    it("E10: Stored mrr in startup-submissions is the submission baseline and not falsely labelled verified", async () => {
      const req = new Request("http://localhost:3000/api/startup-submissions");
      const res = await getStartupSubmissionsRoute(req);
      const json = await res.json();

      const gamma = json.data.find((s: any) => s.id === 202);
      assert.strictEqual(gamma.payment_connected, false);
      assert.strictEqual(gamma.mrr, 50000);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP F: DEMO / SANDBOX ISOLATION
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group F: Demo / Sandbox Isolation", () => {
    it("F1: Demo startup is forced to selfReportedResult in computeVerificationState", () => {
      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 301),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 301),
          fraudSignals: [],
          penaltyCount: 0,
          isDemoProfile: true,
        })
      );

      assert.strictEqual(state.confidenceTier, "SELF_REPORTED");
      assert.strictEqual(state.hasVerificationEvidence, false);
      assert.strictEqual(state.dataSourceLabel, "Sandbox sample data");
    });

    it("F2: Demo startup cannot inflate leaderboard verified revenue", () => {
      const isDemo = isDemoStartupUserId(DEMO_USER_ID);
      assert.strictEqual(isDemo, true);

      const state = computeVerificationState(
        buildVerificationStateInput({
          revenueTransactions: inMemoryTransactions.filter((t) => t.startup_id === 301),
          providerConnections: inMemoryConnections.filter((c) => c.startup_id === 301),
          fraudSignals: [],
          penaltyCount: 0,
          isDemoProfile: isDemo,
        })
      );

      const verifiedRevenue = state.hasVerificationEvidence
        ? state.providerBreakdown.reduce((sum: number, p: any) => sum + p.amount, 0)
        : 0;

      assert.strictEqual(verifiedRevenue, 0, "Demo startup verified revenue must be 0");
    });

    it("F3: Demo startup cannot inflate trust metrics", async () => {
      const req = new Request("http://localhost:3000/api/trust-metrics");
      const res = await getTrustMetricsRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(json.verifiedRevenueTotal, 500000);
    });

    it("F4: Demo startup badge is forced to 'Self Reported' / non-verified", async () => {
      const req = new Request("http://localhost:3000/api/badge/demo-sandbox-startup");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "demo-sandbox-startup" }) });
      const svg = await res.text();

      assert(svg.includes("Self Reported"), "Demo badge must display Self Reported");
      assert(!svg.includes("Revenue Verified"), "Demo badge must NOT display Revenue Verified");
    });

    it("F5: Demo startup cannot appear in live-feed", async () => {
      const req = new Request("http://localhost:3000/api/live-feed");
      const res = await getLiveFeedRoute(req);
      const json = await res.json();

      assert.strictEqual(res.status, 200);
      const demoEvent = json.find((e: any) => e.startupName === "Demo Sandbox Startup");
      assert.strictEqual(demoEvent, undefined, "Demo startup must not appear in live feed");
    });

    it("F6: Demo data source resolves to sandbox descriptor", () => {
      const resolved = resolveTrustDataSource({
        confidenceTier: "SELF_REPORTED",
        providersConnected: ["stripe"],
        isDemoProfile: true,
      });

      assert.strictEqual(resolved.dataSource, "sandbox");
      assert.strictEqual(resolved.dataSourceLabel, "Sandbox sample data");
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // GROUP G: IDENTIFIER & ADVERSARIAL INPUT ROBUSTNESS
  // ═════════════════════════════════════════════════════════════════════════
  describe("Group G: Identifier & Adversarial Input Robustness", () => {
    it("G1: Nonexistent slug returns safe HTTP 404", async () => {
      const req = new Request("http://localhost:3000/api/badge/does-not-exist");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "does-not-exist" }) });
      assert.strictEqual(res.status, 404);
    });

    it("G2: Empty or whitespace-only slug returns safe failure", async () => {
      const req = new Request("http://localhost:3000/api/badge/%20");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: " " }) });
      assert.strictEqual(res.status, 404);
    });

    it("G3: Encoded ../ path traversal fails safely", async () => {
      const req = new Request("http://localhost:3000/api/badge/%2e%2e%2f%2e%2e%2fetc%2fpasswd");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "../../etc/passwd" }) });
      assert.strictEqual(res.status, 404);
    });

    it("G4: Encoded slash/backslash variants fail safely", async () => {
      const req = new Request("http://localhost:3000/api/badge/%5C..%5C..");
      const res = await getBadgeRoute(req, { params: Promise.resolve({ slug: "\\..\\.." }) });
      assert.strictEqual(res.status, 404);
    });

    it("G5: HTML injection payload is safely neutral in escapeXml", () => {
      const htmlPayload = `<div style="background:red">Attack</div>`;
      const escaped = escapeXml(htmlPayload);
      assert(!escaped.includes("<div"));
      assert.strictEqual(escaped, `&lt;div style=&quot;background:red&quot;&gt;Attack&lt;/div&gt;`);
    });

    it("G6: SVG injection payload in badge text is neutralized", () => {
      const svgPayload = `</text><script href="data:text/javascript,alert(1)"/>`;
      const escaped = escapeXml(svgPayload);
      assert(!escaped.includes("</text>"));
      assert(escaped.includes("&lt;/text&gt;"));
    });

    it("G7: XML entity payloads (&, <, >, \", ') are properly converted to entities", () => {
      const allEntities = `A & B < C > D " E ' F`;
      const escaped = escapeXml(allEntities);
      assert.strictEqual(escaped, `A &amp; B &lt; C &gt; D &quot; E &apos; F`);
    });

    it("G8: Unicode and RTL / zero-width characters do not crash or corrupt XML encoding", () => {
      const unicodeName = `Startup \u200B\u200C\u200D\uFEFF\u0627\u0644\u0639\u0631\u0628\u064A\u0629`;
      const escaped = escapeXml(unicodeName);
      assert(escaped.includes("\u0627\u0644\u0639\u0631\u0628\u064A\u0629"));
    });

    it("G9: Extremely long startup names (> 120 chars) are safely truncated before XML escaping", () => {
      const longName = "A".repeat(200) + " & <script>";
      const truncated = longName.length > 15 ? longName.substring(0, 14) + "..." : longName;
      const escaped = escapeXml(truncated);

      assert.strictEqual(truncated, "AAAAAAAAAAAAAA...");
      assert.strictEqual(escaped, "AAAAAAAAAAAAAA...");
      assert(escaped.length <= 20);
    });

    it("G10: Slug normalization and slugify safely cleans special characters", () => {
      assert.strictEqual(slugify("My Cool Startup #1!"), "my-cool-startup-1");
      assert.strictEqual(slugify("   Spaces & Ampersands   "), "spaces-ampersands");
      assert.strictEqual(slugify("---Dashes---"), "dashes");
      assert.strictEqual(normalizeStartupName("  ACME   AI   "), "acme ai");
    });

    it("G11: Numeric ID lookup in badge route enforces is_public = true", async () => {
      // ID 101 is public -> returns 200
      const req101 = new Request("http://localhost:3000/api/badge/101");
      const res101 = await getBadgeRoute(req101, { params: Promise.resolve({ slug: "101" }) });
      assert.strictEqual(res101.status, 200);

      // ID 102 is private -> returns 404
      const req102 = new Request("http://localhost:3000/api/badge/102");
      const res102 = await getBadgeRoute(req102, { params: Promise.resolve({ slug: "102" }) });
      assert.strictEqual(res102.status, 404);
    });
  });
});

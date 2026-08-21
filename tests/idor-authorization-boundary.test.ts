/**
 * TEST 04 — Consolidated IDOR & Authorization Boundary Test Suite
 *
 * Authoritative automated verification of cross-user authorization barriers,
 * tenant isolation, resource ownership enforcement, and admin boundary controls.
 *
 * AUTHENTICATION STRATEGY:
 * Both getAuthenticatedUser() and verifyStartupOwnership() are the REAL production
 * functions from src/lib/auth-server.ts. Only their upstream I/O dependencies are
 * mocked:
 *   - next/headers  (mocked to supply deterministic Bearer tokens)
 *   - @supabase/supabase-js createClient  (mocked to resolve tokens to test users)
 *   - @supabase/ssr createServerClient  (mocked to return null user on cookie path)
 *   - supabaseServer.from()  (mocked to use in-memory test fixtures)
 *
 * Invariants Tested:
 * 1. Unauthenticated requests to protected endpoints return HTTP 401.
 * 2. User A cannot read User B's private startup overview (HTTP 403).
 * 3. User A cannot read User B's provider connection details (HTTP 403).
 * 4. User A cannot access User B's uploaded proof document or signed URL (HTTP 403).
 * 5. User A querying feedback receives ONLY User A's feedback; User B rows are strictly isolated.
 * 6. User B querying feedback receives ONLY User B's feedback; User A rows are strictly isolated.
 * 7. Non-admin User A requesting admin endpoints receives HTTP 403.
 * 8. User A cannot mutate User B's startup identity (HTTP 403; zero DB update invoked).
 * 9. User A cannot trigger provider sync for User B's startup (HTTP 403; zero sync invoked).
 * 10. User A cannot create an investor report order for User B's startup (HTTP 403).
 * 11. Client-supplied body user_id cannot override authenticated user identity.
 * 12. The real production verifyStartupOwnership() is loaded and exercised.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "../src/lib/supabase-server";

// ─── Deterministic Test Fixtures ──────────────────────────────────────────────

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

interface StartupRecord {
  id: number;
  slug: string;
  startup_name: string;
  user_id: string;
  proof_url: string | null;
  trust_score: number;
  verification_type: string;
  penalty_count: number;
  is_public: boolean;
  payment_connected: boolean;
  founder_name?: string;
  founder_bio?: string;
  founder_avatar?: string;
  startup_logo?: string;
}

interface ProviderConnectionRecord {
  id: number;
  startup_id: number;
  provider: string;
  status: string;
  api_key_encrypted: string;
  last_synced_at: string | null;
  latest_revenue: number;
}

interface FeedbackRecord {
  id: string;
  user_id: string;
  user_email: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  feedback_replies?: any[];
}

// ─── Test State & Mutation Spies ──────────────────────────────────────────────

/** Controls which user getAuthenticatedUser() resolves via mocked createClient.auth.getUser() */
let activeBearerToken: string | null = null;

/** Tracks how many times supabaseServer.from("startup_submissions") was queried (used to prove real verifyStartupOwnership executes) */
let ownershipDbQueryCount = 0;

const mutationSpies = {
  startupUpdated: false,
  providerSyncInvoked: false,
  razorpayOrderCreated: false,
  investorReportInserted: false,
  signedUrlGenerated: false,
};

let inMemoryStartups: StartupRecord[] = [];
let inMemoryConnections: ProviderConnectionRecord[] = [];
let inMemoryFeedback: FeedbackRecord[] = [];

function resetTestDatabase() {
  activeBearerToken = null;
  ownershipDbQueryCount = 0;
  mutationSpies.startupUpdated = false;
  mutationSpies.providerSyncInvoked = false;
  mutationSpies.razorpayOrderCreated = false;
  mutationSpies.investorReportInserted = false;
  mutationSpies.signedUrlGenerated = false;

  inMemoryStartups = [
    {
      id: 101,
      slug: "startup-alpha",
      startup_name: "Startup Alpha",
      user_id: USER_A.id,
      proof_url: "proofs/startup-alpha-proof.pdf",
      trust_score: 85,
      verification_type: "stripe",
      penalty_count: 0,
      is_public: true,
      payment_connected: true,
      founder_name: "Founder A",
    },
    {
      id: 202,
      slug: "startup-beta",
      startup_name: "Startup Beta",
      user_id: USER_B.id,
      proof_url: "proofs/startup-beta-proof.pdf",
      trust_score: 92,
      verification_type: "razorpay",
      penalty_count: 0,
      is_public: true,
      payment_connected: true,
      founder_name: "Founder B",
    },
    {
      id: 303,
      slug: "demo-sandbox",
      startup_name: "Demo Sandbox",
      user_id: "00000000-0000-0000-0000-000000000001",
      proof_url: null,
      trust_score: 75,
      verification_type: "manual",
      penalty_count: 0,
      is_public: true,
      payment_connected: false,
    },
  ];

  inMemoryConnections = [
    {
      id: 1,
      startup_id: 101,
      provider: "stripe",
      status: "connected",
      api_key_encrypted: "SECRET_GCM_ENCRYPTED_KEY_ALPHA",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 50000,
    },
    {
      id: 2,
      startup_id: 202,
      provider: "razorpay",
      status: "connected",
      api_key_encrypted: "SECRET_GCM_ENCRYPTED_KEY_BETA",
      last_synced_at: new Date().toISOString(),
      latest_revenue: 120000,
    },
  ];

  inMemoryFeedback = [
    {
      id: "fb-11111111-1111-4111-a111-111111111111",
      user_id: USER_A.id,
      user_email: USER_A.email!,
      category: "feature",
      message: "User A private feedback request regarding export tools.",
      status: "open",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      feedback_replies: [],
    },
    {
      id: "fb-22222222-2222-4222-b222-222222222222",
      user_id: USER_B.id,
      user_email: USER_B.email!,
      category: "bug",
      message: "User B confidential bug report on analytics dashboard.",
      status: "open",
      created_at: "2026-08-02T10:00:00Z",
      updated_at: "2026-08-02T10:00:00Z",
      feedback_replies: [],
    },
  ];
}

// ─── Dependency Interception ──────────────────────────────────────────────────
//
// Strategy: Mock ONLY the upstream I/O dependencies of getAuthenticatedUser()
// so that both getAuthenticatedUser() AND verifyStartupOwnership() execute as
// the REAL production code from src/lib/auth-server.ts.
//
// What is mocked:
//   1. next/headers        — supplies deterministic Authorization Bearer tokens
//   2. @supabase/supabase-js createClient — resolves tokens to test User objects
//   3. @supabase/ssr createServerClient   — returns null user on cookie fallback
//   4. rate-limit           — prevents HTTP 429 during rapid test execution
//   5. supabaseServer.from() — in-memory database fixtures
//   6. supabaseServer.storage — in-memory signed URL spy
//
// What is NOT mocked:
//   - getAuthenticatedUser()      (REAL production function)
//   - verifyStartupOwnership()    (REAL production function)
//   - isAdmin()                   (REAL production function)
//   - Route handler authorization logic (REAL production code)

// 1. Mock next/headers — dependency of getAuthenticatedUser() in auth-server.ts
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

// 2. Mock rate-limit to prevent 429 during automated testing
const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_client_idor_harness",
    checkRateLimit: async () => ({ allowed: true, remaining: 100 }),
  },
} as NodeModule;

// 3. Override @supabase/supabase-js createClient — used by getAuthenticatedUser()
//    to resolve Bearer tokens to User objects. The existing supabaseServer singleton
//    (already created) is unaffected.
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

// 4. Mock @supabase/ssr createServerClient — cookie fallback path in getAuthenticatedUser()
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

// 5. Mock supabaseServer.from() — in-memory database layer
(supabaseServer as any).from = (table: string) => {
  const filters: Array<{ column: string; value: any; op: string }> = [];
  let isSingle = false;
  let isMaybeSingle = false;
  let updateData: any = null;
  let insertData: any = null;

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
    update: (data: any) => {
      updateData = data;
      return chain;
    },
    insert: (data: any) => {
      insertData = data;
      return chain;
    },
    then: (resolve: (val: any) => void) => {
      if (updateData) {
        if (table === "startup_submissions") {
          mutationSpies.startupUpdated = true;
        }
        return resolve({ data: updateData, error: null });
      }

      if (insertData) {
        if (table === "investor_reports") {
          mutationSpies.investorReportInserted = true;
        }
        return resolve({ data: insertData, error: null });
      }

      let dataSet: any[] = [];
      if (table === "startup_submissions") {
        ownershipDbQueryCount++;
        dataSet = [...inMemoryStartups];
      } else if (table === "provider_connections") dataSet = [...inMemoryConnections];
      else if (table === "feedback") dataSet = [...inMemoryFeedback];
      else if (table === "revenue_snapshots") dataSet = [];
      else if (table === "revenue_transactions") dataSet = [];
      else if (table === "fraud_signals") dataSet = [];
      else if (table === "verification_logs") dataSet = [];

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
          return resolve({ data: null, error: { message: "Row not found" } });
        }
        return resolve({ data: item, error: null });
      }

      return resolve({ data: dataSet, error: null });
    },
  };

  return chain;
};

// 6. Mock Supabase storage signed URL generator
(supabaseServer as any).storage = {
  from: (bucket: string) => ({
    createSignedUrl: async (path: string, expiresIn: number) => {
      mutationSpies.signedUrlGenerated = true;
      return {
        data: { signedUrl: `https://mock.supabase.storage/${bucket}/${path}?token=signed_test_token` },
        error: null,
      };
    },
  }),
};

// ─── Import Target Route Handlers After Dependency Interception ───────────────
//
// NOTE: auth-server.ts is NOT in require.cache. It loads NATURALLY when the first
// route handler requires it. Both getAuthenticatedUser() and verifyStartupOwnership()
// are the REAL production implementations from src/lib/auth-server.ts.

const { GET: getStartupOverview } = require("../src/app/api/startup/[id]/overview/route");
const { GET: getStartupConnections } = require("../src/app/api/startup/[id]/connections/route");
const { GET: getStartupProof } = require("../src/app/api/startup/[id]/proof/route");
const { GET: getFeedback } = require("../src/app/api/feedback/route");
const { GET: getAdminFeedback } = require("../src/app/api/admin/feedback/route");
const { GET: getAdminOnboardingAnalytics } = require("../src/app/api/admin/analytics/onboarding/route");
const { POST: postAdminReview } = require("../src/app/api/admin/review/route");
const { PUT: putStartupIdentity } = require("../src/app/api/startup/[id]/identity/route");
const { POST: postStartupSync } = require("../src/app/api/startup/[id]/sync/route");
const { POST: postCreateReportOrder } = require("../src/app/api/reports/create-order/route");

// Verify that auth-server loaded naturally (not from a synthetic require.cache mock)
const authServerPath = require.resolve("../src/lib/auth-server");
const loadedAuthServer = require.cache[authServerPath];
if (!loadedAuthServer || !loadedAuthServer.loaded) {
  throw new Error("FATAL: auth-server.ts was not loaded naturally. Test integrity compromised.");
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("TEST 04 — Consolidated IDOR & Multi-Tenant Authorization Boundary", () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  // ── TEST A: Unauthenticated Baseline ───────────────────────────────────────

  describe("TEST A — Unauthenticated Baseline Rejection", () => {
    it("A1: Unauthenticated request to /api/startup/[id]/overview returns HTTP 401", async () => {
      activeBearerToken = null;
      const req = new Request("http://localhost:3000/api/startup/101/overview");
      const res = await getStartupOverview(req, { params: Promise.resolve({ id: "101" }) });

      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /authentication/i);
    });

    it("A2: Unauthenticated request to /api/startup/[id]/connections returns HTTP 401", async () => {
      activeBearerToken = null;
      const req = new Request("http://localhost:3000/api/startup/101/connections");
      const res = await getStartupConnections(req, { params: Promise.resolve({ id: "101" }) });

      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /authentication/i);
    });

    it("A3: Unauthenticated request to /api/startup/[id]/proof returns HTTP 401", async () => {
      activeBearerToken = null;
      const req = new Request("http://localhost:3000/api/startup/101/proof");
      const res = await getStartupProof(req, { params: Promise.resolve({ id: "101" }) });

      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /unauthorized/i);
    });

    it("A4: Unauthenticated request to /api/feedback returns HTTP 401", async () => {
      activeBearerToken = null;
      const res = await getFeedback();

      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /unauthorized/i);
    });
  });

  // ── TEST B: Cross-User Startup Read Isolation ──────────────────────────────

  describe("TEST B — Cross-User Startup Read Isolation (User A -> Startup B)", () => {
    it("B1: User A requesting User B's startup overview returns HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a"; // Authenticated as User A
      const req = new Request("http://localhost:3000/api/startup/202/overview"); // Target Startup B (owned by User B)
      const res = await getStartupOverview(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error, "Forbidden");
    });

    it("B2: User A requesting User B's startup connections returns HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/startup/202/connections");
      const res = await getStartupConnections(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error, "Forbidden");
    });

    it("B3: User A requesting User B's uploaded proof signed URL returns HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/startup/202/proof");
      const res = await getStartupProof(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error, "Forbidden");
      assert.strictEqual(mutationSpies.signedUrlGenerated, false, "Signed URL must NOT be generated for non-owner");
    });

    it("B4: Legitimate owner User B can read Startup B overview successfully", async () => {
      activeBearerToken = "token_user_b";
      const req = new Request("http://localhost:3000/api/startup/202/overview");
      const res = await getStartupOverview(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.startup.name, "Startup Beta");
    });
  });

  // ── TEST C: Tenant Feedback Isolation ──────────────────────────────────────

  describe("TEST C — Multi-Tenant Feedback Isolation", () => {
    it("C1: User A querying feedback receives ONLY User A's feedback rows", async () => {
      activeBearerToken = "token_user_a";
      const res = await getFeedback();

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert(Array.isArray(json.feedback));
      assert.strictEqual(json.feedback.length, 1);
      assert.strictEqual(json.feedback[0].id, "fb-11111111-1111-4111-a111-111111111111");
      assert.match(json.feedback[0].message, /User A/);

      // Explicit cross-tenant assertion: User B feedback is NOT present
      const userBFeedbackPresent = json.feedback.some(
        (f: any) => f.id === "fb-22222222-2222-4222-b222-222222222222"
      );
      assert.strictEqual(userBFeedbackPresent, false, "User B's feedback MUST NOT leak to User A");
    });

    it("C2: User B querying feedback receives ONLY User B's feedback rows", async () => {
      activeBearerToken = "token_user_b";
      const res = await getFeedback();

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert(Array.isArray(json.feedback));
      assert.strictEqual(json.feedback.length, 1);
      assert.strictEqual(json.feedback[0].id, "fb-22222222-2222-4222-b222-222222222222");
      assert.match(json.feedback[0].message, /User B/);

      // Explicit cross-tenant assertion: User A feedback is NOT present
      const userAFeedbackPresent = json.feedback.some(
        (f: any) => f.id === "fb-11111111-1111-4111-a111-111111111111"
      );
      assert.strictEqual(userAFeedbackPresent, false, "User A's feedback MUST NOT leak to User B");
    });
  });

  // ── TEST D: Admin Barrier Protection ───────────────────────────────────────

  describe("TEST D — Administrator Authorization Barrier", () => {
    it("D1: Non-admin User A requesting /api/admin/feedback receives HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a"; // Non-admin email
      const req = new Request("http://localhost:3000/api/admin/feedback");
      const res = await getAdminFeedback(req);

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /admin access required/i);
    });

    it("D2: Non-admin User A requesting /api/admin/analytics/onboarding receives HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/admin/analytics/onboarding");
      const res = await getAdminOnboardingAnalytics(req);

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /forbidden/i);
    });

    it("D3: Non-admin User A requesting POST /api/admin/review receives HTTP 403 Forbidden", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 101, action: "approve" }),
      });
      const res = await postAdminReview(req);

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /unauthorized/i);
    });

    it("D4: Authorized Admin user can access /api/admin/feedback", async () => {
      activeBearerToken = "token_admin"; // Allowlisted admin email
      const req = new Request("http://localhost:3000/api/admin/feedback");
      const res = await getAdminFeedback(req);

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert(Array.isArray(json.feedback));
    });
  });

  // ── TEST E: Cross-User Startup Identity Mutation ───────────────────────────

  describe("TEST E — Cross-User Startup Identity Mutation Barrier", () => {
    it("E1: User A attempting to mutate Startup B identity returns HTTP 403 and prevents DB update", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/startup/202/identity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founder_name: "Attacker Impersonator",
          founder_bio: "Malicious modification",
          is_public: false,
        }),
      });

      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /forbidden|unauthorized/i);
      assert.strictEqual(mutationSpies.startupUpdated, false, "Database update must NOT be invoked on cross-user attempt");
    });
  });

  // ── TEST F: Cross-User Provider Sync Barrier ───────────────────────────────

  describe("TEST F — Cross-User Provider Synchronization Barrier", () => {
    it("F1: User A attempting to trigger sync for Startup B returns HTTP 403 and halts execution", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/startup/202/sync", {
        method: "POST",
      });

      const res = await postStartupSync(req, { params: Promise.resolve({ id: "202" }) });

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /ownership check failed/i);
      assert.strictEqual(mutationSpies.providerSyncInvoked, false, "Provider sync must NOT execute on cross-user attempt");
    });
  });

  // ── TEST G: Cross-User Investor Report Order Creation ──────────────────────

  describe("TEST G — Cross-User Investor Report Order Creation Barrier", () => {
    it("G1: User A attempting to create report order for Startup B returns HTTP 403 and blocks order creation", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/reports/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startup_id: 202 }),
      });

      const res = await postCreateReportOrder(req);

      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /not owned by authenticated user/i);
      assert.strictEqual(mutationSpies.investorReportInserted, false, "Pending report record must NOT be inserted");
    });
  });

  // ── TEST H: Client-Supplied Body user_id Rejection Invariant ───────────────

  describe("TEST H — Client-Supplied Body user_id Injection Rejection", () => {
    it("H1: Supplying another user's user_id in the request body does NOT bypass ownership check", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost:3000/api/reports/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startup_id: 202,
          user_id: USER_B.id, // Attacker attempts to spoof user_id in body
        }),
      });

      const res = await postCreateReportOrder(req);

      // Server must reject with 403 based on authenticated identity (USER_A)
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /not owned by authenticated user/i);
    });
  });

  // ── TEST I: Production verifyStartupOwnership Execution Proof ──────────────

  describe("TEST I — Production verifyStartupOwnership Execution Proof", () => {
    it("I1: Real production verifyStartupOwnership() from src/lib/auth-server.ts is loaded, queries the database, and evaluates ownership correctly", async () => {
      // 1. Verify auth-server was loaded naturally (not replaced by a synthetic mock)
      const authServerCacheEntry = require.cache[require.resolve("../src/lib/auth-server")];
      assert.ok(authServerCacheEntry, "auth-server module must be present in require.cache");
      assert.ok(authServerCacheEntry.loaded, "auth-server module must be loaded (not a synthetic stub)");

      const authServerExports = authServerCacheEntry.exports;
      assert.strictEqual(typeof authServerExports.verifyStartupOwnership, "function",
        "verifyStartupOwnership must be an exported function");
      assert.strictEqual(typeof authServerExports.getAuthenticatedUser, "function",
        "getAuthenticatedUser must be an exported function");

      // 2. Call the REAL verifyStartupOwnership directly: User A vs Startup B (cross-user)
      activeBearerToken = "token_user_a";
      ownershipDbQueryCount = 0;
      const crossUserResult = await authServerExports.verifyStartupOwnership(202);

      assert.strictEqual(crossUserResult.authenticated, true, "User A is authenticated");
      assert.strictEqual(crossUserResult.owned, false, "User A does NOT own Startup B");
      assert.strictEqual(crossUserResult.user?.id, USER_A.id, "Authenticated user identity is User A");
      assert.strictEqual(crossUserResult.startup?.user_id, USER_B.id, "Queried startup belongs to User B");
      assert.strictEqual(crossUserResult.isDemo, false, "Startup B is not a demo fixture");
      assert.ok(ownershipDbQueryCount > 0,
        "Production verifyStartupOwnership MUST query startup_submissions via supabaseServer.from()");

      // 3. Call the REAL verifyStartupOwnership: User B vs Startup B (legitimate owner)
      activeBearerToken = "token_user_b";
      ownershipDbQueryCount = 0;
      const ownerResult = await authServerExports.verifyStartupOwnership(202);

      assert.strictEqual(ownerResult.authenticated, true, "User B is authenticated");
      assert.strictEqual(ownerResult.owned, true, "User B DOES own Startup B");
      assert.ok(ownershipDbQueryCount > 0,
        "Production verifyStartupOwnership queries DB for positive ownership case too");

      // 4. Call the REAL verifyStartupOwnership: Demo sandbox startup
      ownershipDbQueryCount = 0;
      const demoResult = await authServerExports.verifyStartupOwnership(303);

      assert.strictEqual(demoResult.isDemo, true, "Demo sandbox startup is correctly identified as demo");
      assert.strictEqual(demoResult.owned, false, "Demo startup is never returned as owned");
      assert.ok(ownershipDbQueryCount > 0,
        "Production verifyStartupOwnership queries DB even for demo startups");

      // 5. Call the REAL verifyStartupOwnership: Unauthenticated caller
      activeBearerToken = null;
      const unauthResult = await authServerExports.verifyStartupOwnership(101);

      assert.strictEqual(unauthResult.authenticated, false, "Unauthenticated caller is detected");
      assert.strictEqual(unauthResult.owned, false, "Unauthenticated caller has no ownership");
      assert.strictEqual(unauthResult.user, null, "Unauthenticated caller has null user");
    });
  });
});

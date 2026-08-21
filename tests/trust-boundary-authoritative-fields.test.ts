/**
 * TEST 06 — Trust Boundary & Authoritative Server Data Integrity Test Suite
 *
 * Automated verification that security-sensitive and authoritative values
 * (caller identity, startup ownership, verified revenue, trust score, confidence,
 * verification status, billing amounts, plan codes, investor-report pricing/entitlements,
 * and admin privileges) cannot be forged, manipulated, or escalated through
 * client-supplied request payloads.
 *
 * AUTHENTICATION & I/O MOCKING STRATEGY:
 * - Real production route handlers and validation functions are executed.
 * - getAuthenticatedUser(), verifyStartupOwnership(), and isAdmin() are REAL.
 * - Upstream I/O (next/headers, @supabase/supabase-js createClient, rate-limit,
 *   supabaseServer.from(), supabaseServer.storage, Razorpay SDK) is intercepted
 *   with in-memory fixtures and spies to capture downstream write arguments.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import type { User } from "@supabase/supabase-js";

// ─── Deterministic Test Users ─────────────────────────────────────────────────

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

// ─── In-Memory Database Fixtures & Write Spies ────────────────────────────────

interface StartupRecord {
  id: number;
  slug: string;
  startup_name: string;
  user_id: string;
  proof_url: string | null;
  trust_score: number;
  confidence?: number;
  verification_type: string;
  verification_status?: string;
  verified_revenue?: number | null;
  verification_source?: string | null;
  payment_connected: boolean;
  is_public: boolean;
  mrr?: number;
  arr?: number;
  founder_name?: string;
  founder_bio?: string;
  founder_avatar?: string;
  startup_logo?: string;
  [key: string]: any;
}

interface InvestorReportRecord {
  id: string;
  user_id: string;
  startup_id: number;
  amount_inr: number;
  currency: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  generation_status: "pending" | "generating" | "completed" | "failed";
  storage_path?: string | null;
  metrics_snapshot?: Record<string, unknown>;
  report_period: string;
  created_at: string;
  updated_at: string;
}

let activeBearerToken: string | null = null;
let lastInsertedStartup: Record<string, unknown> | null = null;
let lastUpdatedStartup: Record<string, unknown> | null = null;
let lastInsertedReport: Record<string, unknown> | null = null;
let lastUpdatedReport: Record<string, unknown> | null = null;
let lastRazorpayOrderOptions: Record<string, unknown> | null = null;
let lastRazorpaySubscriptionOptions: Record<string, unknown> | null = null;
let lastSignedUrlRequestedPath: string | null = null;

let inMemoryStartups: StartupRecord[] = [];
let inMemoryReports: InvestorReportRecord[] = [];

function resetTestState() {
  activeBearerToken = null;
  lastInsertedStartup = null;
  lastUpdatedStartup = null;
  lastInsertedReport = null;
  lastUpdatedReport = null;
  lastRazorpayOrderOptions = null;
  lastRazorpaySubscriptionOptions = null;
  lastSignedUrlRequestedPath = null;

  inMemoryStartups = [
    {
      id: 101,
      slug: "startup-alpha",
      startup_name: "Startup Alpha",
      user_id: USER_A.id,
      proof_url: "proofs/startup-alpha-proof.pdf",
      trust_score: 85,
      confidence: 85,
      verification_type: "stripe",
      verification_status: "stripe_connected",
      verified_revenue: 50000,
      payment_connected: true,
      is_public: true,
      mrr: 50000,
      arr: 600000,
      founder_name: "Founder A",
    },
    {
      id: 202,
      slug: "startup-beta",
      startup_name: "Startup Beta",
      user_id: USER_B.id,
      proof_url: "proofs/startup-beta-proof.pdf",
      trust_score: 92,
      confidence: 90,
      verification_type: "razorpay",
      verification_status: "razorpay_connected",
      verified_revenue: 120000,
      payment_connected: true,
      is_public: true,
      mrr: 120000,
      arr: 1440000,
      founder_name: "Founder B",
    },
    {
      id: 303,
      slug: "demo-sandbox",
      startup_name: "Demo Sandbox",
      user_id: "00000000-0000-0000-0000-000000000001",
      proof_url: null,
      trust_score: 75,
      confidence: 70,
      verification_type: "manual",
      verification_status: "pending",
      payment_connected: false,
      is_public: false,
      mrr: 10000,
      arr: 120000,
    },
    {
      id: 404,
      slug: "unverified-startup",
      startup_name: "Unverified Startup",
      user_id: USER_A.id,
      proof_url: null,
      trust_score: 0,
      confidence: 0,
      verification_type: "manual",
      verification_status: "pending",
      verified_revenue: null,
      payment_connected: false,
      is_public: false,
      mrr: 0,
      arr: 0,
    },
  ];

  inMemoryReports = [
    {
      id: "rep-aaaa1111-1111-4111-a111-111111111111",
      user_id: USER_A.id,
      startup_id: 101,
      amount_inr: 499,
      currency: "INR",
      razorpay_order_id: "order_rzp_test_owner_a_101",
      razorpay_payment_id: "pay_rzp_test_owner_a_101",
      payment_status: "paid",
      generation_status: "completed",
      storage_path: `${USER_A.id}/rep-aaaa1111-1111-4111-a111-111111111111.pdf`,
      metrics_snapshot: { mrr: 50000, verified: true },
      report_period: "30_days",
      created_at: "2026-08-19T10:00:00Z",
      updated_at: "2026-08-19T10:05:00Z",
    },
    {
      id: "rep-bbbb2222-2222-4222-b222-222222222222",
      user_id: USER_B.id,
      startup_id: 202,
      amount_inr: 499,
      currency: "INR",
      razorpay_order_id: "order_rzp_test_owner_b_202",
      razorpay_payment_id: "pay_rzp_test_owner_b_202",
      payment_status: "paid",
      generation_status: "completed",
      storage_path: `${USER_B.id}/rep-bbbb2222-2222-4222-b222-222222222222.pdf`,
      metrics_snapshot: { mrr: 120000, verified: true },
      report_period: "30_days",
      created_at: "2026-08-19T11:00:00Z",
      updated_at: "2026-08-19T11:05:00Z",
    },
    {
      id: "rep-pending-a-1111",
      user_id: USER_A.id,
      startup_id: 101,
      amount_inr: 499,
      currency: "INR",
      razorpay_order_id: "order_rzp_pending_a",
      payment_status: "pending",
      generation_status: "pending",
      storage_path: null,
      metrics_snapshot: {},
      report_period: "30_days",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

// ─── Module Interception Setup ────────────────────────────────────────────────

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
      get: (name: string) => (activeBearerToken ? { value: activeBearerToken } : null),
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
    getClientIdentifier: () => "test_client_trust_boundary_harness",
    checkRateLimit: async () => ({ allowed: true, remaining: 100, reset: 0 }),
  },
} as NodeModule;

// 3. Mock @supabase/supabase-js createClient — used by getAuthenticatedUser()
const supabaseJsPath = require.resolve("@supabase/supabase-js");
const realSupabaseJs = require("@supabase/supabase-js");

const mockCreateClient = (url: string, key: string, options?: any) => ({
  auth: {
    getUser: async (token?: string) => {
      const t = token || activeBearerToken;
      if (t === "token_user_a") return { data: { user: USER_A }, error: null };
      if (t === "token_user_b") return { data: { user: USER_B }, error: null };
      if (t === "token_admin") return { data: { user: ADMIN_USER }, error: null };
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
        getUser: async () => {
          if (activeBearerToken === "token_user_a") return { data: { user: USER_A }, error: null };
          if (activeBearerToken === "token_user_b") return { data: { user: USER_B }, error: null };
          if (activeBearerToken === "token_admin") return { data: { user: ADMIN_USER }, error: null };
          return { data: { user: null }, error: new Error("No session") };
        },
      },
    }),
  },
} as NodeModule;

// 5. Mock Razorpay SDK
const razorpayModulePath = require.resolve("razorpay");
let customPaymentAmount: number = 49900;
let customPaymentCurrency: string = "INR";
let customPaymentStatus: string = "captured";

const mockRazorpayConstructor = function (this: any, options: { key_id: string; key_secret: string }) {
  this.orders = {
    create: async (opts: any) => {
      lastRazorpayOrderOptions = opts;
      return {
        id: `order_mock_${Date.now()}`,
        amount: opts.amount,
        currency: opts.currency,
        status: "created",
        receipt: opts.receipt,
      };
    },
    fetch: async (orderId: string) => ({
      id: orderId,
      amount: 49900,
      currency: "INR",
      status: "created",
    }),
    fetchPayments: async () => ({ items: [] }),
  };
  this.payments = {
    fetch: async (paymentId: string) => ({
      id: paymentId,
      order_id: "order_rzp_pending_a",
      amount: customPaymentAmount,
      currency: customPaymentCurrency,
      status: customPaymentStatus,
    }),
  };
  this.subscriptions = {
    create: async (opts: any) => {
      lastRazorpaySubscriptionOptions = opts;
      return {
        id: `sub_mock_${Date.now()}`,
        short_url: "https://rzp.io/i/mock_sub",
        status: "created",
      };
    },
  };
};
require.cache[razorpayModulePath] = {
  id: razorpayModulePath,
  filename: razorpayModulePath,
  loaded: true,
  exports: mockRazorpayConstructor,
} as NodeModule;

// 6. Import supabaseServer and configure in-memory query handler
const { supabaseServer } = require("../src/lib/supabase-server");

(supabaseServer as any).rpc = function (fnName: string, args: any) {
  return {
    select: () => ({
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    }),
  };
};

(supabaseServer as any).from = function (tableName: string): any {
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
    is: () => chain,
    or: () => chain,
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
      if (tableName === "startup_submissions") lastUpdatedStartup = data;
      if (tableName === "investor_reports") lastUpdatedReport = data;
      return chain;
    },
    insert: (data: any) => {
      insertData = data;
      const rec = Array.isArray(data) ? data[0] : data;
      if (tableName === "startup_submissions") {
        lastInsertedStartup = rec;
        const newStartup: StartupRecord = {
          id: 505,
          slug: rec.slug || "new-startup",
          startup_name: rec.startup_name,
          user_id: rec.user_id,
          proof_url: rec.proof_url || null,
          trust_score: rec.trust_score || 0,
          confidence: rec.confidence || 0,
          verification_type: rec.verification_type || "manual",
          verification_status: rec.verification_status || "pending",
          verified_revenue: rec.verified_revenue,
          verification_source: rec.verification_source,
          payment_connected: rec.payment_connected || false,
          is_public: rec.is_public || false,
          mrr: rec.mrr,
          arr: rec.arr,
        };
        inMemoryStartups.push(newStartup);
      }
      if (tableName === "investor_reports") {
        lastInsertedReport = rec;
        const newReport: InvestorReportRecord = {
          id: `rep-new-${Date.now()}`,
          user_id: rec.user_id,
          startup_id: rec.startup_id,
          amount_inr: rec.amount_inr,
          currency: rec.currency,
          razorpay_order_id: rec.razorpay_order_id,
          payment_status: rec.payment_status || "pending",
          generation_status: rec.generation_status || "pending",
          storage_path: rec.storage_path || null,
          report_period: rec.report_period || "30_days",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryReports.push(newReport);
      }
      return chain;
    },
    delete: () => chain,
    then: (resolve: (val: any) => void) => {
      if (updateData) {
        if (tableName === "startup_submissions") {
          const idFilter = filters.find(f => f.column === "id");
          if (idFilter) {
            const idx = inMemoryStartups.findIndex(s => s.id === Number(idFilter.value));
            if (idx !== -1) inMemoryStartups[idx] = { ...inMemoryStartups[idx], ...updateData };
          }
        }
        if (tableName === "investor_reports") {
          const idFilter = filters.find(f => f.column === "id");
          if (idFilter) {
            const idx = inMemoryReports.findIndex(r => r.id === String(idFilter.value));
            if (idx !== -1) inMemoryReports[idx] = { ...inMemoryReports[idx], ...updateData };
          }
        }
        return resolve({ data: updateData, error: null });
      }

      if (insertData) {
        return resolve({ data: Array.isArray(insertData) ? insertData : [insertData], error: null });
      }

      let dataSet: any[] = [];
      if (tableName === "startup_submissions") dataSet = [...inMemoryStartups];
      else if (tableName === "investor_reports") dataSet = [...inMemoryReports];
      else if (tableName === "subscriptions") dataSet = []; // Simulate no active sub

      for (const filter of filters) {
        if (filter.op === "eq") {
          dataSet = dataSet.filter(item => {
            const val = item[filter.column];
            if (typeof filter.value === "number") return Number(val) === filter.value;
            return String(val) === String(filter.value);
          });
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

  return builderProxy(chain);
};

function builderProxy(target: any) {
  return new Proxy(target, {
    get(t, prop) {
      if (prop === "then") return t.then;
      if (typeof t[prop] === "function") return t[prop];
      return () => t;
    },
  });
}

(supabaseServer as any).storage = {
  from: (bucket: string) => ({
    list: async () => ({ data: [], error: null }),
    download: async () => ({ data: new Blob(["dummy"]), error: null }),
    upload: async () => ({ data: { path: "dummy" }, error: null }),
    createSignedUrl: async (storagePath: string, expiresIn: number) => {
      lastSignedUrlRequestedPath = storagePath;
      return { data: { signedUrl: `https://mock.supabase.storage/${bucket}/${storagePath}?token=signed_test_token` }, error: null };
    },
  }),
};

// ─── Import Target Route Handlers After Interception ──────────────────────────

const { POST: postStartupSubmissions } = require("../src/app/api/startup-submissions/route");
const { PUT: putStartupIdentity } = require("../src/app/api/startup/[id]/identity/route");
const { POST: postBillingCheckout } = require("../src/app/api/billing/checkout/route");
const { POST: postBillingChangePlan } = require("../src/app/api/billing/change-plan/route");
const { POST: postCreateReportOrder } = require("../src/app/api/reports/create-order/route");
const { POST: postVerifyPayment } = require("../src/app/api/reports/verify-payment/route");
const { POST: postAdminReview } = require("../src/app/api/admin/review/route");

// Verify that auth-server loaded naturally
const authServerPath = require.resolve("../src/lib/auth-server");
const loadedAuthServer = require.cache[authServerPath];
if (!loadedAuthServer || !loadedAuthServer.loaded) {
  throw new Error("FATAL: auth-server.ts was not loaded naturally.");
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function makeJsonRequest(method: string, url: string, body: Record<string, unknown>, bearerToken?: string): Request {
  activeBearerToken = bearerToken || null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (bearerToken) {
    headers["Authorization"] = `Bearer ${bearerToken}`;
  }
  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function computeValidReportSignature(orderId: string, paymentId: string): string {
  const secret = process.env.RAZORPAY_KEY_SECRET || "test_rzp_secret";
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

describe("TEST 06 — Trust Boundary & Authoritative Server Data Integrity", () => {
  beforeEach(() => {
    resetTestState();
    customPaymentAmount = 49900;
    customPaymentCurrency = "INR";
    customPaymentStatus = "captured";
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly_official_server_id";
    process.env.RAZORPAY_KEY_ID = "rzp_test_mock_key_id";
    process.env.RAZORPAY_KEY_SECRET = "test_rzp_secret";
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP A: STARTUP SUBMISSION FORGED PRIVILEGED FIELDS
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group A: Startup Submission Forged Privileged Field Invariants", () => {
    it("A1: Client-supplied user_id in onboarding is ignored; authoritative user.id is written", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup New Alpha",
        biz_type: "b2b_saas",
        mrr: 10000,
        arr: 120000,
        payment_methods: ["stripe"],
        city: "Bengaluru",
        user_id: "FORGED_ATTACKER_USER_ID_999999",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200, "Should succeed with valid onboarding fields");

      assert(lastInsertedStartup, "Must perform DB insert");
      assert.strictEqual(
        lastInsertedStartup.user_id,
        USER_A.id,
        "Authoritative session user.id must overwrite client-supplied user_id"
      );
    });

    it("A2: Client-supplied verified_revenue is ignored; server enforces null on submission", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Revenue Spoof",
        biz_type: "b2b_saas",
        mrr: 50000,
        arr: 600000,
        payment_methods: ["stripe"],
        city: "Bengaluru",
        verified_revenue: 99999999, // Forged verified revenue
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert.strictEqual(
        lastInsertedStartup.verified_revenue,
        null,
        "verified_revenue must be null on onboarding; cannot be set by client"
      );
    });

    it("A3: Client-supplied verification_status='approved' is ignored; server enforces 'pending'", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Status Spoof",
        biz_type: "b2b_saas",
        mrr: 20000,
        arr: 240000,
        payment_methods: ["razorpay"],
        city: "Mumbai",
        verification_status: "approved", // Forged status
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert.strictEqual(
        lastInsertedStartup.verification_status,
        "pending",
        "verification_status must be 'pending' without proof; cannot be forged as 'approved'"
      );
    });

    it("A4: Client-supplied trust_score=100 is ignored; server-computed score is written", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Score Spoof",
        biz_type: "b2b_saas",
        mrr: 15000,
        arr: 180000,
        payment_methods: ["razorpay"],
        city: "Delhi",
        trust_score: 100, // Forged trust score
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert.notStrictEqual(
        lastInsertedStartup.trust_score,
        100,
        "trust_score must be algorithmically computed by server, not client-controlled"
      );
    });

    it("A5: Client-supplied confidence=100 is ignored; server calculates confidenceScore", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Confidence Spoof",
        biz_type: "b2b_saas",
        mrr: 25000,
        arr: 300000,
        payment_methods: ["stripe"],
        city: "Pune",
        confidence: 100, // Forged confidence
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert(typeof lastInsertedStartup.confidence === "number");
    });

    it("A6: Client-supplied payment_connected=true is ignored; server enforces false on creation", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Payment Connected Spoof",
        biz_type: "b2b_saas",
        mrr: 30000,
        arr: 360000,
        payment_methods: ["stripe"],
        city: "Hyderabad",
        payment_connected: true, // Forged connected state
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert.strictEqual(
        lastInsertedStartup.payment_connected,
        false,
        "payment_connected must strictly initialize to false on creation"
      );
    });

    it("A7: Client-supplied verification_source='stripe' is ignored; server enforces null", async () => {
      const payload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Verification Source Spoof",
        biz_type: "b2b_saas",
        mrr: 40000,
        arr: 480000,
        payment_methods: ["stripe"],
        city: "Chennai",
        verification_source: "stripe", // Forged verification source
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200);

      assert(lastInsertedStartup);
      assert.strictEqual(
        lastInsertedStartup.verification_source,
        null,
        "verification_source must initialize to null"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP B: IDENTITY / VISIBILITY PRIVILEGE ESCALATION
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group B: Identity Mutation & Visibility Trust Boundaries", () => {
    it("B1: Forged user_id in identity mutation is stripped and never alters startup owner", async () => {
      const payload = {
        founder_name: "Founder A Updated",
        founder_bio: "Updated bio description",
        is_public: false,
        user_id: USER_B.id, // Forged owner change
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert(lastUpdatedStartup);
      assert.strictEqual(
        (lastUpdatedStartup as any).user_id,
        undefined,
        "user_id must be stripped by Zod schema and excluded from DB update payload"
      );
    });

    it("B2: Forged owner_id is stripped by Zod schema", async () => {
      const payload = {
        founder_name: "Founder A",
        is_public: false,
        owner_id: USER_B.id,
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert(lastUpdatedStartup);
      assert.strictEqual((lastUpdatedStartup as any).owner_id, undefined);
    });

    it("B3: Forged trust_score in identity update is stripped", async () => {
      const payload = {
        founder_name: "Founder A",
        is_public: false,
        trust_score: 99,
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert(lastUpdatedStartup);
      assert.strictEqual((lastUpdatedStartup as any).trust_score, undefined);
    });

    it("B4: Forged verification_status in identity update is stripped", async () => {
      const payload = {
        founder_name: "Founder A",
        is_public: false,
        verification_status: "approved",
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert(lastUpdatedStartup);
      assert.strictEqual((lastUpdatedStartup as any).verification_status, undefined);
    });

    it("B5: Forged mrr and arr in identity update are stripped", async () => {
      const payload = {
        founder_name: "Founder A",
        is_public: false,
        mrr: 99999999,
        arr: 999999999,
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert(lastUpdatedStartup);
      assert.strictEqual((lastUpdatedStartup as any).mrr, undefined);
      assert.strictEqual((lastUpdatedStartup as any).arr, undefined);
    });

    it("B6: Attempting to make an ineligible unverified startup public is rejected with HTTP 403", async () => {
      const payload = {
        founder_name: "Founder A",
        is_public: true, // Attempting to publish unverified startup 404
      };

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/404/identity", payload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "404" }) });
      assert.strictEqual(
        res.status,
        403,
        "canStartupBePublic visibility gate must reject publishing unverified startup"
      );
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP C: BILLING PRICE AUTHORITY & PLAN SELECTION
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group C: Billing Price Authority & Plan Selection Invariants", () => {
    it("C1: Client attempts amount = 0 in checkout; server ignores client amount", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        amount: 0, // Client attempt to zero price
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);

      assert(lastRazorpaySubscriptionOptions);
      assert.strictEqual(
        lastRazorpaySubscriptionOptions.plan_id,
        "plan_pro_monthly_official_server_id",
        "Server must use authoritative plan_id from environment"
      );
    });

    it("C2: Client attempts amount = 1 in checkout; server uses official plan", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        amount: 1,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert(lastRazorpaySubscriptionOptions);
      assert.strictEqual(lastRazorpaySubscriptionOptions.plan_id, "plan_pro_monthly_official_server_id");
    });

    it("C3: Client attempts amount = 99999 in checkout; ignored by server", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        amount: 99999,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
    });

    it("C4: Client attempts arbitrary currency; server ignores client currency", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        currency: "USD",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
    });

    it("C5: Client attempts arbitrary discount; server ignores client discount", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        discount: 100,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
    });

    it("C6: Client attempts arbitrary trial parameters; server ignores client trial", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        trial_days: 365,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
    });

    it("C7: Client attempts arbitrary price_id; server uses server plan_id", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        price_id: "price_fake_attacker_custom",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert(lastRazorpaySubscriptionOptions);
      assert.strictEqual(lastRazorpaySubscriptionOptions.plan_id, "plan_pro_monthly_official_server_id");
    });

    it("C8: Client attempts arbitrary razorpay_plan_id in body; server uses server env plan", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "monthly",
        razorpay_plan_id: "plan_free_custom_fake_123",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert(lastRazorpaySubscriptionOptions);
      assert.strictEqual(lastRazorpaySubscriptionOptions.plan_id, "plan_pro_monthly_official_server_id");
    });

    it("C9: Unsupported plan_code is rejected with HTTP 400", async () => {
      const payload = {
        plan_code: "enterprise_custom_free",
        billing_cycle: "monthly",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400, "Must reject non-pro plan codes");
    });

    it("C10: Unsupported billing_cycle is rejected with HTTP 400", async () => {
      const payload = {
        plan_code: "pro",
        billing_cycle: "annual", // Annual is deprecated in 2-tier model
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", payload, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400, "Must reject non-monthly billing cycle");
    });

    it("C11: Plan switching via change-plan is rejected with HTTP 400", async () => {
      const payload = {
        plan_code: "founder",
        billing_cycle: "monthly",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/billing/change-plan", payload, "token_user_a");
      const res = await postBillingChangePlan(req);
      assert.strictEqual(res.status, 400, "Direct plan-change mutation must fail closed");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP D: INVESTOR REPORT ₹499 TRUST BOUNDARY
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group D: Investor Report ₹499 Trust Boundary & Fulfillment", () => {
    it("D1: Amount forgery in create-order is ignored; server enforces 49900 paise (₹499)", async () => {
      const amountsToTest = [0, 1, 498, 999, 99999];

      for (const fakeAmt of amountsToTest) {
        // Clear pending report for startup 101 to allow fresh order creation
        inMemoryReports = inMemoryReports.filter(r => !(r.startup_id === 101 && r.payment_status === "pending"));
        lastRazorpayOrderOptions = null;
        lastInsertedReport = null;

        const payload = {
          startup_id: 101,
          amount: fakeAmt,
          amount_inr: fakeAmt,
          currency: "USD",
        };

        const req = makeJsonRequest("POST", "http://localhost/api/reports/create-order", payload, "token_user_a");
        const res = await postCreateReportOrder(req);
        assert.strictEqual(res.status, 200, `Order creation must succeed for valid startup_id: ${fakeAmt}`);

        assert(lastRazorpayOrderOptions, "Must call Razorpay order creation");
        assert.strictEqual(
          (lastRazorpayOrderOptions as any).amount,
          49900,
          "Razorpay order amount must be exactly 49900 paise (₹499)"
        );
        assert.strictEqual((lastRazorpayOrderOptions as any).currency, "INR", "Currency must be INR");

        assert(lastInsertedReport, "Must insert record into investor_reports");
        assert.strictEqual((lastInsertedReport as any).amount_inr, 499, "Database record must store amount_inr = 499");
      }
    });

    it("D2: Cross-user report payment verification is rejected with HTTP 403", async () => {
      // User A attempts to verify/claim User B's report
      const sig = computeValidReportSignature("order_rzp_test_owner_b_202", "pay_rzp_test_owner_b_202");
      const payload = {
        report_id: "rep-bbbb2222-2222-4222-b222-222222222222",
        order_id: "order_rzp_test_owner_b_202",
        payment_id: "pay_rzp_test_owner_b_202",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 403, "Must reject cross-user report payment verification with HTTP 403");
    });

    it("D3: Forged report_id that does not exist returns HTTP 404", async () => {
      const payload = {
        report_id: "rep-nonexistent-9999",
        order_id: "order_fake_123",
        payment_id: "pay_fake_123",
        signature: "sig_fake_123",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 404, "Nonexistent report_id must return HTTP 404");
    });

    it("D4: Forged order_id not matching report's stored order ID is rejected with HTTP 400", async () => {
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_mismatched_attacker_id",
        payment_id: "pay_test_123",
        signature: "sig_test_123",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 400, "Mismatched order_id must return HTTP 400");
    });

    it("D5: Forged payment signature fails HMAC check with HTTP 400", async () => {
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_rzp_pending_a",
        payment_id: "pay_rzp_test_owner_a_101",
        signature: "INVALID_TAMPERED_HMAC_SIGNATURE",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 400, "Invalid signature must return HTTP 400");
    });

    it("D6: Valid signature but wrong gateway amount fails verification", async () => {
      customPaymentAmount = 1; // Underpaid (1 paise instead of 49900)

      const sig = computeValidReportSignature("order_rzp_pending_a", "pay_test_underpaid");
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_rzp_pending_a",
        payment_id: "pay_test_underpaid",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.notStrictEqual(res.status, 200, "Underpaid order must not fulfill");
    });

    it("D7: Valid signature but wrong currency fails verification", async () => {
      customPaymentCurrency = "USD"; // Wrong currency

      const sig = computeValidReportSignature("order_rzp_pending_a", "pay_test_usd");
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_rzp_pending_a",
        payment_id: "pay_test_usd",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.notStrictEqual(res.status, 200, "Wrong currency must not fulfill");
    });

    it("D8: Valid signature but payment status not captured fails verification", async () => {
      customPaymentStatus = "authorized"; // Not captured

      const sig = computeValidReportSignature("order_rzp_pending_a", "pay_test_authorized");
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_rzp_pending_a",
        payment_id: "pay_test_authorized",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.notStrictEqual(res.status, 200, "Uncaptured payment must not fulfill");
    });

    it("D9: Forged paid state in request body is ignored; server enforces DB verification", async () => {
      const payload = {
        report_id: "rep-pending-a-1111",
        order_id: "order_rzp_pending_a",
        payment_id: "pay_fake",
        signature: "sig_fake",
        payment_status: "paid", // Client attempting to claim already paid
        generation_status: "completed",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 400, "Forged paid claim without valid HMAC must be rejected");
    });

    it("D10: Cross-user paid report access is rejected with HTTP 403", async () => {
      // User A attempts to download User B's completed report
      const sig = computeValidReportSignature("order_rzp_test_owner_b_202", "pay_rzp_test_owner_b_202");
      const payload = {
        report_id: "rep-bbbb2222-2222-4222-b222-222222222222",
        order_id: "order_rzp_test_owner_b_202",
        payment_id: "pay_rzp_test_owner_b_202",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 403, "User A cannot access User B's paid report");
    });

    it("D11: Legitimate repeat download by owner returns fresh signed URL via Fast-Path", async () => {
      // Owner User A requests already-completed report
      const sig = computeValidReportSignature("order_rzp_test_owner_a_101", "pay_rzp_test_owner_a_101");
      const payload = {
        report_id: "rep-aaaa1111-1111-4111-a111-111111111111",
        order_id: "order_rzp_test_owner_a_101",
        payment_id: "pay_rzp_test_owner_a_101",
        signature: sig,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 200, "Owner must receive HTTP 200 on repeat download");

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.status, "completed");
      assert(body.download_url && body.download_url.includes("https://mock.supabase.storage/"), "Must return signed URL");
      assert.strictEqual(
        lastSignedUrlRequestedPath,
        `${USER_A.id}/rep-aaaa1111-1111-4111-a111-111111111111.pdf`,
        "Signed URL must be scoped strictly to the authoritative storage path"
      );
    });

    it("D12: Storage path tampering in body is ignored; server uses stored database path", async () => {
      const sig = computeValidReportSignature("order_rzp_test_owner_a_101", "pay_rzp_test_owner_a_101");
      const payload = {
        report_id: "rep-aaaa1111-1111-4111-a111-111111111111",
        order_id: "order_rzp_test_owner_a_101",
        payment_id: "pay_rzp_test_owner_a_101",
        signature: sig,
        storage_path: `${USER_B.id}/victim-report.pdf`, // Path traversal / storage path injection attempt
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", payload, "token_user_a");
      const res = await postVerifyPayment(req);
      assert.strictEqual(res.status, 200);

      assert.strictEqual(
        lastSignedUrlRequestedPath,
        `${USER_A.id}/rep-aaaa1111-1111-4111-a111-111111111111.pdf`,
        "Must use database stored path, not client-supplied storage_path"
      );
    });

    it("D13: User A attempting to create report for User B's startup is rejected with HTTP 403", async () => {
      const payload = {
        startup_id: 202, // Belongs to User B
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/create-order", payload, "token_user_a");
      const res = await postCreateReportOrder(req);
      assert.strictEqual(res.status, 403, "verifyStartupOwnership must block creating report for another user's startup");
    });

    it("D14: Report order creation for demo sandbox startup is rejected with HTTP 403", async () => {
      const payload = {
        startup_id: 303, // Demo startup
      };

      const req = makeJsonRequest("POST", "http://localhost/api/reports/create-order", payload, "token_user_a");
      const res = await postCreateReportOrder(req);
      assert.strictEqual(res.status, 403, "Demo startups cannot create report orders");
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP E: ADMIN AUTHORIZATION BOUNDARY
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group E: Admin Authorization Boundary Invariants", () => {
    it("E1: Authenticated non-admin calling /api/admin/review returns HTTP 403", async () => {
      const payload = {
        id: 101,
        action: "approve",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/admin/review", payload, "token_user_a");
      const res = await postAdminReview(req);
      assert.strictEqual(res.status, 403, "Non-admin user must receive HTTP 403");
    });

    it("E2: Body parameter is_admin: true does NOT escalate non-admin privileges (HTTP 403)", async () => {
      const payload = {
        id: 101,
        action: "approve",
        is_admin: true, // Spoofed admin flag
      };

      const req = makeJsonRequest("POST", "http://localhost/api/admin/review", payload, "token_user_a");
      const res = await postAdminReview(req);
      assert.strictEqual(res.status, 403, "is_admin in body must be ignored");
    });

    it("E3: Body parameter role: 'admin' does NOT escalate privileges (HTTP 403)", async () => {
      const payload = {
        id: 101,
        action: "approve",
        role: "admin",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/admin/review", payload, "token_user_a");
      const res = await postAdminReview(req);
      assert.strictEqual(res.status, 403);
    });

    it("E4: Body parameter reviewer_email: 'eshanmaurya12@gmail.com' does NOT escalate non-admin (HTTP 403)", async () => {
      const payload = {
        id: 101,
        action: "approve",
        reviewer_email: "eshanmaurya12@gmail.com",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/admin/review", payload, "token_user_a");
      const res = await postAdminReview(req);
      assert.strictEqual(res.status, 403, "Must rely on session email, not body email");
    });

    it("E5: Allowlisted admin user in session can access review endpoint", async () => {
      const payload = {
        id: 101,
        action: "approve",
        confidence_score: 95,
      };

      const req = makeJsonRequest("POST", "http://localhost/api/admin/review", payload, "token_admin");
      const res = await postAdminReview(req);
      assert.strictEqual(res.status, 200, "Allowlisted admin user must succeed");

      assert(lastUpdatedStartup);
      assert.strictEqual(lastUpdatedStartup.verification_status, "approved");
      assert.strictEqual(lastUpdatedStartup.confidence_score, 95);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // GROUP F: TYPE CONFUSION / MALFORMED INPUT ROBUSTNESS
  // ════════════════════════════════════════════════════════════════════════════
  describe("Group F: Type Confusion & Malformed Input Robustness", () => {
    it("F1: Prototype pollution keys (__proto__, constructor, prototype) are stripped by Zod schema", async () => {
      const malformedPayload = JSON.parse(
        '{"founder_name": "Founder A", "is_public": false, "__proto__": {"polluted": true}, "constructor": {"polluted": true}}'
      );

      const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", malformedPayload, "token_user_a");
      const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);

      assert.strictEqual((Object.prototype as any).polluted, undefined, "Prototype must not be polluted");
      assert(lastUpdatedStartup);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(lastUpdatedStartup, "__proto__"), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(lastUpdatedStartup, "constructor"), false);
    });

    it("F2: NaN, Infinity, negative numbers in report create-order startup_id are rejected with HTTP 400", async () => {
      const invalidStartupIds = [NaN, Infinity, -Infinity, -101, 0, 101.5, "101", null, undefined, [], {}];

      for (const badId of invalidStartupIds) {
        const payload = { startup_id: badId };
        const req = makeJsonRequest("POST", "http://localhost/api/reports/create-order", payload, "token_user_a");
        const res = await postCreateReportOrder(req);
        assert.strictEqual(res.status, 400, `startup_id ${String(badId)} must return HTTP 400`);
      }
    });

    it("F3: Non-HTTPS and javascript: URLs in founder_avatar are rejected with HTTP 400", async () => {
      const invalidUrls = [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "http://insecure-http-url.com/avatar.png",
        "vbscript:msgbox(1)",
      ];

      for (const badUrl of invalidUrls) {
        const payload = {
          founder_name: "Founder A",
          is_public: false,
          founder_avatar: badUrl,
        };

        const req = makeJsonRequest("PUT", "http://localhost/api/startup/101/identity", payload, "token_user_a");
        const res = await putStartupIdentity(req, { params: Promise.resolve({ id: "101" }) });
        assert.strictEqual(res.status, 400, `URL '${badUrl}' must be rejected with HTTP 400`);
      }
    });

    it("F4: Missing required fields in report verify-payment return HTTP 400", async () => {
      const badPayloads = [
        {},
        { report_id: "rep-1" },
        { report_id: "rep-1", order_id: "ord-1" },
        { report_id: "rep-1", order_id: "ord-1", payment_id: "pay-1" },
        { report_id: null, order_id: "ord-1", payment_id: "pay-1", signature: "sig-1" },
        { report_id: "rep-1", order_id: "", payment_id: "pay-1", signature: "sig-1" },
      ];

      for (const badPayload of badPayloads) {
        const req = makeJsonRequest("POST", "http://localhost/api/reports/verify-payment", badPayload as any, "token_user_a");
        const res = await postVerifyPayment(req);
        assert.strictEqual(res.status, 400, "Missing parameters must return HTTP 400");
      }
    });

    it("F5: Invalid non-numeric, out-of-range, and negative MRR values are rejected with HTTP 400", async () => {
      const invalidMrrValues = [-1000, "not-a-number", NaN, null, undefined, 1000000000];

      for (const badMrr of invalidMrrValues) {
        const payload = {
          name: "Founder A",
          email: "founder-a@example.com",
          startup_name: "Startup Bad MRR",
          biz_type: "b2b_saas",
          mrr: badMrr,
          arr: 120000,
          payment_methods: ["stripe"],
          city: "Bengaluru",
        };

        const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", payload as any, "token_user_a");
        const res = await postStartupSubmissions(req);
        assert.strictEqual(res.status, 400, `MRR '${String(badMrr)}' must be rejected with HTTP 400`);
      }

      // Valid stringified number should be safely parsed
      const validStringPayload = {
        name: "Founder A",
        email: "founder-a@example.com",
        startup_name: "Startup Coerced MRR",
        biz_type: "b2b_saas",
        mrr: "10000",
        arr: "120000",
        payment_methods: ["stripe"],
        city: "Bengaluru",
      };

      const req = makeJsonRequest("POST", "http://localhost/api/startup-submissions", validStringPayload as any, "token_user_a");
      const res = await postStartupSubmissions(req);
      assert.strictEqual(res.status, 200, "Valid stringified number must be safely parsed to number");
      assert(lastInsertedStartup);
      assert.strictEqual(typeof lastInsertedStartup.mrr, "number");
      assert.strictEqual(lastInsertedStartup.mrr, 10000);
    });
  });
});

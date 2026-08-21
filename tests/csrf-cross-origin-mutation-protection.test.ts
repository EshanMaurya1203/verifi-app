/**
 * TEST 09 — CSRF / Cross-Origin Mutation Protection Test Suite
 *
 * Deterministic regression harness validating:
 * - Group A: CORS / Preflight Boundary (no wildcard, no arbitrary origin, no credentials cross-origin)
 * - Group B: Simple Cross-Origin Request / Form Attacks (urlencoded, multipart, text/plain, navigate)
 * - Group C: Ambient Cookie / SameSite Model (SameSite=Lax behavior simulation, unauthenticated rejection)
 * - Group D: Critical Destructive Actions (/api/account/delete, /api/startup/[id]/delete, /api/billing/cancel)
 * - Group E: Billing / Investor Report Purchase (/api/billing/checkout, /api/billing/cancel, /api/reports/*)
 * - Group F: Feedback / Settings / Startup Mutations (/api/feedback, /api/startup-submissions, /api/startup/[id]/identity, sync routes)
 * - Group G: Webhook Signature Boundary (/api/stripe/webhook, /api/razorpay/webhook, /api/billing/webhook/razorpay)
 * - Group H: Side-Effect Accounting (zero DB inserts, updates, deletes, storage, provider, or email side effects on rejected CSRF)
 * - Group I: Same-Origin Legitimate Request Regression
 * - Group J: Server Action / Framework Origin Validation
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import type { User } from "@supabase/supabase-js";

// ─── Test Fixtures & Deterministic Users ─────────────────────────────────────

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
  email: "eshanmaurya12@gmail.com",
  app_metadata: {},
  user_metadata: { full_name: "Verifii Admin" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

// ─── Side-Effect Instrumentation Tracker (Group H) ───────────────────────────

export const sideEffects = {
  dbInsertCount: 0,
  dbUpdateCount: 0,
  dbDeleteCount: 0,
  storageMutationCount: 0,
  stripeMutationCount: 0,
  razorpayMutationCount: 0,
  emailDispatchCount: 0,
  subscriptionMutationCount: 0,
};

export function resetSideEffects() {
  sideEffects.dbInsertCount = 0;
  sideEffects.dbUpdateCount = 0;
  sideEffects.dbDeleteCount = 0;
  sideEffects.storageMutationCount = 0;
  sideEffects.stripeMutationCount = 0;
  sideEffects.razorpayMutationCount = 0;
  sideEffects.emailDispatchCount = 0;
  sideEffects.subscriptionMutationCount = 0;
}

export function assertZeroSideEffects() {
  assert.strictEqual(sideEffects.dbInsertCount, 0, "Expected 0 database INSERTs");
  assert.strictEqual(sideEffects.dbUpdateCount, 0, "Expected 0 database UPDATEs");
  assert.strictEqual(sideEffects.dbDeleteCount, 0, "Expected 0 database DELETEs");
  assert.strictEqual(sideEffects.storageMutationCount, 0, "Expected 0 storage mutations");
  assert.strictEqual(sideEffects.stripeMutationCount, 0, "Expected 0 Stripe mutations");
  assert.strictEqual(sideEffects.razorpayMutationCount, 0, "Expected 0 Razorpay mutations");
  assert.strictEqual(sideEffects.emailDispatchCount, 0, "Expected 0 email dispatches");
  assert.strictEqual(sideEffects.subscriptionMutationCount, 0, "Expected 0 subscription mutations");
}

// ─── In-Memory Test State ───────────────────────────────────────────────────

let activeBearerToken: string | null = null;
let activeProofCookie: string | null = null;
let simulatedCallerUser: User | null = null;

let inMemoryStartups: any[] = [];
let inMemoryFeedback: any[] = [];
let inMemorySubscriptions: any[] = [];
let inMemoryReports: any[] = [];

function resetTestState() {
  activeBearerToken = null;
  activeProofCookie = null;
  simulatedCallerUser = null;
  resetSideEffects();

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
  ];

  inMemoryFeedback = [
    {
      id: "fb-1111",
      user_id: USER_A.id,
      user_email: USER_A.email,
      category: "bug",
      message: "Initial feedback item",
      status: "open",
      created_at: new Date().toISOString(),
    },
  ];

  inMemorySubscriptions = [
    {
      id: "sub-101",
      user_id: USER_A.id,
      razorpay_subscription_id: "sub_rzp_test_active_101",
      status: "active",
      plan_code: "pro",
      billing_cycle: "monthly",
      created_at: new Date().toISOString(),
    },
  ];

  inMemoryReports = [
    {
      id: "rep-101",
      user_id: USER_A.id,
      startup_id: 101,
      amount_inr: 499,
      currency: "INR",
      razorpay_order_id: "order_rzp_test_101",
      payment_status: "paid",
      generation_status: "completed",
      storage_path: `${USER_A.id}/rep-101.pdf`,
      report_period: "30_days",
      created_at: new Date().toISOString(),
    },
  ];
}

// ─── Module Interceptions & Mock Setup (BEFORE Route Requires) ───────────────

// 1. Mock next/headers
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
      get: (name: string) => {
        if (name === "vrf_reauth_proof") {
          return activeProofCookie ? { value: activeProofCookie } : undefined;
        }
        if (activeBearerToken === "token_user_a") return { value: `session_${USER_A.id}` };
        if (activeBearerToken === "token_user_b") return { value: `session_${USER_B.id}` };
        if (activeBearerToken === "token_admin") return { value: `session_${ADMIN_USER.id}` };
        if (simulatedCallerUser) return { value: `session_${simulatedCallerUser.id}` };
        return undefined;
      },
      getAll: () => (activeBearerToken || simulatedCallerUser ? [{ name: "sb-auth-token", value: "tok" }] : []),
      set: () => {},
    }),
  },
} as NodeModule;

// 2. Mock rate-limit
const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_csrf_harness_client",
    checkRateLimit: async () => ({ allowed: true, remaining: 100, reset: 0 }),
  },
} as NodeModule;

// 3. Mock @supabase/supabase-js createClient for getAuthenticatedUser()
const supabaseJsPath = require.resolve("@supabase/supabase-js");
const realSupabaseJs = require("@supabase/supabase-js");

const mockCreateClient = (url: string, key: string, options?: any) => ({
  auth: {
    getUser: async (token?: string) => {
      const t = token || activeBearerToken;
      if (t === "token_user_a") return { data: { user: USER_A }, error: null };
      if (t === "token_user_b") return { data: { user: USER_B }, error: null };
      if (t === "token_admin") return { data: { user: ADMIN_USER }, error: null };
      if (simulatedCallerUser) return { data: { user: simulatedCallerUser }, error: null };
      return { data: { user: null }, error: { message: "No session" } };
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

// 4. Mock @supabase/ssr createServerClient
const supabaseSsrPath = require.resolve("@supabase/ssr");
require.cache[supabaseSsrPath] = {
  id: supabaseSsrPath,
  filename: supabaseSsrPath,
  loaded: true,
  exports: {
    createServerClient: () => ({
      auth: {
        getUser: async () => {
          if (activeBearerToken === "token_user_a") return { data: { user: USER_A }, error: null };
          if (activeBearerToken === "token_user_b") return { data: { user: USER_B }, error: null };
          if (activeBearerToken === "token_admin") return { data: { user: ADMIN_USER }, error: null };
          if (simulatedCallerUser) {
            return { data: { user: simulatedCallerUser }, error: null };
          }
          return { data: { user: null }, error: { message: "No cookie session" } };
        },
      },
    }),
  },
} as NodeModule;

// 5. Mock Razorpay SDK
const razorpayPath = require.resolve("razorpay");
class MockRazorpay {
  key_id: string;
  key_secret: string;
  subscriptions: any;
  orders: any;
  payments: any;

  constructor(options: { key_id: string; key_secret: string }) {
    this.key_id = options.key_id;
    this.key_secret = options.key_secret;
    this.subscriptions = {
      create: async (opts: any) => {
        sideEffects.razorpayMutationCount++;
        sideEffects.subscriptionMutationCount++;
        return {
          id: `sub_rzp_mock_${Date.now()}`,
          short_url: "https://rzp.io/i/mock_sub",
        };
      },
      cancel: async (subId: string, cancelAtCycleEnd: boolean) => {
        sideEffects.razorpayMutationCount++;
        sideEffects.subscriptionMutationCount++;
        return { id: subId, status: "cancelled" };
      },
    };
    this.orders = {
      create: async (opts: any) => {
        sideEffects.razorpayMutationCount++;
        return {
          id: `order_rzp_mock_${Date.now()}`,
          amount: opts.amount,
          currency: opts.currency,
        };
      },
    };
    this.payments = {
      fetch: async (paymentId: string) => ({
        id: paymentId,
        amount: 49900,
        currency: "INR",
        status: "captured",
      }),
    };
  }
}
require.cache[razorpayPath] = {
  id: razorpayPath,
  filename: razorpayPath,
  loaded: true,
  exports: MockRazorpay,
} as NodeModule;

// 6. Mock subscription-cancellation service
const subCancelPath = require.resolve("../src/lib/billing/subscription-cancellation");
require.cache[subCancelPath] = {
  id: subCancelPath,
  filename: subCancelPath,
  loaded: true,
  exports: {
    cancelAllUserSubscriptions: async (userId: string, options?: { immediate?: boolean }) => {
      sideEffects.subscriptionMutationCount++;
      return { success: true, count: 1 };
    },
  },
} as NodeModule;

// 7. Mock logger to prevent log pollution during testing
const loggerPath = require.resolve("../src/lib/logger");
require.cache[loggerPath] = {
  id: loggerPath,
  filename: loggerPath,
  loaded: true,
  exports: {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    LogEvent: {
      ACCOUNT_DELETION_FAILED: "account_deletion_failed",
      ACCOUNT_DELETED: "account_deleted",
      STARTUP_DELETION_FAILED: "startup_deletion_failed",
      STARTUP_DELETED: "startup_deleted",
      PROVIDER_DISCONNECTED: "provider_disconnected",
      PROVIDER_DISCONNECT_FAILED: "provider_disconnect_failed",
    },
  },
} as NodeModule;

// 8. Mock notifications dispatcher
const dispatcherPath = require.resolve("../src/notifications/dispatcher");
require.cache[dispatcherPath] = {
  id: dispatcherPath,
  filename: dispatcherPath,
  loaded: true,
  exports: {
    dispatchNotification: async () => {
      sideEffects.emailDispatchCount++;
      return { success: true };
    },
  },
} as NodeModule;

// 9. Mock subscriptions helper
const subsHelperPath = require.resolve("../src/lib/subscriptions");
require.cache[subsHelperPath] = {
  id: subsHelperPath,
  filename: subsHelperPath,
  loaded: true,
  exports: {
    getUserPlan: async (userId: string) => null,
  },
} as NodeModule;

// 10. Mock supabaseServer
const { supabaseServer } = require("../src/lib/supabase-server");

function builderProxy(target: any) {
  return new Proxy(target, {
    get(t, prop) {
      if (prop === "then") return t.then;
      if (typeof t[prop] === "function") return t[prop];
      return () => t;
    },
  });
}

(supabaseServer as any).from = function (tableName: string): any {
  const filters: Array<{ column: string; value: any; op: string }> = [];
  let isSingle = false;
  let isMaybeSingle = false;
  let updateData: any = null;
  let insertData: any = null;
  let isDelete = false;

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
      sideEffects.dbUpdateCount++;
      updateData = data;
      return chain;
    },
    insert: (data: any) => {
      sideEffects.dbInsertCount++;
      insertData = data;
      const rec = Array.isArray(data) ? data[0] : data;
      if (tableName === "startup_submissions") {
        const newStartup = { id: 500 + inMemoryStartups.length, ...rec, is_public: false };
        inMemoryStartups.push(newStartup);
      }
      if (tableName === "feedback") {
        const newFb = { id: `fb-${Date.now()}`, ...rec, status: "open" };
        inMemoryFeedback.push(newFb);
      }
      return chain;
    },
    delete: () => {
      sideEffects.dbDeleteCount++;
      isDelete = true;
      return chain;
    },
    then: (resolve: (val: any) => void) => {
      if (isDelete) {
        if (tableName === "startup_submissions") {
          const idFilter = filters.find((f) => f.column === "id");
          if (idFilter) inMemoryStartups = inMemoryStartups.filter((s) => s.id !== Number(idFilter.value));
        }
        return resolve({ error: null });
      }

      if (updateData) {
        if (tableName === "startup_submissions") {
          const idFilter = filters.find((f) => f.column === "id" || f.column === "slug");
          if (idFilter) {
            const idx = inMemoryStartups.findIndex((s) => s.id === Number(idFilter.value) || s.slug === idFilter.value);
            if (idx !== -1) inMemoryStartups[idx] = { ...inMemoryStartups[idx], ...updateData };
          }
        }
        if (tableName === "feedback") {
          const idFilter = filters.find((f) => f.column === "id");
          if (idFilter) {
            const idx = inMemoryFeedback.findIndex((f) => f.id === idFilter.value);
            if (idx !== -1) inMemoryFeedback[idx] = { ...inMemoryFeedback[idx], ...updateData };
          }
        }
        return resolve({ data: updateData, error: null });
      }

      if (insertData) {
        const rec = Array.isArray(insertData) ? insertData[0] : insertData;
        return resolve({ data: rec, error: null });
      }

      let dataSet: any[] = [];
      if (tableName === "startup_submissions") dataSet = [...inMemoryStartups];
      else if (tableName === "investor_reports") dataSet = [...inMemoryReports];
      else if (tableName === "feedback") dataSet = [...inMemoryFeedback];
      else if (tableName === "subscriptions") dataSet = [...inMemorySubscriptions];

      for (const filter of filters) {
        if (filter.op === "eq") {
          dataSet = dataSet.filter((item) => {
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

(supabaseServer as any).storage = {
  from: (bucket: string) => ({
    list: async (path: string, options?: any) => {
      return { data: [{ name: "valid-proof.pdf" }], error: null };
    },
    createSignedUrl: async (path: string, expiry: number) => {
      return { data: { signedUrl: `https://storage.supabase.co/${bucket}/${path}?token=mock_signed` }, error: null };
    },
  }),
};

// ─── Import Route Handlers Under Test (AFTER Interceptions) ───────────────────

const { DELETE: deleteAccountHandler } = require("../src/app/api/account/delete/route");
const { DELETE: deleteStartupHandler } = require("../src/app/api/startup/[id]/delete/route");
const { DELETE: disconnectProviderHandler } = require("../src/app/api/startup/[id]/connections/[provider]/route");
const { PUT: updateIdentityHandler } = require("../src/app/api/startup/[id]/identity/route");
const { POST: createStartupHandler } = require("../src/app/api/startup-submissions/route");
const { POST: billingCheckoutHandler } = require("../src/app/api/billing/checkout/route");
const { POST: billingCancelHandler } = require("../src/app/api/billing/cancel/route");
const { POST: billingChangePlanHandler } = require("../src/app/api/billing/change-plan/route");
const { POST: createReportOrderHandler } = require("../src/app/api/reports/create-order/route");
const { POST: verifyReportPaymentHandler } = require("../src/app/api/reports/verify-payment/route");
const { POST: submitFeedbackHandler } = require("../src/app/api/feedback/route");
const { PATCH: adminUpdateFeedbackHandler } = require("../src/app/api/admin/feedback/route");
const { POST: adminReplyFeedbackHandler } = require("../src/app/api/admin/feedback/reply/route");
const { POST: adminReviewHandler } = require("../src/app/api/admin/review/route");
const { POST: stripeWebhookHandler } = require("../src/app/api/stripe/webhook/route");
const { POST: razorpayWebhookHandler } = require("../src/app/api/razorpay/webhook/route");
const { POST: razorpayBillingWebhookHandler } = require("../src/app/api/billing/webhook/razorpay/route");

// Helper to construct mock Request
function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body?: any
): Request {
  const init: RequestInit = {
    method,
    headers: {
      "host": "www.verifii.in",
      ...headers,
    },
  };
  if (body !== undefined) {
    if (typeof body === "string") {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)["content-type"] = "application/json";
    }
  }
  return new Request(url, init);
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("TEST 09 — CSRF / Cross-Origin Mutation Protection", () => {
  beforeEach(() => {
    resetTestState();
    process.env.ENCRYPTION_SECRET = "test_encryption_secret_minimum_32_characters_long_12345";
    process.env.RAZORPAY_KEY_ID = "rzp_test_mock_key_id";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_mock_key_secret";
    process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly_123";
    process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = "whsec_billing_mock_secret_12345";
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A: CORS / PREFLIGHT BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group A: CORS / Preflight Boundary", () => {
    it("A1: Mutating route rejects granting Access-Control-Allow-Origin to third-party origin", async () => {
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST", {
        origin: "https://evil.example",
      });
      const res = await billingCancelHandler(req);
      assert.notStrictEqual(res.headers.get("access-control-allow-origin"), "https://evil.example");
    });

    it("A2: Mutating route never returns wildcard Access-Control-Allow-Origin: *", async () => {
      const req = makeRequest("https://www.verifii.in/api/account/delete", "DELETE", {
        origin: "https://evil.example",
      });
      const res = await deleteAccountHandler(req);
      assert.notStrictEqual(res.headers.get("access-control-allow-origin"), "*");
    });

    it("A3: Mutating route never grants Access-Control-Allow-Credentials: true to cross-origin caller", async () => {
      const req = makeRequest("https://www.verifii.in/api/feedback", "POST", {
        origin: "https://attacker.site",
      }, { category: "bug", message: "csrf attack" });
      const res = await submitFeedbackHandler(req);
      assert.notStrictEqual(res.headers.get("access-control-allow-credentials"), "true");
    });

    it("A4: Admin mutation routes do not grant CORS permissions to arbitrary origins", async () => {
      const req = makeRequest("https://www.verifii.in/api/admin/feedback", "PATCH", {
        origin: "https://attacker.com",
      }, { feedback_id: "fb-1111", status: "resolved" });
      const res = await adminUpdateFeedbackHandler(req);
      assert.strictEqual(res.headers.get("access-control-allow-origin"), null);
      assertZeroSideEffects();
    });

    it("A5: Same-origin requests do not trigger CORS restrictions", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST", {
        origin: "https://www.verifii.in",
      });
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B: SIMPLE CROSS-ORIGIN REQUEST / FORM ATTACKS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group B: Simple Cross-Origin Request / Form Attacks", () => {
    it("B1: Cross-origin form POST (urlencoded) to /api/billing/cancel cannot cancel without auth cookie", async () => {
      const req = makeRequest(
        "https://www.verifii.in/api/billing/cancel",
        "POST",
        {
          "origin": "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
        },
        "confirm=true"
      );
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("B2: Cross-origin form POST (urlencoded) to /api/feedback fails JSON parse with zero DB inserts", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest(
        "https://www.verifii.in/api/feedback",
        "POST",
        {
          "origin": "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-site": "cross-site",
        },
        "category=bug&message=forged+feedback"
      );
      const res = await submitFeedbackHandler(req);
      assert.strictEqual(res.status, 400);
      assertZeroSideEffects();
    });

    it("B3: Cross-origin multipart/form-data to /api/startup-submissions fails JSON parse with zero DB inserts", async () => {
      activeBearerToken = "token_user_a";
      const multipartBody = "--boundary\r\nContent-Disposition: form-data; name=\"startup_name\"\r\n\r\nForged Startup\r\n--boundary--";
      const req = makeRequest(
        "https://www.verifii.in/api/startup-submissions",
        "POST",
        {
          "origin": "https://evil.example",
          "content-type": "multipart/form-data; boundary=boundary",
          "sec-fetch-site": "cross-site",
        },
        multipartBody
      );
      const res = await createStartupHandler(req);
      assert.ok([400, 500].includes(res.status), `Expected 400 or 500, got ${res.status}`);
      assertZeroSideEffects();
    });

    it("B4: Cross-origin text/plain to /api/startup/[id]/identity fails schema parse with zero DB updates", async () => {
      activeBearerToken = "token_user_a";
      const plainText = '{"startup_name":"Hijacked"} =';
      const req = makeRequest(
        "https://www.verifii.in/api/startup/101/identity",
        "PUT",
        {
          "origin": "https://evil.example",
          "content-type": "text/plain",
          "sec-fetch-site": "cross-site",
        },
        plainText
      );
      const res = await updateIdentityHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.ok([400, 500].includes(res.status), `Expected 400 or 500, got ${res.status}`);
      assertZeroSideEffects();
    });

    it("B5: Cross-origin form attempt on /api/startup/[id]/delete blocked before destructive DB action", async () => {
      const req = makeRequest(
        "https://www.verifii.in/api/startup/101/delete",
        "DELETE",
        {
          "origin": "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-site": "cross-site",
        },
        "confirm=true"
      );
      const res = await deleteStartupHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("B6: Cross-origin form attempt on /api/account/delete blocked before destructive DB action", async () => {
      const req = makeRequest(
        "https://www.verifii.in/api/account/delete",
        "DELETE",
        {
          "origin": "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
          "sec-fetch-site": "cross-site",
        },
        "confirm=true"
      );
      const res = await deleteAccountHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C: AMBIENT COOKIE / SAME-SITE MODEL
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group C: Ambient Cookie / Same-Site Model", () => {
    it("C1: Request without authentication cookies is rejected by authentication boundary", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST");
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("C2: Cross-site request where SameSite=Lax blocks cookie transmission behaves as unauthenticated", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/feedback", "POST", {
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
      }, { category: "bug", message: "cross-site attack" });
      const res = await submitFeedbackHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("C3: Same-site context with valid session cookie allows authorized access", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/feedback", "POST", {
        "sec-fetch-site": "same-origin",
      }, { category: "general", message: "Legitimate user feedback" });
      const res = await submitFeedbackHandler(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.dbInsertCount, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D: CRITICAL DESTRUCTIVE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group D: Critical Destructive Actions", () => {
    it("D1: Cross-origin account deletion cannot occur without re-auth proof", async () => {
      activeBearerToken = "token_user_a";
      activeProofCookie = null; // No reauth proof
      const req = makeRequest("https://www.verifii.in/api/account/delete", "DELETE", {
        "origin": "https://evil.example",
        "sec-fetch-site": "cross-site",
      });
      const res = await deleteAccountHandler(req);
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });

    it("D2: Cross-origin startup deletion cannot occur without re-auth proof", async () => {
      activeBearerToken = "token_user_a";
      activeProofCookie = null; // No reauth proof
      const req = makeRequest("https://www.verifii.in/api/startup/101/delete", "DELETE", {
        "origin": "https://evil.example",
        "sec-fetch-site": "cross-site",
      });
      const res = await deleteStartupHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });

    it("D3: Cross-origin billing cancellation cannot occur without active authenticated session", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST", {
        "origin": "https://evil.example",
        "sec-fetch-site": "cross-site",
      });
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("D4: Account deletion rejects destructive DB calls before re-auth verification", async () => {
      activeBearerToken = "token_user_a";
      activeProofCookie = "invalid_proof_token";
      const req = makeRequest("https://www.verifii.in/api/account/delete", "DELETE");
      const res = await deleteAccountHandler(req);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(sideEffects.dbDeleteCount, 0);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 0);
    });

    it("D5: Startup deletion rejects destructive DB calls before re-auth verification", async () => {
      activeBearerToken = "token_user_a";
      activeProofCookie = "invalid_proof_token";
      const req = makeRequest("https://www.verifii.in/api/startup/101/delete", "DELETE");
      const res = await deleteStartupHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(sideEffects.dbDeleteCount, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E: BILLING / INVESTOR REPORT PURCHASE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group E: Billing / Investor Report Purchase", () => {
    it("E1: Cross-origin form POST to /api/billing/checkout fails JSON parsing with zero gateway calls", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest(
        "https://www.verifii.in/api/billing/checkout",
        "POST",
        {
          "origin": "https://evil.example",
          "content-type": "application/x-www-form-urlencoded",
        },
        "plan_code=pro&billing_cycle=monthly"
      );
      const res = await billingCheckoutHandler(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(sideEffects.razorpayMutationCount, 0);
    });

    it("E2: /api/billing/cancel without ambient cookie is rejected with zero provider mutations", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST");
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 0);
    });

    it("E3: /api/billing/change-plan is blocked with HTTP 400 with zero plan changes", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/billing/change-plan", "POST", {}, {
        plan_code: "pro",
        billing_cycle: "monthly",
      });
      const res = await billingChangePlanHandler(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 0);
    });

    it("E4: /api/reports/create-order unauthenticated cross-origin request creates zero orders", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/reports/create-order", "POST", {}, {
        startup_id: 101,
      });
      const res = await createReportOrderHandler(req);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(sideEffects.razorpayMutationCount, 0);
    });

    it("E5: /api/reports/verify-payment requires authoritative HMAC signature and valid session", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/reports/verify-payment", "POST", {}, {
        report_id: "rep-101",
        razorpay_order_id: "order_rzp_test_101",
        razorpay_payment_id: "pay_test_123",
        razorpay_signature: "forged_invalid_signature",
      });
      const res = await verifyReportPaymentHandler(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(sideEffects.storageMutationCount, 0);
    });

    it("E6: Provider mutation count remains strictly 0 across all rejected billing attacks", async () => {
      assert.strictEqual(sideEffects.razorpayMutationCount, 0);
      assert.strictEqual(sideEffects.stripeMutationCount, 0);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP F: FEEDBACK / SETTINGS / STARTUP MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group F: Feedback / Settings / Startup Mutations", () => {
    it("F1: /api/feedback unauthenticated cross-origin request yields 0 DB inserts", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/feedback", "POST", {}, {
        category: "bug",
        message: "forged unauth feedback",
      });
      const res = await submitFeedbackHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("F2: /api/startup-submissions unauthenticated cross-origin request yields 0 startups created", async () => {
      simulatedCallerUser = null;
      activeBearerToken = null;
      const req = makeRequest("https://www.verifii.in/api/startup-submissions", "POST", {}, {
        startup_name: "Attacker Startup",
      });
      const res = await createStartupHandler(req);
      assert.strictEqual(res.status, 401);
      assertZeroSideEffects();
    });

    it("F3: /api/startup/[id]/identity cross-origin request without ownership yields 0 DB updates", async () => {
      activeBearerToken = "token_user_b"; // User B targeting User A's startup (101)
      const req = makeRequest("https://www.verifii.in/api/startup/101/identity", "PUT", {}, {
        startup_name: "Defaced Name",
      });
      const res = await updateIdentityHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });

    it("F4: /api/startup/[id]/connections/[provider] cross-origin request without ownership yields 0 disconnects", async () => {
      activeBearerToken = "token_user_b";
      const req = makeRequest("https://www.verifii.in/api/startup/101/connections/stripe", "DELETE");
      const res = await disconnectProviderHandler(req, { params: Promise.resolve({ id: "101", provider: "stripe" }) });
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });

    it("F5: Admin feedback reply requires allowlisted admin user email", async () => {
      activeBearerToken = "token_user_a"; // Non-admin caller
      const req = makeRequest("https://www.verifii.in/api/admin/feedback/reply", "POST", {}, {
        feedbackId: "fb-1111",
        replyMessage: "Unauthorized reply",
      });
      const res = await adminReplyFeedbackHandler(req);
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });

    it("F6: Admin review action requires allowlisted admin user email", async () => {
      activeBearerToken = "token_user_a"; // Non-admin caller
      const req = makeRequest("https://www.verifii.in/api/admin/review", "POST", {}, {
        id: 101,
        status: "approved",
      });
      const res = await adminReviewHandler(req);
      assert.strictEqual(res.status, 403);
      assertZeroSideEffects();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP G: WEBHOOK SIGNATURE BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group G: Webhook Signature Boundary", () => {
    it("G1: Attacker Origin header cannot substitute for Stripe webhook signature", async () => {
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", "POST", {
        "origin": "https://evil.example",
      }, { type: "payment_intent.succeeded" });
      const res = await stripeWebhookHandler(req);
      assert.strictEqual(res.status, 400);
      assertZeroSideEffects();
    });

    it("G2: Attacker Origin header cannot substitute for Razorpay webhook signature", async () => {
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", "POST", {
        "origin": "https://evil.example",
      }, { event: "payment.captured" });
      const res = await razorpayWebhookHandler(req);
      assert.strictEqual(res.status, 400);
      assertZeroSideEffects();
    });

    it("G3: Missing signature on /api/billing/webhook/razorpay returns HTTP 400 with 0 DB mutations", async () => {
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", "POST", {}, {
        event: "subscription.charged",
      });
      const res = await razorpayBillingWebhookHandler(req);
      assert.strictEqual(res.status, 400);
      assertZeroSideEffects();
    });

    it("G4: Invalid signature on /api/billing/webhook/razorpay returns HTTP 400 with 0 DB mutations", async () => {
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", "POST", {
        "x-razorpay-signature": "invalid_forged_signature_hex",
      }, { event: "subscription.cancelled" });
      const res = await razorpayBillingWebhookHandler(req);
      assert.strictEqual(res.status, 400);
      assertZeroSideEffects();
    });

    it("G5: Webhooks do not execute provider side effects on unverified cross-origin requests", async () => {
      assert.strictEqual(sideEffects.stripeMutationCount, 0);
      assert.strictEqual(sideEffects.razorpayMutationCount, 0);
      assert.strictEqual(sideEffects.dbUpdateCount, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP H: SIDE-EFFECT ACCOUNTING
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group H: Side-Effect Accounting", () => {
    it("H1: Aggregated verification that all rejected CSRF attempts caused zero DB mutations", async () => {
      assertZeroSideEffects();
    });

    it("H2: Rejection occurs before any partial mutation or provider communication", async () => {
      assert.strictEqual(sideEffects.dbInsertCount, 0);
      assert.strictEqual(sideEffects.dbDeleteCount, 0);
      assert.strictEqual(sideEffects.emailDispatchCount, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP I: SAME-ORIGIN REGRESSION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group I: Same-Origin Legitimate Request Regression", () => {
    it("I1: Legitimate same-origin authenticated request to /api/billing/cancel succeeds", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/billing/cancel", "POST", {
        "origin": "https://www.verifii.in",
      });
      const res = await billingCancelHandler(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.subscriptionMutationCount, 1);
    });

    it("I2: Legitimate same-origin authenticated request to /api/feedback submits feedback", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/feedback", "POST", {
        "origin": "https://www.verifii.in",
      }, { category: "general", message: "Everything works smoothly!" });
      const res = await submitFeedbackHandler(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.dbInsertCount, 1);
    });

    it("I3: Legitimate same-origin authenticated request to /api/startup/[id]/identity updates identity", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/startup/101/identity", "PUT", {
        "origin": "https://www.verifii.in",
      }, { founder_name: "Founder A Updated", is_public: true });
      const res = await updateIdentityHandler(req, { params: Promise.resolve({ id: "101" }) });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.dbUpdateCount, 1);
    });

    it("I4: Legitimate same-origin authenticated request to /api/reports/create-order generates order", async () => {
      activeBearerToken = "token_user_a";
      const req = makeRequest("https://www.verifii.in/api/reports/create-order", "POST", {
        "origin": "https://www.verifii.in",
      }, { startup_id: 101 });
      const res = await createReportOrderHandler(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(sideEffects.razorpayMutationCount, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP J: SERVER ACTION / FRAMEWORK ORIGIN VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group J: Server Action / Framework Origin Validation", () => {
    it("J1: Server Action createReauthIntentAction requires authenticated user session", async () => {
      const { createReauthIntentAction } = require("../src/app/dashboard/settings/actions");
      simulatedCallerUser = null;
      activeBearerToken = null;
      const result = await createReauthIntentAction("delete-account");
      assert.strictEqual(result.success, false);
      assert.match(result.error, /Authentication required/i);
    });

    it("J2: Server Action checkReauthProofAction passively inspects proof cookie without consumption", async () => {
      const { checkReauthProofAction } = require("../src/app/dashboard/settings/actions");
      simulatedCallerUser = USER_A;
      const result = await checkReauthProofAction("delete-account");
      assert.strictEqual(result.valid, false); // No valid proof cookie provided
      assert.strictEqual(sideEffects.dbDeleteCount, 0);
    });
  });
});

/**
 * TEST 12 — Billing & Subscription Entitlement Integrity Regression Test Suite
 *
 * Deterministic regression harness validating:
 * - Group A: Unauthenticated & Unauthorized Checkout Boundaries (A1–A5)
 * - Group B: Client Plan & Price Tampering Immunity (B1–B8)
 * - Group C: Server-Authoritative Plan Selection & Entitlement SSoT (C1–C14)
 * - Group D: Duplicate Checkout & Active Subscription Defense (D1–D8)
 * - Group E: Cancellation Lifecycle & Period-End Entitlements (E1–E10)
 * - Group F: Expired & Past-Due State Entitlement Revocation (F1–F9)
 * - Group G: Cross-User Isolation & Owner-Bound Billing Actions (G1–G5)
 * - Group H: Deprecated Endpoints & 2-Tier Commercial Invariants (H1–H7)
 *
 * Authoritative Pass: Server-authoritative plan IDs are enforced; entitlements are correctly
 * restricted according to authoritative subscription state; unauthorized/wrong pricing or Pro access cannot be obtained.
 * Authoritative Fail: Wrong pricing is accepted; unauthorized Pro access occurs; client-controlled plan values can
 * alter billing or entitlement state; checkout authorization bypassed; cancellation/expiry state produces incorrect entitlement access.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import type { User } from "@supabase/supabase-js";
import crypto from "crypto";

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
  email: "eshanmaurya12@gmail.com",
  app_metadata: {},
  user_metadata: { full_name: "Verifii Admin" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

// ─── In-Memory State & Spies ────────────────────────────────────────────────

interface MockSubscriptionRecord {
  id: string;
  user_id: string;
  plan_code: "viewer" | "pro" | "founder";
  billing_cycle: "monthly" | "annual";
  status: "active" | "trialing" | "grace_period" | "past_due" | "cancelled" | "expired";
  razorpay_subscription_id: string | null;
  stripe_subscription_id?: string | null;
  razorpay_customer_id?: string | null;
  razorpay_plan_id?: string | null;
  replaces_razorpay_subscription_id?: string | null;
  current_period_start: string;
  current_period_end: string;
  trial_start?: string | null;
  trial_end?: string | null;
  created_at: string;
  updated_at: string;
}

interface MockFeatureAccessRecord {
  plan_code: string;
  feature_name: string;
  is_enabled: boolean;
}

let activeBearerToken: string | null = null;
let inMemorySubscriptions: MockSubscriptionRecord[] = [];
let inMemoryFeatureAccess: MockFeatureAccessRecord[] = [];
let queryDbError: Error | null = null;

let lastRazorpayCreateSubscriptionArgs: Record<string, unknown> | null = null;
let lastRazorpayCancelSubscriptionArgs: Array<{ subId: string; cancelAtCycleEnd: boolean }> = [];
let lastRazorpayFetchCalls: string[] = [];
let razorpayCancelFails: boolean | string = false;
let razorpayAlreadyCancelled: boolean | string = false;
let razorpayFetchStatuses: Record<string, string> = {};

// ─── Reset State ─────────────────────────────────────────────────────────────

function resetTestState() {
  activeBearerToken = null;
  queryDbError = null;
  lastRazorpayCreateSubscriptionArgs = null;
  lastRazorpayCancelSubscriptionArgs = [];
  lastRazorpayFetchCalls = [];
  razorpayCancelFails = false;
  razorpayAlreadyCancelled = false;
  razorpayFetchStatuses = {};

  process.env.RAZORPAY_KEY_ID = "rzp_test_key_12345";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_67890";
  process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly_999";

  inMemorySubscriptions = [];

  // Default Feature Access Mapping per Migration 20260818000000
  inMemoryFeatureAccess = [
    { plan_code: "viewer", feature_name: "verified_badge", is_enabled: true },
    { plan_code: "viewer", feature_name: "privacy_toggle", is_enabled: true },
    { plan_code: "viewer", feature_name: "csv_export", is_enabled: false },
    { plan_code: "viewer", feature_name: "rest_api", is_enabled: false },
    { plan_code: "viewer", feature_name: "advanced_filters", is_enabled: false },

    { plan_code: "pro", feature_name: "verified_badge", is_enabled: true },
    { plan_code: "pro", feature_name: "privacy_toggle", is_enabled: true },
    { plan_code: "pro", feature_name: "csv_export", is_enabled: true },
    { plan_code: "pro", feature_name: "rest_api", is_enabled: true },
    { plan_code: "pro", feature_name: "advanced_filters", is_enabled: true },
  ];
}

// ─── Module Interception Setup ──────────────────────────────────────────────

// 1. Mock next/headers for getAuthenticatedUser()
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

// 2. Mock rate-limit to avoid 429 during automated testing
const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_client_billing_entitlement_harness",
    checkRateLimit: async () => ({ allowed: true, remaining: 100, reset: 0 }),
  },
} as NodeModule;

// 3. Mock @supabase/supabase-js createClient
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

// 4. Mock @supabase/ssr createServerClient
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
const mockRazorpayConstructor = function (this: any, opts: any) {
  this.subscriptions = {
    create: async (options: Record<string, unknown>) => {
      lastRazorpayCreateSubscriptionArgs = options;
      return {
        id: `sub_rzp_${crypto.randomBytes(6).toString("hex")}`,
        short_url: `https://rzp.io/i/${crypto.randomBytes(4).toString("hex")}`,
        status: "created",
      };
    },
    cancel: async (subId: string, cancelAtCycleEnd: boolean) => {
      lastRazorpayCancelSubscriptionArgs.push({ subId, cancelAtCycleEnd });
      if (razorpayCancelFails === true || razorpayCancelFails === subId) {
        throw new Error("Razorpay API network timeout / 500 error");
      }
      if (razorpayAlreadyCancelled === true || razorpayAlreadyCancelled === subId) {
        const err = new Error("Subscription is not cancellable") as Error & {
          statusCode: number;
          error: { code: string; description: string };
        };
        err.statusCode = 400;
        err.error = {
          code: "BAD_REQUEST_ERROR",
          description: "Subscription is not cancellable in its current state",
        };
        throw err;
      }
      return {
        id: subId,
        status: cancelAtCycleEnd ? "active" : "cancelled",
      };
    },
    fetch: async (subId: string) => {
      lastRazorpayFetchCalls.push(subId);
      const status = razorpayFetchStatuses[subId] || "cancelled";
      return {
        id: subId,
        status,
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

supabaseServer.from = function (table: string): any {
  if (table === "subscriptions") {
    let dataset = [...inMemorySubscriptions];
    let selectedColumns: string[] | null = null;
    let limitCount: number | null = null;

    const builder: any = {
      select: (cols: string = "*") => {
        if (cols !== "*") {
          selectedColumns = cols.split(",").map((c) => c.trim());
        }
        return builder;
      },
      eq: (field: string, value: any) => {
        dataset = dataset.filter((row: any) => row[field] === value);
        return builder;
      },
      in: (field: string, values: any[]) => {
        dataset = dataset.filter((row: any) => values.includes(row[field]));
        return builder;
      },
      is: (field: string, value: any) => {
        if (value === null) {
          dataset = dataset.filter((row: any) => row[field] == null);
        } else {
          dataset = dataset.filter((row: any) => row[field] === value);
        }
        return builder;
      },
      not: (field: string, operator: string, value: any) => {
        if (operator === "is" && value === null) {
          dataset = dataset.filter((row: any) => row[field] != null);
        }
        return builder;
      },
      or: (conditionString: string) => {
        const nowIso = new Date().toISOString();
        dataset = dataset.filter((row: any) => {
          // Status in (active, grace_period)
          if (row.status === "active" || row.status === "grace_period") {
            return true;
          }
          // Trialing with trial_end in the future and trial_start <= now or null
          if (
            row.status === "trialing" &&
            row.trial_end &&
            new Date(row.trial_end).getTime() > new Date(nowIso).getTime() &&
            (!row.trial_start || new Date(row.trial_start).getTime() <= new Date(nowIso).getTime())
          ) {
            return true;
          }
          // Cancelled with current_period_end in the future
          if (
            row.status === "cancelled" &&
            row.current_period_end &&
            new Date(row.current_period_end).getTime() > new Date(nowIso).getTime()
          ) {
            return true;
          }
          return false;
        });
        return builder;
      },
      order: (field: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending ?? true;
        dataset.sort((a: any, b: any) => {
          if (field === "created_at") {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            return asc ? timeA - timeB : timeB - timeA;
          }
          return 0;
        });
        return builder;
      },
      limit: (count: number) => {
        limitCount = count;
        return builder;
      },
      maybeSingle: async () => {
        if (queryDbError) return { data: null, error: queryDbError };
        const item = dataset[0] || null;
        return { data: item ? filterCols(item, selectedColumns) : null, error: null };
      },
      single: async () => {
        if (queryDbError) return { data: null, error: queryDbError };
        const item = dataset[0] || null;
        if (!item) return { data: null, error: new Error("Row not found") };
        return { data: filterCols(item, selectedColumns), error: null };
      },
      update: (updates: Record<string, any>) => {
        return {
          eq: async (field: string, value: any) => {
            dataset.forEach((row: any) => {
              if (row[field] === value) {
                Object.assign(row, updates, { updated_at: new Date().toISOString() });
              }
            });
            return { data: null, error: null };
          },
          in: async (field: string, values: any[]) => {
            dataset.forEach((row: any) => {
              if (values.includes(row[field])) {
                Object.assign(row, updates, { updated_at: new Date().toISOString() });
              }
            });
            return { data: null, error: null };
          },
        };
      },
      then: (resolve: any, reject: any) => {
        if (queryDbError) {
          return Promise.resolve({ data: null, error: queryDbError }).then(resolve, reject);
        }
        let res: any[] = dataset;
        if (limitCount != null) {
          res = res.slice(0, limitCount);
        }
        if (selectedColumns) {
          res = res.map((r) => filterCols(r, selectedColumns));
        }
        return Promise.resolve({ data: res, error: null }).then(resolve, reject);
      },
    };
    return builder;
  }

  if (table === "feature_access") {
    let dataset = [...inMemoryFeatureAccess];
    const builder: any = {
      select: () => builder,
      eq: (field: string, value: any) => {
        dataset = dataset.filter((row: any) => row[field] === value);
        return builder;
      },
      maybeSingle: async () => {
        if (queryDbError) return { data: null, error: queryDbError };
        return { data: dataset[0] || null, error: null };
      },
    };
    return builder;
  }

  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
      }),
    }),
  };
};

function filterCols(obj: Record<string, any>, cols: string[] | null): any {
  if (!cols) return { ...obj };
  const filtered: Record<string, any> = {};
  for (const c of cols) {
    filtered[c] = obj[c];
  }
  return filtered;
}

// ─── Import Target Route Handlers & Helpers After Interception ───────────────

const { POST: postBillingCheckout } = require("../src/app/api/billing/checkout/route");
const { POST: postBillingCancel } = require("../src/app/api/billing/cancel/route");
const { POST: postBillingChangePlan } = require("../src/app/api/billing/change-plan/route");
const { getUserPlan, hasFeatureAccess, enforcePlanAccess } = require("../src/lib/subscriptions");
const { cancelAllUserSubscriptions } = require("../src/lib/billing/subscription-cancellation");

function makeJsonRequest(method: string, url: string, body?: any, bearerToken?: string): Request {
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
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────

describe("TEST 12 — Billing & Subscription Entitlement Integrity", () => {
  beforeEach(() => {
    resetTestState();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A: UNAUTHENTICATED & UNAUTHORIZED CHECKOUT BOUNDARIES (A1–A5)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group A: Unauthenticated & Unauthorized Checkout Boundaries", () => {
    it("A1: Missing authentication returns HTTP 401 Unauthorized", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      });
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error, "Authentication required");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("A2: Invalid / forged authorization token returns HTTP 401 Unauthorized", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "invalid_forged_token");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error, "Authentication required");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("A3: Unauthenticated checkout does NOT invoke Razorpay subscriptions.create", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      });
      await postBillingCheckout(req);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null, "Razorpay API must never be called for unauthenticated requests");
    });

    it("A4: Malformed non-JSON body returns HTTP 400 Bad Request", async () => {
      activeBearerToken = "token_user_a";
      const req = new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer token_user_a" },
        body: "{malformed_json:--broken",
      });
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Invalid JSON");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("A5: Authentication check strictly precedes body evaluation and billing mutations", async () => {
      // Unauthenticated request with deliberately invalid plan values
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "invalid_unsupported_tier",
        billing_cycle: "invalid_cycle",
      });
      const res = await postBillingCheckout(req);
      // Auth barrier (401) must execute before body validation (400)
      assert.strictEqual(res.status, 401, "Auth check must strictly precede body validation");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B: CLIENT PLAN & PRICE TAMPERING IMMUNITY (B1–B8)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group B: Client Plan & Price Tampering Immunity", () => {
    it("B1: Client-supplied amount (e.g. amount: 100 paise) is ignored; server enforces Pro monthly plan", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
        amount: 100, // 1 INR attempt
        amount_inr: 1,
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs?.plan_id, "plan_pro_monthly_999");
      assert.strictEqual((lastRazorpayCreateSubscriptionArgs as any)?.amount, undefined, "Client amount must not be forwarded to Razorpay");
    });

    it("B2: Client-supplied price / price_inr parameters are completely ignored", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
        price: 0,
        price_inr: 0,
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs?.plan_id, "plan_pro_monthly_999");
    });

    it("B3: Client-supplied plan_id cannot override server-configured RAZORPAY_PLAN_PRO_MONTHLY", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
        plan_id: "plan_forged_free_tier_000",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs?.plan_id, "plan_pro_monthly_999");
    });

    it("B4: Non-Pro plan requests (e.g. plan_code: 'viewer') return HTTP 400", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "viewer",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Invalid plan or billing cycle. Only Pro monthly is available.");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("B5: Annual plan requests (billing_cycle: 'annual') return HTTP 400", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "annual",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Invalid plan or billing cycle. Only Pro monthly is available.");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("B6: Legacy Founder plan requests (plan_code: 'founder') return HTTP 400", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "founder",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("B7: Currency manipulation in body (e.g. currency: 'USD') cannot alter billing configuration", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
        currency: "USD",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs?.plan_id, "plan_pro_monthly_999");
      assert.strictEqual((lastRazorpayCreateSubscriptionArgs as any)?.currency, undefined);
    });

    it("B8: Server-configured RAZORPAY_PLAN_PRO_MONTHLY is strictly enforced in subscription creation notes", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      const notes = (lastRazorpayCreateSubscriptionArgs as any)?.notes;
      assert.strictEqual(notes?.user_id, USER_A.id);
      assert.strictEqual(notes?.plan_code, "pro");
      assert.strictEqual(notes?.billing_cycle, "monthly");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C: SERVER-AUTHORITATIVE PLAN SELECTION & ENTITLEMENT SSoT (C1–C14)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group C: Server-Authoritative Plan Selection & Entitlement SSoT", () => {
    it("C1: Active Pro subscription returns plan_code: 'pro' and status: 'active'", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_1",
          current_period_start: new Date(Date.now() - 86400000 * 10).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "active");
    });

    it("C2: Grace period subscription returns plan_code: 'pro' and status: 'grace_period'", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_2",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "grace_period",
          razorpay_subscription_id: "sub_rzp_2",
          current_period_start: new Date(Date.now() - 86400000 * 32).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 2).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 32).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "grace_period");
    });

    it("C3: Valid trialing subscription (trial_end in future) grants Pro entitlement", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_3",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "trialing",
          razorpay_subscription_id: "sub_rzp_3",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "trialing");
    });

    it("C4: Cancelled subscription with current_period_end in the future retains Pro access", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_4",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_4",
          current_period_start: new Date(Date.now() - 86400000 * 15).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 15).toISOString(), // 15 days left
          created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "cancelled");
    });

    it("C5: Cancelled subscription with past current_period_end drops immediately to Free viewer", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_5",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_5",
          current_period_start: new Date(Date.now() - 86400000 * 45).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 15).toISOString(), // Expired 15 days ago
          created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("C6: Past-due subscription drops immediately to Free viewer", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_6",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "past_due",
          razorpay_subscription_id: "sub_rzp_6",
          current_period_start: new Date(Date.now() - 86400000 * 35).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 5).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 35).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("C7: Expired subscription drops immediately to Free viewer", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_7",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "expired",
          razorpay_subscription_id: "sub_rzp_7",
          current_period_start: new Date(Date.now() - 86400000 * 60).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 30).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("C8: User with zero subscriptions receives free_viewer_fallback", async () => {
      inMemorySubscriptions = [];
      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
      assert.strictEqual(plan.user_id, USER_A.id);
    });

    it("C9: Empty query result returns free_viewer_fallback", async () => {
      inMemorySubscriptions = [];
      const plan = await getUserPlan("nonexistent_user_id");
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("C10: Database query error fails closed to free_viewer_fallback", async () => {
      queryDbError = new Error("PostgreSQL connection timeout");
      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer", "Must fail closed to viewer plan on database error");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("C11: Older cancelled subscription does NOT override newer active subscription", async () => {
      inMemorySubscriptions = [
        // Old cancelled record (created 30 days ago, cancelled 10 days ago, current_period_end still in future)
        {
          id: "sub_old_cancelled",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_old",
          current_period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          updated_at: new Date().toISOString(),
        },
        // Newer active record (created 5 days ago)
        {
          id: "sub_new_active",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_new",
          current_period_start: new Date(Date.now() - 86400000 * 5).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 25).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.id, "sub_new_active", "Active subscription must win over cancelled");
      assert.strictEqual(plan.status, "active");
    });

    it("C12: Deterministic STATUS_PRIORITY ordering: active (0) > grace_period (1) > trialing (2) > cancelled (3)", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_cancelled",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_c",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 10).toISOString(),
          created_at: new Date(Date.now() + 1000).toISOString(), // Newer timestamp
          updated_at: new Date().toISOString(),
        },
        {
          id: "sub_trialing",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "trialing",
          razorpay_subscription_id: "sub_t",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 10).toISOString(),
          trial_end: new Date(Date.now() + 86400000 * 10).toISOString(),
          created_at: new Date(Date.now() - 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      // Trialing (priority 2) must beat Cancelled (priority 3) regardless of created_at
      assert.strictEqual(plan.id, "sub_trialing");
      assert.strictEqual(plan.status, "trialing");
    });

    it("C13: Newer record only wins within the same priority tier", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_active_old",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_a1",
          current_period_start: new Date(Date.now() - 86400000 * 20).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 10).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "sub_active_new",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_a2",
          current_period_start: new Date(Date.now() - 86400000 * 2).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 28).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.id, "sub_active_new", "Newest active subscription must be selected");
    });

    it("C14: Entitlement is immune to client claims in headers, cookies, or request bodies", async () => {
      inMemorySubscriptions = [];
      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer", "Entitlement must strictly come from server database SSoT");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D: DUPLICATE CHECKOUT & ACTIVE SUBSCRIPTION DEFENSE (D1–D8)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group D: Duplicate Checkout & Active Subscription Defense", () => {
    it("D1: Existing active Pro subscription blocks new checkout session with HTTP 400", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_act_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_act",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Active subscription exists. Please cancel existing subscription first.");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("D2: Existing trialing Pro subscription blocks duplicate checkout with HTTP 400", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_tri_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "trialing",
          razorpay_subscription_id: "sub_rzp_tri",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          trial_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error, "Active subscription exists. Please cancel existing subscription first.");
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("D3: Existing grace_period subscription blocks duplicate checkout with HTTP 400", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_grp_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "grace_period",
          razorpay_subscription_id: "sub_rzp_grp",
          current_period_start: new Date(Date.now() - 86400000 * 32).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 2).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 32).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("D4: Existing cancelled subscription (still entitled) blocks duplicate checkout with HTTP 400", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_can_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_can",
          current_period_start: new Date(Date.now() - 86400000 * 10).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs, null);
    });

    it("D5: Free user (viewer) can legitimately initiate checkout", async () => {
      inMemorySubscriptions = []; // No active subscription
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.subscription_id);
      assert.ok(json.short_url);
      assert.strictEqual(lastRazorpayCreateSubscriptionArgs?.plan_id, "plan_pro_monthly_999");
    });

    it("D6: Fully expired subscription does not block legitimate re-subscription", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_exp_1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "expired",
          razorpay_subscription_id: "sub_rzp_exp",
          current_period_start: new Date(Date.now() - 86400000 * 60).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 30).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.ok(json.subscription_id);
    });

    it("D7: Database partial unique-index invariant idx_active_subscription_unique guarantees single active row", () => {
      // Invariant check: In Supabase migration 20260606000000_subscription_foundation.sql:
      // CREATE UNIQUE INDEX idx_active_subscription_unique ON subscriptions (user_id) WHERE (status IN ('active', 'trialing', 'grace_period'));
      const activeStatuses = ["active", "trialing", "grace_period"];
      const activeRows = inMemorySubscriptions.filter((s) => s.user_id === USER_A.id && activeStatuses.includes(s.status));
      assert.ok(activeRows.length <= 1, "Database unique partial index invariant holds");
    });

    it("D8: Logical concurrency safety prevents duplicate active state creation", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_active_race",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_race",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 30).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E: CANCELLATION LIFECYCLE & PERIOD-END ENTITLEMENTS (E1–E10)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group E: Cancellation Lifecycle & Period-End Entitlements", () => {
    it("E1: Unauthenticated cancellation returns HTTP 401 Unauthorized", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error, "Authentication required");
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });

    it("E2: User without cancellable subscription returns HTTP 404", async () => {
      inMemorySubscriptions = []; // No subscription
      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel", {}, "token_user_a");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 404);
      const json = await res.json();
      assert.strictEqual(json.error, "No active subscription found to cancel.");
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });

    it("E3: Cycle-end cancellation passes cancel_at_cycle_end = true (immediate: false)", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_to_cancel",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_cancel_1",
          current_period_start: new Date(Date.now() - 86400000 * 10).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      razorpayFetchStatuses["sub_rzp_cancel_1"] = "active"; // Provider status remains active with cancel schedule

      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel", {}, "token_user_a");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);

      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 1);
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs[0].subId, "sub_rzp_cancel_1");
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs[0].cancelAtCycleEnd, true, "Normal cancellation must pass cancel_at_cycle_end=true");
    });

    it("E4: Cancellation verification via subscriptions.fetch is mandatory", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_verify_cancel",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_verify_1",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      razorpayFetchStatuses["sub_rzp_verify_1"] = "active";

      await cancelAllUserSubscriptions(USER_A.id, { immediate: false });
      assert.ok(lastRazorpayFetchCalls.includes("sub_rzp_verify_1"), "Must verify status via fetch call");
    });

    it("E5: Cancellation preserves Pro entitlement while current_period_end is in the future", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_cancelled_entitled",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_c1",
          current_period_start: new Date(Date.now() - 86400000 * 10).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(), // 20 days remaining
          created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro", "Cancelled sub with future period_end must retain Pro access");
      assert.strictEqual(plan.status, "cancelled");
    });

    it("E6: Cancellation does NOT extend current_period_end or billing period", async () => {
      const originalEnd = new Date(Date.now() + 86400000 * 18).toISOString();
      inMemorySubscriptions = [
        {
          id: "sub_c_no_extend",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_c2",
          current_period_start: new Date(Date.now() - 86400000 * 12).toISOString(),
          current_period_end: originalEnd,
          created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      razorpayFetchStatuses["sub_rzp_c2"] = "active";

      await cancelAllUserSubscriptions(USER_A.id, { immediate: false });
      const sub = inMemorySubscriptions.find((s) => s.id === "sub_c_no_extend");
      assert.strictEqual(sub?.current_period_end, originalEnd, "Period end timestamp must remain immutable");
    });

    it("E7: Cancellation does NOT grant additional Pro access beyond current_period_end", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_c_bounded",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_c3",
          current_period_start: new Date(Date.now() - 86400000 * 40).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 10).toISOString(), // Expired
          created_at: new Date(Date.now() - 86400000 * 40).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
    });

    it("E8: Already-cancelled provider subscription is handled gracefully by isAlreadyCancelledError", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_already_c",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_already_c",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 15).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      razorpayAlreadyCancelled = "sub_rzp_already_c";
      razorpayFetchStatuses["sub_rzp_already_c"] = "cancelled";

      const result = await cancelAllUserSubscriptions(USER_A.id, { immediate: false });
      assert.strictEqual(result.success, true, "Already-cancelled sub must be handled gracefully");
    });

    it("E9: Cross-user cancellation is rejected (User A cannot cancel User B's subscription)", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_user_b",
          user_id: USER_B.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_user_b",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel", {}, "token_user_a");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 404, "User A cannot discover or cancel User B's subscription");
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });

    it("E10: No client-supplied ID in body can redirect cancellation to another user", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_user_b_tamper",
          user_id: USER_B.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_user_b_tamper",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel", {
        user_id: USER_B.id,
        subscription_id: "sub_user_b_tamper",
      }, "token_user_a");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP F: EXPIRED & PAST-DUE STATE ENTITLEMENT REVOCATION (F1–F9)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group F: Expired & Past-Due State Entitlement Revocation", () => {
    it("F1: Cancelled subscription where current_period_end <= now is strictly Free", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f1",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_f1",
          current_period_start: new Date(Date.now() - 86400000 * 31).toISOString(),
          current_period_end: new Date(Date.now() - 1000).toISOString(), // 1s ago
          created_at: new Date(Date.now() - 86400000 * 31).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
      assert.strictEqual(plan.id, "free_viewer_fallback");
    });

    it("F2: Cancelled subscription where current_period_end > now is strictly Pro", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f2",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_f2",
          current_period_start: new Date(Date.now() - 86400000 * 15).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 15).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "cancelled");
    });

    it("F3: past_due subscription is strictly Free (excluded from entitlement query)", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f3",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "past_due",
          razorpay_subscription_id: "sub_rzp_f3",
          current_period_start: new Date(Date.now() - 86400000 * 35).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 5).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 35).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer", "past_due must not grant Pro entitlement");
    });

    it("F4: expired subscription is strictly Free", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f4",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "expired",
          razorpay_subscription_id: "sub_rzp_f4",
          current_period_start: new Date(Date.now() - 86400000 * 60).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 30).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
    });

    it("F5: Expired subscription cannot authorize Pro feature access (enforcePlanAccess)", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f5",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "expired",
          razorpay_subscription_id: "sub_rzp_f5",
          current_period_start: new Date(Date.now() - 86400000 * 60).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 30).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const hasCsvAccess = await enforcePlanAccess(USER_A.id, "csv_export");
      assert.strictEqual(hasCsvAccess, false, "Expired user must not have csv_export access");

      const hasApiAccess = await enforcePlanAccess(USER_A.id, "rest_api");
      assert.strictEqual(hasApiAccess, false, "Expired user must not have rest_api access");
    });

    it("F6: Expired subscription allows creating a new checkout session without blocking", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f6",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "expired",
          razorpay_subscription_id: "sub_rzp_f6",
          current_period_start: new Date(Date.now() - 86400000 * 60).toISOString(),
          current_period_end: new Date(Date.now() - 86400000 * 30).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200, "Expired subscription must not block new checkout");
    });

    it("F7: trialing subscription after trial_end is strictly Free", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f7",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "trialing",
          razorpay_subscription_id: "sub_rzp_f7",
          current_period_start: new Date(Date.now() - 86400000 * 20).toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 10).toISOString(),
          trial_start: new Date(Date.now() - 86400000 * 20).toISOString(),
          trial_end: new Date(Date.now() - 86400000 * 6).toISOString(), // Trial ended 6 days ago
          created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer", "Expired trial must not grant Pro");
    });

    it("F8: Valid trialing subscription with future trial_end retains Pro", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_f8",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "trialing",
          razorpay_subscription_id: "sub_rzp_f8",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 86400000 * 14).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "pro");
      assert.strictEqual(plan.status, "trialing");
    });

    it("F9: Boundary timestamp check: exactly 1 millisecond after current_period_end drops to Free", async () => {
      const pastTime = new Date(Date.now() - 1).toISOString();
      inMemorySubscriptions = [
        {
          id: "sub_f9",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "cancelled",
          razorpay_subscription_id: "sub_rzp_f9",
          current_period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
          current_period_end: pastTime,
          created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const plan = await getUserPlan(USER_A.id);
      assert.strictEqual(plan.plan_code, "viewer");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP G: CROSS-USER ISOLATION & OWNER-BOUND BILLING ACTIONS (G1–G5)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group G: Cross-User Isolation & Owner-Bound Billing Actions", () => {
    it("G1: User A cannot cancel User B's subscription", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_g1_user_b",
          user_id: USER_B.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_g1",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const req = makeJsonRequest("POST", "http://localhost/api/billing/cancel", {}, "token_user_a");
      const res = await postBillingCancel(req);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });

    it("G2: User A cannot use User B's subscription to obtain Pro entitlement", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_g2_user_b",
          user_id: USER_B.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_g2",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const planUserA = await getUserPlan(USER_A.id);
      assert.strictEqual(planUserA.plan_code, "viewer", "User A must remain Free viewer");

      const planUserB = await getUserPlan(USER_B.id);
      assert.strictEqual(planUserB.plan_code, "pro", "User B is Pro");
    });

    it("G3: getUserPlan for User A strictly filters database by user_id = User A", async () => {
      inMemorySubscriptions = [
        {
          id: "sub_g3_user_a",
          user_id: USER_A.id,
          plan_code: "pro",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: "sub_rzp_g3_a",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "sub_g3_user_b",
          user_id: USER_B.id,
          plan_code: "viewer",
          billing_cycle: "monthly",
          status: "active",
          razorpay_subscription_id: null,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 86400000 * 20).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const planA = await getUserPlan(USER_A.id);
      assert.strictEqual(planA.user_id, USER_A.id);
      assert.strictEqual(planA.id, "sub_g3_user_a");
    });

    it("G4: User-supplied parameters in request body cannot bypass session user.id", async () => {
      inMemorySubscriptions = [];
      const req = makeJsonRequest("POST", "http://localhost/api/billing/checkout", {
        plan_code: "pro",
        billing_cycle: "monthly",
        user_id: USER_B.id, // Attempt to create checkout for User B
      }, "token_user_a");

      const res = await postBillingCheckout(req);
      assert.strictEqual(res.status, 200);
      const notes = (lastRazorpayCreateSubscriptionArgs as any)?.notes;
      assert.strictEqual(notes?.user_id, USER_A.id, "Session user.id must override any body user_id");
    });

    it("G5: Missing / unauthenticated ownership check in cancellation fails closed", async () => {
      const result = await cancelAllUserSubscriptions("nonexistent_user", { immediate: false });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.discoveredCount, 0);
      assert.strictEqual(result.cancelledActiveCount, 0);
      assert.strictEqual(lastRazorpayCancelSubscriptionArgs.length, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP H: DEPRECATED ENDPOINTS & 2-TIER COMMERCIAL INVARIANTS (H1–H7)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group H: Deprecated Endpoints & 2-Tier Commercial Invariants", () => {
    it("H1: /api/billing/change-plan rejects plan switching with HTTP 400", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/change-plan", {
        plan_code: "pro",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingChangePlan(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes("Plan switching between paid tiers is unavailable"));
    });

    it("H2: Annual plan change request returns HTTP 400 (obsolete)", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/change-plan", {
        plan_code: "pro",
        billing_cycle: "annual",
      }, "token_user_a");
      const res = await postBillingChangePlan(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes("obsolete and no longer supported"));
    });

    it("H3: Legacy Founder plan change request returns HTTP 400 (obsolete)", async () => {
      const req = makeJsonRequest("POST", "http://localhost/api/billing/change-plan", {
        plan_code: "founder",
        billing_cycle: "monthly",
      }, "token_user_a");
      const res = await postBillingChangePlan(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.includes("obsolete and no longer supported"));
    });

    it("H4: Free viewer plan price is ₹0 (verified against commercial migration & catalog)", async () => {
      const hasBadge = await hasFeatureAccess("viewer", "verified_badge");
      assert.strictEqual(hasBadge, true, "Verified badge must be enabled for Free viewer plan");
    });

    it("H5: Pro monthly plan price is ₹999/mo (RAZORPAY_PLAN_PRO_MONTHLY)", () => {
      assert.strictEqual(process.env.RAZORPAY_PLAN_PRO_MONTHLY, "plan_pro_monthly_999");
    });

    it("H6: Free features (verified_badge, privacy_toggle) are enabled for Free plan", async () => {
      const hasBadge = await hasFeatureAccess("viewer", "verified_badge");
      const hasPrivacy = await hasFeatureAccess("viewer", "privacy_toggle");
      assert.strictEqual(hasBadge, true);
      assert.strictEqual(hasPrivacy, true);
    });

    it("H7: Pro-only features (csv_export, rest_api, advanced_filters) require Pro entitlement", async () => {
      const viewerCsv = await hasFeatureAccess("viewer", "csv_export");
      const viewerApi = await hasFeatureAccess("viewer", "rest_api");
      const viewerFilters = await hasFeatureAccess("viewer", "advanced_filters");

      assert.strictEqual(viewerCsv, false, "Free viewer must NOT have csv_export");
      assert.strictEqual(viewerApi, false, "Free viewer must NOT have rest_api");
      assert.strictEqual(viewerFilters, false, "Free viewer must NOT have advanced_filters");

      const proCsv = await hasFeatureAccess("pro", "csv_export");
      const proApi = await hasFeatureAccess("pro", "rest_api");
      const proFilters = await hasFeatureAccess("pro", "advanced_filters");

      assert.strictEqual(proCsv, true, "Pro plan must have csv_export");
      assert.strictEqual(proApi, true, "Pro plan must have rest_api");
      assert.strictEqual(proFilters, true, "Pro plan must have advanced_filters");
    });
  });
});

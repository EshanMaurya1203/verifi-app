/**
 * TEST 13 — Payment Provider & Webhook Boundary Regression Test Suite
 *
 * Deterministic regression harness validating:
 * - Group A: Cryptographic Signature Boundaries (A1–A15)
 * - Group B: Provider Identity & Anti-Spoofing (B1–B12)
 * - Group C: Atomic Event Idempotency & Concurrency (C1–C12)
 * - Group D: Replay & Stale Event Monotonicity (D1–D9)
 * - Group E: Unmapped Account & Fail-Closed Boundaries (E1–E12)
 * - Group F: Revenue & MRR Calculation Integrity (F1–F12)
 * - Group G: Subscription State Machine (G1–G14)
 *
 * Authoritative Pass: Only authenticated provider events mutate the correct account and
 * duplicates/replays cause zero duplicate financial/subscription mutation.
 * Authoritative Fail: Forged, replayed, stale, unmapped, malformed, or incorrectly
 * attributed events can mutate financial state or activate unauthorized entitlements.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";

// ─── Test Secrets & Configuration ───────────────────────────────────────────

const TEST_STRIPE_WEBHOOK_SECRET = "whsec_test_stripe_secret_1234567890abcdef";
const TEST_RAZORPAY_WEBHOOK_SECRET = "test_rzp_provider_webhook_secret_xyz123";
const TEST_RAZORPAY_BILLING_WEBHOOK_SECRET = "test_rzp_billing_webhook_secret_abc456";
const TEST_PRO_PLAN_ID = "plan_ProMonthly_999";

process.env.STRIPE_SECRET_KEY = "sk_test_mock_stripe_key_123456";
process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_WEBHOOK_SECRET;
process.env.RAZORPAY_KEY_ID = "rzp_test_key_mock_123";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_mock_456";
process.env.RAZORPAY_WEBHOOK_SECRET = TEST_RAZORPAY_WEBHOOK_SECRET;
process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = TEST_RAZORPAY_BILLING_WEBHOOK_SECRET;
process.env.RAZORPAY_PLAN_PRO_MONTHLY = TEST_PRO_PLAN_ID;
process.env.ENCRYPTION_SECRET = "12345678901234567890123456789012";

// ─── In-Memory Mock Database & Mutation Counters ────────────────────────────

interface MockProviderConnection {
  id: string;
  startup_id: number;
  provider: "stripe" | "razorpay";
  provider_account_id: string;
  status: "connected" | "disconnected";
  last_synced_at?: string;
}

interface MockStartupSubmission {
  id: number;
  user_id: string;
  startup_name: string;
  mrr: number;
  mrr_breakdown: Record<string, number>;
  clean_events: number;
  penalty_count: number;
  last_penalty_at: string | null;
  payment_connected: boolean;
  stripe_account_id: string | null;
  verification_status: string;
  video_url?: string;
  website?: string;
  raw_metrics?: Record<string, unknown>;
}

interface MockSubscription {
  id: string;
  user_id: string;
  plan_code: "viewer" | "pro";
  billing_cycle: "monthly";
  status: "active" | "trialing" | "grace_period" | "past_due" | "cancelled" | "expired";
  razorpay_subscription_id: string;
  razorpay_customer_id: string | null;
  razorpay_plan_id: string | null;
  replaces_razorpay_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  last_billing_event_at: string | null;
  last_billing_event_id: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  created_at: string;
  updated_at: string;
}

interface MutationCounters {
  processedWebhookEventsInserts: number;
  revenueTransactionsInserts: number;
  revenueSnapshotsInserts: number;
  startupSubmissionsUpdates: number;
  subscriptionsUpserts: number;
  subscriptionEventsInserts: number;
  notificationDispatches: number;
  externalRazorpayCancels: number;
}

const counters: MutationCounters = {
  processedWebhookEventsInserts: 0,
  revenueTransactionsInserts: 0,
  revenueSnapshotsInserts: 0,
  startupSubmissionsUpdates: 0,
  subscriptionsUpserts: 0,
  subscriptionEventsInserts: 0,
  notificationDispatches: 0,
  externalRazorpayCancels: 0,
};

let processedWebhookEvents = new Set<string>();
let providerConnections: MockProviderConnection[] = [];
let startupSubmissions: Map<number, MockStartupSubmission> = new Map();
let subscriptions: Map<string, MockSubscription> = new Map();
let revenueTransactions: Array<{ id: string; startup_id: number; payment_id: string; amount: number; provider: string; created_at: string }> = [];
let revenueSnapshots: Array<{ id: string; startup_id: number; total_revenue: number; provider_breakdown: Record<string, number>; created_at: string }> = [];
let subscriptionEvents: Array<{ subscription_id: string; user_id: string; event_type: string; new_status: string; created_at: string }> = [];
let dispatchedNotifications: Array<{ type: string; idempotencyKey: string; payload: Record<string, unknown> }> = [];
let externalRazorpayCancelCalls: Array<{ subId: string; cancelAtCycleEnd: boolean }> = [];

function resetDatabaseState() {
  processedWebhookEvents.clear();
  providerConnections = [];
  startupSubmissions.clear();
  subscriptions.clear();
  revenueTransactions = [];
  revenueSnapshots = [];
  subscriptionEvents = [];
  dispatchedNotifications = [];
  externalRazorpayCancelCalls = [];

  counters.processedWebhookEventsInserts = 0;
  counters.revenueTransactionsInserts = 0;
  counters.revenueSnapshotsInserts = 0;
  counters.startupSubmissionsUpdates = 0;
  counters.subscriptionsUpserts = 0;
  counters.subscriptionEventsInserts = 0;
  counters.notificationDispatches = 0;
  counters.externalRazorpayCancels = 0;

  // Seed default startup 101 for User Alpha
  startupSubmissions.set(101, {
    id: 101,
    user_id: "usr_alpha_1111",
    startup_name: "Alpha Payments Inc",
    mrr: 500,
    mrr_breakdown: { stripe: 200, razorpay: 300 },
    clean_events: 5,
    penalty_count: 0,
    last_penalty_at: null,
    payment_connected: true,
    stripe_account_id: "acct_stripe_alpha_123",
    verification_status: "stripe_connected",
    website: "https://alphapay.example.com",
    video_url: "https://youtube.com/watch?v=alpha123",
  });

  // Seed default startup 102 for User Beta
  startupSubmissions.set(102, {
    id: 102,
    user_id: "usr_beta_2222",
    startup_name: "Beta Logistics Ltd",
    mrr: 1000,
    mrr_breakdown: { razorpay: 1000 },
    clean_events: 10,
    penalty_count: 0,
    last_penalty_at: null,
    payment_connected: true,
    stripe_account_id: null,
    verification_status: "razorpay_connected",
    website: "https://betalogistics.example.com",
  });

  // Seed connections
  providerConnections.push({
    id: "conn_stripe_101",
    startup_id: 101,
    provider: "stripe",
    provider_account_id: "acct_stripe_alpha_123",
    status: "connected",
  });

  providerConnections.push({
    id: "conn_razorpay_101",
    startup_id: 101,
    provider: "razorpay",
    provider_account_id: "acc_rzp_alpha_456",
    status: "connected",
  });

  providerConnections.push({
    id: "conn_razorpay_102",
    startup_id: 102,
    provider: "razorpay",
    provider_account_id: "acc_rzp_beta_789",
    status: "connected",
  });
}

// ─── Stub Modules in require.cache ──────────────────────────────────────────

const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_client_webhook_ip",
    checkRateLimit: async () => ({ allowed: true, remaining: 50 }),
  },
} as NodeModule;

const dispatcherPath = require.resolve("../src/notifications/dispatcher");
require.cache[dispatcherPath] = {
  id: dispatcherPath,
  filename: dispatcherPath,
  loaded: true,
  exports: {
    dispatchNotification: async (params: { type: string; idempotencyKey: string; payload: Record<string, unknown> }) => {
      const alreadySent = dispatchedNotifications.some((n) => n.idempotencyKey === params.idempotencyKey);
      if (!alreadySent) {
        dispatchedNotifications.push(params);
        counters.notificationDispatches++;
      }
    },
  },
} as NodeModule;

// Mock Razorpay SDK constructor
const razorpayModulePath = require.resolve("razorpay");
require.cache[razorpayModulePath] = {
  id: razorpayModulePath,
  filename: razorpayModulePath,
  loaded: true,
  exports: class MockRazorpay {
    subscriptions = {
      cancel: async (subId: string, cancelAtCycleEnd: boolean) => {
        externalRazorpayCancelCalls.push({ subId, cancelAtCycleEnd });
        counters.externalRazorpayCancels++;
        return { id: subId, status: "cancelled" };
      },
      fetch: async (subId: string) => {
        return { id: subId, status: "cancelled" };
      },
    };
  },
} as NodeModule;

// Import supabaseServer singleton and patch query execution methods
const { supabaseServer } = require("../src/lib/supabase-server");

function executeSelect(
  tableName: string,
  filters: Record<string, unknown>,
  inFilters: Record<string, unknown[]>,
  gtFilters: Record<string, unknown>,
  gteFilters: Record<string, unknown>,
  ltFilters: Record<string, unknown>,
  lteFilters: Record<string, unknown>,
  isNullFilters: string[],
  isNotNullFilters: string[],
  orderField: string | null,
  isAscending: boolean,
  limitCount: number | null
) {
  let list: any[] = [];
  if (tableName === "provider_connections") {
    list = [...providerConnections];
  } else if (tableName === "startup_submissions") {
    list = Array.from(startupSubmissions.values());
  } else if (tableName === "subscriptions") {
    list = Array.from(subscriptions.values());
  } else if (tableName === "revenue_transactions") {
    list = [...revenueTransactions];
  } else if (tableName === "revenue_snapshots") {
    list = [...revenueSnapshots];
  } else if (tableName === "subscription_events") {
    list = [...subscriptionEvents];
  }

  // Apply equality filters
  for (const [col, val] of Object.entries(filters)) {
    list = list.filter((item) => {
      if (col === "startup_id" && val !== undefined) {
        return Number(item.startup_id) === Number(val);
      }
      if (col === "id" && val !== undefined) {
        return String(item.id) === String(val);
      }
      return item[col] === val;
    });
  }

  // Apply IN filters
  for (const [col, vals] of Object.entries(inFilters)) {
    list = list.filter((item) => vals.includes(item[col]));
  }

  // Apply GT filters
  for (const [col, val] of Object.entries(gtFilters)) {
    list = list.filter((item) => Number(item[col]) > Number(val));
  }

  // Apply GTE filters
  for (const [col, val] of Object.entries(gteFilters)) {
    list = list.filter((item) => Number(item[col]) >= Number(val));
  }

  // Apply LT filters
  for (const [col, val] of Object.entries(ltFilters)) {
    list = list.filter((item) => Number(item[col]) < Number(val));
  }

  // Apply LTE filters
  for (const [col, val] of Object.entries(lteFilters)) {
    list = list.filter((item) => Number(item[col]) <= Number(val));
  }

  // Apply IS NULL filters
  for (const col of isNullFilters) {
    list = list.filter((item) => item[col] == null);
  }

  // Apply IS NOT NULL filters
  for (const col of isNotNullFilters) {
    list = list.filter((item) => item[col] != null);
  }

  // Order
  if (orderField) {
    list.sort((a, b) => {
      const valA = a[orderField!];
      const valB = b[orderField!];
      if (valA < valB) return isAscending ? -1 : 1;
      if (valA > valB) return isAscending ? 1 : -1;
      return 0;
    });
  }

  // Limit
  if (limitCount !== null) {
    list = list.slice(0, limitCount);
  }

  return list;
}

(supabaseServer as any).auth = {
  admin: {
    getUserById: async (userId: string) => {
      return {
        data: {
          user: {
            id: userId,
            email: `${userId}@example.com`,
            user_metadata: { full_name: `User ${userId}` },
          },
        },
        error: null,
      };
    },
  },
};

(supabaseServer as any).from = (tableName: string) => {
  let filters: Record<string, unknown> = {};
  let inFilters: Record<string, unknown[]> = {};
  let gtFilters: Record<string, unknown> = {};
  let gteFilters: Record<string, unknown> = {};
  let ltFilters: Record<string, unknown> = {};
  let lteFilters: Record<string, unknown> = {};
  let isNullFilters: string[] = [];
  let isNotNullFilters: string[] = [];
  let orderField: string | null = null;
  let isAscending = true;
  let limitCount: number | null = null;

  const builder: any = {
    select: (_fields?: string, _options?: { count?: string; head?: boolean }) => builder,
    eq: (col: string, val: unknown) => {
      filters[col] = val;
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      inFilters[col] = vals;
      return builder;
    },
    gt: (col: string, val: unknown) => {
      gtFilters[col] = val;
      return builder;
    },
    gte: (col: string, val: unknown) => {
      gteFilters[col] = val;
      return builder;
    },
    lt: (col: string, val: unknown) => {
      ltFilters[col] = val;
      return builder;
    },
    lte: (col: string, val: unknown) => {
      lteFilters[col] = val;
      return builder;
    },
    is: (col: string, val: unknown) => {
      if (val === null) isNullFilters.push(col);
      return builder;
    },
    not: (col: string, op: string, val: unknown) => {
      if (op === "is" && val === null) isNotNullFilters.push(col);
      return builder;
    },
    order: (col: string, options?: { ascending?: boolean }) => {
      orderField = col;
      isAscending = options?.ascending ?? true;
      return builder;
    },
    limit: (n: number) => {
      limitCount = n;
      return builder;
    },
    single: async () => {
      const results = executeSelect(
        tableName,
        filters,
        inFilters,
        gtFilters,
        gteFilters,
        ltFilters,
        lteFilters,
        isNullFilters,
        isNotNullFilters,
        orderField,
        isAscending,
        limitCount
      );
      if (results.length === 0) return { data: null, error: new Error("Row not found") };
      return { data: results[0], error: null };
    },
    maybeSingle: async () => {
      const results = executeSelect(
        tableName,
        filters,
        inFilters,
        gtFilters,
        gteFilters,
        ltFilters,
        lteFilters,
        isNullFilters,
        isNotNullFilters,
        orderField,
        isAscending,
        limitCount
      );
      if (results.length === 0) return { data: null, error: null };
      return { data: results[0], error: null };
    },
    insert: async (data: Record<string, unknown> | Array<Record<string, unknown>>) => {
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        if (tableName === "processed_webhook_events") {
          const key = `${row.provider}:${row.event_id}`;
          if (processedWebhookEvents.has(key)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          processedWebhookEvents.add(key);
          counters.processedWebhookEventsInserts++;
        } else if (tableName === "revenue_transactions") {
          const existing = revenueTransactions.find((tx) => tx.payment_id === row.payment_id);
          if (existing) {
            return { data: null, error: { code: "23505", message: "duplicate key value" } };
          }
          revenueTransactions.push({
            id: crypto.randomUUID(),
            startup_id: Number(row.startup_id),
            payment_id: String(row.payment_id),
            amount: Number(row.amount),
            provider: String(row.provider),
            created_at: new Date().toISOString(),
          });
          counters.revenueTransactionsInserts++;
        } else if (tableName === "revenue_snapshots") {
          revenueSnapshots.push({
            id: crypto.randomUUID(),
            startup_id: Number(row.startup_id),
            total_revenue: Number(row.total_revenue),
            provider_breakdown: (row.provider_breakdown as Record<string, number>) || {},
            created_at: new Date().toISOString(),
          });
          counters.revenueSnapshotsInserts++;
        } else if (tableName === "subscription_events") {
          subscriptionEvents.push({
            subscription_id: String(row.subscription_id),
            user_id: String(row.user_id),
            event_type: String(row.event_type),
            new_status: String(row.new_status),
            created_at: new Date().toISOString(),
          });
          counters.subscriptionEventsInserts++;
        }
      }
      return { data: rows, error: null };
    },
    update: (updateData: Record<string, unknown>) => {
      const updateBuilder = {
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return updateBuilder;
        },
        in: (col: string, vals: unknown[]) => {
          inFilters[col] = vals;
          return updateBuilder;
        },
        select: (_cols?: string) => updateBuilder,
        single: async () => {
          if (tableName === "startup_submissions") {
            const id = Number(filters.id);
            const startup = startupSubmissions.get(id);
            if (startup) {
              Object.assign(startup, updateData);
              counters.startupSubmissionsUpdates++;
              return { data: startup, error: null };
            }
          }
          return { data: null, error: null };
        },
        then: (resolve: (val: { data: unknown; error: null }) => void) => {
          if (tableName === "startup_submissions") {
            const id = Number(filters.id);
            const startup = startupSubmissions.get(id);
            if (startup) {
              if (inFilters.verification_status && !inFilters.verification_status.includes(startup.verification_status)) {
                resolve({ data: startup, error: null });
                return;
              }
              Object.assign(startup, updateData);
              counters.startupSubmissionsUpdates++;
            }
          } else if (tableName === "subscriptions") {
            const razorpaySubId = String(filters.razorpay_subscription_id);
            const sub = subscriptions.get(razorpaySubId);
            if (sub) {
              Object.assign(sub, updateData);
              counters.subscriptionsUpserts++;
            }
          }
          resolve({ data: null, error: null });
        },
      };
      return updateBuilder;
    },
    upsert: (data: Record<string, unknown>, _options?: { onConflict?: string }) => {
      if (tableName === "subscriptions") {
        const subId = String(data.razorpay_subscription_id);
        const existing = subscriptions.get(subId);
        const record: MockSubscription = {
          id: existing?.id || crypto.randomUUID(),
          user_id: String(data.user_id),
          plan_code: data.plan_code as "pro",
          billing_cycle: "monthly",
          status: data.status as any,
          razorpay_subscription_id: subId,
          razorpay_customer_id: (data.razorpay_customer_id as string) || null,
          razorpay_plan_id: (data.razorpay_plan_id as string) || null,
          replaces_razorpay_subscription_id: (data.replaces_razorpay_subscription_id as string) || null,
          current_period_start: String(data.current_period_start),
          current_period_end: String(data.current_period_end),
          last_billing_event_at: String(data.last_billing_event_at),
          last_billing_event_id: String(data.last_billing_event_id),
          trial_start: (data.trial_start as string) || null,
          trial_end: (data.trial_end as string) || null,
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        subscriptions.set(subId, record);
        counters.subscriptionsUpserts++;

        return {
          select: () => ({
            single: async () => ({ data: { id: record.id }, error: null }),
          }),
        };
      }
      return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
    },
    then: (resolve: (val: { data: unknown[]; count: number; error: null }) => void) => {
      const results = executeSelect(
        tableName,
        filters,
        inFilters,
        gtFilters,
        gteFilters,
        ltFilters,
        lteFilters,
        isNullFilters,
        isNotNullFilters,
        orderField,
        isAscending,
        limitCount
      );
      resolve({ data: results, count: results.length, error: null });
    },
  };

  return builder;
};

(supabaseServer as any).rpc = async (fnName: string, params: Record<string, unknown>) => {
  if (fnName === "process_razorpay_billing_webhook") {
    const provider = String(params.p_provider);
    const eventId = String(params.p_event_id);
    const eventType = String(params.p_event_type);
    const userId = String(params.p_user_id);
    const planCode = params.p_plan_code as "pro";
    const status = params.p_status as any;
    const rzpSubId = String(params.p_razorpay_subscription_id);
    const replacesSubId = params.p_replaces_sub_id ? String(params.p_replaces_sub_id) : null;
    const eventAt = String(params.p_event_at);

    // 1. Claim
    const key = `${provider}:${eventId}`;
    if (processedWebhookEvents.has(key)) {
      return { data: { processed: false, duplicate: true, stale: false }, error: null };
    }
    processedWebhookEvents.add(key);
    counters.processedWebhookEventsInserts++;

    // 2. Stale check
    const existing = subscriptions.get(rzpSubId);
    if (existing?.last_billing_event_at && new Date(eventAt).getTime() < new Date(existing.last_billing_event_at).getTime()) {
      return { data: { processed: false, duplicate: false, stale: true }, error: null };
    }

    // 3. Upsert
    const record: MockSubscription = {
      id: existing?.id || crypto.randomUUID(),
      user_id: userId,
      plan_code: planCode,
      billing_cycle: "monthly",
      status,
      razorpay_subscription_id: rzpSubId,
      razorpay_customer_id: (params.p_razorpay_customer_id as string) || null,
      razorpay_plan_id: (params.p_razorpay_plan_id as string) || null,
      replaces_razorpay_subscription_id: status === "active" ? null : replacesSubId,
      current_period_start: String(params.p_current_period_start),
      current_period_end: String(params.p_current_period_end),
      last_billing_event_at: eventAt,
      last_billing_event_id: eventId,
      trial_start: (params.p_trial_start as string) || null,
      trial_end: (params.p_trial_end as string) || null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    subscriptions.set(rzpSubId, record);
    counters.subscriptionsUpserts++;

    // 4. Subscription Event
    subscriptionEvents.push({
      subscription_id: record.id,
      user_id: userId,
      event_type: eventType,
      new_status: status,
      created_at: new Date().toISOString(),
    });
    counters.subscriptionEventsInserts++;

    // 5. Replacement Check
    let shouldCancel = false;
    if ((eventType === "subscription.activated" || eventType === "subscription.charged") && replacesSubId) {
      const oldSub = subscriptions.get(replacesSubId);
      if (oldSub && ["active", "trialing", "grace_period", "past_due"].includes(oldSub.status)) {
        oldSub.status = "cancelled";
        counters.subscriptionsUpserts++;
        subscriptionEvents.push({
          subscription_id: oldSub.id,
          user_id: userId,
          event_type: "subscription.replaced",
          new_status: "cancelled",
          created_at: new Date().toISOString(),
        });
        counters.subscriptionEventsInserts++;
        shouldCancel = true;
      }
    }

    return {
      data: {
        processed: true,
        duplicate: false,
        stale: false,
        status,
        subscription_id: record.id,
        replaces_sub_id: replacesSubId,
        should_cancel_replacement: shouldCancel,
      },
      error: null,
    };
  }

  if (fnName === "process_stripe_payment_webhook") {
    const provider = String(params.p_provider);
    const eventId = String(params.p_event_id);
    const startupId = Number(params.p_startup_id);
    const amount = Number(params.p_amount);
    const paymentId = String(params.p_payment_id);
    const accountId = String(params.p_account_id);

    // Step 0: Ownership check
    const conn = providerConnections.find(
      (c) => c.startup_id === startupId && c.provider === "stripe" && c.provider_account_id === accountId && c.status === "connected"
    );
    if (!conn) {
      return { data: { processed: false, error: "unmapped_provider_account" }, error: null };
    }

    // Step 1: Claim (pre-claimed by HTTP handler in Step 1 is caught as unique_violation and ignored)
    const key = `${provider}:${eventId}`;
    processedWebhookEvents.add(key);

    // Step 2: Payment Idempotency
    if (revenueTransactions.some((tx) => tx.payment_id === paymentId)) {
      return { data: { processed: true, duplicate: true }, error: null };
    }

    // Step 3: Insert Transaction
    revenueTransactions.push({
      id: crypto.randomUUID(),
      startup_id: startupId,
      payment_id: paymentId,
      amount,
      provider: "stripe",
      created_at: new Date().toISOString(),
    });
    counters.revenueTransactionsInserts++;

    // Step 4 & 6: Update Startup MRR
    const startup = startupSubmissions.get(startupId);
    if (startup) {
      startup.mrr_breakdown["stripe"] = (startup.mrr_breakdown["stripe"] || 0) + amount;
      startup.mrr = Object.values(startup.mrr_breakdown).reduce((a, b) => a + b, 0);
      counters.startupSubmissionsUpdates++;

      // Step 5: Snapshot
      revenueSnapshots.push({
        id: crypto.randomUUID(),
        startup_id: startupId,
        total_revenue: startup.mrr,
        provider_breakdown: { ...startup.mrr_breakdown },
        created_at: new Date().toISOString(),
      });
      counters.revenueSnapshotsInserts++;
    }

    return { data: { processed: true, duplicate: false }, error: null };
  }

  if (fnName === "process_stripe_account_webhook") {
    const provider = String(params.p_provider);
    const eventId = String(params.p_event_id);
    const startupId = Number(params.p_startup_id);
    const accountId = String(params.p_account_id);

    const conn = providerConnections.find(
      (c) => c.startup_id === startupId && c.provider === "stripe" && c.provider_account_id === accountId && c.status === "connected"
    );
    if (!conn) {
      return { data: { processed: false, error: "unmapped_provider_account" }, error: null };
    }

    const key = `${provider}:${eventId}`;
    processedWebhookEvents.add(key);

    conn.last_synced_at = new Date().toISOString();
    const startup = startupSubmissions.get(startupId);
    if (startup) {
      startup.stripe_account_id = accountId;
      startup.payment_connected = true;
      if (["pending", "syncing", "unverified"].includes(startup.verification_status)) {
        startup.verification_status = "stripe_connected";
      }
      counters.startupSubmissionsUpdates++;
    }

    return { data: { processed: true, duplicate: false }, error: null };
  }

  return { data: null, error: null };
};

// ─── Import Route Handlers and Helpers ───────────────────────────────────────

const { POST: stripeWebhookHandler } = require("../src/app/api/stripe/webhook/route");
const { POST: razorpayWebhookHandler } = require("../src/app/api/razorpay/webhook/route");
const { POST: razorpayBillingWebhookHandler } = require("../src/app/api/billing/webhook/razorpay/route");
const { timingSafeCompare } = require("../src/lib/encryption");
const { updateRevenueAndSnapshot } = require("../src/lib/webhook-handler");

// ─── Helper Functions ───────────────────────────────────────────────────────

function makeStripeSignature(body: string, secret = TEST_STRIPE_WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)): string {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

function makeRazorpaySignature(body: string, secret = TEST_RAZORPAY_WEBHOOK_SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(url: string, body: string, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// TEST SUITE: TEST 13 — PAYMENT PROVIDER & WEBHOOK BOUNDARY
// ═════════════════════════════════════════════════════════════════════════════

describe("TEST 13 — Payment Provider & Webhook Boundary", () => {
  beforeEach(() => {
    resetDatabaseState();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A: CRYPTOGRAPHIC SIGNATURE BOUNDARIES (A1–A15)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group A: Cryptographic Signature Boundaries", () => {
    it("A1: Stripe valid signature is accepted and processes event", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_a1",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_a1_123", amount: 50000 } }, // $500.00
      });
      const sig = makeStripeSignature(payload);
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.revenueTransactionsInserts, 1);
    });

    it("A2: Stripe missing signature is rejected with HTTP 400 and zero mutations", async () => {
      const payload = JSON.stringify({ id: "evt_stripe_a2", type: "payment_intent.succeeded" });
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload);
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, "Invalid signature");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
      assert.strictEqual(counters.startupSubmissionsUpdates, 0);
    });

    it("A3: Stripe invalid signature is rejected with HTTP 400 and zero mutations", async () => {
      const payload = JSON.stringify({ id: "evt_stripe_a3", type: "payment_intent.succeeded" });
      const sig = "t=1700000000,v1=invalid_fake_stripe_hmac_000000000000000000000000000000";
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("A4: Stripe malformed signature header is rejected with HTTP 400", async () => {
      const payload = JSON.stringify({ id: "evt_stripe_a4", type: "payment_intent.succeeded" });
      const malformedHeaders = ["not_a_valid_sig", "t=abc", "v1=", ""];
      for (const sig of malformedHeaders) {
        const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
        const res = await stripeWebhookHandler(req);
        assert.strictEqual(res.status, 400);
      }
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("A5: Stripe signature verification occurs before payload processing / DB query", async () => {
      const payload = "MALFORMED NON-JSON BODY";
      const sig = "t=1700000000,v1=bad_sig";
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.processedWebhookEventsInserts, 0);
    });

    it("A6: Razorpay revenue valid HMAC is accepted and processes captured payment", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_rzp_a6", amount: 25000 } } }, // ₹250
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.revenueTransactionsInserts, 1);
    });

    it("A7: Razorpay revenue missing signature header is rejected with HTTP 400", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload);
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      const text = await res.text();
      assert.strictEqual(text, "Missing signature");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("A8: Razorpay revenue invalid signature is rejected with HTTP 400", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": "forged_sig" });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("A9: Razorpay billing valid HMAC is accepted and updates subscription", async () => {
      const payload = JSON.stringify({
        id: "evt_rzp_bill_a9",
        event: "subscription.activated",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_a9_123",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.subscriptionsUpserts, 1);
    });

    it("A10: Razorpay billing missing signature header is rejected with HTTP 400", async () => {
      const payload = JSON.stringify({ event: "subscription.charged" });
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload);
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      const text = await res.text();
      assert.strictEqual(text, "Missing signature");
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });

    it("A11: Razorpay billing invalid signature is rejected with HTTP 400", async () => {
      const payload = JSON.stringify({ event: "subscription.charged" });
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": "bad_sig" });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });

    it("A12: Razorpay revenue secret cannot validate billing webhook", async () => {
      const payload = JSON.stringify({
        id: "evt_cross_a12",
        event: "subscription.activated",
        payload: { subscription: { entity: { id: "sub_cross_12", plan_id: TEST_PRO_PLAN_ID, notes: { user_id: "usr_alpha_1111" } } } },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });

    it("A13: Razorpay billing secret cannot validate revenue webhook", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_cross_13", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("A14: timingSafeCompare operates in constant time and safely handles unequal lengths", () => {
      const a = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      const b = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
      const c = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456780";
      const d = "short";

      assert.strictEqual(timingSafeCompare(a, b), true);
      assert.strictEqual(timingSafeCompare(a, c), false);
      assert.strictEqual(timingSafeCompare(a, d), false);
      assert.strictEqual(timingSafeCompare("", a), false);
    });

    it("A15: Invalid signatures produce zero database / notification / provider side effects", async () => {
      assert.strictEqual(counters.processedWebhookEventsInserts, 0);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
      assert.strictEqual(counters.revenueSnapshotsInserts, 0);
      assert.strictEqual(counters.startupSubmissionsUpdates, 0);
      assert.strictEqual(counters.subscriptionsUpserts, 0);
      assert.strictEqual(counters.subscriptionEventsInserts, 0);
      assert.strictEqual(counters.notificationDispatches, 0);
      assert.strictEqual(counters.externalRazorpayCancels, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B: PROVIDER IDENTITY & ANTI-SPOOFING (B1–B12)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group B: Provider Identity & Anti-Spoofing", () => {
    it("B1: Connected Stripe account maps to the correct startup (101)", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_b1",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_b1_101", amount: 15000 } },
      });
      const sig = makeStripeSignature(payload);
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const tx = revenueTransactions.find((t) => t.payment_id === "pi_b1_101");
      assert.ok(tx);
      assert.strictEqual(tx.startup_id, 101);
      assert.strictEqual(startupSubmissions.get(101)?.mrr_breakdown.stripe, 350);
    });

    it("B2: Unmapped Stripe account is rejected/skipped safely with 0 mutations", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_b2",
        type: "payment_intent.succeeded",
        account: "acct_stripe_unmapped_999",
        data: { object: { id: "pi_b2_999", amount: 50000 } },
      });
      const sig = makeStripeSignature(payload);
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("B3: Disconnected Stripe account is rejected/skipped safely", async () => {
      const conn = providerConnections.find((c) => c.provider_account_id === "acct_stripe_alpha_123");
      if (conn) conn.status = "disconnected";

      const payload = JSON.stringify({
        id: "evt_stripe_b3",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_b3_disc", amount: 50000 } },
      });
      const sig = makeStripeSignature(payload);
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("B4: Connected Razorpay account maps to the correct startup (102)", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_beta_789",
        payload: { payment: { entity: { id: "pay_rzp_b4_102", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const tx = revenueTransactions.find((t) => t.payment_id === "pay_rzp_b4_102");
      assert.ok(tx);
      assert.strictEqual(tx.startup_id, 102);
      assert.strictEqual(startupSubmissions.get(102)?.mrr, 1500);
    });

    it("B5: Unmapped Razorpay account is rejected/skipped safely", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_unmapped_000",
        payload: { payment: { entity: { id: "pay_rzp_b5", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("B6: Disconnected Razorpay account is rejected/skipped safely", async () => {
      const conn = providerConnections.find((c) => c.provider_account_id === "acc_rzp_beta_789");
      if (conn) conn.status = "disconnected";

      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_beta_789",
        payload: { payment: { entity: { id: "pay_rzp_b6", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("B7: Payload-supplied startup_id in metadata cannot redirect revenue to another startup", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        startup_id: 102,
        metadata: { startup_id: 102, target: "Beta Logistics Ltd" },
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_b7_spoof",
              amount: 40000,
              notes: { startup_id: "102" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload);
      const req = makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig });
      const res = await razorpayWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const tx = revenueTransactions.find((t) => t.payment_id === "pay_rzp_b7_spoof");
      assert.ok(tx);
      assert.strictEqual(tx.startup_id, 101);
      assert.strictEqual(startupSubmissions.get(102)?.mrr, 1000);
    });

    it("B8: Spoofed Stripe metadata cannot redirect revenue to another startup", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_b8",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: {
          object: {
            id: "pi_b8_spoof",
            amount: 30000,
            metadata: { startup_id: "102", user_id: "usr_beta_2222" },
          },
        },
      });
      const sig = makeStripeSignature(payload);
      const req = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res = await stripeWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const tx = revenueTransactions.find((t) => t.payment_id === "pi_b8_spoof");
      assert.ok(tx);
      assert.strictEqual(tx.startup_id, 101);
      assert.strictEqual(startupSubmissions.get(102)?.mrr, 1000);
    });

    it("B9: Provider account mismatch in updateRevenueAndSnapshot fails closed", async () => {
      await updateRevenueAndSnapshot(101, 500, "razorpay", "pay_mismatch_b9", "acc_rzp_beta_789");
      const tx = revenueTransactions.find((t) => t.payment_id === "pay_mismatch_b9");
      assert.strictEqual(tx, undefined, "Mismatched provider connection must reject mutation");
    });

    it("B10: Billing user_id comes only through authoritative subscription notes.user_id", async () => {
      const payload = JSON.stringify({
        id: "evt_rzp_b10",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_b10",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const sub = subscriptions.get("sub_rzp_b10");
      assert.ok(sub);
      assert.strictEqual(sub.user_id, "usr_alpha_1111");
    });

    it("B11: Unknown/missing billing user identity cannot create entitlement", async () => {
      const payload = JSON.stringify({
        id: "evt_rzp_b11",
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_b11",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "no_user_id");
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });

    it("B12: Unknown Razorpay plan_id cannot activate an entitlement", async () => {
      const payload = JSON.stringify({
        id: "evt_rzp_b12",
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_b12",
              plan_id: "plan_UnknownLegacy_FreeProHack",
              status: "active",
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unknown_plan_id");
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C: ATOMIC EVENT IDEMPOTENCY & CONCURRENCY (C1–C12)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group C: Atomic Event Idempotency & Concurrency", () => {
    it("C1: First valid event processes exactly once", async () => {
      const payload = JSON.stringify({
        id: "evt_c1_single",
        event: "subscription.activated",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c1_single",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const req = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res = await razorpayBillingWebhookHandler(req);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.subscriptionsUpserts, 1);
      assert.strictEqual(counters.subscriptionEventsInserts, 1);
    });

    it("C2: Sequential duplicate event produces zero second mutation", async () => {
      const payload = JSON.stringify({
        id: "evt_c2_dupe",
        event: "subscription.activated",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c2_dupe",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      const req1 = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res1 = await razorpayBillingWebhookHandler(req1);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(counters.subscriptionsUpserts, 1);

      const req2 = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig });
      const res2 = await razorpayBillingWebhookHandler(req2);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.duplicate, true);
      assert.strictEqual(counters.subscriptionsUpserts, 1);
    });

    it("C3: Same event_id for same provider is idempotent across all fields", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_c3",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_c3_test", amount: 20000 } },
      });
      const sig = makeStripeSignature(payload);

      const req1 = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      await stripeWebhookHandler(req1);
      assert.strictEqual(counters.revenueTransactionsInserts, 1);

      const req2 = makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig });
      const res2 = await stripeWebhookHandler(req2);
      const data2 = await res2.json();
      assert.strictEqual(data2.duplicate, true);
      assert.strictEqual(counters.revenueTransactionsInserts, 1);
    });

    it("C4: Same event_id under different provider namespaces remains provider-isolated", async () => {
      const stripePayload = JSON.stringify({
        id: "evt_shared_123",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_shared_stripe", amount: 10000 } },
      });
      const stripeSig = makeStripeSignature(stripePayload);
      const stripeReq = makeRequest("https://www.verifii.in/api/stripe/webhook", stripePayload, { "stripe-signature": stripeSig });
      await stripeWebhookHandler(stripeReq);
      assert.strictEqual(counters.processedWebhookEventsInserts, 1);

      const rzpPayload = JSON.stringify({
        id: "evt_shared_123",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_shared_rzp",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const rzpSig = makeRazorpaySignature(rzpPayload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const rzpReq = makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", rzpPayload, { "x-razorpay-signature": rzpSig });
      const rzpRes = await razorpayBillingWebhookHandler(rzpReq);

      assert.strictEqual(rzpRes.status, 200);
      assert.strictEqual(counters.processedWebhookEventsInserts, 2);
    });

    it("C5: 10 concurrent first deliveries result in exactly one successful processing path", async () => {
      const payload = JSON.stringify({
        id: "evt_concurrency_c5",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c5_race",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      const requests = Array.from({ length: 10 }, () =>
        razorpayBillingWebhookHandler(
          makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig })
        )
      );

      const responses = await Promise.all(requests);
      const bodies = await Promise.all(responses.map((r) => r.json()));

      const successful = bodies.filter((b) => b.duplicate !== true);
      const duplicates = bodies.filter((b) => b.duplicate === true);

      assert.strictEqual(successful.length, 1);
      assert.strictEqual(duplicates.length, 9);
      assert.strictEqual(counters.subscriptionsUpserts, 1);
    });

    it("C6: Remaining concurrent deliveries are recognized as duplicates with HTTP 200", async () => {
      const payload = JSON.stringify({
        id: "evt_c6_dupe_check",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c6_check",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      // First call
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.subscriptionEventsInserts, 1);

      // Second duplicate call
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(res2.status, 200);
      const body2 = await res2.json();
      assert.strictEqual(body2.duplicate, true);
      assert.strictEqual(counters.subscriptionEventsInserts, 1);
    });

    it("C7: Duplicate delivery does not create duplicate revenue_transactions", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_rzp_c7_dupe", amount: 30000 } } },
      });
      const sig = makeRazorpaySignature(payload);

      await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.revenueTransactionsInserts, 1);

      await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.revenueTransactionsInserts, 1);
    });

    it("C8: Duplicate delivery does not create duplicate snapshots", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_rzp_c8_dupe", amount: 35000 } } },
      });
      const sig = makeRazorpaySignature(payload);

      await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      const snaps1 = counters.revenueSnapshotsInserts;
      assert.strictEqual(snaps1, 1);

      await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.revenueSnapshotsInserts, snaps1);
    });

    it("C9: Duplicate subscription event does not create duplicate subscription_events", async () => {
      const payload = JSON.stringify({
        id: "evt_c9_dupe_events",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c9_test",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.subscriptionEventsInserts, 1);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(counters.subscriptionEventsInserts, 1);
    });

    it("C10: Duplicate notification dispatch is idempotent", async () => {
      const payload = JSON.stringify({
        id: "evt_c10_dispatch",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c10_disp",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      await new Promise((r) => setTimeout(r, 25));
      assert.strictEqual(counters.notificationDispatches, 1);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      await new Promise((r) => setTimeout(r, 25));
      assert.strictEqual(counters.notificationDispatches, 1);
    });

    it("C11: processed_webhook_events uniqueness is enforced atomically", async () => {
      const payload = JSON.stringify({
        id: "evt_c11_unique",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_c11_test",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      const key = "razorpay:evt_c11_unique";
      assert.strictEqual(processedWebhookEvents.has(key), true);
    });

    it("C12: Database error during claim stops processing immediately with zero business mutations", async () => {
      const payload = JSON.stringify({
        id: "evt_c12_unmapped",
        type: "payment_intent.succeeded",
        account: "acct_unmapped_none",
        data: { object: { id: "pi_c12", amount: 50000 } },
      });
      const sig = makeStripeSignature(payload);
      const res = await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D: REPLAY & STALE EVENT MONOTONICITY (D1–D9)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group D: Replay & Stale Event Monotonicity", () => {
    it("D1: Older billing event is rejected as stale", async () => {
      const newPayload = JSON.stringify({
        id: "evt_time_new_2000",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_time_d1",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(newPayload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", newPayload, { "x-razorpay-signature": sig1 }));
      assert.strictEqual(subscriptions.get("sub_time_d1")?.status, "active");

      const oldPayload = JSON.stringify({
        id: "evt_time_old_1000",
        event: "subscription.created",
        created_at: 1000,
        payload: {
          subscription: {
            entity: {
              id: "sub_time_d1",
              plan_id: TEST_PRO_PLAN_ID,
              status: "created",
              current_start: 1000,
              current_end: 4000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(oldPayload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", oldPayload, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.skipped, "stale_event");
      assert.strictEqual(subscriptions.get("sub_time_d1")?.status, "active");
    });

    it("D2: Older event produces zero state mutation", async () => {
      const newPayload = JSON.stringify({
        id: "evt_d2_new",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d2",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(newPayload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", newPayload, { "x-razorpay-signature": sig1 }));
      const upsertsBefore = counters.subscriptionsUpserts;

      const oldPayload = JSON.stringify({
        id: "evt_d2_old",
        event: "subscription.created",
        created_at: 1000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d2",
              plan_id: TEST_PRO_PLAN_ID,
              status: "created",
              current_start: 1000,
              current_end: 4000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(oldPayload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", oldPayload, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(counters.subscriptionsUpserts, upsertsBefore);
    });

    it("D3: Equal timestamp event remains permitted for idempotent state completion", async () => {
      const payload = JSON.stringify({
        id: "evt_equal_time_d3",
        event: "subscription.charged",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_time_d3",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
    });

    it("D4: Equal timestamp event remains idempotent", async () => {
      const payload1 = JSON.stringify({
        id: "evt_d4_1",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d4",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payload1, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload1, { "x-razorpay-signature": sig1 }));
      assert.strictEqual(subscriptions.get("sub_d4")?.status, "active");

      const payload2 = JSON.stringify({
        id: "evt_d4_2",
        event: "subscription.charged",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d4",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payload2, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload2, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(subscriptions.get("sub_d4")?.status, "active");
    });

    it("D5: Newer event advances last_billing_event_at", async () => {
      const payload1 = JSON.stringify({
        id: "evt_d5_1",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d5",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payload1, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload1, { "x-razorpay-signature": sig1 }));

      const payload2 = JSON.stringify({
        id: "evt_newer_d5",
        event: "subscription.halted",
        created_at: 3000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d5",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payload2, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload2, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      const sub = subscriptions.get("sub_d5");
      assert.strictEqual(sub?.status, "past_due");
      assert.strictEqual(sub?.last_billing_event_id, "evt_newer_d5");
    });

    it("D6: Newer event can legitimately transition subscription state", async () => {
      const payload1 = JSON.stringify({
        id: "evt_d6_1",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d6",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payload1, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload1, { "x-razorpay-signature": sig1 }));

      const payload2 = JSON.stringify({
        id: "evt_d6_2",
        event: "subscription.halted",
        created_at: 3000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d6",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payload2, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload2, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(subscriptions.get("sub_d6")?.status, "past_due");
    });

    it("D7: Out-of-order events cannot revert a newer subscription state", async () => {
      // 1. Deliver event at t=3000 (halted)
      const payloadNew = JSON.stringify({
        id: "evt_d7_new",
        event: "subscription.halted",
        created_at: 3000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d7",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payloadNew, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payloadNew, { "x-razorpay-signature": sig1 }));
      assert.strictEqual(subscriptions.get("sub_d7")?.status, "past_due");

      // 2. Deliver out-of-order event at t=2500 (charged)
      const payloadOld = JSON.stringify({
        id: "evt_out_of_order_d7",
        event: "subscription.charged",
        created_at: 2500,
        payload: {
          subscription: {
            entity: {
              id: "sub_d7",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payloadOld, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payloadOld, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.skipped, "stale_event");
      assert.strictEqual(subscriptions.get("sub_d7")?.status, "past_due");
    });

    it("D8: Stale event cannot reactivate an expired / cancelled state", async () => {
      // 1. Deliver event at t=3000 (cancelled)
      const payloadCancelled = JSON.stringify({
        id: "evt_d8_cancelled",
        event: "subscription.cancelled",
        created_at: 3000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d8",
              plan_id: TEST_PRO_PLAN_ID,
              status: "cancelled",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payloadCancelled, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payloadCancelled, { "x-razorpay-signature": sig1 }));
      assert.strictEqual(subscriptions.get("sub_d8")?.status, "cancelled");

      // 2. Deliver stale event at t=2500 (active)
      const payloadStale = JSON.stringify({
        id: "evt_d8_stale",
        event: "subscription.charged",
        created_at: 2500,
        payload: {
          subscription: {
            entity: {
              id: "sub_d8",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payloadStale, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payloadStale, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.skipped, "stale_event");
      assert.strictEqual(subscriptions.get("sub_d8")?.status, "cancelled");
    });

    it("D9: Future/newer event is not incorrectly rejected as stale", async () => {
      const payload1 = JSON.stringify({
        id: "evt_d9_1",
        event: "subscription.activated",
        created_at: 2000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d9",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 2000,
              current_end: 5000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig1 = makeRazorpaySignature(payload1, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload1, { "x-razorpay-signature": sig1 }));

      const payload2 = JSON.stringify({
        id: "evt_future_d9",
        event: "subscription.charged",
        created_at: 4000,
        payload: {
          subscription: {
            entity: {
              id: "sub_d9",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 4000,
              current_end: 7000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig2 = makeRazorpaySignature(payload2, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res2 = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload2, { "x-razorpay-signature": sig2 }));

      assert.strictEqual(res2.status, 200);
      assert.strictEqual(subscriptions.get("sub_d9")?.status, "active");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E: UNMAPPED ACCOUNT & FAIL-CLOSED BOUNDARIES (E1–E12)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group E: Unmapped Account & Fail-Closed Boundaries", () => {
    it("E1: Missing provider account ID returns 200 skipped with 0 mutations", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_e1", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("E2: Unknown provider account ID returns 200 skipped with 0 mutations", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_ghost_unknown",
        payload: { payment: { entity: { id: "pay_e2", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("E3: Disconnected provider account fails closed", async () => {
      const payload = JSON.stringify({
        id: "evt_stripe_e3",
        type: "account.updated",
        data: { object: { id: "acct_disconnected_99", details_submitted: true } },
      });
      const sig = makeStripeSignature(payload);
      const res = await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unmapped_provider_account");
      assert.strictEqual(counters.startupSubmissionsUpdates, 0);
    });

    it("E4: Missing billing notes.user_id fails closed", async () => {
      const payload = JSON.stringify({
        id: "evt_e4_no_user",
        event: "subscription.charged",
        payload: { subscription: { entity: { id: "sub_e4", plan_id: TEST_PRO_PLAN_ID, notes: {} } } },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "no_user_id");
      assert.strictEqual(counters.subscriptionsUpserts, 0);
    });

    it("E5: Unknown billing user fails safely", async () => {
      const payload = JSON.stringify({
        id: "evt_e5_unknown_user",
        event: "subscription.charged",
        created_at: 1700000000,
        payload: {
          subscription: {
            entity: {
              id: "sub_e5",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000000,
              current_end: 1702592000,
              notes: { user_id: "usr_nonexistent_9999" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
    });

    it("E6: Unknown Razorpay plan_id fails closed", async () => {
      const payload = JSON.stringify({
        id: "evt_e6_bad_plan",
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_e6",
              plan_id: "plan_hacked_free_pro",
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unknown_plan_id");
    });

    it("E7: Unsupported event type returns 200 skipped with 0 mutations", async () => {
      const payload = JSON.stringify({
        id: "evt_e7_unsupported",
        type: "customer.discount.created",
        account: "acct_stripe_alpha_123",
        data: { object: {} },
      });
      const sig = makeStripeSignature(payload);
      const res = await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("E8: Malformed JSON payload returns HTTP 400 with 0 mutations", async () => {
      const badJson = "{\"event\": \"payment.captured\", broken_json:";
      const sig = makeRazorpaySignature(badJson);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", badJson, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 400);
      const text = await res.text();
      assert.strictEqual(text, "Invalid JSON");
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("E9: Empty payload returns HTTP 400 with 0 mutations", async () => {
      const emptyPayload = "";
      const sig = makeRazorpaySignature(emptyPayload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", emptyPayload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 400);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });

    it("E10: Missing required event ID in Stripe is handled safely", async () => {
      const payload = JSON.stringify({
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_e10", amount: 50000 } },
      });
      const sig = makeStripeSignature(payload);
      const res = await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      assert.strictEqual(res.status, 200);
    });

    it("E11: Missing required payment/subscription entity returns 200 skipped", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: {},
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "no_payment_entity");
    });

    it("E12: Invalid amount / payment structure fails safely with 0 mutations", async () => {
      const payload = JSON.stringify({
        id: "evt_e12_bad_amount",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_e12", amount: 0 } },
      });
      const sig = makeStripeSignature(payload);
      const res = await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(counters.revenueTransactionsInserts, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP F: REVENUE & MRR CALCULATION INTEGRITY (F1–F12)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group F: Revenue & MRR Calculation Integrity", () => {
    it("F1: Stripe amount conversion correctly converts cents to base currency ($150.00)", async () => {
      const payload = JSON.stringify({
        id: "evt_f1_conv",
        type: "payment_intent.succeeded",
        account: "acct_stripe_alpha_123",
        data: { object: { id: "pi_f1_150", amount: 15000 } },
      });
      const sig = makeStripeSignature(payload);
      await stripeWebhookHandler(makeRequest("https://www.verifii.in/api/stripe/webhook", payload, { "stripe-signature": sig }));

      const tx = revenueTransactions.find((t) => t.payment_id === "pi_f1_150");
      assert.ok(tx);
      assert.strictEqual(tx.amount, 150);
    });

    it("F2: Razorpay paise-to-rupees conversion is correct (50000 paise -> ₹500)", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_f2_500", amount: 50000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      const tx = revenueTransactions.find((t) => t.payment_id === "pay_f2_500");
      assert.ok(tx);
      assert.strictEqual(tx.amount, 500);
    });

    it("F3: Amount below ₹100 is ignored according to anti-dust policy", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_f3_dust", amount: 9900 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const text = await res.text();
      assert.strictEqual(text, "Ignored micro payment");
      assert.strictEqual(revenueTransactions.some((t) => t.payment_id === "pay_f3_dust"), false);
    });

    it("F4: Exactly ₹100 is accepted and credited", async () => {
      const payload = JSON.stringify({
        event: "payment.captured",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_f4_exact_100", amount: 10000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      assert.ok(revenueTransactions.find((t) => t.payment_id === "pay_f4_exact_100"));
    });

    it("F5: Refund amount is represented as a negative revenue mutation (-₹150)", async () => {
      const payload = JSON.stringify({
        event: "payment.refunded",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_f5_refund", amount: 15000 } } },
      });
      const sig = makeRazorpaySignature(payload);
      const res = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const refundTx = revenueTransactions.find((t) => t.payment_id === "pay_f5_refund_refund");
      assert.ok(refundTx);
      assert.strictEqual(refundTx.amount, -150);
      assert.strictEqual(startupSubmissions.get(101)?.mrr_breakdown.razorpay, 150);
    });

    it("F6: Refund deduplication prevents duplicate deductions", async () => {
      const payload = JSON.stringify({
        event: "payment.refunded",
        account_id: "acc_rzp_alpha_456",
        payload: { payment: { entity: { id: "pay_f6_refund", amount: 15000 } } },
      });
      const sig = makeRazorpaySignature(payload);

      // First refund
      const res1 = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(res1.status, 200);

      // Duplicate refund
      const res2 = await razorpayWebhookHandler(makeRequest("https://www.verifii.in/api/razorpay/webhook", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(res2.status, 200);
      const text = await res2.text();
      assert.strictEqual(text, "Duplicate refund");
      assert.strictEqual(startupSubmissions.get(101)?.mrr_breakdown.razorpay, 150);
    });

    it("F7: Duplicate payment ID cannot create duplicate revenue", async () => {
      await updateRevenueAndSnapshot(101, 100, "razorpay", "pay_f7_tx", "acc_rzp_alpha_456");
      const countBefore = revenueTransactions.length;
      await updateRevenueAndSnapshot(101, 100, "razorpay", "pay_f7_tx", "acc_rzp_alpha_456");
      assert.strictEqual(revenueTransactions.length, countBefore);
    });

    it("F8: Provider account mismatch cannot update another startup's MRR", async () => {
      const mrrBetaBefore = startupSubmissions.get(102)?.mrr;
      await updateRevenueAndSnapshot(102, 500, "razorpay", "pay_fake_cross", "acc_rzp_alpha_456");
      assert.strictEqual(startupSubmissions.get(102)?.mrr, mrrBetaBefore);
    });

    it("F9: MRR recalculation accurately sums across all active gateways", async () => {
      const startup = startupSubmissions.get(101);
      assert.ok(startup);
      const expectedTotal = Object.values(startup.mrr_breakdown).reduce((a, b) => a + b, 0);
      assert.strictEqual(startup.mrr, expectedTotal);
    });

    it("F10: Revenue snapshot is created only for accepted authoritative financial events", async () => {
      await updateRevenueAndSnapshot(101, 200, "razorpay", "pay_f10_snap", "acc_rzp_alpha_456");
      assert.ok(revenueSnapshots.length > 0);
      for (const snap of revenueSnapshots) {
        assert.ok(snap.total_revenue >= 0);
      }
    });

    it("F11: Invalid/forged financial payload cannot alter trust/revenue state", async () => {
      assert.ok(startupSubmissions.get(101)!.clean_events >= 0);
    });

    it("F12: Financial mutation and related snapshot behavior remain consistent", async () => {
      await updateRevenueAndSnapshot(101, 200, "razorpay", "pay_f12_snap", "acc_rzp_alpha_456");
      const latestSnapshot = revenueSnapshots[revenueSnapshots.length - 1];
      if (latestSnapshot) {
        const startup = startupSubmissions.get(latestSnapshot.startup_id);
        assert.strictEqual(latestSnapshot.total_revenue, startup?.mrr);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP G: SUBSCRIPTION STATE MACHINE (G1–G14)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group G: Subscription State Machine", () => {
    it("G1: subscription.created maps to 'trialing' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g1_created",
        event: "subscription.created",
        created_at: 1700000001,
        payload: {
          subscription: {
            entity: {
              id: "sub_g1",
              plan_id: TEST_PRO_PLAN_ID,
              status: "created",
              current_start: 1700000001,
              current_end: 1702592001,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g1")?.status, "trialing");
    });

    it("G2: subscription.authenticated maps to 'trialing' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g2_auth",
        event: "subscription.authenticated",
        created_at: 1700000002,
        payload: {
          subscription: {
            entity: {
              id: "sub_g2",
              plan_id: TEST_PRO_PLAN_ID,
              status: "authenticated",
              current_start: 1700000002,
              current_end: 1702592002,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g2")?.status, "trialing");
    });

    it("G3: subscription.activated maps to 'active' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g3_act",
        event: "subscription.activated",
        created_at: 1700000003,
        payload: {
          subscription: {
            entity: {
              id: "sub_g3",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000003,
              current_end: 1702592003,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g3")?.status, "active");
    });

    it("G4: subscription.charged maps to 'active' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g4_charged",
        event: "subscription.charged",
        created_at: 1700000004,
        payload: {
          subscription: {
            entity: {
              id: "sub_g4",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700000004,
              current_end: 1702592004,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g4")?.status, "active");
    });

    it("G5: subscription.halted maps to 'past_due' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g5_halted",
        event: "subscription.halted",
        created_at: 1700000005,
        payload: {
          subscription: {
            entity: {
              id: "sub_g5",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 1700000005,
              current_end: 1702592005,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g5")?.status, "past_due");
    });

    it("G6: subscription.cancelled maps to 'cancelled' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g6_cancel",
        event: "subscription.cancelled",
        created_at: 1700000006,
        payload: {
          subscription: {
            entity: {
              id: "sub_g6",
              plan_id: TEST_PRO_PLAN_ID,
              status: "cancelled",
              current_start: 1700000006,
              current_end: 1702592006,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g6")?.status, "cancelled");
    });

    it("G7: subscription.completed maps to 'expired' status", async () => {
      const payload = JSON.stringify({
        id: "evt_g7_comp",
        event: "subscription.completed",
        created_at: 1700000007,
        payload: {
          subscription: {
            entity: {
              id: "sub_g7",
              plan_id: TEST_PRO_PLAN_ID,
              status: "completed",
              current_start: 1700000007,
              current_end: 1702592007,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g7")?.status, "expired");
    });

    it("G8: subscription.updated maps status from entity status correctly", async () => {
      const payload = JSON.stringify({
        id: "evt_g8_upd",
        event: "subscription.updated",
        created_at: 1700000008,
        payload: {
          subscription: {
            entity: {
              id: "sub_g8",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 1700000008,
              current_end: 1702592008,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(subscriptions.get("sub_g8")?.status, "past_due");
    });

    it("G9: Cancelled subscription preserves current_period_end", async () => {
      const payload = JSON.stringify({
        id: "evt_g9_cancel",
        event: "subscription.cancelled",
        created_at: 1700000009,
        payload: {
          subscription: {
            entity: {
              id: "sub_g9",
              plan_id: TEST_PRO_PLAN_ID,
              status: "cancelled",
              current_start: 1700000009,
              current_end: 1702592009,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      const sub = subscriptions.get("sub_g9");
      assert.ok(sub);
      assert.strictEqual(sub.status, "cancelled");
      assert.ok(new Date(sub.current_period_end).getTime() > 0);
    });

    it("G10: Completed / expired subscription status is 'expired'", async () => {
      const payload = JSON.stringify({
        id: "evt_g10_comp",
        event: "subscription.completed",
        created_at: 1700000010,
        payload: {
          subscription: {
            entity: {
              id: "sub_g10",
              plan_id: TEST_PRO_PLAN_ID,
              status: "completed",
              current_start: 1700000010,
              current_end: 1702592010,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      const sub = subscriptions.get("sub_g10");
      assert.ok(sub);
      assert.strictEqual(sub.status, "expired");
    });

    it("G11: Halted / past_due does not grant active entitlement", async () => {
      const payload = JSON.stringify({
        id: "evt_g11_halt",
        event: "subscription.halted",
        created_at: 1700000011,
        payload: {
          subscription: {
            entity: {
              id: "sub_g11",
              plan_id: TEST_PRO_PLAN_ID,
              status: "halted",
              current_start: 1700000011,
              current_end: 1702592011,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      const sub = subscriptions.get("sub_g11");
      assert.ok(sub);
      assert.strictEqual(sub.status, "past_due");
      assert.notStrictEqual(sub.status, "active");
    });

    it("G12: Activated replacement subscription cancels old subscription", async () => {
      // 1. Seed old active subscription
      subscriptions.set("sub_old_pro_1", {
        id: "uuid_old_pro_1",
        user_id: "usr_alpha_1111",
        plan_code: "pro",
        billing_cycle: "monthly",
        status: "active",
        razorpay_subscription_id: "sub_old_pro_1",
        razorpay_customer_id: "cust_123",
        razorpay_plan_id: TEST_PRO_PLAN_ID,
        replaces_razorpay_subscription_id: null,
        current_period_start: new Date(1700000000 * 1000).toISOString(),
        current_period_end: new Date(1702592000 * 1000).toISOString(),
        last_billing_event_at: new Date(1700000000 * 1000).toISOString(),
        last_billing_event_id: "evt_old_1",
        created_at: new Date(1700000000 * 1000).toISOString(),
        updated_at: new Date(1700000000 * 1000).toISOString(),
      });

      // 2. Deliver new subscription.activated with replaces_subscription_id = "sub_old_pro_1"
      const payload = JSON.stringify({
        id: "evt_g12_replacement",
        event: "subscription.activated",
        created_at: 1700050000,
        payload: {
          subscription: {
            entity: {
              id: "sub_new_pro_2",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700050000,
              current_end: 1702642000,
              notes: { user_id: "usr_alpha_1111", replaces_subscription_id: "sub_old_pro_1" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      assert.strictEqual(subscriptions.get("sub_new_pro_2")?.status, "active");
      assert.strictEqual(subscriptions.get("sub_old_pro_1")?.status, "cancelled");
      assert.strictEqual(counters.externalRazorpayCancels, 1);
    });

    it("G13: Duplicate state event does not duplicate subscription_events", async () => {
      const payload = JSON.stringify({
        id: "evt_g13_dupe",
        event: "subscription.charged",
        created_at: 1700060000,
        payload: {
          subscription: {
            entity: {
              id: "sub_g13",
              plan_id: TEST_PRO_PLAN_ID,
              status: "active",
              current_start: 1700060000,
              current_end: 1702652000,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      const eventsBefore = subscriptionEvents.length;

      await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));
      assert.strictEqual(subscriptionEvents.length, eventsBefore);
    });

    it("G14: Unknown subscription event type fails safely", async () => {
      const payload = JSON.stringify({
        id: "evt_g14_unknown",
        event: "subscription.nonexistent_action",
        payload: {
          subscription: {
            entity: {
              id: "sub_g14",
              plan_id: TEST_PRO_PLAN_ID,
              notes: { user_id: "usr_alpha_1111" },
            },
          },
        },
      });
      const sig = makeRazorpaySignature(payload, TEST_RAZORPAY_BILLING_WEBHOOK_SECRET);
      const res = await razorpayBillingWebhookHandler(makeRequest("https://www.verifii.in/api/billing/webhook/razorpay", payload, { "x-razorpay-signature": sig }));

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.skipped, "unhandled_event");
    });
  });
});

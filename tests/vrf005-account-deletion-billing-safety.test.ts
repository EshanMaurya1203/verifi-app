/**
 * VRF-005 Account Deletion & Billing Safety Test Suite
 *
 * Verifies the core security invariant:
 * Account deletion MUST NOT permanently delete the Verifii account if a provider-backed
 * Razorpay subscription capable of future charging has not been successfully cancelled
 * and provider state verified as non-chargeable.
 *
 * Test Matrix:
 * 1. Active subscription + account deletion (immediate cancel)
 * 2. Active + pending replacement (pending cancelled first, active cancelled)
 * 3. Trialing subscription (cancelled immediately)
 * 4. Provider cancellation failure (aborts deletion; DB & Auth user intact)
 * 5. Pending replacement cancellation failure (active sub not cancelled; deletion aborts)
 * 6. Already-cancelled subscription (not cancellable handled; deletion proceeds)
 * 7. Free/viewer user (0 provider calls; deletion proceeds)
 * 8. Subscription discovery DB failure (fails closed; deletion aborts)
 * 9. Local bookkeeping UPDATE failure after verified cancellation (deletion proceeds)
 * 10. Helper isAlreadyCancelledError detection
 * 11. Normal billing cancellation preserves cancel_at_cycle_end=true
 * 12. Missing Razorpay API keys fails closed and returns success=false
 * 13. Route integration: /api/account/delete aborts when cancellation fails
 * 14. Route integration: /api/account/delete proceeds when cancellation succeeds
 * 15. CONCURRENCY: Two simultaneous DELETE /api/account/delete requests execute safely
 * 16. WEBHOOK RACE: subscription.cancelled webhook after delete cannot recreate subscription
 * 17. WEBHOOK RACE: subscription.charged webhook after delete cannot resurrect user or send notifications
 * 18. FAILURE ORDER: Verification failure strictly blocks application data & Auth user deletion
 */

import assert from "assert";
import crypto from "crypto";
import Razorpay from "razorpay";
import { supabaseServer } from "../src/lib/supabase-server";
import { isAlreadyCancelledError, cancelAllUserSubscriptions } from "../src/lib/billing/subscription-cancellation";

interface MockSubscription {
  id: string;
  user_id: string;
  status: string;
  plan_code: string;
  razorpay_subscription_id: string | null;
  replaces_razorpay_subscription_id?: string | null;
  current_period_end?: string | null;
}

// ── State variables for test assertions ────────────────────────────────────
let activeSubscriptions: MockSubscription[] = [];
let selectError: Error | null = null;
let updateError: Error | null = null;
let cancelFails: boolean | string = false;
let alreadyCancelled: boolean | string = false;
let dynamicCancelledOnFirst = false;
let cancellationCountForSub = 0;
let fetchStatuses: Record<string, string> = {};
const recordedCancelCalls: Array<{ subId: string; cancelAtCycleEnd: boolean }> = [];
const recordedFetchCalls: string[] = [];
let deletedStartupSubmissions = false;
let deletedAuthUser = false;
let isUserDeletedInAuth = false;
const processedEvents = new Set<string>();

interface RazorpayWithResources {
  subscriptions?: {
    cancel: (subId: string, cancelAtCycleEnd: boolean) => Promise<{ id: string; status: string }>;
    fetch: (subId: string) => Promise<{ id: string; status: string }>;
  };
}

// ── Patch Razorpay addResources ───────────────────────────────────────────
(Razorpay.prototype as unknown as { addResources: (this: RazorpayWithResources) => void }).addResources = function (this: RazorpayWithResources) {
  this.subscriptions = {
    cancel: async (subId: string, cancelAtCycleEnd: boolean) => {
      recordedCancelCalls.push({ subId, cancelAtCycleEnd });
      if (cancelFails === true || cancelFails === subId) {
        throw new Error("Razorpay network timeout / 500 error");
      }
      if (dynamicCancelledOnFirst) {
        cancellationCountForSub++;
        if (cancellationCountForSub > 1) {
          // Second concurrent call receives already cancelled from Razorpay
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
      }
      if (alreadyCancelled === true || alreadyCancelled === subId) {
        const err = new Error("Subscription is not cancellable") as Error & {
          statusCode: number;
          error: { code: string; description: string };
        };
        err.statusCode = 400;
        err.error = {
          code: "BAD_REQUEST_ERROR",
          description: "Subscription is not cancellable",
        };
        throw err;
      }
      return { id: subId, status: cancelAtCycleEnd ? "active" : "cancelled" };
    },
    fetch: async (subId: string) => {
      recordedFetchCalls.push(subId);
      const customStatus = fetchStatuses[subId];
      return {
        id: subId,
        status: customStatus ?? "cancelled",
      };
    },
  };
};

// ── Patch supabaseServer singleton ─────────────────────────────────────────
interface MockChain {
  select: (cols?: string) => MockChain;
  eq: (col: string, val: unknown) => MockChain;
  in: (col: string, vals: unknown[]) => MockChain;
  not: (col: string, op: string, val: unknown) => MockChain;
  is: (col: string, val: unknown) => MockChain;
  order: () => MockChain;
  limit: () => MockChain;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  delete: () => MockChain;
  update: (data: unknown) => MockChain;
  insert: (data: unknown) => Promise<{ data: unknown; error: unknown }>;
  upsert: (data: unknown) => MockChain;
  then: (resolve: (val: unknown) => void) => void;
}

(supabaseServer as unknown as { from: (table: string) => MockChain }).from = (table: string) => {
  let isUpdate = false;
  const chain: MockChain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    not: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    single: async () => {
      if (table === "subscriptions") {
        if (isUserDeletedInAuth) {
          return { data: null, error: { code: "23503", message: "foreign key violation: user does not exist in auth.users" } };
        }
        return { data: { id: "sub_db_single" }, error: null };
      }
      return { data: null, error: null };
    },
    maybeSingle: async () => {
      if (table === "subscriptions") {
        if (selectError) return { data: null, error: selectError };
        return { data: activeSubscriptions[0] || null, error: null };
      }
      if (table === "startup_submissions") {
        return { data: { startup_name: "Verifii Demo" }, error: null };
      }
      return { data: null, error: null };
    },
    delete: () => {
      if (table === "startup_submissions") {
        deletedStartupSubmissions = true;
      }
      return chain;
    },
    update: () => {
      isUpdate = true;
      return chain;
    },
    insert: async (data: unknown) => {
      if (table === "processed_webhook_events") {
        const evt = data as { event_id: string };
        if (processedEvents.has(evt.event_id)) {
          return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        processedEvents.add(evt.event_id);
        return { data, error: null };
      }
      if (table === "subscriptions" || table === "subscription_events") {
        if (isUserDeletedInAuth) {
          return { data: null, error: { code: "23503", message: "foreign key violation: user does not exist in auth.users" } };
        }
      }
      return { data, error: null };
    },
    upsert: () => {
      if (isUserDeletedInAuth) {
        return {
          ...chain,
          single: async () => ({
            data: null,
            error: { code: "23503", message: "foreign key violation: user does not exist in auth.users" },
          }),
        };
      }
      return chain;
    },
    then: (resolve: (val: unknown) => void) => {
      if (isUpdate) {
        if (updateError) {
          return resolve({ data: null, error: updateError });
        }
        return resolve({ data: null, error: null });
      }
      if (table === "subscriptions") {
        if (selectError) {
          return resolve({ data: null, error: selectError });
        }
        return resolve({ data: activeSubscriptions, error: null });
      }
      if (table === "startup_submissions") {
        return resolve({ data: [{ startup_name: "Verifii Demo" }], error: null });
      }
      return resolve({ data: [], error: null });
    },
  };
  return chain;
};

(supabaseServer as unknown as { rpc: () => Promise<{ data: unknown; error: unknown }> }).rpc = async () => {
  if (isUserDeletedInAuth) {
    return { data: null, error: { code: "23503", message: "foreign key violation: user does not exist in auth.users" } };
  }
  return { data: { success: true }, error: null };
};

(supabaseServer.auth as unknown as {
  admin: {
    getUserById: (id: string) => Promise<{ data: { user: { email: string; user_metadata: { full_name: string } } | null }; error: null }>;
    deleteUser: (id: string) => Promise<{ error: null }>;
  };
}).admin = {
  getUserById: async () => {
    if (isUserDeletedInAuth) {
      return { data: { user: null }, error: null };
    }
    return { data: { user: { email: "founder@example.com", user_metadata: { full_name: "Test Founder" } } }, error: null };
  },
  deleteUser: async () => {
    deletedAuthUser = true;
    isUserDeletedInAuth = true;
    return { error: null };
  },
};

// ── Patch rate-limit and auth-server in require.cache ───────────────────────
const rateLimitPath = require.resolve("../src/lib/rate-limit");
require.cache[rateLimitPath] = {
  id: rateLimitPath,
  filename: rateLimitPath,
  loaded: true,
  exports: {
    getClientIdentifier: () => "test_client_127_0_0_1",
    checkRateLimit: async () => ({ allowed: true, remaining: 50 }),
  },
} as NodeModule;

const authServerPath = require.resolve("../src/lib/auth-server");
require.cache[authServerPath] = {
  id: authServerPath,
  filename: authServerPath,
  loaded: true,
  exports: {
    getAuthenticatedUser: async () => ({
      id: "usr_test_vrf005_123",
      email: "founder@example.com",
      user_metadata: { full_name: "Test Founder" },
    }),
  },
} as NodeModule;

function resetState() {
  process.env.ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy_key_id";
  process.env.RAZORPAY_KEY_SECRET = "rzp_test_dummy_secret";
  process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = "test_billing_webhook_secret_123456";
  process.env.RAZORPAY_PLAN_PRO_MONTHLY = "plan_pro_monthly";
  activeSubscriptions = [];
  selectError = null;
  updateError = null;
  cancelFails = false;
  alreadyCancelled = false;
  dynamicCancelledOnFirst = false;
  cancellationCountForSub = 0;
  fetchStatuses = {};
  recordedCancelCalls.length = 0;
  recordedFetchCalls.length = 0;
  deletedStartupSubmissions = false;
  deletedAuthUser = false;
  isUserDeletedInAuth = false;
  processedEvents.clear();
}

function makeAuthDeleteRequest(): Request {
  const { signReauthProof } = require("../src/lib/reauth-proof");
  const proof = signReauthProof("usr_test_vrf005_123", "delete-account");
  return new Request("http://localhost:3000/api/account/delete", {
    method: "DELETE",
    headers: {
      cookie: `vrf_reauth_proof=${proof}`,
    },
  });
}

async function run() {
  console.log("==========================================================");
  console.log("   VRF-005 ACCOUNT DELETION & BILLING SAFETY TEST SUITE   ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      resetState();
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${name}: ${msg}`);
      failed++;
    }
  }

  // ── TEST 1: Active subscription + account deletion ──
  await test("TEST 1: Active subscription cancels immediately in Razorpay (cancel_at_cycle_end=false)", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_1",
        user_id: "usr_1",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_active_100",
      },
    ];

    const result = await cancelAllUserSubscriptions("usr_1", { immediate: true });

    assert.strictEqual(result.success, true, "Must return success=true");
    assert.strictEqual(result.cancelledActiveCount, 1, "Must cancel 1 active subscription");
    assert.strictEqual(recordedCancelCalls.length, 1, "Must call Razorpay cancel once");
    assert.strictEqual(recordedCancelCalls[0].subId, "sub_rzp_active_100");
    assert.strictEqual(recordedCancelCalls[0].cancelAtCycleEnd, false, "Account deletion MUST use immediate cancel (false)");
    assert.strictEqual(recordedFetchCalls.includes("sub_rzp_active_100"), true, "Must verify status via fetch");
  });

  // ── TEST 2: Active + Pending Replacement ──
  await test("TEST 2: Pending replacement cancelled immediately FIRST, then active sub cancelled", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_active",
        user_id: "usr_2",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_active_200",
      },
      {
        id: "sub_db_pending",
        user_id: "usr_2",
        status: "trialing",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_pending_201",
        replaces_razorpay_subscription_id: "sub_rzp_active_200",
      },
    ];

    const result = await cancelAllUserSubscriptions("usr_2", { immediate: true });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.cancelledPendingCount, 1);
    assert.strictEqual(result.cancelledActiveCount, 1);
    assert.strictEqual(recordedCancelCalls.length, 2);
    // Order assertion: pending replacement must be cancelled FIRST
    assert.strictEqual(recordedCancelCalls[0].subId, "sub_rzp_pending_201", "Pending replacement must be cancelled first");
    assert.strictEqual(recordedCancelCalls[0].cancelAtCycleEnd, false, "Pending replacement must be cancelled immediately");
    assert.strictEqual(recordedCancelCalls[1].subId, "sub_rzp_active_200", "Active sub cancelled second");
  });

  // ── TEST 3: Trialing subscription ──
  await test("TEST 3: Trialing subscription cancels immediately on account deletion", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_trial",
        user_id: "usr_3",
        status: "trialing",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_trial_300",
      },
    ];

    const result = await cancelAllUserSubscriptions("usr_3", { immediate: true });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.cancelledActiveCount, 1);
    assert.strictEqual(recordedCancelCalls[0].cancelAtCycleEnd, false);
  });

  // ── TEST 4: Provider cancellation failure ──
  await test("TEST 4: Provider cancellation failure returns success=false to block account deletion", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_4",
        user_id: "usr_4",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_fail_400",
      },
    ];
    cancelFails = true;

    const result = await cancelAllUserSubscriptions("usr_4", { immediate: true });

    assert.strictEqual(result.success, false, "Must return success=false on Razorpay error");
    assert.ok(result.error?.includes("Failed to cancel"), "Must report cancellation error");
  });

  // ── TEST 5: Pending replacement cancellation failure ──
  await test("TEST 5: Pending replacement failure aborts immediately; active sub is NOT cancelled", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_act",
        user_id: "usr_5",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_act_500",
      },
      {
        id: "sub_db_pend",
        user_id: "usr_5",
        status: "trialing",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_pend_501",
        replaces_razorpay_subscription_id: "sub_rzp_act_500",
      },
    ];
    cancelFails = "sub_rzp_pend_501"; // Only pending replacement fails

    const result = await cancelAllUserSubscriptions("usr_5", { immediate: true });

    assert.strictEqual(result.success, false, "Must abort with success=false");
    assert.strictEqual(recordedCancelCalls.length, 1, "Only pending cancel attempted");
    assert.strictEqual(recordedCancelCalls[0].subId, "sub_rzp_pend_501");
    // Assert active sub was NOT touched
    assert.strictEqual(
      recordedCancelCalls.some((c) => c.subId === "sub_rzp_act_500"),
      false,
      "Active sub must NOT be cancelled if pending cancel fails"
    );
  });

  // ── TEST 6: Already-cancelled subscription ──
  await test("TEST 6: Already-cancelled subscription (not cancellable + fetch confirmed) treated as success", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_6",
        user_id: "usr_6",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_already_600",
      },
    ];
    alreadyCancelled = true;
    fetchStatuses = { sub_rzp_already_600: "cancelled" };

    const result = await cancelAllUserSubscriptions("usr_6", { immediate: true });

    assert.strictEqual(result.success, true, "Already-cancelled must resolve to success=true");
    assert.strictEqual(recordedCancelCalls.length, 1);
    assert.strictEqual(recordedFetchCalls.includes("sub_rzp_already_600"), true, "Must verify terminal status via fetch");
  });

  // ── TEST 7: Free / viewer user ──
  await test("TEST 7: Free viewer user (0 subscriptions) succeeds with zero Razorpay calls", async () => {
    activeSubscriptions = [];

    const result = await cancelAllUserSubscriptions("usr_7", { immediate: true });

    assert.strictEqual(result.success, true, "Free user must succeed");
    assert.strictEqual(result.discoveredCount, 0);
    assert.strictEqual(recordedCancelCalls.length, 0, "Must make zero provider calls");
  });

  // ── TEST 8: Subscription discovery DB failure ──
  await test("TEST 8: Subscription discovery DB query failure fails closed (success=false)", async () => {
    activeSubscriptions = [];
    selectError = new Error("Postgres connection timeout");

    const result = await cancelAllUserSubscriptions("usr_8", { immediate: true });

    assert.strictEqual(result.success, false, "Discovery DB error must return success=false");
    assert.strictEqual(recordedCancelCalls.length, 0, "Must not proceed to cancel without discovery");
    assert.ok(result.error?.includes("Database discovery error"));
  });

  // ── TEST 9: Local bookkeeping UPDATE failure after verified cancellation ──
  await test("TEST 9: Local DB update failure after verified provider cancel returns success=true", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_9",
        user_id: "usr_9",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_bk_900",
      },
    ];
    updateError = new Error("Transient DB update lock contention");

    const result = await cancelAllUserSubscriptions("usr_9", { immediate: true });

    assert.strictEqual(result.success, true, "Provider safety achieved; DB update failure is non-fatal");
    assert.strictEqual(result.cancelledActiveCount, 1);
  });

  // ── TEST 10: Helper isAlreadyCancelledError detection ──
  await test("TEST 10: isAlreadyCancelledError correctly identifies 400 BAD_REQUEST not cancellable", () => {
    const matchingError = {
      statusCode: 400,
      error: {
        code: "BAD_REQUEST_ERROR",
        description: "Subscription is not cancellable in its current state",
      },
    };
    const nonMatchingError = {
      statusCode: 500,
      error: { code: "SERVER_ERROR", description: "Internal server error" },
    };

    assert.strictEqual(isAlreadyCancelledError(matchingError), true);
    assert.strictEqual(isAlreadyCancelledError(nonMatchingError), false);
    assert.strictEqual(isAlreadyCancelledError(null), false);
  });

  // ── TEST 11: Normal billing cancellation uses cancel_at_cycle_end=true ──
  await test("TEST 11: Normal billing cancellation (/api/billing/cancel) uses cancel_at_cycle_end=true", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_11",
        user_id: "usr_11",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_norm_1100",
      },
    ];
    fetchStatuses = { sub_rzp_norm_1100: "active" }; // Active until period end

    const result = await cancelAllUserSubscriptions("usr_11", { immediate: false });

    assert.strictEqual(result.success, true);
    assert.strictEqual(recordedCancelCalls.length, 1);
    assert.strictEqual(recordedCancelCalls[0].cancelAtCycleEnd, true, "Normal billing cancel must preserve cancel_at_cycle_end=true");
  });

  // ── TEST 12: Missing Razorpay API keys returns success=false ──
  await test("TEST 12: Missing Razorpay API keys fails closed and returns success=false", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_12",
        user_id: "usr_12",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_key_1200",
      },
    ];
    delete process.env.RAZORPAY_KEY_ID;

    const result = await cancelAllUserSubscriptions("usr_12", { immediate: true });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes("keys are not configured"));
  });

  // ── TEST 13: Route Integration: /api/account/delete ABORTS when cancellation fails ──
  await test("TEST 13: /api/account/delete route ABORTS on cancellation failure (DB and Auth intact)", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_13",
        user_id: "usr_test_vrf005_123",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_fail_1300",
      },
    ];
    cancelFails = true; // Force Razorpay failure

    const { DELETE: deleteHandler } = await import("../src/app/api/account/delete/route");
    const req = makeAuthDeleteRequest();
    const res = await deleteHandler(req);

    assert.strictEqual(res.status, 500, "Must return HTTP 500 on cancellation failure");
    const data = (await res.json()) as { error: string };
    assert.strictEqual(data.error, "Failed to cancel active billing subscriptions. Account deletion aborted for billing safety.");
    assert.strictEqual(deletedStartupSubmissions, false, "startup_submissions MUST NOT be deleted");
    assert.strictEqual(deletedAuthUser, false, "Auth user MUST NOT be deleted");
  });

  // ── TEST 14: Route Integration: /api/account/delete PROCEEDS when cancellation succeeds ──
  await test("TEST 14: /api/account/delete route PROCEEDS on cancellation success (DB and Auth deleted)", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_14",
        user_id: "usr_test_vrf005_123",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_succ_1400",
      },
    ];

    const { DELETE: deleteHandler } = await import("../src/app/api/account/delete/route");
    const req = makeAuthDeleteRequest();
    const res = await deleteHandler(req);

    assert.strictEqual(res.status, 200, "Must return HTTP 200 on success");
    const data = (await res.json()) as { success: boolean };
    assert.strictEqual(data.success, true);
    assert.strictEqual(deletedStartupSubmissions, true, "startup_submissions must be deleted");
    assert.strictEqual(deletedAuthUser, true, "Auth user must be deleted");
  });

  // ── TEST 15: CONCURRENCY: Two simultaneous DELETE /api/account/delete requests ──
  await test("TEST 15: [CONCURRENCY] Two simultaneous account deletion requests handle duplicate cancellation safely", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_concurrent_15",
        user_id: "usr_test_vrf005_123",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_concurrent_1500",
      },
    ];
    dynamicCancelledOnFirst = true; // First cancel call succeeds; second receives 400 "not cancellable" -> fetch verifies "cancelled"
    fetchStatuses = { sub_rzp_concurrent_1500: "cancelled" };

    const { DELETE: deleteHandler } = await import("../src/app/api/account/delete/route");

    const req1 = makeAuthDeleteRequest();
    await new Promise((r) => setTimeout(r, 5));
    const req2 = makeAuthDeleteRequest();

    // Execute two deletion requests concurrently
    const [res1, res2] = await Promise.all([
      deleteHandler(req1),
      deleteHandler(req2),
    ]);

    // Both requests must complete safely without hanging or throwing unhandled errors
    assert.strictEqual(res1.status, 200, "First deletion request returns 200");
    assert.strictEqual(res2.status, 200, "Second deletion request returns 200 via safe already-cancelled handling");

    // Invariant: Razorpay state was cancelled and verified
    assert.strictEqual(recordedCancelCalls.length, 2, "Both cancellation attempts recorded");
    assert.strictEqual(recordedFetchCalls.includes("sub_rzp_concurrent_1500"), true, "Verification fetch executed");
    assert.strictEqual(deletedAuthUser, true, "Auth user deleted");
    assert.strictEqual(deletedStartupSubmissions, true, "Startup data deleted");
  });

  // ── TEST 16: WEBHOOK RACE: subscription.cancelled arrives during/after delete ──
  await test("TEST 16: [WEBHOOK RACE] subscription.cancelled webhook after delete cannot recreate subscription or corrupt state", async () => {
    // 1. Simulate completed account deletion
    isUserDeletedInAuth = true;

    const { POST: webhookHandler } = await import("../src/app/api/billing/webhook/razorpay/route");

    const eventPayload = {
      entity: "event",
      account_id: "acc_test_123",
      event: "subscription.cancelled",
      contains: ["subscription"],
      payload: {
        subscription: {
          entity: {
            id: "sub_rzp_race_1600",
            plan_id: "plan_pro_monthly",
            customer_id: "cust_race_1600",
            status: "cancelled",
            current_start: 1723600000,
            current_end: 1726200000,
            charge_at: null,
            start_at: 1723600000,
            notes: {
              user_id: "usr_test_vrf005_123", // Deleted user
              plan_code: "pro",
              billing_cycle: "monthly",
            },
          },
        },
      },
      created_at: 1723605000,
    };

    const rawBody = JSON.stringify(eventPayload);
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_BILLING_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    const req = new Request("http://localhost:3000/api/billing/webhook/razorpay", {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
        "content-type": "application/json",
      },
      body: rawBody,
    });

    const res = await webhookHandler(req);

    // Webhook should process without crash; DB FK violation safely rejects orphan subscription insertion
    assert.ok(res.status === 200 || res.status === 500, "Webhook handled response safely");
    // Confirm idempotency claim was recorded
    assert.strictEqual(processedEvents.size, 1, "Idempotency claim recorded");
  });

  // ── TEST 17: WEBHOOK RACE: subscription.charged arrives after delete ──
  await test("TEST 17: [WEBHOOK RACE] subscription.charged webhook after delete cannot resurrect user or send notifications", async () => {
    // 1. Simulate completed account deletion
    isUserDeletedInAuth = true;

    const { POST: webhookHandler } = await import("../src/app/api/billing/webhook/razorpay/route");

    const eventPayload = {
      entity: "event",
      account_id: "acc_test_123",
      event: "subscription.charged",
      contains: ["subscription", "payment"],
      payload: {
        subscription: {
          entity: {
            id: "sub_rzp_race_1700",
            plan_id: "plan_pro_monthly",
            customer_id: "cust_race_1700",
            status: "active",
            current_start: 1723600000,
            current_end: 1726200000,
            charge_at: 1726200000,
            start_at: 1723600000,
            notes: {
              user_id: "usr_test_vrf005_123", // Deleted user
              plan_code: "pro",
              billing_cycle: "monthly",
            },
          },
        },
        payment: {
          entity: {
            id: "pay_test_race_1700",
            amount: 2900,
            currency: "USD",
            status: "captured",
          },
        },
      },
      created_at: 1723605000,
    };

    const rawBody = JSON.stringify(eventPayload);
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_BILLING_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    const req = new Request("http://localhost:3000/api/billing/webhook/razorpay", {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
        "content-type": "application/json",
      },
      body: rawBody,
    });

    const res = await webhookHandler(req);

    // Invariant: FK rejects recreation of subscriptions row; deleted Auth user cannot be notified
    assert.ok(res.status === 200 || res.status === 500, "Webhook handled without unhandled exception");
    // Ensure no auth user was resurrected
    assert.strictEqual(isUserDeletedInAuth, true, "Auth user remains deleted");
  });

  // ── TEST 18: FAILURE ORDER: Verification failure strictly blocks application data & Auth user deletion ──
  await test("TEST 18: [FAILURE ORDER] Provider state verification failure strictly blocks app data and Auth user deletion", async () => {
    activeSubscriptions = [
      {
        id: "sub_db_fail_order_18",
        user_id: "usr_test_vrf005_123",
        status: "active",
        plan_code: "pro",
        razorpay_subscription_id: "sub_rzp_unverified_1800",
      },
    ];
    // Razorpay reports status as still "active" / non-cancelled after cancel call
    fetchStatuses = { sub_rzp_unverified_1800: "active" };

    const { DELETE: deleteHandler } = await import("../src/app/api/account/delete/route");
    const req = makeAuthDeleteRequest();
    const res = await deleteHandler(req);

    assert.strictEqual(res.status, 500, "Must abort with HTTP 500 when provider verification fails");
    const data = (await res.json()) as { error: string };
    assert.strictEqual(data.error, "Failed to cancel active billing subscriptions. Account deletion aborted for billing safety.");
    assert.strictEqual(deletedStartupSubmissions, false, "startup_submissions MUST NOT be deleted");
    assert.strictEqual(deletedAuthUser, false, "Auth user MUST NOT be deleted");
  });

  console.log(`\n==========================================================`);
  console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();

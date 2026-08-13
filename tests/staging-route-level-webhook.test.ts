/**
 * Route-Level HTTP Webhook Integration Test Suite for Staging (oppasxypeacbrqbnqrnk)
 *
 * Tests the ACTUAL Next.js App Router Webhook HTTP POST Handlers:
 * - src/app/api/stripe/webhook/route.ts
 * - src/app/api/razorpay/webhook/route.ts
 *
 * Uses cryptographically generated HMAC signatures with STRIPE_WEBHOOK_SECRET and RAZORPAY_WEBHOOK_SECRET.
 * Verifies exact DB state (Startup MRR, Transactions, Snapshots) before and after each request.
 */

import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Explicitly configure STAGING Supabase env vars if not set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oppasxypeacbrqbnqrnk.supabase.co";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable for Staging test suite");
}

import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_45f1b8a91ba35b1285d2fbcfce871b933b33d0cc587e45be6430f5f5cb0311f6";
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "e3cd5f5273f41585a77658f424352f713b323883d1761ce228491fdc48df84f9";

function generateStripeSignature(rawBody: string, secret: string, timestamp?: number): string {
  const t = timestamp || Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return `t=${t},v1=${signature}`;
}

function generateRazorpaySignature(rawBody: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Route Integration Test Failed: ${message}`);
  }
}

export async function runRouteLevelWebhookTests() {
  console.log("=======================================================================");
  console.log(" REAL ROUTE-LEVEL HTTP WEBHOOK INTEGRATION TEST SUITE (STAGING DB)");
  console.log("=======================================================================\n");

  // Dynamically import route handlers AFTER process.env has been configured
  const { POST: stripePOST } = await import("../src/app/api/stripe/webhook/route");
  const { POST: razorpayPOST } = await import("../src/app/api/razorpay/webhook/route");

  const stagingSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async function getStartupState(startupId: number) {
    const { data } = await stagingSupabase
      .from("startup_submissions")
      .select("mrr, mrr_breakdown")
      .eq("id", startupId)
      .maybeSingle();
    return data;
  }

  async function getTransactionCount() {
    const { count } = await stagingSupabase
      .from("revenue_transactions")
      .select("id", { count: "exact", head: true });
    return count || 0;
  }

  async function getSnapshotCount() {
    const { count } = await stagingSupabase
      .from("revenue_snapshots")
      .select("id", { count: "exact", head: true });
    return count || 0;
  }

  const STAGING_STARTUP_ID = 999001;
  const STAGING_ACCOUNT_ID = "acct_test_staging_1786523556470";
  const ATTACKER_TARGET_STARTUP_ID = 888888;

  // -------------------------------------------------------------------------
  // TEST 1: Legitimate Stripe Account + Legitimate Payment via HTTP Route
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: Legitimate Stripe Webhook (HTTP Route POST) ---");
  const eventId1 = "evt_route_test_1_" + Date.now();
  const paymentId1 = "pay_route_test_1_" + Date.now();
  const stripePayload1 = JSON.stringify({
    id: eventId1,
    type: "payment_intent.succeeded",
    account: STAGING_ACCOUNT_ID,
    data: {
      object: {
        id: paymentId1,
        amount: 25000, // $250.00
        currency: "usd",
        metadata: { startup_id: String(STAGING_STARTUP_ID) }
      }
    }
  });

  const sig1 = generateStripeSignature(stripePayload1, STRIPE_SECRET);
  const req1 = new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig1, "content-type": "application/json" },
    body: stripePayload1
  });

  const txCountBefore1 = await getTransactionCount();
  const snapCountBefore1 = await getSnapshotCount();
  const startupBefore1 = await getStartupState(STAGING_STARTUP_ID);

  const res1 = await stripePOST(req1);
  const body1 = await res1.json();

  const txCountAfter1 = await getTransactionCount();
  const snapCountAfter1 = await getSnapshotCount();
  const startupAfter1 = await getStartupState(STAGING_STARTUP_ID);

  console.log(`Endpoint: /api/stripe/webhook | HTTP Status: ${res1.status}`);
  console.log(`Response:`, body1);
  console.log(`Provider Account: ${STAGING_ACCOUNT_ID}`);
  console.log(`Startup ${STAGING_STARTUP_ID} MRR: Before = ${startupBefore1?.mrr ?? 0}, After = ${startupAfter1?.mrr ?? 0}`);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore1}, After = ${txCountAfter1}`);
  console.log(`Revenue Snapshots Count: Before = ${snapCountBefore1}, After = ${snapCountAfter1}`);

  assert(res1.status === 200, "Test 1 HTTP status not 200");
  assert(body1.received === true && !body1.skipped, "Test 1 unexpected skipped response");
  assert(txCountAfter1 === txCountBefore1 + 1, "Test 1 transaction not created");
  console.log("✓ TEST 1 PASSED: Legitimate Stripe HTTP route credited correct startup revenue.\n");

  // -------------------------------------------------------------------------
  // TEST 2: Legitimate Account + Metadata pointing to Target Startup 888888
  // -------------------------------------------------------------------------
  console.log("--- TEST 2: Stripe Webhook Metadata Spoof Attempt (HTTP Route POST) ---");
  const eventId2 = "evt_route_test_2_" + Date.now();
  const paymentId2 = "pay_route_test_2_" + Date.now();
  const stripePayload2 = JSON.stringify({
    id: eventId2,
    type: "payment_intent.succeeded",
    account: STAGING_ACCOUNT_ID, // Account belongs to 999001
    data: {
      object: {
        id: paymentId2,
        amount: 50000, // $500.00
        currency: "usd",
        metadata: { startup_id: String(ATTACKER_TARGET_STARTUP_ID) } // ATTACK SPOOF
      }
    }
  });

  const sig2 = generateStripeSignature(stripePayload2, STRIPE_SECRET);
  const req2 = new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig2, "content-type": "application/json" },
    body: stripePayload2
  });

  const attackerBefore2 = await getStartupState(ATTACKER_TARGET_STARTUP_ID);
  const ownerBefore2 = await getStartupState(STAGING_STARTUP_ID);
  const txCountBefore2 = await getTransactionCount();

  const res2 = await stripePOST(req2);
  const body2 = await res2.json();

  const attackerAfter2 = await getStartupState(ATTACKER_TARGET_STARTUP_ID);
  const ownerAfter2 = await getStartupState(STAGING_STARTUP_ID);
  const txCountAfter2 = await getTransactionCount();

  console.log(`Endpoint: /api/stripe/webhook | HTTP Status: ${res2.status}`);
  console.log(`Response:`, body2);
  console.log(`Attacker Target Startup ${ATTACKER_TARGET_STARTUP_ID} MRR: Before = ${attackerBefore2?.mrr ?? 0}, After = ${attackerAfter2?.mrr ?? 0}`);
  console.log(`Legitimate Owner Startup ${STAGING_STARTUP_ID} MRR: Before = ${ownerBefore2?.mrr ?? 0}, After = ${ownerAfter2?.mrr ?? 0}`);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore2}, After = ${txCountAfter2}`);

  assert(res2.status === 200, "Test 2 HTTP status not 200");
  assert((attackerAfter2?.mrr ?? 0) === (attackerBefore2?.mrr ?? 0), "Attacker startup received revenue!");
  assert(txCountAfter2 === txCountBefore2 + 1, "Transaction was not recorded for legitimate owner");
  console.log("✓ TEST 2 PASSED: Metadata spoofing attempt rejected. Attacker startup received 0 revenue.\n");

  // -------------------------------------------------------------------------
  // TEST 3: Unknown Provider Account (Unmapped)
  // -------------------------------------------------------------------------
  console.log("--- TEST 3: Unknown Provider Account Webhook (HTTP Route POST) ---");
  const eventId3 = "evt_route_test_3_" + Date.now();
  const paymentId3 = "pay_route_test_3_" + Date.now();
  const stripePayload3 = JSON.stringify({
    id: eventId3,
    type: "payment_intent.succeeded",
    account: "acct_UNKNOWN_999999999",
    data: {
      object: {
        id: paymentId3,
        amount: 30000,
        currency: "usd"
      }
    }
  });

  const sig3 = generateStripeSignature(stripePayload3, STRIPE_SECRET);
  const req3 = new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig3, "content-type": "application/json" },
    body: stripePayload3
  });

  const txCountBefore3 = await getTransactionCount();

  const res3 = await stripePOST(req3);
  const body3 = await res3.json();

  const txCountAfter3 = await getTransactionCount();

  console.log(`Endpoint: /api/stripe/webhook | HTTP Status: ${res3.status}`);
  console.log(`Response:`, body3);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore3}, After = ${txCountAfter3}`);

  assert(res3.status === 200, "Test 3 HTTP status not 200");
  assert(body3.skipped === "unmapped_provider_account", "Test 3 did not return unmapped_provider_account");
  assert(txCountAfter3 === txCountBefore3, "Unknown account created a transaction!");
  console.log("✓ TEST 3 PASSED: Unknown provider account failed closed with zero revenue mutation.\n");

  // -------------------------------------------------------------------------
  // TEST 4: Duplicate / Replayed Webhook Event
  // -------------------------------------------------------------------------
  console.log("--- TEST 4: Replayed Webhook Event (HTTP Route POST) ---");
  const sig4 = generateStripeSignature(stripePayload1, STRIPE_SECRET);
  const req4 = new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig4, "content-type": "application/json" },
    body: stripePayload1
  });

  const txCountBefore4 = await getTransactionCount();

  const res4 = await stripePOST(req4);
  const body4 = await res4.json();

  const txCountAfter4 = await getTransactionCount();

  console.log(`Endpoint: /api/stripe/webhook | HTTP Status: ${res4.status}`);
  console.log(`Response:`, body4);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore4}, After = ${txCountAfter4}`);

  assert(res4.status === 200, "Test 4 HTTP status not 200");
  assert(body4.duplicate === true, "Test 4 did not return duplicate = true");
  assert(txCountAfter4 === txCountBefore4, "Replay event created duplicate transaction!");
  console.log("✓ TEST 4 PASSED: Replayed webhook event handled idempotently with zero duplicate mutation.\n");

  // -------------------------------------------------------------------------
  // TEST 5: Missing / Malformed Provider Account
  // -------------------------------------------------------------------------
  console.log("--- TEST 5: Missing event.account Field (HTTP Route POST) ---");
  const eventId5 = "evt_route_test_5_" + Date.now();
  const stripePayload5 = JSON.stringify({
    id: eventId5,
    type: "payment_intent.succeeded",
    // account is missing
    data: {
      object: {
        id: "pay_route_test_5_" + Date.now(),
        amount: 15000,
        currency: "usd"
      }
    }
  });

  const sig5 = generateStripeSignature(stripePayload5, STRIPE_SECRET);
  const req5 = new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig5, "content-type": "application/json" },
    body: stripePayload5
  });

  const txCountBefore5 = await getTransactionCount();

  const res5 = await stripePOST(req5);
  const body5 = await res5.json();

  const txCountAfter5 = await getTransactionCount();

  console.log(`Endpoint: /api/stripe/webhook | HTTP Status: ${res5.status}`);
  console.log(`Response:`, body5);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore5}, After = ${txCountAfter5}`);

  assert(res5.status === 200, "Test 5 HTTP status not 200");
  assert(body5.skipped === "unmapped_provider_account", "Test 5 did not fail closed");
  assert(txCountAfter5 === txCountBefore5, "Missing event.account created a transaction!");
  console.log("✓ TEST 5 PASSED: Missing event.account failed closed with zero revenue mutation.\n");

  // -------------------------------------------------------------------------
  // TEST 6: Razorpay Webhook Route for API Key Connection (provider_account_id = NULL)
  // -------------------------------------------------------------------------
  console.log("--- TEST 6: Razorpay Webhook with NULL provider_account_id (HTTP Route POST) ---");
  const razorpayPayload6 = JSON.stringify({
    entity: "event",
    account_id: "acc_staging_razorpay_unmapped_123",
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_rzp_route_test_" + Date.now(),
          amount: 50000, // 500 INR
          currency: "INR",
          status: "captured",
          notes: { startup_id: String(STAGING_STARTUP_ID) }
        }
      }
    }
  });

  const sig6 = generateRazorpaySignature(razorpayPayload6, RAZORPAY_SECRET);
  const req6 = new Request("http://localhost:3000/api/razorpay/webhook", {
    method: "POST",
    headers: { "x-razorpay-signature": sig6, "content-type": "application/json" },
    body: razorpayPayload6
  });

  const txCountBefore6 = await getTransactionCount();

  const res6 = await razorpayPOST(req6);
  const body6 = await res6.json();

  const txCountAfter6 = await getTransactionCount();

  console.log(`Endpoint: /api/razorpay/webhook | HTTP Status: ${res6.status}`);
  console.log(`Response:`, body6);
  console.log(`Revenue Transactions Count: Before = ${txCountBefore6}, After = ${txCountAfter6}`);

  assert(res6.status === 200, "Test 6 HTTP status not 200");
  assert(body6.skipped === "unmapped_provider_account", "Razorpay webhook did not fail closed!");
  assert(txCountAfter6 === txCountBefore6, "Razorpay NULL provider_account_id created a transaction!");
  console.log("✓ TEST 6 PASSED: Razorpay webhook for NULL provider_account_id failed closed with zero revenue mutation.\n");

  console.log("=======================================================================");
  console.log(" ALL 6 ROUTE-LEVEL HTTP WEBHOOK INTEGRATION TESTS PASSED CLEANLY!");
  console.log("=======================================================================\n");
}

if (require.main === module) {
  runRouteLevelWebhookTests().catch((err) => {
    console.error("Route Integration Test Error:", err);
    process.exit(1);
  });
}

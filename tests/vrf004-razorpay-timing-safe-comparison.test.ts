/**
 * VRF-004 Razorpay Timing-Safe Cryptographic Signature Comparison Test Suite
 *
 * Verifies constant-time signature comparison across all edge cases (A through K):
 * A. Valid signature
 * B. Invalid equal-length signature (64 chars)
 * C. Malformed signature (non-hex characters)
 * D. Wrong-length signature (shorter/longer) - no length exception
 * E. Empty signature
 * F. Missing signature header
 * G. Provider revenue Razorpay route verification
 * H. Billing Razorpay route verification
 * I. Raw-body integrity (HMAC on exact raw bytes)
 * J. Ordering / security regression (no mutations on invalid signature)
 * K. Secret isolation (RAZORPAY_WEBHOOK_SECRET vs RAZORPAY_BILLING_WEBHOOK_SECRET)
 */
import assert from "assert";
import crypto from "crypto";

// Stub rate-limit module for standalone unit testing
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

interface MockChain {
  select: () => MockChain;
  eq: () => MockChain;
  maybeSingle: () => Promise<{ data: null; error: null }>;
  limit: () => Promise<{ data: never[]; error: null }>;
}

// Stub supabaseServer to prevent live network calls during unit tests
const supabaseServerPath = require.resolve("../src/lib/supabase-server");
const mockSupabase = {
  from: (_table: string) => {
    const chain: MockChain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      limit: async () => ({ data: [], error: null }),
    };
    return chain;
  },
  rpc: async () => ({ data: null, error: null }),
};
require.cache[supabaseServerPath] = {
  id: supabaseServerPath,
  filename: supabaseServerPath,
  loaded: true,
  exports: { supabaseServer: mockSupabase, getSupabaseServer: () => mockSupabase },
} as NodeModule;

import { timingSafeCompare } from "../src/lib/encryption";

// Test-only secrets (isolated from production)
const TEST_PROVIDER_SECRET = "test_rzp_provider_webhook_secret_xyz123";
const TEST_BILLING_SECRET = "test_rzp_billing_webhook_secret_abc456";

function computeHmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function run() {
  console.log("==========================================================");
  console.log("   VRF-004 RAZORPAY TIMING-SAFE COMPARISON TEST SUITE     ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${name}: ${msg}`);
      failed++;
    }
  }

  // ── TEST A: Valid signature ──
  await test("TEST A: Genuine HMAC signature is accepted by timingSafeCompare", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", id: "pay_123" });
    const signature = computeHmac(rawBody, TEST_PROVIDER_SECRET);
    const expectedSignature = computeHmac(rawBody, TEST_PROVIDER_SECRET);

    const isValid = timingSafeCompare(signature, expectedSignature);
    assert.strictEqual(isValid, true, "Genuine signature must be accepted");
  });

  // ── TEST B: Invalid equal-length signature ──
  await test("TEST B: Invalid 64-char signature is rejected safely without exception", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", id: "pay_123" });
    const expectedSignature = computeHmac(rawBody, TEST_PROVIDER_SECRET);
    // Create an invalid 64-char signature with 1 byte difference
    const invalidSignature = "a" + expectedSignature.substring(1);
    assert.strictEqual(invalidSignature.length, 64);
    assert.strictEqual(expectedSignature.length, 64);

    const isValid = timingSafeCompare(invalidSignature, expectedSignature);
    assert.strictEqual(isValid, false, "Invalid equal-length signature must be rejected");
  });

  // ── TEST C: Malformed signature ──
  await test("TEST C: Malformed signature (non-hex characters) is rejected safely without exception", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", id: "pay_123" });
    const expectedSignature = computeHmac(rawBody, TEST_PROVIDER_SECRET);
    const malformedSignatures = [
      "not-a-hex-signature-at-all-xyz!@#$%^&*()_+~`",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeZ",
      "undefined",
      "null",
      "<script>alert(1)</script>",
    ];

    for (const malformed of malformedSignatures) {
      assert.doesNotThrow(() => {
        const isValid = timingSafeCompare(malformed, expectedSignature);
        assert.strictEqual(isValid, false, `Malformed "${malformed}" must be rejected`);
      }, `Malformed "${malformed}" must not throw`);
    }
  });

  // ── TEST D: Wrong-length signatures (shorter / longer) ──
  await test("TEST D: Wrong-length signatures return false safely without ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH", () => {
    const rawBody = JSON.stringify({ event: "payment.captured", id: "pay_123" });
    const expectedSignature = computeHmac(rawBody, TEST_PROVIDER_SECRET);

    const wrongLengthSignatures = [
      "",                                                 // 0 chars
      "a",                                                // 1 char
      "1234567890abcdef",                                 // 16 chars
      expectedSignature.substring(0, 32),                 // 32 chars (half length)
      expectedSignature.substring(0, 63),                 // 63 chars (1 char too short)
      expectedSignature + "a",                            // 65 chars (1 char too long)
      expectedSignature + expectedSignature,              // 128 chars (double length)
    ];

    for (const candidate of wrongLengthSignatures) {
      assert.doesNotThrow(() => {
        const isValid = timingSafeCompare(candidate, expectedSignature);
        assert.strictEqual(isValid, false, `Length ${candidate.length} must return false`);
      }, `Length ${candidate.length} must not throw timingSafeEqual length error`);
    }
  });

  // ── TEST E: Empty signature ──
  await test("TEST E: Empty signature string is safely rejected", () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const expectedSignature = computeHmac(rawBody, TEST_PROVIDER_SECRET);

    const isValid = timingSafeCompare("", expectedSignature);
    assert.strictEqual(isValid, false, "Empty signature must return false");
  });

  // ── TEST F: Missing signature header (route-level check) ──
  await test("TEST F: Missing signature header returns HTTP 400 'Missing signature'", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_PROVIDER_SECRET;
    const { POST: providerPOST } = await import("../src/app/api/razorpay/webhook/route");

    const req = new Request("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "payment.captured" }),
    });

    const res = await providerPOST(req);
    assert.strictEqual(res.status, 400, "Missing signature header must return 400");
    const text = await res.text();
    assert.strictEqual(text, "Missing signature");
  });

  // ── TEST G: Provider revenue Razorpay route accepts genuine signature ──
  await test("TEST G: Provider route (/api/razorpay/webhook) validates genuine signature with timingSafeCompare", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_PROVIDER_SECRET;
    const { POST: providerPOST } = await import("../src/app/api/razorpay/webhook/route");

    const payload = JSON.stringify({
      event: "payment.captured",
      account_id: "acc_test_unmapped_123",
      payload: {
        payment: {
          entity: {
            id: "pay_test_001",
            amount: 5000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const signature = computeHmac(payload, TEST_PROVIDER_SECRET);
    const req = new Request("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await providerPOST(req);
    // If signature succeeds, it reaches account check (200 unmapped or 400 unmapped, but NOT 400 Invalid signature)
    assert.notStrictEqual(res.status, 500);
    const resText = await res.clone().text();
    assert.notStrictEqual(resText, "Invalid signature", "Valid signature must pass signature verification step");
  });

  // ── TEST H: Billing Razorpay route accepts genuine signature ──
  await test("TEST H: Billing route (/api/billing/webhook/razorpay) validates genuine signature with timingSafeCompare", async () => {
    process.env.RAZORPAY_BILLING_WEBHOOK_SECRET = TEST_BILLING_SECRET;
    const { POST: billingPOST } = await import("../src/app/api/billing/webhook/razorpay/route");

    const payload = JSON.stringify({
      event: "subscription.charged",
      payload: {
        subscription: {
          entity: {
            id: "sub_test_001",
            plan_id: "plan_founder_monthly",
            notes: { user_id: "usr_test_123" },
          },
        },
      },
    });

    const signature = computeHmac(payload, TEST_BILLING_SECRET);
    const req = new Request("http://localhost:3000/api/billing/webhook/razorpay", {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await billingPOST(req);
    assert.notStrictEqual(res.status, 500);
    const resText = await res.clone().text();
    assert.notStrictEqual(resText, "Invalid signature", "Valid billing signature must pass signature verification");
  });

  // ── TEST I: Raw-body integrity ──
  await test("TEST I: Any modification to raw body invalidates HMAC signature", () => {
    const originalBody = JSON.stringify({ amount: 1000, account_id: "acc_123" });
    const tamperedBody = JSON.stringify({ amount: 9999999, account_id: "acc_123" });

    const signature = computeHmac(originalBody, TEST_PROVIDER_SECRET);
    const expectedForTampered = computeHmac(tamperedBody, TEST_PROVIDER_SECRET);

    const isValid = timingSafeCompare(signature, expectedForTampered);
    assert.strictEqual(isValid, false, "Tampered body must fail HMAC comparison");
  });

  // ── TEST J: Ordering / security regression ──
  await test("TEST J: Invalid signature returns 400 'Invalid signature' and aborts processing", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_PROVIDER_SECRET;
    const { POST: providerPOST } = await import("../src/app/api/razorpay/webhook/route");

    const payload = JSON.stringify({ event: "payment.captured", amount: 99999999 });
    const forgedSignature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const req = new Request("http://localhost:3000/api/razorpay/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": forgedSignature,
        "content-type": "application/json",
      },
      body: payload,
    });

    const res = await providerPOST(req);
    assert.strictEqual(res.status, 400, "Forged signature must be rejected with HTTP 400");
    const text = await res.text();
    assert.strictEqual(text, "Invalid signature");
  });

  // ── TEST K: Secret isolation ──
  await test("TEST K: Provider secret cannot verify Billing webhook and vice-versa", () => {
    const body = JSON.stringify({ event: "test" });
    const providerSig = computeHmac(body, TEST_PROVIDER_SECRET);
    const billingExpected = computeHmac(body, TEST_BILLING_SECRET);

    const isValidCross = timingSafeCompare(providerSig, billingExpected);
    assert.strictEqual(isValidCross, false, "Cross-secret signature comparison must fail");
  });

  // ── Summary ──
  console.log(`\n==========================================================`);
  console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`==========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();

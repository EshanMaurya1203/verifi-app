/**
 * A4.5 Step 4B — Investor Report Client Flow Test Suite
 *
 * Tests the useInvestorReport hook and loadRazorpayScript utility.
 * Uses the project's established testing pattern: source-code inspection
 * via node:test + node:assert to verify structural invariants.
 *
 * Validates that the client runner:
 * - Sends ONLY { startup_id } to create-order
 * - Consumes server-returned amount/currency/key_id/order_id for Razorpay
 * - Forwards Razorpay payment credentials to verify-payment
 * - Implements the correct state machine
 * - Handles errors, cancellation, and generating states safely
 * - Never exposes RAZORPAY_KEY_SECRET
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";

describe("A4.5 Step 4B — useInvestorReport Client Hook", () => {
  const hookPath = path.join(process.cwd(), "src/lib/reports/use-investor-report.ts");
  const hookContent = fs.readFileSync(hookPath, "utf8");

  // ============================================================
  // TEST 1: create-order sends only startup_id
  // ============================================================
  it("TEST 1: create-order fetch body contains ONLY startup_id", () => {
    // The JSON.stringify body must contain only startup_id
    assert(
      hookContent.includes("JSON.stringify({\n            startup_id: startupId,\n          })") ||
      hookContent.includes("JSON.stringify({") && hookContent.includes("startup_id: startupId"),
      "Must send startup_id in create-order body"
    );
    // The create-order body block must NOT contain amount, currency, or user_id
    const createOrderFetchMatch = hookContent.match(
      /fetch\("\/api\/reports\/create-order"[\s\S]*?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/
    );
    assert(createOrderFetchMatch, "Must find create-order fetch call with JSON body");
    const bodyContent = createOrderFetchMatch[1];
    assert(!bodyContent.includes("amount"), "create-order body must NOT contain amount");
    assert(!bodyContent.includes("currency"), "create-order body must NOT contain currency");
    assert(!bodyContent.includes("user_id"), "create-order body must NOT contain user_id");
  });

  // ============================================================
  // TEST 2: client does not send amount
  // ============================================================
  it("TEST 2: create-order request body does NOT contain amount", () => {
    const createOrderBody = hookContent.match(
      /fetch\("\/api\/reports\/create-order"[\s\S]*?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/
    );
    assert(createOrderBody, "Must find create-order fetch body");
    assert(!createOrderBody[1].includes("amount"), "Body must NOT include amount field");
  });

  // ============================================================
  // TEST 3: client does not send currency
  // ============================================================
  it("TEST 3: create-order request body does NOT contain currency", () => {
    const createOrderBody = hookContent.match(
      /fetch\("\/api\/reports\/create-order"[\s\S]*?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/
    );
    assert(createOrderBody, "Must find create-order fetch body");
    assert(!createOrderBody[1].includes("currency"), "Body must NOT include currency field");
  });

  // ============================================================
  // TEST 4: client does not send user_id
  // ============================================================
  it("TEST 4: create-order request body does NOT contain user_id", () => {
    const createOrderBody = hookContent.match(
      /fetch\("\/api\/reports\/create-order"[\s\S]*?body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/
    );
    assert(createOrderBody, "Must find create-order fetch body");
    assert(!createOrderBody[1].includes("user_id"), "Body must NOT include user_id field");
  });

  // ============================================================
  // TEST 5: server-returned amount is passed to Razorpay
  // ============================================================
  it("TEST 5: Razorpay options use amount from server response (orderData.amount)", () => {
    assert(
      hookContent.includes("amount: orderData.amount"),
      "Razorpay options must use orderData.amount from server response"
    );
    // Must NOT hardcode 49900 in the Razorpay options block
    const razorpayOptionsMatch = hookContent.match(/const options:\s*RazorpayOptions\s*=\s*\{([\s\S]*?)\};/);
    assert(razorpayOptionsMatch, "Must find RazorpayOptions block");
    assert(!razorpayOptionsMatch[1].includes("49900"), "Razorpay options must NOT hardcode 49900");
  });

  // ============================================================
  // TEST 6: server-returned currency is passed to Razorpay
  // ============================================================
  it("TEST 6: Razorpay options use currency from server response (orderData.currency)", () => {
    assert(
      hookContent.includes("currency: orderData.currency"),
      "Razorpay options must use orderData.currency from server response"
    );
    const razorpayOptionsMatch = hookContent.match(/const options:\s*RazorpayOptions\s*=\s*\{([\s\S]*?)\};/);
    assert(razorpayOptionsMatch, "Must find RazorpayOptions block");
    // Currency in options must come from orderData, not hardcoded
    assert(
      !razorpayOptionsMatch[1].match(/currency:\s*["']INR["']/),
      "Razorpay options must NOT hardcode INR"
    );
  });

  // ============================================================
  // TEST 7: server-returned order_id is passed to Razorpay
  // ============================================================
  it("TEST 7: Razorpay options use order_id from server response (orderData.order_id)", () => {
    assert(
      hookContent.includes("order_id: orderData.order_id"),
      "Razorpay options must use orderData.order_id from server response"
    );
  });

  // ============================================================
  // TEST 8: server-returned key_id is passed to Razorpay
  // ============================================================
  it("TEST 8: Razorpay options use key from server response (orderData.key_id)", () => {
    assert(
      hookContent.includes("key: orderData.key_id"),
      "Razorpay options must use orderData.key_id from server response"
    );
  });

  // ============================================================
  // TEST 9: payment handler forwards payment_id
  // ============================================================
  it("TEST 9: verify-payment receives razorpay_payment_id via handler", () => {
    assert(
      hookContent.includes("response.razorpay_payment_id"),
      "Handler must extract razorpay_payment_id from Razorpay response"
    );
    assert(
      hookContent.includes("paymentId: response.razorpay_payment_id"),
      "Must map razorpay_payment_id to paymentId credential"
    );
  });

  // ============================================================
  // TEST 10: payment handler forwards order_id
  // ============================================================
  it("TEST 10: verify-payment receives razorpay_order_id via handler", () => {
    assert(
      hookContent.includes("response.razorpay_order_id"),
      "Handler must extract razorpay_order_id from Razorpay response"
    );
    assert(
      hookContent.includes("orderId: response.razorpay_order_id"),
      "Must map razorpay_order_id to orderId credential"
    );
  });

  // ============================================================
  // TEST 11: payment handler forwards signature
  // ============================================================
  it("TEST 11: verify-payment receives razorpay_signature via handler", () => {
    assert(
      hookContent.includes("response.razorpay_signature"),
      "Handler must extract razorpay_signature from Razorpay response"
    );
    assert(
      hookContent.includes("signature: response.razorpay_signature"),
      "Must map razorpay_signature to signature credential"
    );
  });

  // ============================================================
  // TEST 12: payment handler forwards report_id
  // ============================================================
  it("TEST 12: verify-payment sends report_id from create-order response", () => {
    // The verify-payment body must include report_id
    assert(
      hookContent.includes("report_id: credentials.reportId"),
      "Must send report_id in verify-payment body"
    );
    // The handler must capture reportId from orderData
    assert(
      hookContent.includes("reportId: orderData.report_id"),
      "Must capture report_id from orderData into credentials"
    );
  });

  // ============================================================
  // TEST 13: completed response exposes download_url
  // ============================================================
  it("TEST 13: completed status sets downloadUrl from response", () => {
    assert(
      hookContent.includes('data.status === "completed"'),
      "Must check for completed status in verify response"
    );
    assert(
      hookContent.includes("setDownloadUrl(data.download_url)"),
      "Must call setDownloadUrl with data.download_url on completion"
    );
    assert(
      hookContent.includes('setState("completed")'),
      "Must transition to completed state"
    );
  });

  // ============================================================
  // TEST 14: generating response enters generating state
  // ============================================================
  it("TEST 14: generating status transitions to generating state (not error)", () => {
    assert(
      hookContent.includes('data.status === "generating"'),
      "Must check for generating status in verify response"
    );
    assert(
      hookContent.includes('setState("generating")'),
      "Must transition to generating state"
    );
    // Verify that after setting generating, we do NOT set error
    const generatingBlock = hookContent.match(/data\.status === "generating"\)[\s\S]*?\{([\s\S]*?)\}/);
    assert(generatingBlock, "Must find generating status handler block");
    assert(!generatingBlock[1].includes('setState("error")'), "generating handler must NOT set error state");
  });

  // ============================================================
  // TEST 15: generating state does NOT create another order
  // ============================================================
  it("TEST 15: retryGeneration calls verify-payment, NOT create-order", () => {
    // retryGeneration must use stored credentials
    assert(
      hookContent.includes("lastPaymentCredentialsRef.current"),
      "retryGeneration must reference lastPaymentCredentialsRef"
    );
    // Extract the retryGeneration function body from source
    const retryStart = hookContent.indexOf("const retryGeneration");
    assert(retryStart !== -1, "Must find retryGeneration definition");
    // Use a narrow window to avoid capturing the return { ... } export block
    const retryEnd = hookContent.indexOf("}, [verifyPayment]);", retryStart);
    assert(retryEnd !== -1, "Must find retryGeneration closing");
    const retryBlock = hookContent.slice(retryStart, retryEnd);
    assert(retryBlock.includes("verifyPayment"), "retryGeneration must call verifyPayment");
    assert(!retryBlock.includes("create-order"), "retryGeneration must NOT call create-order");
    assert(!retryBlock.includes("fetch("), "retryGeneration must NOT directly call fetch");
  });

  // ============================================================
  // TEST 16: checkout dismissal does not report success
  // ============================================================
  it("TEST 16: Razorpay modal ondismiss sets idle, NOT completed", () => {
    assert(hookContent.includes("ondismiss"), "Must handle Razorpay modal ondismiss");
    // Find the ondismiss handler
    const dismissMatch = hookContent.match(/ondismiss:\s*\(\)\s*=>\s*\{([\s\S]*?)\}/);
    assert(dismissMatch, "Must find ondismiss callback");
    assert(
      dismissMatch[1].includes('"idle"'),
      "ondismiss must transition to idle state"
    );
    assert(
      !dismissMatch[1].includes('"completed"'),
      "ondismiss must NOT transition to completed state"
    );
    assert(
      !dismissMatch[1].includes("download"),
      "ondismiss must NOT reference download"
    );
  });

  // ============================================================
  // TEST 17: API failures enter error state
  // ============================================================
  it("TEST 17: failed create-order response transitions to error state", () => {
    // Check that non-ok response from create-order sets error state
    assert(
      hookContent.includes("!res.ok || !orderData.success"),
      "Must check res.ok and orderData.success for create-order"
    );
    // After failed create-order, must set error state
    const failBlock = hookContent.match(/!res\.ok \|\| !orderData\.success[\s\S]*?\{([\s\S]*?)\}/);
    assert(failBlock, "Must find create-order failure handler");
    assert(failBlock[1].includes('"error"'), "Must set error state on create-order failure");
  });

  // ============================================================
  // TEST 18: duplicate invocation is prevented while request is active
  // ============================================================
  it("TEST 18: duplicate startPurchase prevented by isBusyRef guard", () => {
    assert(
      hookContent.includes("isBusyRef.current"),
      "Must use isBusyRef for concurrency guard"
    );
    // startPurchase must check isBusyRef at the top
    const purchaseBlock = hookContent.match(
      /const startPurchase[\s\S]*?async \(startupId[\s\S]*?\{([\s\S]*?)try \{/
    );
    assert(purchaseBlock, "Must find startPurchase function opening");
    assert(
      purchaseBlock[1].includes("if (isBusyRef.current)"),
      "Must check isBusyRef.current before proceeding"
    );
    assert(
      purchaseBlock[1].includes("return"),
      "Must return early when busy"
    );
  });

  // ============================================================
  // TEST 19: Razorpay script-load failure is handled safely
  // ============================================================
  it("TEST 19: script load failure sets error state", () => {
    assert(
      hookContent.includes("loadRazorpayScript"),
      "Must call loadRazorpayScript"
    );
    assert(
      hookContent.includes("!scriptLoaded || !window.Razorpay"),
      "Must check scriptLoaded result and window.Razorpay"
    );
    // After failure, must set error state
    const scriptFailMatch = hookContent.match(/!scriptLoaded \|\| !window\.Razorpay[\s\S]*?\{([\s\S]*?)\}/);
    assert(scriptFailMatch, "Must find script load failure handler");
    assert(scriptFailMatch[1].includes('"error"'), "Must set error state on script load failure");
    assert(
      scriptFailMatch[1].includes("Failed to load payment gateway"),
      "Must provide user-facing error message about gateway load failure"
    );
  });

  // ============================================================
  // TEST 20: RAZORPAY_KEY_SECRET does not appear anywhere in client implementation
  // ============================================================
  it("TEST 20: RAZORPAY_KEY_SECRET does not appear in client hook source", () => {
    assert(
      !hookContent.includes("RAZORPAY_KEY_SECRET"),
      "Hook source must NOT contain RAZORPAY_KEY_SECRET"
    );
    assert(
      !hookContent.includes("key_secret"),
      "Hook source must NOT contain key_secret"
    );
    assert(
      !hookContent.includes("razorpay_key_secret"),
      "Hook source must NOT contain razorpay_key_secret"
    );
  });

  // ============================================================
  // Additional Coverage
  // ============================================================

  it("TEST 21: verify-payment error response transitions to error state", () => {
    // In verifyPayment, must check res.ok
    const verifyFunc = hookContent.match(/const verifyPayment[\s\S]*?(?=const startPurchase)/);
    assert(verifyFunc, "Must find verifyPayment function");
    assert(verifyFunc[0].includes("!res.ok"), "Must check res.ok in verifyPayment");
    assert(verifyFunc[0].includes('setState("error")'), "Must set error state on verify failure");
  });

  it("TEST 22: reset() clears all state back to idle", () => {
    assert(hookContent.includes("const reset = useCallback"), "Must define reset callback");
    const resetBlock = hookContent.match(/const reset = useCallback\(\(\)\s*=>\s*\{([\s\S]*?)\},/);
    assert(resetBlock, "Must find reset callback body");
    assert(resetBlock[1].includes('"idle"'), "reset must set idle state");
    assert(resetBlock[1].includes("setReportId(null)"), "reset must clear reportId");
    assert(resetBlock[1].includes("setOrderId(null)"), "reset must clear orderId");
    assert(resetBlock[1].includes("setDownloadUrl(null)"), "reset must clear downloadUrl");
    assert(resetBlock[1].includes("setError(null)"), "reset must clear error");
    assert(resetBlock[1].includes("lastPaymentCredentialsRef.current = null"), "reset must clear credentials");
    assert(resetBlock[1].includes("isBusyRef.current = false"), "reset must clear busy flag");
  });

  it("TEST 23: invalid startup_id (0 or negative) is rejected without fetch", () => {
    // Must validate startupId before making any fetch call
    assert(
      hookContent.includes("startupId <= 0") || hookContent.includes("!startupId"),
      "Must validate startupId is positive"
    );
    assert(
      hookContent.includes("Invalid startup ID"),
      "Must provide user-facing error for invalid startup_id"
    );
  });

  it("TEST 24: hook exports correct InvestorReportState union type", () => {
    assert(hookContent.includes('"idle"'), "Must include idle state");
    assert(hookContent.includes('"creating_order"'), "Must include creating_order state");
    assert(hookContent.includes('"payment_open"'), "Must include payment_open state");
    assert(hookContent.includes('"verifying"'), "Must include verifying state");
    assert(hookContent.includes('"generating"'), "Must include generating state");
    assert(hookContent.includes('"completed"'), "Must include completed state");
    assert(hookContent.includes('"error"'), "Must include error state");
  });

  it("TEST 25: Razorpay script URL is official checkout.razorpay.com", () => {
    assert(
      hookContent.includes("https://checkout.razorpay.com/v1/checkout.js"),
      "Must use official Razorpay Checkout script URL"
    );
  });

  it("TEST 26: hook does NOT call /api/billing/checkout", () => {
    assert(
      !hookContent.includes("/api/billing/checkout"),
      "Must NOT call subscription checkout endpoint"
    );
    assert(
      !hookContent.includes("/api/billing/"),
      "Must NOT call any billing endpoint"
    );
  });

  it("TEST 27: hook does NOT call PDF generator or Supabase Storage", () => {
    assert(
      !hookContent.includes("generateInvestorReportPdf"),
      "Must NOT call PDF generator from client"
    );
    assert(
      !hookContent.includes("supabaseServer"),
      "Must NOT import supabaseServer in client hook"
    );
    assert(
      !hookContent.includes(".storage.from"),
      "Must NOT access Supabase Storage from client"
    );
  });

  it("TEST 28: retryGeneration without credentials provides error", () => {
    const retryStart = hookContent.indexOf("const retryGeneration");
    assert(retryStart !== -1, "Must find retryGeneration definition");
    const retryBlock = hookContent.slice(retryStart, retryStart + 500);
    assert(
      retryBlock.includes("!lastPaymentCredentialsRef.current"),
      "Must check for null credentials before retry"
    );
    assert(
      retryBlock.includes("No active report payment credentials"),
      "Must provide user-facing error when no credentials available"
    );
  });
});

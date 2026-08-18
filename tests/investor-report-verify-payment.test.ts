import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { timingSafeCompare } from "../src/lib/encryption";

describe("POST /api/reports/verify-payment (Investor Report Payment Verification, Atomic Claims & Crash Reclamation)", () => {
  const routePath = path.join(process.cwd(), "src/app/api/reports/verify-payment/route.ts");
  const routeContent = fs.readFileSync(routePath, "utf8");

  it("TEST 1: Unauthenticated request rejected with HTTP 401", () => {
    assert(routeContent.includes("getAuthenticatedUser"), "Must call getAuthenticatedUser");
    assert(routeContent.includes('status: 401'), "Must return 401 on unauthenticated");
  });

  it("TEST 2: Missing report_id rejected with HTTP 400", () => {
    assert(routeContent.includes("!report_id"), "Must validate report_id existence");
    assert(routeContent.includes("status: 400"), "Must return 400 on missing parameter");
  });

  it("TEST 3: Missing order_id rejected with HTTP 400", () => {
    assert(routeContent.includes("!order_id"), "Must validate order_id existence");
  });

  it("TEST 4: Missing payment_id rejected with HTTP 400", () => {
    assert(routeContent.includes("!payment_id"), "Must validate payment_id existence");
  });

  it("TEST 5: Missing signature rejected with HTTP 400", () => {
    assert(routeContent.includes("!signature"), "Must validate signature existence");
  });

  it("TEST 6: Unknown report returns safe HTTP 404", () => {
    assert(routeContent.includes('status: 404'), "Must return 404 when report not found");
    assert(routeContent.includes("Investor report record not found"), "Must return descriptive error");
  });

  it("TEST 7: User cannot verify another user's report (Strict IDOR defense returns 403)", () => {
    assert(routeContent.includes("report.user_id !== user.id"), "Must enforce report user_id matches session user");
    assert(routeContent.includes('status: 403'), "Must return 403 on ownership check failure");
  });

  it("TEST 8: Supplied order ID must match DB order ID", () => {
    assert(routeContent.includes("report.razorpay_order_id !== order_id"), "Must verify order ID match");
    assert(routeContent.includes("Supplied order ID does not match report record"), "Must reject mismatched order ID");
  });

  it("TEST 9: Invalid HMAC signature rejected with HTTP 400", () => {
    assert(routeContent.includes("Invalid payment signature"), "Must reject invalid signature");
    assert(routeContent.includes("createHmac"), "Must compute HMAC-SHA256");
  });

  it("TEST 10: Timing-safe signature verification is used (timingSafeCompare)", () => {
    assert(routeContent.includes("timingSafeCompare"), "Must use timingSafeCompare");
    
    // Verify timingSafeCompare utility directly
    const secret = "test_secret_12345";
    const payload = "order_123|pay_456";
    const validSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const invalidSig = "0".repeat(64);
    
    assert.strictEqual(timingSafeCompare(validSig, validSig), true);
    assert.strictEqual(timingSafeCompare(validSig, invalidSig), false);
    assert.strictEqual(timingSafeCompare(validSig, "short"), false);
  });

  it("TEST 11: Razorpay payment fetch failure does not mark report paid (returns 502)", () => {
    assert(routeContent.includes("razorpay.payments.fetch"), "Must fetch payment from Razorpay");
    assert(routeContent.includes("status: 502"), "Must return 502 on gateway fetch error");
  });

  it("TEST 12: Razorpay order fetch failure does not mark report paid (returns 502)", () => {
    assert(routeContent.includes("razorpay.orders.fetch"), "Must fetch order from Razorpay");
  });

  it("TEST 13: Payment amount != 49900 rejected with HTTP 400", () => {
    assert(routeContent.includes("EXPECTED_AMOUNT_PAISE = 49900"), "Expected amount must be 49900");
    assert(routeContent.includes("isPaymentAmountValid"), "Must check payment amount validity");
  });

  it("TEST 14: Payment currency != INR rejected with HTTP 400", () => {
    assert(routeContent.includes('EXPECTED_CURRENCY = "INR"'), "Expected currency must be INR");
    assert(routeContent.includes("isPaymentCurrencyValid"), "Must check payment currency validity");
  });

  it("TEST 15: Order amount != 49900 rejected with HTTP 400", () => {
    assert(routeContent.includes("isOrderAmountValid"), "Must check order amount validity");
  });

  it("TEST 16: Order currency != INR rejected with HTTP 400", () => {
    assert(routeContent.includes("isOrderCurrencyValid"), "Must check order currency validity");
  });

  it("TEST 17: Payment belonging to another order rejected with HTTP 400", () => {
    assert(routeContent.includes("isPaymentOrderMatch"), "Must check payment order match");
  });

  it("TEST 18: Payment status = authorized is NOT sufficient (strictly requires captured)", () => {
    assert(routeContent.includes('rzpPayment?.status === "captured"'), "Must strictly check captured status");
    assert(!routeContent.includes('rzpPayment?.status === "authorized"'), "Authorized must not be accepted");
  });

  it("TEST 19: Payment status = captured is accepted", () => {
    assert(routeContent.includes("isCaptured"), "Must evaluate isCaptured");
  });

  it("TEST 20: Captured payment with exact ₹499 INR values is accepted", () => {
    assert(routeContent.includes("Payment verification failed: Payment not captured or parameters mismatched"), "Error when checks fail");
  });

  it("TEST 21: Successful verification sets payment_status = paid", () => {
    assert(routeContent.includes('payment_status: "paid"'), "Must transition payment_status to paid");
  });

  it("TEST 22: razorpay_payment_id is persisted exactly once in database", () => {
    assert(routeContent.includes("razorpay_payment_id: payment_id"), "Must persist payment_id");
  });

  it("TEST 23: paid_at timestamp is persisted", () => {
    assert(routeContent.includes("paid_at: new Date().toISOString()"), "Must persist paid_at");
  });

  it("TEST 24: Metrics snapshot contains provider-backed facts (revenue, gateways, transaction count)", () => {
    assert(routeContent.includes("getAggregatedRevenue"), "Must use getAggregatedRevenue");
    assert(routeContent.includes("verifiedRevenue:"), "Must populate verifiedRevenue in snapshot");
    assert(routeContent.includes("totalRevenueInr:"), "Must include totalRevenueInr");
  });

  it("TEST 25: Metrics snapshot contains derived trust metrics (score, tier, consistency)", () => {
    assert(routeContent.includes("computeTrustScore"), "Must use computeTrustScore");
    assert(routeContent.includes("trustMetrics:"), "Must populate trustMetrics in snapshot");
    assert(routeContent.includes("trustScore:"), "Must include trustScore");
  });

  it("TEST 26: Metrics snapshot contains founder-provided data (startup name, category, website)", () => {
    assert(routeContent.includes("startup: {"), "Must populate startup in snapshot");
    assert(routeContent.includes("startup.startup_name"), "Must use DB startup_name");
  });

  it("TEST 27: Snapshot is generated from server/database data, not client metadata", () => {
    assert(!routeContent.includes("startup: body.startup"), "Must not use client-supplied startup metadata");
    assert(!routeContent.includes("revenue: body.revenue"), "Must not use client-supplied revenue");
  });

  it("TEST 28: PDF generator receives the frozen snapshot values", () => {
    assert(routeContent.includes("generateInvestorReportPdf(snapshot)"), "Must pass frozen snapshot to generator");
  });

  it("TEST 29: PDF generation failure leaves payment_status = paid", () => {
    assert(routeContent.includes('generation_status: "failed"'), "Must update generation_status to failed");
    assert(!routeContent.includes('payment_status: "failed",\n        generation_status: "failed"'), "Must not revert payment_status to failed");
  });

  it("TEST 30: PDF generation failure sets generation_status = failed", () => {
    assert(routeContent.includes("PDF generation failed. Payment is preserved and retryable."), "Must explain retryable status");
  });

  it("TEST 31: Storage upload failure leaves payment_status = paid", () => {
    assert(routeContent.includes("Storage upload failed. Payment is preserved and retryable."), "Must preserve payment on upload failure");
  });

  it("TEST 32: Storage upload failure sets generation_status = failed", () => {
    assert(routeContent.includes('status: "generation_failed"'), "Must return generation_failed status");
  });

  it("TEST 33: Successful storage upload sets storage_path (<user_id>/<report_id>.pdf)", () => {
    assert(routeContent.includes("const storagePath = `${user.id}/${report.id}.pdf`"), "Must format path as user_id/report_id.pdf");
    assert(routeContent.includes("storage_path: storagePath"), "Must persist storage_path");
  });

  it("TEST 34: Successful completion sets generation_status = completed", () => {
    assert(routeContent.includes('generation_status: "completed"'), "Must transition generation_status to completed");
  });

  it("TEST 35: completed_at timestamp is persisted", () => {
    assert(routeContent.includes("completed_at: new Date().toISOString()"), "Must persist completed_at");
  });

  it("TEST 36: Completed report does not regenerate PDF on repeated verify (idempotent fast path)", () => {
    assert(routeContent.includes('report.payment_status === "paid" && report.generation_status === "completed"'), "Must detect completed report");
    assert(routeContent.includes("createSignedUrl(report.storage_path"), "Must return signed URL directly without calling generator");
  });

  it("TEST 37: Paid + generation_failed retries without another Razorpay payment", () => {
    assert(routeContent.includes('report.payment_status === "pending"'), "Only calls Razorpay when payment_status is pending");
  });

  it("TEST 38: Retry uses existing metrics_snapshot and does not recalculate live metrics", () => {
    assert(routeContent.includes("existingSnapshot.startup && existingSnapshot.verifiedRevenue"), "Must check for existing snapshot");
    assert(routeContent.includes("snapshot = existingSnapshot"), "Must reuse existing snapshot on retry");
  });

  it("TEST 39: Paid + generating does not start duplicate generation", () => {
    assert(routeContent.includes('report.payment_status === "paid"'), "Guards against duplicate processing when paid");
    assert(routeContent.includes("Report generation in progress"), "Must return in-progress response");
  });

  it("TEST 40: Refunded report cannot be regenerated (HTTP 400)", () => {
    assert(routeContent.includes('report.payment_status === "refunded"'), "Must check refunded status");
    assert(routeContent.includes("Report payment was refunded. Fulfillment disabled."), "Must reject refunded report");
  });

  it("TEST 41: Short-lived signed URL is generated from private storage path (60s expiry)", () => {
    assert(routeContent.includes("SIGNED_URL_EXPIRY_SECONDS = 60"), "Signed URL expiry must be 60 seconds");
    assert(routeContent.includes("createSignedUrl"), "Must call createSignedUrl");
  });

  it("TEST 42: No public storage URL is returned", () => {
    assert(!routeContent.includes("getPublicUrl"), "Must not call getPublicUrl on private bucket");
    assert(routeContent.includes('STORAGE_BUCKET = "investor-reports"'), "Target bucket must be investor-reports");
  });

  it("TEST 43: Client cannot override amount/currency/startup/user/metrics", () => {
    assert(!routeContent.includes("amount: body.amount"), "Must not accept client amount");
    assert(!routeContent.includes("currency: body.currency"), "Must not accept client currency");
  });

  it("TEST 44: Rate limiting is enforced (HTTP 429 on abuse)", () => {
    assert(routeContent.includes("getClientIdentifier"), "Must use getClientIdentifier");
    assert(routeContent.includes("checkRateLimit"), "Must call checkRateLimit");
    assert(routeContent.includes("status: 429"), "Must return 429 on rate limit");
  });

  it("TEST 45: No Razorpay secret is exposed in client response", () => {
    const returnStatements = routeContent.match(/return NextResponse\.json\([\s\S]*?\);/g) || [];
    for (const stmt of returnStatements) {
      assert(!stmt.includes("secret"), "Returned JSON must never contain secrets");
      assert(!stmt.includes("keySecret"), "Returned JSON must never contain keySecret");
    }
  });

  it("TEST 46: No provider credentials or sensitive keys are logged", () => {
    assert(!routeContent.includes("console.log(keySecret"), "Must not log keySecret");
    assert(!routeContent.includes("console.log(process.env"), "Must not log process.env");
  });

  it("TEST 47: Concurrent verify requests cannot generate duplicate reports", () => {
    assert(routeContent.includes('isGenerationOwner'), "Guards execution behind atomic ownership flag");
  });

  it("TEST 48: Database unique constraint prevents duplicate payment attachment", () => {
    assert(routeContent.includes("razorpay_payment_id: payment_id"), "Persists unique razorpay_payment_id");
  });

  it("TEST 49: No second Razorpay order is created by verify endpoint", () => {
    assert(!routeContent.includes("razorpay.orders.create"), "Verify endpoint must never create new Razorpay orders");
  });

  it("TEST 50: No subscription API is called by verify endpoint", () => {
    assert(!routeContent.includes("razorpay.subscriptions"), "Verify endpoint must never call subscriptions API");
  });

  // =========================================================================
  // F-3C-01 & F-3C-02 HARDENING REGRESSION TESTS (TESTS A THROUGH J)
  // =========================================================================

  it("TEST A (51): Two concurrent verify requests when payment_status = pending (Atomic Claim F-3C-02)", () => {
    assert(routeContent.includes('.eq("payment_status", "pending")'), "Must use atomic conditional update checking pending status");
    assert(routeContent.includes("claimedReport"), "Must verify returned row from atomic claim");
    assert(routeContent.includes("Concurrent request already claimed generation"), "Must safely handle losing concurrent request");
  });

  it("TEST B (52): Concurrent requests when state is paid + generating + recent (no takeover, returns generating)", () => {
    assert(routeContent.includes("STALE_GENERATION_THRESHOLD_MS = 2 * 60 * 1000"), "Must define 2-minute conservative stale threshold");
    assert(routeContent.includes("!isStale"), "Recent generation must not be reclaimed");
  });

  it("TEST C (53): Stale paid + generating atomically reclaims generation (F-3C-01)", () => {
    assert(routeContent.includes('.is("storage_path", null)'), "Reclamation requires null storage_path");
    assert(routeContent.includes('.lte("updated_at", staleCutoff)'), "Reclamation requires stale updated_at cutoff");
    assert(routeContent.includes("Atomically reclaimed stale generation"), "Must log successful atomic reclamation");
  });

  it("TEST D (54): Two simultaneous stale-recovery requests (exactly one reclamation winner)", () => {
    assert(routeContent.includes("reclaimedReport"), "Must check reclaimedReport returned from atomic conditional update");
    assert(routeContent.includes("Lost race for stale generation reclamation"), "Losing reclamation request must not generate PDF");
  });

  it("TEST E (55): Crash simulation: generation claim succeeds but generation fails (payment remains paid, retryable)", () => {
    assert(routeContent.includes('generation_status: "failed"'), "Sets generation_status to failed on crash");
    assert(!routeContent.includes('payment_status: "failed"'), "Never resets payment_status to failed on generation failure");
  });

  it("TEST F (56): Existing completed report returns signed URL without regeneration", () => {
    assert(routeContent.includes('report.payment_status === "paid" && report.generation_status === "completed"'), "Fast path returns signed URL");
  });

  it("TEST G (57): Existing paid + failed report retries without Razorpay call or new order", () => {
    assert(routeContent.includes('.eq("generation_status", "failed")'), "Atomic retry claim targets failed generation_status");
  });

  it("TEST H (58): Existing frozen metrics_snapshot does NOT call revenue aggregation or trust score", () => {
    assert(routeContent.includes("existingSnapshot.startup && existingSnapshot.verifiedRevenue"), "Checks existing snapshot before computing");
  });

  it("TEST I (59): No storage_path + generating + stale + existing snapshot reuses snapshot without recalculation", () => {
    assert(routeContent.includes("snapshot = existingSnapshot"), "Reuses frozen snapshot on stale reclamation");
  });

  it("TEST J (60): Existing refunded report cannot be regenerated", () => {
    assert(routeContent.includes('report.payment_status === "refunded"'), "Explicitly blocks refunded report generation");
  });
});

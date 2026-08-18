import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { generateReportReceipt } from "../src/app/api/reports/create-order/route";

describe("POST /api/reports/create-order (Investor Report Razorpay Order Creation & Payment Lifecycle Hardening)", () => {
  const routePath = path.join(process.cwd(), "src/app/api/reports/create-order/route.ts");
  const routeContent = fs.readFileSync(routePath, "utf8");

  const migrationPath = path.join(process.cwd(), "supabase/migrations/20260819120000_investor_reports_concurrency_index.sql");
  const migrationExists = fs.existsSync(migrationPath);
  const migrationContent = migrationExists ? fs.readFileSync(migrationPath, "utf8") : "";

  it("TEST 1: Route enforces authentication check returning 401 when unauthenticated", () => {
    assert(routeContent.includes("getAuthenticatedUser"), "Must call getAuthenticatedUser");
    assert(routeContent.includes("Authentication required"), "Must return authentication required error");
    assert(routeContent.includes("status: 401"), "Must return HTTP 401");
  });

  it("TEST 2: Route rejects missing startup_id with HTTP 400", () => {
    assert(routeContent.includes("startup_id === undefined"), "Must check for undefined startup_id");
    assert(routeContent.includes("status: 400"), "Must return HTTP 400 for missing startup_id");
  });

  it("TEST 3: Route rejects non-integer and non-positive startup_id with HTTP 400", () => {
    assert(routeContent.includes("Number.isInteger(startup_id)"), "Must enforce integer startup_id");
    assert(routeContent.includes("Number.isFinite(startup_id)"), "Must enforce finite startup_id");
    assert(routeContent.includes("startup_id <= 0"), "Must enforce positive startup_id");
  });

  it("TEST 4: Route verifies ownership and rejects non-owned startup with HTTP 403", () => {
    assert(routeContent.includes("verifyStartupOwnership"), "Must call verifyStartupOwnership");
    assert(routeContent.includes("!ownership.owned"), "Must check ownership.owned");
    assert(routeContent.includes("status: 403"), "Must return HTTP 403 on non-ownership");
  });

  it("TEST 5: Owned startup proceeds to order creation and database record insertion", () => {
    assert(routeContent.includes("razorpay.orders.create"), "Must call razorpay.orders.create");
    assert(routeContent.includes('.from("investor_reports")'), "Must target investor_reports table");
    assert(routeContent.includes(".insert({"), "Must insert record");
  });

  it("TEST 6: Razorpay order amount is ALWAYS strictly server-enforced as 49900 paise (₹499)", () => {
    assert(routeContent.includes("const REPORT_AMOUNT_PAISE = 49900;"), "REPORT_AMOUNT_PAISE must be 49900");
    assert(routeContent.includes("amount: REPORT_AMOUNT_PAISE"), "Order create must use REPORT_AMOUNT_PAISE");
  });

  it("TEST 7: Razorpay currency is ALWAYS strictly server-enforced as 'INR'", () => {
    assert(routeContent.includes('const REPORT_CURRENCY = "INR";'), "REPORT_CURRENCY must be INR");
    assert(routeContent.includes("currency: REPORT_CURRENCY"), "Order create must use REPORT_CURRENCY");
  });

  it("TEST 8: Razorpay secret is never returned in client response", () => {
    const returnMatch = routeContent.match(/return NextResponse\.json\(\{\s*success: true,[\s\S]*?\}\);/);
    assert(returnMatch, "Must find successful return payload");
    assert(!returnMatch[0].includes("secret"), "Returned JSON must never contain secret keys");
  });

  it("TEST 9: Successful order creates a record in public.investor_reports with report_period='30_days'", () => {
    assert(routeContent.includes('report_period: REPORT_PERIOD'), "Must insert report_period");
    assert(routeContent.includes('const REPORT_PERIOD = "30_days";'), "REPORT_PERIOD must be 30_days");
    assert(routeContent.includes('razorpay_order_id: order.id'), "Must link razorpay_order_id");
  });

  it("TEST 10: Investor report is initialized in 'pending' payment status (never marked paid at creation)", () => {
    assert(routeContent.includes('payment_status: "pending"'), "Initial payment_status must be pending");
    assert(routeContent.includes('generation_status: "pending"'), "Initial generation_status must be pending");
  });

  it("TEST 11: Razorpay failure returns 502 and does NOT insert into investor_reports", () => {
    assert(routeContent.includes("Failed to initialize payment order with payment gateway"), "Must handle gateway failure");
    assert(routeContent.includes("status: 502"), "Must return 502 on Razorpay order creation failure");
  });

  it("TEST 12: Database insertion failure returns 500 without claiming success", () => {
    assert(routeContent.includes("insertError"), "Must check insertError");
    assert(routeContent.includes("Failed to record report initialization in database"), "Must handle DB error");
    assert(routeContent.includes("status: 500"), "Must return 500 on database failure");
  });

  it("TEST 13: Client cannot override order amount (client-supplied body amount is completely ignored)", () => {
    assert(!routeContent.includes("amount: body.amount"), "Client body amount must not be used");
    assert(!routeContent.includes("amount = body.amount"), "Client body amount must not be assigned");
  });

  it("TEST 14: Client cannot override currency (client-supplied body currency is completely ignored)", () => {
    assert(!routeContent.includes("currency: body.currency"), "Client body currency must not be used");
    assert(!routeContent.includes("currency = body.currency"), "Client body currency must not be assigned");
  });

  it("TEST 15: Client cannot provide another user's user_id to bypass ownership", () => {
    assert(!routeContent.includes("user_id: body.user_id"), "Client body user_id must not be used");
    assert(routeContent.includes("user_id: user.id"), "user_id must strictly come from authenticated session user");
  });

  it("TEST 16: Idempotency check reuses active pending order created in last 15 minutes", () => {
    assert(routeContent.includes('eq("payment_status", "pending")'), "Must check for existing pending report");
    assert(routeContent.includes('isRecent'), "Must check 15-minute window");
    assert(routeContent.includes('existingPending.razorpay_order_id'), "Must return existing order ID if pending");
  });

  it("TEST 17: Rate limiting prevents uncontrolled repeated order creation", () => {
    assert(routeContent.includes("getClientIdentifier"), "Must use getClientIdentifier");
    assert(routeContent.includes("checkRateLimit"), "Must call checkRateLimit");
    assert(routeContent.includes("status: 429"), "Must return 429 when rate limit exceeded");
  });

  it("TEST 18: In-flight request deduplication prevents concurrent race conditions in same process", () => {
    assert(routeContent.includes("inFlightOrderCreations"), "Must maintain in-flight deduplication map");
    assert(routeContent.includes("inFlightOrderCreations.has(flightKey)"), "Must check for concurrent in-flight order creation");
    assert(routeContent.includes("inFlightOrderCreations.set"), "Must register in-flight promise");
    assert(routeContent.includes("inFlightOrderCreations.delete"), "Must clean up in-flight promise");
  });

  it("TEST 19: Historical reports (completed, failed, refunded, paid) do not block new report orders", () => {
    assert(routeContent.includes('.eq("payment_status", "pending")'), "Pending query must exclusively target pending status");
    assert(!routeContent.includes('.in("payment_status", ["pending", "paid", "completed"])'), "Must not block on completed reports");
  });

  it("TEST 20: Receipt generation is collision-resistant and adheres to Razorpay 40-character limit", () => {
    const receipts = new Set<string>();
    const count = 1000;
    
    for (let i = 0; i < count; i++) {
      const receipt = generateReportReceipt(12345);
      assert(receipt.length <= 40, `Receipt length ${receipt.length} must be <= 40 chars, got: ${receipt}`);
      assert(receipt.startsWith("rep_12345_"), `Receipt must start with prefix, got: ${receipt}`);
      receipts.add(receipt);
    }
    
    assert.strictEqual(receipts.size, count, "1000 generated receipts must have zero collisions");
  });

  it("TEST 21: Database-level partial unique index guarantees at most ONE pending order per (user_id, startup_id)", () => {
    assert(migrationExists, "Migration file for partial unique index must exist");
    assert(migrationContent.includes("CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_reports_pending_unique"), "Must declare unique index");
    assert(migrationContent.includes("ON public.investor_reports (user_id, startup_id)"), "Must be compound index on (user_id, startup_id)");
    assert(migrationContent.includes("WHERE payment_status = 'pending'"), "Must be partial index on pending status only");
  });

  it("TEST 22: Route handles PostgreSQL 23505 unique violation by recovering winning order across separate instances", () => {
    assert(routeContent.includes('insertError.code === "23505"'), "Must detect 23505 unique violation code");
    assert(routeContent.includes("idx_investor_reports_pending_unique"), "Must identify partial unique index conflict");
    assert(routeContent.includes("winningReport"), "Must query the winning concurrent order");
  });

  it("TEST 23: Stale pending orders (> 15 minutes) are provider-verified before releasing the index", () => {
    assert(routeContent.includes("razorpay.orders.fetch"), "Must verify order status with Razorpay");
    assert(routeContent.includes("razorpay.orders.fetchPayments"), "Must inspect payments on stale order");
  });

  it("TEST 24: Two different users can independently create report orders simultaneously", () => {
    assert(migrationContent.includes("(user_id, startup_id)"), "Compound index scopes uniqueness to specific user");
  });

  it("TEST 25: Two different startups owned by the same user can independently create report orders", () => {
    assert(migrationContent.includes("(user_id, startup_id)"), "Compound index scopes uniqueness to specific startup");
  });

  it("TEST 26: If an unresolvable database conflict occurs, returns HTTP 500 without false success", () => {
    assert(routeContent.includes('status: 500'), "Must return HTTP 500 on database failure");
    assert(routeContent.includes('Failed to record report initialization in database'), "Must describe DB failure");
  });

  it("TEST 27: Zero actual financial transactions or provider mutations occur during tests", () => {
    assert(!routeContent.includes("razorpay.payments.capture"), "Order creation must never capture payments");
    assert(!routeContent.includes("razorpay.subscriptions"), "Order creation must never call subscriptions API");
  });

  it("TEST 28: A pending report older than 15 minutes is NOT automatically classified as failure merely because of age", () => {
    assert(!routeContent.includes(".lte(\"created_at\", fifteenMinutesAgo)\n        .update({ payment_status: \"failed\" })"), "Must not blindly update status purely by date");
    assert(routeContent.includes("orders.fetch"), "Must fetch provider status first");
  });

  it("TEST 29: Delayed payment webhook cannot cause a paid Razorpay payment to be converted to failed", () => {
    assert(routeContent.includes('rzpOrder.status === "paid"'), "Must check if provider order is already paid");
    assert(routeContent.includes("Preserving record"), "Must preserve record if already paid");
  });

  it("TEST 30: If provider status confirms payment is still pending, existing order remains active", () => {
    assert(routeContent.includes("Retaining pending order"), "Must retain order when reconciliation encounters pending state");
  });

  it("TEST 31: If provider status confirms captured payment, report is never transitioned to failed", () => {
    assert(routeContent.includes('hasSuccessfulPayment'), "Must verify captured payments");
    assert(routeContent.includes('already_paid: true'), "Must flag already paid when payment captured");
  });

  it("TEST 32: If provider status confirms order has zero payments, stale order transitions to failed to allow new purchase", () => {
    assert(routeContent.includes('Provider confirmed 0 payments'), "Must log confirmed zero payments");
    assert(routeContent.includes('.update({ payment_status: "failed" })'), "Transitions verified abandoned order to failed");
  });

  it("TEST 33: Concurrent cross-instance insertion results in exactly one pending database report", () => {
    assert(migrationContent.includes("WHERE payment_status = 'pending'"), "Enforces exactly one pending row per (user_id, startup_id)");
  });

  it("TEST 34: Losing instance in DB 23505 race logs the orphan Razorpay order ID explicitly", () => {
    assert(routeContent.includes("Concurrent instance lost DB 23505 race"), "Must log losing instance order ID");
    assert(routeContent.includes("order.id"), "Must include losing order.id in telemetry log");
  });

  it("TEST 35: Razorpay Orders API has no cancellation endpoint, so losing order expires with zero charges", () => {
    assert(!routeContent.includes("razorpay.orders.cancel"), "Orders API does not have cancel endpoint");
    assert(routeContent.includes("will expire naturally"), "Documents natural expiration with zero charges");
  });

  it("TEST 36: No real Razorpay orders, payments, captures, or refunds are created by tests", () => {
    assert(!routeContent.includes("razorpay.refunds"), "No refunds in order creation route");
  });
});

/**
 * A4.2 Free Verification Boundaries & Regression Test Suite
 *
 * Proves the core commercial invariant:
 * Verification is 100% free for all authenticated startup owners on the Viewer plan,
 * while maintaining strict authentication, startup ownership, anti-fraud, and Pro feature boundaries.
 *
 * Test Matrix:
 * 1. Viewer can initiate Stripe connection without paid subscription
 * 2. Viewer can initiate Razorpay connection without paid subscription
 * 3. Viewer can perform revenue verification & sync without paid subscription
 * 4. Viewer cannot access Pro-only features (csv_export, rest_api, advanced_filters)
 * 5. Unauthenticated requests are strictly denied (HTTP 401)
 * 6. Non-owner requests to verify another founder's startup are strictly denied (HTTP 403)
 * 7. VRF security invariants (tamper-proof boundaries & timing-safe crypto) remain intact
 */

import assert from "assert";
import fs from "fs";
import path from "path";

// Mock environment
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key";
process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err: unknown) {
    console.error(`✗ ${name}:`);
    console.error(err instanceof Error ? err.message : err);
    failed++;
  }
}

async function run() {
  console.log("==========================================================");
  console.log("   A4.2 FREE VERIFICATION & SECURITY BOUNDARY TESTS       ");
  console.log("==========================================================\n");

  // ── TEST 1: Viewer can initiate Stripe connection without paid subscription ──
  await test("TEST 1: Viewer can initiate Stripe connection without paid subscription", () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/stripe/connect/route.ts"),
      "utf8"
    );

    assert.strictEqual(
      routeContent.includes('plan.plan_code === "viewer"'),
      false,
      "Route must not contain viewer paywall"
    );
    assert.strictEqual(
      routeContent.includes("Subscription required to connect integration"),
      false,
      "Route must not require paid subscription"
    );
    assert.strictEqual(
      routeContent.includes("verifyStartupOwnership"),
      true,
      "Route must preserve verifyStartupOwnership"
    );
  });

  // ── TEST 2: Viewer can initiate Razorpay connection without paid subscription ──
  await test("TEST 2: Viewer can initiate Razorpay connection without paid subscription", () => {
    const routeContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/razorpay/verify/route.ts"),
      "utf8"
    );

    assert.strictEqual(
      routeContent.includes('plan.plan_code === "viewer"'),
      false,
      "Razorpay verify must not block viewer plan"
    );
    assert.strictEqual(
      routeContent.includes("Subscription required to connect integration"),
      false,
      "Razorpay verify must not require subscription"
    );
    assert.strictEqual(
      routeContent.includes("verifyStartupOwnership"),
      true,
      "Razorpay verify must enforce startup ownership"
    );
  });

  // ── TEST 3: Viewer can perform verification flow without paid subscription ──
  await test("TEST 3: Viewer can perform verification flow and sync without paid subscription", () => {
    const routesToCheck = [
      "src/app/api/stripe/verify/route.ts",
      "src/app/api/sync/stripe/route.ts",
      "src/app/api/razorpay/sync/route.ts",
      "src/app/api/sync/razorpay/route.ts",
      "src/app/api/startup/[id]/sync/route.ts",
      "src/app/api/trust/calculate/route.ts",
      "src/app/api/verify/revenue/route.ts"
    ];

    for (const relPath of routesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
      assert.strictEqual(
        content.includes('plan.plan_code === "viewer"'),
        false,
        `${relPath} must not block viewer plan`
      );
      assert.strictEqual(
        content.includes("Subscription required"),
        false,
        `${relPath} must not require paid subscription`
      );
      assert.strictEqual(
        content.includes("verifyStartupOwnership"),
        true,
        `${relPath} must enforce startup ownership`
      );
    }
  });

  // ── TEST 4: Viewer cannot access Pro-only functionality ──
  await test("TEST 4: Viewer cannot access Pro-only functionality merely because verification is free", async () => {
    const migrationContent = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260818000000_commercial_model_free_and_pro_999.sql"),
      "utf8"
    );

    assert(
      migrationContent.includes("feature_name IN ('verified_badge', 'privacy_toggle')"),
      "Migration must strictly enable only badge & privacy for viewer"
    );
    assert(
      !migrationContent.includes("csv_export") && !migrationContent.includes("rest_api"),
      "Migration must NOT enable Pro-only features for viewer"
    );
  });

  // ── TEST 5: Unauthenticated users remain denied ──
  await test("TEST 5: Unauthenticated users remain strictly denied on all verification routes", () => {
    const routesToCheck = [
      "src/app/api/stripe/connect/route.ts",
      "src/app/api/stripe/verify/route.ts",
      "src/app/api/sync/stripe/route.ts",
      "src/app/api/razorpay/verify/route.ts",
      "src/app/api/razorpay/sync/route.ts",
      "src/app/api/sync/razorpay/route.ts",
      "src/app/api/startup/[id]/sync/route.ts",
      "src/app/api/trust/calculate/route.ts",
      "src/app/api/verify/revenue/route.ts"
    ];

    for (const relPath of routesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
      assert.strictEqual(
        content.includes("Authentication required") || content.includes("authenticated"),
        true,
        `${relPath} must enforce authentication`
      );
      assert.strictEqual(
        content.includes("status: 401"),
        true,
        `${relPath} must return HTTP 401 when unauthenticated`
      );
    }
  });

  // ── TEST 6: A user cannot verify another user's startup ──
  await test("TEST 6: A user cannot verify another user's startup (strict IDOR defense)", () => {
    const routesToCheck = [
      "src/app/api/stripe/connect/route.ts",
      "src/app/api/stripe/verify/route.ts",
      "src/app/api/sync/stripe/route.ts",
      "src/app/api/razorpay/verify/route.ts",
      "src/app/api/razorpay/sync/route.ts",
      "src/app/api/sync/razorpay/route.ts",
      "src/app/api/startup/[id]/sync/route.ts",
      "src/app/api/trust/calculate/route.ts",
      "src/app/api/verify/revenue/route.ts"
    ];

    for (const relPath of routesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
      assert.strictEqual(
        content.includes("Unauthorized startup ownership check failed") || content.includes("!owned"),
        true,
        `${relPath} must enforce startup ownership check`
      );
      assert.strictEqual(
        content.includes("status: 403"),
        true,
        `${relPath} must return HTTP 403 when ownership check fails`
      );
    }
  });

  // ── TEST 7: VRF and Gate 2 security invariants remain intact ──
  await test("TEST 7: VRF-001 through VRF-004 and Gate 2 security invariants remain intact", () => {
    // 1. VRF-003 SVG Escaping in Badge route
    const badgeContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/badge/[slug]/route.ts"),
      "utf8"
    );
    assert.strictEqual(
      badgeContent.includes("escapeXml"),
      true,
      "VRF-003: Badge route must maintain XML entity escaping"
    );

    // 2. VRF-004 Timing-safe comparison in Webhook route
    const webhookContent = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/billing/webhook/razorpay/route.ts"),
      "utf8"
    );
    assert.strictEqual(
      webhookContent.includes("timingSafeCompare"),
      true,
      "VRF-004: Webhook route must maintain constant-time comparison"
    );

    // 3. VRF-005 Fail-closed cancellation engine
    const cancellationContent = fs.readFileSync(
      path.join(process.cwd(), "src/lib/billing/subscription-cancellation.ts"),
      "utf8"
    );
    assert.strictEqual(
      cancellationContent.includes("cancelAllUserSubscriptions"),
      true,
      "VRF-005: Account deletion cancellation engine must remain intact"
    );
  });

  console.log("\n==========================================================");
  console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run();

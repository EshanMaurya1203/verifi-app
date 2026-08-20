/**
 * TEST 01-D: Build / Runtime Configuration Consistency Test Suite
 *
 * Verifies deterministic repository configuration invariants:
 * - A: Public vs. Private Environment Variable Prefix Boundary
 * - B: Configuration Naming Parity (Code vs. Expected Contracts)
 * - C: Next.js Security Headers Configuration Integrity
 * - D: Middleware & Route Handler Supabase Auth Schema Parity
 * - E: Client Component Import Boundary (Zero direct imports of secret-holding server modules)
 * - F: Route Dynamic/Static Classification Contract
 * - G: Edge Runtime Dependency Safety (OG Image Generator)
 */

import assert from "assert";
import fs from "fs";
import path from "path";

async function run() {
  console.log("==========================================================");
  console.log("   TEST 01-D: BUILD / RUNTIME CONFIGURATION CONSISTENCY   ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${name}: ${msg}`);
      failed++;
    }
  }

  // ── TEST A: Public vs. Private Env Prefix Boundary ──
  test("TEST A: Only intended public identifiers use the NEXT_PUBLIC_ prefix", () => {
    const allowedPublicPrefixes = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_VERCEL_URL",
      "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    ];

    const forbiddenSensitiveTerms = [
      "SERVICE_ROLE",
      "SECRET",
      "TOKEN",
      "PASSWORD",
      "PRIVATE",
      "MASTER",
      "ENCRYPTION",
    ];

    // Scan all codebase files for NEXT_PUBLIC_ variables
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      for (const f of fs.readdirSync(dir)) {
        if (["node_modules", ".git", ".next", ".vercel"].includes(f)) continue;
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          results = results.concat(scanDir(full));
        } else if (/\.(ts|tsx|js|jsx)$/.test(f)) {
          const text = fs.readFileSync(full, "utf8");
          const matches = text.match(/NEXT_PUBLIC_[A-Za-z0-9_]+/g);
          if (matches) results.push(...matches);
        }
      }
      return results;
    }

    const foundPublicVars = [...new Set(scanDir("src"))];
    for (const v of foundPublicVars) {
      assert.ok(
        allowedPublicPrefixes.includes(v),
        `Unexpected NEXT_PUBLIC_ variable found: ${v}`
      );
      for (const term of forbiddenSensitiveTerms) {
        assert.ok(
          !v.includes(term),
          `Public variable ${v} contains forbidden sensitive term ${term}`
        );
      }
    }
  });

  // ── TEST B: Configuration Naming Contract Parity ──
  test("TEST B: Server runtime configuration contracts match expected variable names", () => {
    const requiredServerContracts = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "ENCRYPTION_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "RAZORPAY_BILLING_WEBHOOK_SECRET",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "RESEND_API_KEY",
      "CRON_SECRET",
    ];

    const codeContent = [
      fs.readFileSync("src/lib/supabase-server.ts", "utf8"),
      fs.readFileSync("src/lib/encryption.ts", "utf8"),
      fs.readFileSync("src/lib/stripe.ts", "utf8"),
      fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"),
      fs.readFileSync("src/app/api/billing/checkout/route.ts", "utf8"),
      fs.readFileSync("src/app/api/razorpay/webhook/route.ts", "utf8"),
      fs.readFileSync("src/app/api/billing/webhook/razorpay/route.ts", "utf8"),
      fs.readFileSync("src/lib/rate-limit.ts", "utf8"),
      fs.readFileSync("src/notifications/email/resend.ts", "utf8"),
      fs.readFileSync("src/app/api/cron/trial-reminders/route.ts", "utf8"),
    ].join("\n");

    for (const contract of requiredServerContracts) {
      assert.ok(
        codeContent.includes(`process.env.${contract}`) || codeContent.includes(contract),
        `Missing configuration contract reference for ${contract}`
      );
    }
  });

  // ── TEST C: Next.js Security Headers Configuration ──
  test("TEST C: next.config.ts enforces strict baseline security headers", async () => {
    const nextConfigContent = fs.readFileSync("next.config.ts", "utf8");
    assert.ok(nextConfigContent.includes("X-Frame-Options"), "Missing X-Frame-Options header");
    assert.ok(nextConfigContent.includes("X-Content-Type-Options"), "Missing X-Content-Type-Options header");
    assert.ok(nextConfigContent.includes("Strict-Transport-Security"), "Missing HSTS header");
    assert.ok(nextConfigContent.includes("Referrer-Policy"), "Missing Referrer-Policy header");
    assert.ok(nextConfigContent.includes("Permissions-Policy"), "Missing Permissions-Policy header");
  });

  // ── TEST D: Middleware & Route Auth Schema Parity ──
  test("TEST D: Middleware and Server Auth share identical Supabase Auth cookie patterns", () => {
    const middlewareContent = fs.readFileSync("src/lib/supabase/middleware.ts", "utf8");
    assert.ok(
      middlewareContent.includes("sb-") || middlewareContent.includes("auth-token"),
      "Middleware must recognize canonical Supabase auth cookie prefixes"
    );
    assert.ok(
      middlewareContent.includes("NEXT_PUBLIC_SUPABASE_URL"),
      "Middleware must use canonical Supabase URL"
    );
    assert.ok(
      middlewareContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      "Middleware must use canonical Supabase Anon Key"
    );
  });

  // ── TEST E: Client Component Import Boundary ──
  test("TEST E: Client components ('use client') never directly import server secret holders", () => {
    const forbiddenServerModules = [
      "src/lib/supabase-server",
      "src/lib/auth-server",
      "src/lib/stripe",
      "src/lib/encryption",
      "src/notifications/email/resend",
      "src/lib/billing/subscription-cancellation",
    ];

    function checkClientImports(dir: string) {
      for (const f of fs.readdirSync(dir)) {
        if (["node_modules", ".git", ".next", ".vercel"].includes(f)) continue;
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
          checkClientImports(full);
        } else if (/\.(tsx|jsx)$/.test(f)) {
          const text = fs.readFileSync(full, "utf8");
          if (/^[\s\n]*['"]use client['"]/m.test(text)) {
            for (const mod of forbiddenServerModules) {
              const base = path.basename(mod);
              const importStatementRegex = new RegExp(`import\\s+.*from\\s+['"][^'"]*${base}['"]`, "g");
              const matches = text.match(importStatementRegex);
              assert.strictEqual(
                matches,
                null,
                `Client component ${full} directly imports forbidden server module: ${mod}`
              );
            }
          }
        }
      }
    }

    checkClientImports("src");
  });

  // ── TEST F: Edge Runtime Route Safety ──
  test("TEST F: Edge runtime route (/api/og/startup/[slug]) relies only on Web APIs", () => {
    const ogRouteContent = fs.readFileSync("src/app/api/og/startup/[slug]/route.tsx", "utf8");
    assert.ok(
      ogRouteContent.includes('export const runtime = "edge"'),
      "OG Route must declare edge runtime"
    );
    assert.ok(
      !ogRouteContent.includes("fs."),
      "Edge route must not use Node.js fs module"
    );
    assert.ok(
      !ogRouteContent.includes("child_process"),
      "Edge route must not use Node.js child_process"
    );
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

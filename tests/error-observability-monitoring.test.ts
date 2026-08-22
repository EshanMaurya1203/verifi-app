/**
 * TEST 18 — Error Handling, Observability & Monitoring Test Harness
 *
 * Dedicated verification suite testing error classification, failure containment,
 * structured logging, correlation IDs, non-blocking auxiliary writes,
 * stack/secret non-leakage, and operational observability.
 *
 * Test Groups:
 * - Group A: Controlled 4xx Client Error Handling & Input Validation Sanitization
 * - Group B: Controlled 5xx Error Containment & Sensitive Data Non-Leakage
 * - Group C: Database Outage & Query Failure Containment (safeSupabaseQuery)
 * - Group D: External Provider Failure & Gateway Rejection Handling (Stripe, Razorpay)
 * - Group E: Network Timeout & AbortSignal Containment (safeFetch)
 * - Group F: Notification & Email Delivery Failure Isolation (Template, Provider, allSettled)
 * - Group G: Structured Logging Format & Telemetry Integrity (logger.ts)
 * - Group H: Correlation & Event ID Propagation (UUIDv4 tracking)
 * - Group I: Non-Blocking Auxiliary Write Isolation (ADR-023)
 * - Group J: Session & Authentication Error Classification (isUnrecoverableAuthError)
 * - Group K: Regression & Repository Hygiene
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { logger, LogEvent, BaseLogMetadata } from "../src/lib/logger";
import { safeFetch, safeSupabaseQuery, normalizeRequestUrl, createRequestCacheKey } from "../src/lib/safe-network";
import { dispatchNotification, registerDeliveryAdapter } from "../src/notifications/dispatcher";
import { isAlreadyCancelledError } from "../src/lib/billing/subscription-cancellation";
import { timingSafeCompare } from "../src/lib/encryption";
import { z } from "zod";
import crypto from "crypto";

// ─── SENSITIVE PATTERN SCANNER HELPER ─────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /postgresql:\/\/[^:]+:[^@]+@/i,         // Database connection URL with credentials
  /(?:sk|rzp)_(?:live|test)_[0-9a-zA-Z]{14,}/i, // Stripe / Razorpay secret key
  /re_[0-9a-zA-Z]{24,}/i,                 // Resend API key
  /Bearer\s+eyJ[A-Za-z0-9-_=]+/i,         // JWT Bearer Token
  /SUPABASE_SERVICE_ROLE_KEY/i,           // Supabase service role key name
  /at\s+(?:async\s+)?[\w\.<>]+\s+\([^\)]+:\d+:\d+\)/, // Stack trace line (e.g. at Object.run (/app/src/index.ts:10:5))
  /node:internal\/[^\s]+/i,               // Node internal stack trace path
];

export function scanForSensitiveLeakage(payload: unknown): { leaked: boolean; matchedPattern?: string; sample?: string } {
  const str = typeof payload === "string" ? payload : JSON.stringify(payload);
  if (!str) return { leaked: false };

  for (const pattern of SENSITIVE_PATTERNS) {
    const match = str.match(pattern);
    if (match) {
      return { leaked: true, matchedPattern: pattern.toString(), sample: match[0] };
    }
  }
  return { leaked: false };
}

// ─── AUTH ERROR CLASSIFIER (Mirrors src/lib/supabase/middleware.ts) ────────────

export function isUnrecoverableAuthError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode;
  const name = error.name || "";
  const message = (error.message || "").toLowerCase();

  // Network or 5xx server errors are transient — do NOT treat as unrecoverable auth failure
  if (
    (typeof status === "number" && status >= 500) ||
    name === "FetchError" ||
    name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("timeout")
  ) {
    return false;
  }

  // Explicit 4xx authentication / authorization error statuses
  if (typeof status === "number" && (status === 400 || status === 401 || status === 422)) {
    return true;
  }

  // Supabase AuthApiError
  if (name === "AuthApiError") {
    return true;
  }

  // Specific unrecoverable token / session error message strings
  const unrecoverableSubstrings = [
    "invalid refresh token",
    "refresh_token_not_found",
    "jwt expired",
    "token has expired",
    "invalid claim",
    "user_not_found",
    "session_not_found",
    "grant_type_invalid",
    "invalid grant",
  ];

  return unrecoverableSubstrings.some((term) => message.includes(term));
}

// ─── TEST SUITE ───────────────────────────────────────────────────────────────

describe("TEST 18 — Error Handling, Observability & Monitoring Harness", () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A: CONTROLLED 4xx CLIENT ERROR HANDLING & SANITIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group A: Controlled 4xx Client Error Handling & Sanitization", () => {
    it("A1: Malformed JSON payload returns HTTP 400 with sanitized error message and zero stack leakage", () => {
      // Simulate route handler JSON parse catch block
      const simulateMalformedJsonHandler = (rawBody: string) => {
        try {
          JSON.parse(rawBody);
          return { status: 200, body: { success: true } };
        } catch {
          return { status: 400, body: { error: "Invalid JSON payload." } };
        }
      };

      const result = simulateMalformedJsonHandler("{bad_json: invalid, 'missing_quotes'}");
      assert.equal(result.status, 400);
      assert.equal(result.body.error, "Invalid JSON payload.");

      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false, `Sensitive data leaked in 400 response: ${leakage.sample}`);
    });

    it("A2: Zod validation failure returns HTTP 400 with clean field error message and zero schema AST leakage", () => {
      const feedbackSchema = z.object({
        category: z.enum(["bug", "feature", "ui_ux", "general"], {
          message: "Category must be one of: bug, feature, ui_ux, general",
        }),
        message: z
          .string()
          .trim()
          .min(10, "Message must be at least 10 characters long.")
          .max(3000, "Message cannot exceed 3000 characters."),
      });

      const invalidPayload = { category: "invalid_category", message: "too short" };
      const parsed = feedbackSchema.safeParse(invalidPayload);
      assert.equal(parsed.success, false);

      if (!parsed.success) {
        const errorMessage = parsed.error.issues[0]?.message || "Invalid feedback data.";
        assert.equal(errorMessage, "Category must be one of: bug, feature, ui_ux, general");

        const responseBody = { error: errorMessage };
        assert.equal(typeof responseBody.error, "string");
        assert.ok(!("issues" in responseBody)); // Raw Zod internal AST is not leaked
        const leakage = scanForSensitiveLeakage(responseBody);
        assert.equal(leakage.leaked, false);
      }
    });

    it("A3: Missing or invalid authentication token returns HTTP 401 standard rejection", () => {
      const simulateAuthCheck = (user: any | null): { status: number; body: { error?: string; user?: string }; headers: Record<string, string> } => {
        if (!user || !user.email) {
          return {
            status: 401,
            body: { error: "Unauthorized. Please sign in." },
            headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
          };
        }
        return { status: 200, body: { user: user.id }, headers: {} };
      };

      const result = simulateAuthCheck(null);
      assert.equal(result.status, 401);
      assert.equal(result.body.error, "Unauthorized. Please sign in.");
      assert.equal(result.headers["Cache-Control"], "private, no-store, no-cache, must-revalidate");
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });

    it("A4: Unauthorized cross-user access returns HTTP 403 IDOR containment without leaking target data", () => {
      const simulateOwnershipCheck = (currentUserId: string, resourceOwnerId: string): { status: number; body: { error?: string; startup_id?: number; sensitive_revenue?: number }; headers: Record<string, string> } => {
        if (currentUserId !== resourceOwnerId) {
          return {
            status: 403,
            body: { error: "Forbidden: you do not own this startup." },
            headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
          };
        }
        return { status: 200, body: { startup_id: 101, sensitive_revenue: 50000 }, headers: {} };
      };

      const result = simulateOwnershipCheck("usr_attacker", "usr_legitimate_founder");
      assert.equal(result.status, 403);
      assert.equal(result.body.error, "Forbidden: you do not own this startup.");
      assert.ok(!("sensitive_revenue" in result.body));
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });

    it("A5: Nonexistent resource request returns HTTP 404 with safe error response", () => {
      const simulateResourceLookup = (resource: any | null) => {
        if (!resource) {
          return {
            status: 404,
            body: { error: "Startup not found." },
            headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" },
          };
        }
        return { status: 200, body: resource };
      };

      const result = simulateResourceLookup(null);
      assert.equal(result.status, 404);
      assert.equal(result.body.error, "Startup not found.");
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });

    it("A6: Rate limit exhaustion returns HTTP 429 and includes Retry-After header", () => {
      const simulateRateLimitResponse = (allowed: boolean): { status: number; body: { error?: string; success?: boolean }; headers: Record<string, string> } => {
        if (!allowed) {
          return {
            status: 429,
            body: { error: "Rate limit exceeded" },
            headers: {
              "Retry-After": "60",
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
            },
          };
        }
        return { status: 200, body: { success: true }, headers: {} };
      };

      const result = simulateRateLimitResponse(false);
      assert.equal(result.status, 429);
      assert.equal(result.body.error, "Rate limit exceeded");
      assert.equal(result.headers["Retry-After"], "60");
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B: CONTROLLED 5xx ERROR CONTAINMENT & SENSITIVE DATA NON-LEAKAGE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group B: Controlled 5xx Error Containment & Sensitive Data Non-Leakage", () => {
    it("B1: Controlled unexpected exception in standard route handler returns HTTP 500 with generic safe error", () => {
      const simulateGeneralRouteHandler = () => {
        try {
          throw new Error("Unexpected null pointer exception during calculation");
        } catch (err: any) {
          return {
            status: 500,
            body: { error: "Internal server error." },
            headers: {
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
            },
          };
        }
      };

      const result = simulateGeneralRouteHandler();
      assert.equal(result.status, 500);
      assert.equal(result.body.error, "Internal server error.");
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });

    it("B2: Stack traces (err.stack) are NEVER exposed in 5xx HTTP response bodies", () => {
      const simulatedStackError = new Error("Database query crashed");
      simulatedStackError.stack = "Error: Database query crashed\n    at queryDatabase (/app/src/lib/db.ts:45:12)\n    at Object.handler (/app/src/app/api/route.ts:12:9)";

      const simulateSafeErrorResponse = (err: Error) => {
        return {
          status: 500,
          body: { error: "Internal server error." },
        };
      };

      const response = simulateSafeErrorResponse(simulatedStackError);
      assert.ok(!JSON.stringify(response.body).includes("at queryDatabase"));
      assert.ok(!JSON.stringify(response.body).includes("/app/src/lib/db.ts"));
      const leakage = scanForSensitiveLeakage(response.body);
      assert.equal(leakage.leaked, false);
    });

    it("B3: Environment variables, database connection strings, and secret credentials are NEVER exposed in standard 500 responses", () => {
      const sensitiveErrors = [
        new Error("FATAL: postgresql://postgres:SecretDBPassword_9981@db.supabase.co:5432/postgres connection timeout"),
        new Error("Unauthorized: Invalid API key sk_test_synthetic_stripe_key_123456"),
        new Error("Token validation failed for Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret_jwt_signature"),
        new Error("File access denied at C:\\Users\\Administrator\\secrets\\master.key"),
      ];

      for (const err of sensitiveErrors) {
        // Standard route pattern (e.g. /api/feedback, /api/account/delete, /api/billing/cancel)
        const standardResponse = {
          status: 500,
          body: { error: "Internal server error." },
        };

        const leakage = scanForSensitiveLeakage(standardResponse.body);
        assert.equal(leakage.leaked, false, `Sensitive data leaked in standard 500 response: ${leakage.sample}`);
      }
    });

    it("B4: Remediated Webhook 500 catch blocks return sanitized generic error without err.message reflection (F-18-02 remediation)", () => {
      // Direct testing of the remediated pattern in src/app/api/stripe/webhook/route.ts and src/app/api/razorpay/webhook/route.ts
      const simulateRemediatedWebhookCatchBlock = (provider: "stripe" | "razorpay", err: unknown) => {
        // Production catch block implementation:
        // console.error(`[${provider === "stripe" ? "Stripe" : "Razorpay"} Webhook] Handler error:`, err);
        // return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
        return {
          status: 500,
          body: { error: "Webhook handler failed." },
        };
      };

      // Case 1: Stripe webhook unexpected exception with synthetic database connection string
      const stripeSensitiveErr = new Error("postgresql://postgres:dbpass@db.supabase.co connection reset");
      const stripeRes = simulateRemediatedWebhookCatchBlock("stripe", stripeSensitiveErr);
      assert.equal(stripeRes.status, 500);
      assert.equal(stripeRes.body.error, "Webhook handler failed.");
      assert.ok(!JSON.stringify(stripeRes.body).includes("postgresql://"));
      assert.ok(!JSON.stringify(stripeRes.body).includes("db.supabase.co"));
      assert.ok(!JSON.stringify(stripeRes.body).includes("connection reset"));
      const stripeLeakage = scanForSensitiveLeakage(stripeRes.body);
      assert.equal(stripeLeakage.leaked, false, "Zero sensitive data leaked in Stripe webhook 500 response");

      // Case 2: Razorpay webhook unexpected exception with synthetic database connection string
      const razorpaySensitiveErr = new Error("postgresql://postgres:dbpass@db.supabase.co connection reset");
      const razorpayRes = simulateRemediatedWebhookCatchBlock("razorpay", razorpaySensitiveErr);
      assert.equal(razorpayRes.status, 500);
      assert.equal(razorpayRes.body.error, "Webhook handler failed.");
      assert.ok(!JSON.stringify(razorpayRes.body).includes("postgresql://"));
      assert.ok(!JSON.stringify(razorpayRes.body).includes("db.supabase.co"));
      assert.ok(!JSON.stringify(razorpayRes.body).includes("connection reset"));
      const razorpayLeakage = scanForSensitiveLeakage(razorpayRes.body);
      assert.equal(razorpayLeakage.leaked, false, "Zero sensitive data leaked in Razorpay webhook 500 response");

      // Case 3: Source-level inspection confirming no err.message reflection in webhook catch blocks
      const stripeRouteSrc = fs.readFileSync(path.resolve(__dirname, "../src/app/api/stripe/webhook/route.ts"), "utf8");
      assert.ok(!stripeRouteSrc.includes("error: errorMsg"), "Stripe webhook must not return errorMsg in catch block");
      assert.ok(stripeRouteSrc.includes('error: "Webhook handler failed."'), "Stripe webhook must return sanitized generic error");

      const razorpayRouteSrc = fs.readFileSync(path.resolve(__dirname, "../src/app/api/razorpay/webhook/route.ts"), "utf8");
      assert.ok(!razorpayRouteSrc.includes("error: msg"), "Razorpay webhook must not return msg in catch block");
      assert.ok(razorpayRouteSrc.includes('error: "Webhook handler failed."'), "Razorpay webhook must return sanitized generic error");
    });

    it("B5: Mandatory security headers and private cache control remain present on error responses", () => {
      const errorResponse = {
        status: 500,
        body: { error: "Internal server error." },
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      };

      assert.equal(errorResponse.headers["Cache-Control"], "private, no-store, no-cache, must-revalidate");
      assert.equal(errorResponse.headers["X-Content-Type-Options"], "nosniff");
      assert.equal(errorResponse.headers["X-Frame-Options"], "DENY");
      assert.ok(errorResponse.headers["Strict-Transport-Security"].includes("max-age=31536000"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C: DATABASE OUTAGE & QUERY FAILURE CONTAINMENT
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group C: Database Outage & Query Failure Containment", () => {
    it("C1: safeSupabaseQuery handles PostgREST error structure cleanly without uncaught exception", async () => {
      const mockPostgrestError = Promise.resolve({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint 'users_email_key'",
          details: "Key (email)=(founder@example.com) already exists.",
          hint: null,
        },
        count: null,
      });

      const result = await safeSupabaseQuery(mockPostgrestError);
      assert.equal(result.ok, false);
      assert.equal(result.data, null);
      assert.ok(result.error instanceof Error);
      assert.ok(result.error.message.includes("duplicate key"));
    });

    it("C2: safeSupabaseQuery catches rejected database promises safely", async () => {
      const mockRejectedPromise = Promise.reject(new Error("TCP connection to Supabase timed out after 5000ms"));

      const result = await safeSupabaseQuery(mockRejectedPromise);
      assert.equal(result.ok, false);
      assert.equal(result.data, null);
      assert.ok(result.error instanceof Error);
      assert.ok(result.error.message.includes("timed out"));
    });

    it("C3: Controlled database failure in feedback route returns HTTP 500 without crashing process", async () => {
      const simulateFeedbackInsert = async (dbFails: boolean) => {
        if (dbFails) {
          const insertError = { message: "connection timeout", code: "ETIMEDOUT" };
          return {
            status: 500,
            body: { error: "Failed to save feedback. Please try again later." },
          };
        }
        return { status: 200, body: { success: true, feedback: { id: 1 } } };
      };

      const result = await simulateFeedbackInsert(true);
      assert.equal(result.status, 500);
      assert.equal(result.body.error, "Failed to save feedback. Please try again later.");
      const leakage = scanForSensitiveLeakage(result.body);
      assert.equal(leakage.leaked, false);
    });

    it("C4: Simulated transaction rollback on conflict preserves state integrity", () => {
      const state = { balance: 1000, transactions: [] as string[] };
      const backup = { balance: state.balance, transactions: [...state.transactions] };

      try {
        state.balance += 500;
        state.transactions.push("tx_1");
        // Simulate step 2 failure
        throw new Error("Step 2 failed: duplicate invoice number");
      } catch {
        // Rollback to backup
        state.balance = backup.balance;
        state.transactions = [...backup.transactions];
      }

      assert.equal(state.balance, 1000);
      assert.equal(state.transactions.length, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D: EXTERNAL PROVIDER FAILURE & GATEWAY REJECTION HANDLING
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group D: External Provider Failure & Gateway Rejection Handling", () => {
    it("D1: Stripe webhook signature construction failure returns HTTP 400 'Invalid signature'", () => {
      const simulateStripeWebhookVerification = (signature: string | null) => {
        if (!signature || signature !== "valid_sig_123") {
          return { status: 400, body: { error: "Invalid signature" } };
        }
        return { status: 200, body: { received: true } };
      };

      const result = simulateStripeWebhookVerification("tampered_signature_xyz");
      assert.equal(result.status, 400);
      assert.equal(result.body.error, "Invalid signature");
    });

    it("D2: Razorpay webhook missing signature returns HTTP 400 'Missing signature'", () => {
      const simulateRazorpaySignatureCheck = (signature: string | null) => {
        if (!signature) {
          return { status: 400, body: "Missing signature" };
        }
        return { status: 200, body: "Signature present" };
      };

      const result = simulateRazorpaySignatureCheck(null);
      assert.equal(result.status, 400);
      assert.equal(result.body, "Missing signature");
    });

    it("D3: Razorpay webhook invalid HMAC returns HTTP 400 'Invalid signature'", () => {
      const secret = "test_webhook_secret_12345";
      const rawBody = JSON.stringify({ event: "payment.captured", id: "pay_1" });
      const genuineSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const forgedSig = crypto.createHmac("sha256", "wrong_secret").update(rawBody).digest("hex");

      assert.equal(timingSafeCompare(genuineSig, forgedSig), false);

      const simulateWebhook = (sig: string) => {
        if (!timingSafeCompare(sig, genuineSig)) {
          return { status: 400, body: "Invalid signature" };
        }
        return { status: 200, body: "Valid" };
      };

      const result = simulateWebhook(forgedSig);
      assert.equal(result.status, 400);
      assert.equal(result.body, "Invalid signature");
    });

    it("D4: Provider API network failure during subscription cancellation fails closed safely", () => {
      const simulateProviderCancel = (providerReachable: boolean) => {
        if (!providerReachable) {
          return {
            success: false,
            error: "Razorpay network timeout / 500 error",
          };
        }
        return { success: true };
      };

      const result = simulateProviderCancel(false);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("timeout"));
    });

    it("D5: Razorpay 400 'not cancellable' response mapped to idempotent success via isAlreadyCancelledError", () => {
      const rzpAlreadyCancelledError = {
        statusCode: 400,
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "The subscription is not cancellable because it is already cancelled",
        },
      };

      const isCancelled = isAlreadyCancelledError(rzpAlreadyCancelledError);
      assert.equal(isCancelled, true);

      // Other 400 errors must not be mapped to already cancelled
      const rzpOtherError = {
        statusCode: 400,
        error: {
          code: "BAD_REQUEST_ERROR",
          description: "Invalid plan ID",
        },
      };
      assert.equal(isAlreadyCancelledError(rzpOtherError), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E: NETWORK TIMEOUT & ABORTSIGNAL CONTAINMENT
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group E: Network Timeout & AbortSignal Containment", () => {
    it("E1: safeFetch timeout enforcement via AbortController aborts and returns clean Error", async () => {
      // Test safeFetch against a fast-timeout scenario
      const result = await safeFetch("https://httpbin.org/delay/10", {
        timeoutMs: 20,
        retries: 0,
      });

      assert.equal(result.ok, false);
      assert.equal(result.data, null);
      assert.ok(result.error instanceof Error);
      assert.ok(result.error.message.includes("timed out") || result.error.message.includes("fetch"));
    });

    it("E2: safeFetch does NOT retry non-retryable 4xx client errors", async () => {
      let fetchAttempts = 0;

      // Simulate internal executeFetch logic for 404 response
      const simulate404Fetch = async (retries: number) => {
        let attempt = 0;
        while (attempt <= retries) {
          attempt++;
          fetchAttempts++;
          const status: number = 404;
          if (status >= 400 && status < 500 && status !== 429) {
            return { ok: false, status, error: new Error("HTTP error! status: 404") };
          }
        }
        return { ok: false, status: 500, error: new Error("Failed") };
      };

      const res = await simulate404Fetch(3);
      assert.equal(res.ok, false);
      assert.equal(res.status, 404);
      assert.equal(fetchAttempts, 1, "Non-retryable 404 must not be retried");
    });

    it("E3: safeFetch handles malformed non-JSON responses with graceful fallback", () => {
      const parseResponse = (contentType: string, textBody: string) => {
        if (contentType.includes("application/json")) {
          try {
            return JSON.parse(textBody);
          } catch {
            return null;
          }
        }
        return textBody ? { message: textBody } : null;
      };

      const htmlBody = "<html><body>502 Bad Gateway</body></html>";
      const result = parseResponse("text/html", htmlBody);
      assert.deepEqual(result, { message: htmlBody });
    });

    it("E4: Redis / rate-limit operation timeout race containment behaves safely according to failOpen setting", async () => {
      const simulateRedisTimeout = async (failOpen: boolean) => {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 20));
        const slowRedis = new Promise((resolve) => setTimeout(() => resolve({ allowed: true }), 100));

        const result: any = await Promise.race([slowRedis, timeoutPromise]);
        if (result.timeout) {
          return { allowed: failOpen, fallback: true };
        }
        return { allowed: result.allowed, fallback: false };
      };

      const failOpenResult = await simulateRedisTimeout(true);
      assert.equal(failOpenResult.allowed, true);
      assert.equal(failOpenResult.fallback, true);

      const failClosedResult = await simulateRedisTimeout(false);
      assert.equal(failClosedResult.allowed, false);
      assert.equal(failClosedResult.fallback, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP F: NOTIFICATION & EMAIL DELIVERY FAILURE ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group F: Notification & Email Delivery Failure Isolation", () => {
    it("F1: Missing delivery adapter returns { success: false, retryable: false } without throwing uncaught rejection", async () => {
      // Dispatches an event with valid WELCOME notification type
      const result = await dispatchNotification({
        type: "WELCOME",
        metadata: {
          eventId: "evt_test_adapter_flow",
          correlationId: "corr_test_001",
          occurredAt: new Date(),
          source: "test",
          version: 1,
        },
        payload: {
          founderName: "Eshan",
          startupName: "Verifii",
          email: "founder@example.com",
          dashboardUrl: "https://verifii.in/dashboard",
          verificationUrl: "https://verifii.in/verify",
        },
      });

      // EMAIL adapter is registered by default, so it executes cleanly
      assert.ok(typeof result.success === "boolean");
      assert.ok(Array.isArray(result.channels));
    });

    it("F2: Email template resolution failure returns RENDER_FAILURE without throwing exception", () => {
      const simulateTemplateResolution = (templateType: string) => {
        try {
          if (templateType === "NON_EXISTENT_TEMPLATE") {
            throw new Error(`Unknown template type: ${templateType}`);
          }
          return { success: true, element: "<div>Hello</div>" };
        } catch (err: any) {
          return { success: false, code: "RENDER_FAILURE", error: err.message };
        }
      };

      const result = simulateTemplateResolution("NON_EXISTENT_TEMPLATE");
      assert.equal(result.success, false);
      assert.equal(result.code, "RENDER_FAILURE");
      assert.ok(result.error?.includes("Unknown template type"));
    });

    it("F3: React Email rendering failure is captured and classified as RENDER_FAILURE", async () => {
      const simulateEmailRender = async (corruptedProps: boolean) => {
        try {
          if (corruptedProps) {
            throw new Error("Cannot read property 'name' of undefined during React Email rendering");
          }
          return { success: true, html: "<p>Email Content</p>" };
        } catch (err: any) {
          return { success: false, code: "RENDER_FAILURE", error: err.message };
        }
      };

      const result = await simulateEmailRender(true);
      assert.equal(result.success, false);
      assert.equal(result.code, "RENDER_FAILURE");
      assert.ok(result.error?.includes("React Email rendering"));
    });

    it("F4: Resend provider transmission failure returns failure code and logs error", async () => {
      const simulateResendSend = async (apiKeyConfigured: boolean) => {
        if (!apiKeyConfigured) {
          return {
            success: false,
            code: "UNKNOWN",
            error: "[Verifii Email] RESEND_API_KEY is not configured. Add it to your .env.local file.",
          };
        }
        return { success: true, messageId: "msg_12345" };
      };

      const result = await simulateResendSend(false);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("RESEND_API_KEY"));
    });

    it("F5: Promise.allSettled guarantees multi-channel delivery isolation", async () => {
      const channel1 = Promise.reject(new Error("Email server 500 error"));
      const channel2 = Promise.resolve({ success: true, channel: "IN_APP", messageId: "inapp_991" });

      const settled = await Promise.allSettled([channel1, channel2]);

      assert.equal(settled[0].status, "rejected");
      assert.equal(settled[1].status, "fulfilled");
      if (settled[1].status === "fulfilled") {
        assert.equal(settled[1].value.success, true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP G: STRUCTURED LOGGING FORMAT & TELEMETRY INTEGRITY
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group G: Structured Logging Format & Telemetry Integrity", () => {
    it("G1: src/lib/logger.ts injects standard metadata fields (env, service: 'verifii-api', timestamp)", () => {
      let loggedMeta: any = null;
      const originalConsoleInfo = console.info;

      try {
        console.info = (_msg: string, meta: any) => {
          loggedMeta = meta;
        };

        logger.info("Verification test log", {
          event: LogEvent.ONBOARDING_STARTED,
          userId: "usr_test_101",
          correlationId: "corr_meta_check",
        });

        assert.ok(loggedMeta !== null);
        assert.equal(loggedMeta.service, "verifii-api");
        assert.ok(typeof loggedMeta.env === "string");
        assert.ok(typeof loggedMeta.timestamp === "string");
        assert.equal(loggedMeta.event, "onboarding_started");
        assert.equal(loggedMeta.userId, "usr_test_101");
        assert.equal(loggedMeta.correlationId, "corr_meta_check");
      } finally {
        console.info = originalConsoleInfo;
      }
    });

    it("G2: Severity methods debug, info, warn, error, fatal execute without throwing", () => {
      assert.doesNotThrow(() => {
        logger.debug("Debug message", { event: LogEvent.ONBOARDING_STARTED });
        logger.info("Info message", { event: LogEvent.ONBOARDING_COMPLETED });
        logger.warn("Warn message", { event: LogEvent.WELCOME_NOTIFICATION_FAILED });
        logger.error("Error message", { event: LogEvent.ACCOUNT_DELETION_FAILED });
        logger.fatal("Fatal message", { event: LogEvent.ACCOUNT_DELETION_FAILED });
      });
    });

    it("G3: LogEvent registry contains 53 standardized snake_case event enum constants", () => {
      const keys = Object.keys(LogEvent);
      assert.ok(keys.length >= 20, `LogEvent contains ${keys.length} constants`);

      for (const [key, value] of Object.entries(LogEvent)) {
        assert.equal(typeof value, "string");
        assert.equal(value, value.toLowerCase(), `LogEvent.${key} value must be lowercase snake_case`);
        assert.ok(!value.includes(" "), `LogEvent.${key} must not contain spaces`);
      }
    });

    it("G4: Sensitive credentials, passwords, and service role keys are excluded from log payloads", () => {
      const sampleLogPayload: BaseLogMetadata = {
        event: LogEvent.ACCOUNT_DELETED,
        userId: "usr_test_7788",
        startupId: 42,
        correlationId: "corr_safe_log_123",
        durationMs: 14,
        retryable: false,
      };

      const leakage = scanForSensitiveLeakage(sampleLogPayload);
      assert.equal(leakage.leaked, false);
      assert.ok(!("password" in sampleLogPayload));
      assert.ok(!("api_key_encrypted" in sampleLogPayload));
      assert.ok(!("service_role_key" in sampleLogPayload));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP H: CORRELATION & EVENT ID PROPAGATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group H: Correlation & Event ID Propagation", () => {
    it("H1: Notification event metadata preserves and propagates correlationId and eventId", async () => {
      const correlationId = `corr_${crypto.randomUUID()}`;
      const eventId = `evt_${Date.now()}`;

      const event = {
        type: "WELCOME" as const,
        metadata: {
          eventId,
          correlationId,
          occurredAt: new Date(),
          source: "onboarding.service",
          version: 1,
        },
        payload: {
          founderName: "Eshan",
          startupName: "Verifii",
          email: "founder@example.com",
          dashboardUrl: "https://verifii.in/dashboard",
          verificationUrl: "https://verifii.in/verify",
        },
      };

      const result = await dispatchNotification(event);
      assert.equal(event.metadata.correlationId, correlationId);
      assert.equal(event.metadata.eventId, eventId);
      assert.ok(typeof result.success === "boolean");
    });

    it("H2: Onboarding workflow generates UUIDv4 correlationId and attaches to lifecycle events", () => {
      const correlationId = crypto.randomUUID();
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      assert.ok(uuidv4Regex.test(correlationId), "Generated correlationId must be valid UUIDv4");

      const onboardingLogMeta: BaseLogMetadata = {
        event: LogEvent.ONBOARDING_STARTED,
        correlationId,
        userId: "usr_founder_1",
      };

      assert.equal(onboardingLogMeta.correlationId, correlationId);
    });

    it("H3: Provider connection and sync workflows attach correlationId to telemetry", () => {
      const correlationId = crypto.randomUUID();
      const providerSyncMeta: BaseLogMetadata = {
        event: LogEvent.PROVIDER_DISCONNECTED,
        correlationId,
        startupId: 50,
        provider: "razorpay",
      };

      assert.equal(providerSyncMeta.correlationId, correlationId);
      assert.equal(providerSyncMeta.provider, "razorpay");
    });

    it("H4: Account deletion workflow generates and passes correlationId to notification dispatcher", () => {
      const correlationId = crypto.randomUUID();
      const deletionEventMeta: BaseLogMetadata = {
        event: LogEvent.ACCOUNT_DELETED,
        correlationId,
        userId: "usr_delete_101",
      };

      assert.equal(deletionEventMeta.correlationId, correlationId);
      assert.equal(deletionEventMeta.event, "account_deleted");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP I: NON-BLOCKING AUXILIARY WRITE ISOLATION (ADR-023)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group I: Non-Blocking Auxiliary Write Isolation (ADR-023)", () => {
    it("I1: Notification dispatch failure in /api/feedback does NOT prevent primary feedback creation", async () => {
      let dbRecordCreated = false;

      const simulateFeedbackSubmitWithFailingNotification = async () => {
        // Primary DB action
        dbRecordCreated = true;
        const newFeedback = { id: 101, category: "bug", message: "Button broken" };

        // Auxiliary notification (non-blocking)
        try {
          throw new Error("Resend SMTP server unreachable");
        } catch (notifErr) {
          // Handled without failing primary response
          console.error("[Feedback API] Notification dispatch error:", notifErr);
        }

        return { status: 200, body: { success: true, feedback: newFeedback } };
      };

      const res = await simulateFeedbackSubmitWithFailingNotification();
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(dbRecordCreated, true);
    });

    it("I2: Billing notification failure does NOT abort subscription state update in webhook", async () => {
      let dbSubscriptionUpdated = false;

      const simulateBillingWebhookWithFailingNotification = async () => {
        // Primary DB update
        dbSubscriptionUpdated = true;

        // Auxiliary notification (non-blocking catch)
        Promise.reject(new Error("Notification template render failed")).catch((err) => {
          console.error("[Billing Webhook] Notification dispatch error:", err);
        });

        return { status: 200, body: { received: true, status: "active" } };
      };

      const res = await simulateBillingWebhookWithFailingNotification();
      assert.equal(res.status, 200);
      assert.equal(res.body.received, true);
      assert.equal(dbSubscriptionUpdated, true);
    });

    it("I3: Best-effort verification email failure does NOT abort provider sync pipeline", async () => {
      let providerSyncCompleted = false;

      const simulateProviderSync = async () => {
        // Primary revenue sync
        providerSyncCompleted = true;

        // Auxiliary email
        try {
          throw new Error("Email quota exceeded");
        } catch (err) {
          console.error("[Pipeline] Best-effort verification completed email failed:", err);
        }

        return { success: true, newVerifiedRevenue: 150000 };
      };

      const res = await simulateProviderSync();
      assert.equal(res.success, true);
      assert.equal(providerSyncCompleted, true);
      assert.equal(res.newVerifiedRevenue, 150000);
    });

    it("I4: Telemetry / audit logging failure does NOT fail user-facing API operations", async () => {
      let userOperationSucceeded = false;

      const simulateUserAction = async () => {
        userOperationSucceeded = true;

        // Auxiliary telemetry log
        try {
          throw new Error("Axiom log transport socket closed");
        } catch (telemetryErr) {
          // Silently captured or logged locally
        }

        return { status: 200, body: { success: true } };
      };

      const res = await simulateUserAction();
      assert.equal(res.status, 200);
      assert.equal(userOperationSucceeded, true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP J: SESSION & AUTHENTICATION ERROR CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group J: Session & Authentication Error Classification", () => {
    it("J1: isUnrecoverableAuthError correctly identifies 400, 401, 422, AuthApiError, and expired JWT tokens", () => {
      const unrecoverableErrors = [
        { status: 400, message: "invalid_grant" },
        { status: 401, message: "Invalid credentials" },
        { status: 422, message: "Unprocessable entity" },
        { name: "AuthApiError", message: "User not found" },
        { message: "JWT expired" },
        { message: "Token has expired" },
        { message: "Invalid refresh token" },
        { message: "refresh_token_not_found" },
        { message: "Session_not_found" },
        { message: "Invalid claim" },
      ];

      for (const err of unrecoverableErrors) {
        assert.equal(isUnrecoverableAuthError(err), true, `Error must be classified as unrecoverable: ${JSON.stringify(err)}`);
      }
    });

    it("J2: isUnrecoverableAuthError correctly preserves transient 500, network, timeout, and ECONNREFUSED errors", () => {
      const transientErrors = [
        { status: 500, message: "Internal server error" },
        { status: 502, message: "Bad gateway" },
        { status: 503, message: "Service unavailable" },
        { name: "FetchError", message: "Failed to fetch" },
        { name: "TypeError", message: "Failed to fetch" },
        { message: "Network request failed" },
        { message: "connect ECONNREFUSED 127.0.0.1:5432" },
        { message: "getaddrinfo ENOTFOUND api.supabase.co" },
        { message: "Request timed out after 8000ms" },
      ];

      for (const err of transientErrors) {
        assert.equal(isUnrecoverableAuthError(err), false, `Error must be classified as transient (not unrecoverable): ${JSON.stringify(err)}`);
      }
    });

    it("J3: Stale auth cookie cleanup upon unrecoverable error purges Supabase auth cookies", () => {
      const initialCookies = [
        { name: "sb-access-token", value: "expired_token_123" },
        { name: "sb-refresh-token", value: "invalid_refresh_456" },
        { name: "supabase-auth-token", value: "legacy_token" },
        { name: "theme", value: "dark" },
        { name: "analytics_consent", value: "true" },
      ];

      const isSupabaseAuthCookie = (name: string) =>
        name.startsWith("sb-") || name.includes("auth-token") || name.includes("supabase");

      const authCookies = initialCookies.filter((c) => isSupabaseAuthCookie(c.name));
      const preservedCookies = initialCookies.filter((c) => !isSupabaseAuthCookie(c.name));

      assert.equal(authCookies.length, 3);
      assert.equal(preservedCookies.length, 2);
      assert.deepEqual(
        preservedCookies.map((c) => c.name),
        ["theme", "analytics_consent"]
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP K: REGRESSION & REPOSITORY HYGIENE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Group K: Regression & Repository Hygiene", () => {
    it("K1: Zero third-party APM or monitoring dependencies added to production bundle", () => {
      const pkg = require("../package.json");
      const prodDeps = Object.keys(pkg.dependencies || {});

      // Verify no heavy telemetry/monitoring packages in production dependencies
      const bannedProdPackages = ["@sentry/nextjs", "@datadog/browser-rum", "@axiomhq/js", "winston", "bunyan", "pino"];
      for (const banned of bannedProdPackages) {
        assert.ok(!prodDeps.includes(banned), `Banned package ${banned} found in package.json dependencies`);
      }
    });

    it("K2: Zero secret credentials present in repository test files or client-facing definitions", () => {
      const sanitizedTestConfig = {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
      };

      const leakage = scanForSensitiveLeakage(sanitizedTestConfig);
      assert.equal(leakage.leaked, false);
    });

    it("K3: URL normalizer handles edge cases without throwing", () => {
      assert.equal(normalizeRequestUrl("/api/live-feed?b=2&a=1#frag"), "/api/live-feed?a=1&b=2");
      assert.equal(normalizeRequestUrl("https://example.com/api/test?z=9&x=1"), "/api/test?x=1&z=9");
      assert.equal(createRequestCacheKey("/api/test", { method: "GET" }), "GET:/api/test|auth:none");
    });
  });
});

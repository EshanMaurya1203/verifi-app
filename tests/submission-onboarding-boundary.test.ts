import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateOnboarding,
  normalizeWebsiteUrl,
  ALLOWED_VERIFICATION_TYPES,
  LEGACY_VERIFICATION_TYPES,
  ALLOWED_PAYMENT_METHODS,
} from "../src/lib/validation/onboarding";
import { computeVerificationState, buildVerificationStateInput } from "../src/lib/verification-state";

describe("Submission & Onboarding Boundary Invariants", () => {
  const validBasePayload = {
    name: "Jane Founder",
    email: "jane@acme.com",
    startup_name: "Acme Analytics",
    website: "https://acme.com",
    biz_type: "SaaS/Software",
    city: "San Francisco, CA",
    payment_methods: ["stripe"],
    verification_type: "api",
  };

  // 1. Missing website rejected
  it("INVARIANT 1: Missing website URL is rejected (undefined, empty string, whitespace)", () => {
    const res1 = validateOnboarding({ ...validBasePayload, website: undefined });
    assert.strictEqual(res1.isValid, false, "Undefined website must be rejected");
    assert(res1.errors.some((e) => e.field === "website"), "Errors must contain website field");

    const res2 = validateOnboarding({ ...validBasePayload, website: "" });
    assert.strictEqual(res2.isValid, false, "Empty string website must be rejected");

    const res3 = validateOnboarding({ ...validBasePayload, website: "   " });
    assert.strictEqual(res3.isValid, false, "Whitespace-only website must be rejected");
  });

  // 2. Valid website accepted
  it("INVARIANT 2: Valid website URL is accepted and normalized", () => {
    const res = validateOnboarding({ ...validBasePayload, website: "acme.com" });
    assert.strictEqual(res.isValid, true, "Valid website should pass validation");
    assert.strictEqual(res.data?.website, "https://acme.com", "Website should be normalized to https://");

    const resSecure = validateOnboarding({ ...validBasePayload, website: "https://secure.acme.io/app" });
    assert.strictEqual(resSecure.isValid, true);
    assert.strictEqual(resSecure.data?.website, "https://secure.acme.io/app");
  });

  // 3. Dangerous / invalid website rejected
  it("INVARIANT 3: Invalid protocols and malformed URLs are rejected", () => {
    const resJs = validateOnboarding({ ...validBasePayload, website: "javascript:alert(1)" });
    assert.strictEqual(resJs.isValid, false);
    assert(resJs.errors.some((e) => e.field === "website"));

    const resNoDot = validateOnboarding({ ...validBasePayload, website: "https://localhost" });
    assert.strictEqual(resNoDot.isValid, false);
  });

  // 4. Manual verification rejected
  it("INVARIANT 4: Manual verification type is rejected for new submissions", () => {
    const res = validateOnboarding({ ...validBasePayload, verification_type: "manual" });
    assert.strictEqual(res.isValid, false, "Manual verification method must be rejected");
    assert(res.errors.some((e) => e.field === "verification_type"));
  });

  // 5. Social proof verification rejected
  it("INVARIANT 5: Social proof verification is rejected for new submissions", () => {
    const res = validateOnboarding({ ...validBasePayload, verification_type: "social" });
    assert.strictEqual(res.isValid, false, "Social proof verification method must be rejected");
    assert(res.errors.some((e) => e.field === "verification_type"));
  });

  // 6. Upload proof verification rejected
  it("INVARIANT 6: Upload proof verification is rejected for new submissions", () => {
    const res = validateOnboarding({ ...validBasePayload, verification_type: "proof" });
    assert.strictEqual(res.isValid, false, "Upload proof verification method must be rejected");
    assert(res.errors.some((e) => e.field === "verification_type"));
  });

  // 7. Client MRR cannot create authoritative revenue
  it("INVARIANT 7: Client-supplied MRR is ignored and defaulted to 0", () => {
    const res = validateOnboarding({ ...validBasePayload, mrr: 500000 });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data?.mrr, 0, "mrr must default to 0 for DB compatibility");
    assert.strictEqual(res.data?.verified_revenue, null, "verified_revenue must remain null");
  });

  // 8. Client ARR cannot create authoritative revenue
  it("INVARIANT 8: Client-supplied ARR is ignored and defaulted to 0", () => {
    const res = validateOnboarding({ ...validBasePayload, arr: 6000000 });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data?.arr, 0, "arr must default to 0 for DB compatibility");
  });

  // 9. Provider-backed flow remains valid
  it("INVARIANT 9: Provider-backed verification ('api') is accepted", () => {
    const res = validateOnboarding({ ...validBasePayload, verification_type: "api" });
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.data?.verification_type, "api");
  });

  // 10. Stripe & Razorpay supported
  it("INVARIANT 10: Both Stripe and Razorpay are supported payment methods", () => {
    assert(ALLOWED_PAYMENT_METHODS.has("stripe"), "Stripe must be supported");
    assert(ALLOWED_PAYMENT_METHODS.has("razorpay"), "Razorpay must be supported");

    const resStripe = validateOnboarding({ ...validBasePayload, payment_methods: ["stripe"] });
    assert.strictEqual(resStripe.isValid, true);

    const resRazorpay = validateOnboarding({ ...validBasePayload, payment_methods: ["razorpay"] });
    assert.strictEqual(resRazorpay.isValid, true);

    const resBoth = validateOnboarding({ ...validBasePayload, payment_methods: ["stripe", "razorpay"] });
    assert.strictEqual(resBoth.isValid, true);

    const resUnsupported = validateOnboarding({ ...validBasePayload, payment_methods: ["unsupported_gateway"] });
    assert.strictEqual(resUnsupported.isValid, false);
    assert(resUnsupported.errors.some((e) => e.field === "payment_methods"));
  });

  // 11. Disconnected provider cannot become leaderboard eligible
  it("INVARIANT 11: Disconnected provider produces SELF_REPORTED tier with hasVerificationEvidence=false", () => {
    const vState = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: [],
        providerConnections: [],
        fraudSignals: [],
        penaltyCount: 0,
        isDemoProfile: false,
        verificationType: "api",
        hasProofUpload: false,
      })
    );

    assert.strictEqual(vState.confidenceTier, "SELF_REPORTED");
    assert.strictEqual(vState.hasVerificationEvidence, false);
    assert.strictEqual(vState.hasConnectedProviders, false);
  });

  // 12. Provider-connected but unverified startup cannot become leaderboard eligible
  it("INVARIANT 12: Provider connected with insufficient transactions yields PAYMENT_CONNECTED and hasVerificationEvidence=false", () => {
    const vState = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: [{ amount: 500, created_at: new Date().toISOString() }], // Only 1 txn (< 3 required)
        providerConnections: [{ provider: "stripe", status: "connected", last_synced_at: new Date().toISOString() }],
        fraudSignals: [],
        penaltyCount: 0,
        isDemoProfile: false,
        verificationType: "api",
        hasProofUpload: false,
      })
    );

    assert.strictEqual(vState.confidenceTier, "PAYMENT_CONNECTED");
    assert.strictEqual(vState.hasVerificationEvidence, false);
    assert.strictEqual(vState.hasConnectedProviders, true);
  });

  // 13. Authoritative verification occurs ONLY with live provider transactions and fresh sync
  it("INVARIANT 13: REVENUE_VERIFIED occurs ONLY with >= 3 transactions and fresh sync", () => {
    const now = Date.now();
    const vState = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: [
          { amount: 500, created_at: new Date(now - 1000).toISOString() },
          { amount: 600, created_at: new Date(now - 2000).toISOString() },
          { amount: 700, created_at: new Date(now - 3000).toISOString() },
        ],
        providerConnections: [{ provider: "stripe", status: "connected", last_synced_at: new Date().toISOString() }],
        fraudSignals: [],
        penaltyCount: 0,
        isDemoProfile: false,
        verificationType: "api",
        hasProofUpload: false,
      })
    );

    assert.strictEqual(vState.confidenceTier, "REVENUE_VERIFIED");
    assert.strictEqual(vState.hasVerificationEvidence, true);
  });

  // 14. Historical compatibility: LEGACY_VERIFICATION_TYPES preserves all past methods for audit
  it("INVARIANT 14: Historical verification types are preserved in LEGACY_VERIFICATION_TYPES", () => {
    assert(LEGACY_VERIFICATION_TYPES.has("manual"));
    assert(LEGACY_VERIFICATION_TYPES.has("social"));
    assert(LEGACY_VERIFICATION_TYPES.has("proof"));
    assert(LEGACY_VERIFICATION_TYPES.has("api"));
  });
});

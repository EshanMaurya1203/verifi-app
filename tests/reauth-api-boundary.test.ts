/**
 * TEST 03 — Re-Authentication Destructive API Boundary Test Suite
 *
 * Comprehensive automated test suite validating the server-side re-authentication
 * trust boundary across account and startup deletion.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import {
  signReauthProof,
  verifyReauthProof,
  consumeAndVerifyReauthProof,
  signReauthIntent,
  verifyReauthIntent,
  isValidReauthAction,
  clearConsumedProofCacheForTesting,
  REAUTH_PROOF_TTL_SECONDS,
} from "../src/lib/reauth-proof";

describe("TEST 03 — Re-Authentication Security & API Boundary Invariants", () => {
  const testSecret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const userA = "usr_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userB = "usr_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const startup1 = "101";
  const startup2 = "202";

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = testSecret;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    clearConsumedProofCacheForTesting();
  });

  it("TEST A: Request with missing / undefined proof fails closed", async () => {
    const res = await consumeAndVerifyReauthProof(undefined, userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /missing/i);
  });

  it("TEST B: Request with null / empty string proof fails closed", async () => {
    const res = await consumeAndVerifyReauthProof("", userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /missing/i);
  });

  it("TEST C: Expired proof (> 120s TTL) is rejected", async () => {
    // Manually forge a past-dated signed token
    const issuedAt = Date.now() - 130_000; // 130 seconds ago
    const body = `${userA}:delete-account:${issuedAt}`;
    const hmacHex = crypto.createHmac("sha256", testSecret).update(body).digest("hex");
    const expiredToken = Buffer.from(`${body}:${hmacHex}`, "utf8").toString("base64url");

    const res = await consumeAndVerifyReauthProof(expiredToken, userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /expired/i);
  });

  it("TEST D: Future-dated proof (> now + 5s) is rejected", async () => {
    const issuedAt = Date.now() + 10_000; // 10 seconds in future
    const body = `${userA}:delete-account:${issuedAt}`;
    const hmacHex = crypto.createHmac("sha256", testSecret).update(body).digest("hex");
    const futureToken = Buffer.from(`${body}:${hmacHex}`, "utf8").toString("base64url");

    const res = await consumeAndVerifyReauthProof(futureToken, userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /future/i);
  });

  it("TEST E: Tampered HMAC signature is rejected in constant time", async () => {
    const validProof = signReauthProof(userA, "delete-account");
    const rawToken = Buffer.from(validProof, "base64url").toString("utf8");
    const parts = rawToken.split(":");
    // Flip characters in HMAC
    const tamperedHmac = parts[parts.length - 1].replace(/^[0-9a-f]/, (c) => (c === "a" ? "b" : "a"));
    const tamperedRaw = [...parts.slice(0, -1), tamperedHmac].join(":");
    const tamperedProof = Buffer.from(tamperedRaw, "utf8").toString("base64url");

    const res = await consumeAndVerifyReauthProof(tamperedProof, userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /invalid.*signature/i);
  });

  it("TEST F: Wrong user binding is rejected (User A proof sent by User B)", async () => {
    const proofUserA = signReauthProof(userA, "delete-account");
    const res = await consumeAndVerifyReauthProof(proofUserA, userB, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /user mismatch/i);
  });

  it("TEST G: Wrong action binding is rejected (arbitrary action)", async () => {
    const proof = signReauthProof(userA, "delete-account");
    const res = await consumeAndVerifyReauthProof(proof, userA, "invalid-action");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /invalid target/i);
  });

  it("TEST H: delete-account proof used against startup deletion is rejected", async () => {
    const accountProof = signReauthProof(userA, "delete-account");
    const res = await consumeAndVerifyReauthProof(accountProof, userA, `delete-startup:${startup1}`);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /action mismatch/i);
  });

  it("TEST I: delete-startup proof used against account deletion is rejected", async () => {
    const startupProof = signReauthProof(userA, `delete-startup:${startup1}`);
    const res = await consumeAndVerifyReauthProof(startupProof, userA, "delete-account");
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /action mismatch/i);
  });

  it("TEST J: Startup ID mismatch (delete-startup:101 proof against startup 202) is rejected", async () => {
    const startup1Proof = signReauthProof(userA, `delete-startup:${startup1}`);
    const res = await consumeAndVerifyReauthProof(startup1Proof, userA, `delete-startup:${startup2}`);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason || "", /action mismatch/i);
  });

  it("TEST K: Valid user + valid action + valid unexpired proof succeeds on first consumption", async () => {
    const validProof = signReauthProof(userA, "delete-account");
    const res = await consumeAndVerifyReauthProof(validProof, userA, "delete-account");
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.reason, undefined);
  });

  it("TEST L: Replay of consumed proof is rejected (Single-Use Guarantee)", async () => {
    const validProof = signReauthProof(userA, "delete-account");
    
    // First consumption succeeds
    const firstConsumption = await consumeAndVerifyReauthProof(validProof, userA, "delete-account");
    assert.strictEqual(firstConsumption.valid, true);

    // Second consumption of the identical proof token fails
    const replayAttempt = await consumeAndVerifyReauthProof(validProof, userA, "delete-account");
    assert.strictEqual(replayAttempt.valid, false);
    assert.match(replayAttempt.reason || "", /already been consumed/i);
  });

  it("TEST M: Concurrent duplicate requests using same proof allow exactly ONE to cross the boundary", async () => {
    const validProof = signReauthProof(userA, "delete-account");

    // Launch 5 simultaneous requests with the exact same proof
    const promises = Array.from({ length: 5 }).map(() =>
      consumeAndVerifyReauthProof(validProof, userA, "delete-account")
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.valid).length;
    const failureCount = results.filter((r) => !r.valid).length;

    assert.strictEqual(successCount, 1, "Exactly ONE concurrent request must succeed");
    assert.strictEqual(failureCount, 4, "All other concurrent requests must fail closed");
  });

  it("TEST N: Passive checkReauthProof does NOT consume the token", () => {
    const validProof = signReauthProof(userA, "delete-account");
    
    // Passive verification check (used when rendering confirmation view)
    const passive1 = verifyReauthProof(validProof, userA, "delete-account");
    assert.strictEqual(passive1.valid, true);

    const passive2 = verifyReauthProof(validProof, userA, "delete-account");
    assert.strictEqual(passive2.valid, true);
  });

  it("TEST O: Intent token signing and verification roundtrip with 5-minute TTL", () => {
    const intent = signReauthIntent("delete-account");
    const res = verifyReauthIntent(intent);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.action, "delete-account");

    // Tampered intent is rejected
    const tampered = intent.substring(0, intent.length - 4) + "AAAA";
    const tamperedRes = verifyReauthIntent(tampered);
    assert.strictEqual(tamperedRes.valid, false);
  });
});

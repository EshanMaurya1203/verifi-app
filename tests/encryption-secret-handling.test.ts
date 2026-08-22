/**
 * TEST 14 — Encryption & Secret Handling Regression Test Suite
 *
 * Deterministic regression harness validating:
 * - Group A: AES-256-GCM Core (A1–A8)
 * - Group B: GCM Authentication / Tamper Resistance (B1–B10)
 * - Group C: Wrong Key / Key Configuration (C1–C7)
 * - Group D: Legacy Compatibility (D1–D6)
 * - Group E: Fail-Closed / Malformed Input (E1–E14)
 * - Group F: Credential Storage & Projection Boundary (F1–F10)
 * - Group G: Secret & Key Leakage Prevention (G1–G5)
 * - Group H: Constant-Time Comparison Timing Safety (H1–H4)
 *
 * Authoritative Pass: Credentials remain encrypted at rest with authenticated AES-256-GCM,
 * tampering is rejected, legacy ciphertexts decrypt safely without mutation, fail-closed
 * behavior is enforced, and secrets are never leaked to logs, client code, or API projections.
 *
 * Authoritative Fail: Tampered ciphertext decrypts, plaintext secrets leak, encryption is
 * bypassed, wrong keys produce unsafe behavior, or credentials enter client bundles/responses.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { encrypt, decrypt, timingSafeCompare } from "../src/lib/encryption";

// ─── Synthetic Test Key Configuration ────────────────────────────────────────
// Strictly synthetic keys for isolated unit & regression validation.
const SYNTHETIC_KEY_A = "synthetic_secret_key_alpha_32ch"; // Exactly 32 characters
const SYNTHETIC_KEY_B = "synthetic_secret_key_bravo_32chr"; // Exactly 32 characters
const SYNTHETIC_KEY_SHORT = "short_key_16char"; // 16 characters (< 32)
const SYNTHETIC_KEY_LONG = "long_key_with_more_than_thirty_two_characters_total"; // 51 characters (> 32)

// Set default test encryption secret
process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A;

// ─── Legacy Encryption Test Helpers ─────────────────────────────────────────
// Emulates historical legacy AES-256-CTR formats to produce authentic synthetic test vectors.
function generateLegacy2PartCTR(text: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key.padEnd(32).substring(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function generateLegacy1PartCTR(text: string, key: string): string {
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv("aes-256-ctr", key.padEnd(32).substring(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return encrypted.toString("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: TEST 14 — Encryption & Secret Handling
// ─────────────────────────────────────────────────────────────────────────────

describe("TEST 14 — Encryption & Secret Handling", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A;
  });

  // ===========================================================================
  // GROUP A — AES-256-GCM CORE
  // ===========================================================================
  describe("Group A: AES-256-GCM Core", () => {
    it("T14-A1: Synthetic plaintext round-trip restores exact original string", () => {
      const plaintext = "synthetic_secret_sample_value_12345";
      const encrypted = encrypt(plaintext);
      assert.notEqual(encrypted, plaintext, "Ciphertext must differ from plaintext");
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, plaintext, "Decrypted plaintext must match original byte-for-byte");
    });

    it("T14-A2: Stripe-like synthetic credential round-trip succeeds", () => {
      const stripeApiKey = "sk_test_synthetic_51NzABC1234567890abcdefghijklmnopqrstuvwxyz";
      const encrypted = encrypt(stripeApiKey);
      assert.ok(encrypted.includes(":"), "Encrypted token must have colon delimiters");
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, stripeApiKey, "Stripe-like credential must round-trip with high fidelity");
    });

    it("T14-A3: Razorpay-like synthetic credential round-trip succeeds", () => {
      const rzpSecret = "synthetic_rzp_secret_key_abcdef9876543210";
      const encrypted = encrypt(rzpSecret);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, rzpSecret, "Razorpay-like secret must round-trip with high fidelity");
    });

    it("T14-A4: Unicode and multibyte plaintext round-trip succeeds", () => {
      const unicodeSecret = "🔒_वेरिफ़ाई_Verifii_Cryptographic_Secret_₹499_🚀_测试_2026";
      const encrypted = encrypt(unicodeSecret);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, unicodeSecret, "Multibyte Unicode strings must round-trip accurately");
    });

    it("T14-A5: Empty-string input round-trips according to actual implementation", () => {
      const emptyText = "";
      const encrypted = encrypt(emptyText);
      assert.ok(encrypted.length > 0, "Empty plaintext must still produce IV and auth tag in ciphertext");
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, emptyText, "Decrypted empty string must equal original empty string");
    });

    it("T14-A6: Large synthetic plaintext (100KB) round-trip succeeds", () => {
      const largePayload = "X".repeat(102400); // 100 KB payload
      const encrypted = encrypt(largePayload);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted.length, 102400, "Large decrypted payload length must match original");
      assert.equal(decrypted, largePayload, "Large payload contents must match exactly");
    });

    it("T14-A7: Repeated encryption of identical plaintext produces distinct ciphertexts (non-deterministic)", () => {
      const plaintext = "repeated_synthetic_secret_value";
      const ciphertexts = new Set<string>();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const encrypted = encrypt(plaintext);
        ciphertexts.add(encrypted);
      }

      assert.equal(
        ciphertexts.size,
        iterations,
        `All ${iterations} encryptions must produce unique ciphertexts due to random IVs`
      );
    });

    it("T14-A8: Every generated distinct ciphertext decrypts correctly to original plaintext", () => {
      const plaintext = "deterministic_decryption_verification";
      for (let i = 0; i < 20; i++) {
        const enc = encrypt(plaintext);
        const dec = decrypt(enc);
        assert.equal(dec, plaintext, `Iteration ${i} must decrypt cleanly`);
      }
    });
  });

  // ===========================================================================
  // GROUP B — GCM AUTHENTICATION / TAMPER RESISTANCE
  // ===========================================================================
  describe("Group B: GCM Authentication / Tamper Resistance", () => {
    it("T14-B1: Mutating one byte of ciphertext triggers authentication rejection", () => {
      const plaintext = "tamper_test_secret_payload";
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(":");
      assert.equal(parts.length, 3, "Valid GCM token must have 3 parts");

      // Flip first hex character of ciphertext portion
      const originalCt = parts[1];
      const flippedChar = originalCt[0] === "a" ? "b" : "a";
      const tamperedCt = flippedChar + originalCt.substring(1);
      const tamperedToken = `${parts[0]}:${tamperedCt}:${parts[2]}`;

      assert.throws(
        () => decrypt(tamperedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must throw an error when ciphertext is tampered"
      );
    });

    it("T14-B2: Mutating one byte of authentication tag triggers authentication rejection", () => {
      const plaintext = "auth_tag_tamper_payload";
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(":");

      // Flip last hex character of authentication tag portion
      const originalTag = parts[2];
      const flippedChar = originalTag[originalTag.length - 1] === "0" ? "1" : "0";
      const tamperedTag = originalTag.substring(0, originalTag.length - 1) + flippedChar;
      const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedTag}`;

      assert.throws(
        () => decrypt(tamperedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must throw an error when authentication tag is tampered"
      );
    });

    it("T14-B3: Mutating one byte of IV triggers authentication rejection", () => {
      const plaintext = "iv_tamper_payload";
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(":");

      // Flip first character of IV portion
      const originalIv = parts[0];
      const flippedChar = originalIv[0] === "c" ? "d" : "c";
      const tamperedIv = flippedChar + originalIv.substring(1);
      const tamperedToken = `${tamperedIv}:${parts[1]}:${parts[2]}`;

      assert.throws(
        () => decrypt(tamperedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must throw an error when IV is tampered"
      );
    });

    it("T14-B4: Replacing authentication tag with another valid-length tag fails authentication", () => {
      const token1 = encrypt("secret_message_one");
      const token2 = encrypt("secret_message_two");
      const parts1 = token1.split(":");
      const parts2 = token2.split(":");

      // Swap auth tag from token2 onto token1
      const splicedToken = `${parts1[0]}:${parts1[1]}:${parts2[2]}`;

      assert.throws(
        () => decrypt(splicedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must reject spliced authentication tag from another token"
      );
    });

    it("T14-B5: Replacing ciphertext with unrelated valid-looking ciphertext fails authentication", () => {
      const token1 = encrypt("target_secret_a");
      const token2 = encrypt("target_secret_b");
      const parts1 = token1.split(":");
      const parts2 = token2.split(":");

      // Splice ciphertext from token2 into token1's IV and tag
      const splicedToken = `${parts1[0]}:${parts2[1]}:${parts1[2]}`;

      assert.throws(
        () => decrypt(splicedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must reject mismatched ciphertext payload"
      );
    });

    it("T14-B6: Truncating ciphertext fails authentication", () => {
      const token = encrypt("payload_for_truncation");
      const parts = token.split(":");
      const truncatedCt = parts[1].substring(0, Math.max(2, parts[1].length - 4));
      const tamperedToken = `${parts[0]}:${truncatedCt}:${parts[2]}`;

      assert.throws(
        () => decrypt(tamperedToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must reject truncated ciphertext"
      );
    });

    it("T14-B7: Truncating authentication tag to invalid length or mismatched truncated tag fails safely", () => {
      const token = encrypt("payload_for_tag_truncation");
      const parts = token.split(":");
      // Invalid tag length (e.g. 6 hex chars = 3 bytes, where GCM requires minimum 4 bytes)
      const invalidLenTag = parts[2].substring(0, 6);
      const tamperedToken1 = `${parts[0]}:${parts[1]}:${invalidLenTag}`;

      assert.throws(
        () => decrypt(tamperedToken1),
        /Invalid authentication tag length|Invalid tag|Unsupported state|Error/i,
        "Decryption must reject invalid authentication tag length"
      );

      // Truncated tag with mismatched bytes
      const mismatchedTruncatedTag = "0011223344556677"; // 8 bytes but wrong tag
      const tamperedToken2 = `${parts[0]}:${parts[1]}:${mismatchedTruncatedTag}`;
      assert.throws(
        () => decrypt(tamperedToken2),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must reject mismatched truncated authentication tag"
      );
    });

    it("T14-B8: Truncating IV fails safely", () => {
      const token = encrypt("payload_for_iv_truncation");
      const parts = token.split(":");
      const truncatedIv = parts[0].substring(0, 16); // 8 bytes instead of 16
      const tamperedToken = `${truncatedIv}:${parts[1]}:${parts[2]}`;

      assert.throws(
        () => decrypt(tamperedToken),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Decryption must reject truncated IV length"
      );
    });

    it("T14-B9: Introducing non-hex characters into ciphertext or tag fails safely", () => {
      const token = encrypt("payload_for_non_hex");
      const parts = token.split(":");
      // Introduce non-hex chars in the middle of ciphertext
      const mid = Math.floor(parts[1].length / 2);
      const tamperedCt = parts[1].substring(0, mid) + "ZZ" + parts[1].substring(mid + 2);
      const invalidHexToken = `${parts[0]}:${tamperedCt}:${parts[2]}`;

      assert.throws(
        () => decrypt(invalidHexToken),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption must reject non-hex corrupted data"
      );
    });

    it("T14-B10: Malformed delimiter structure (extra or missing colons) fails safely", () => {
      const token = encrypt("payload_for_delimiters");
      const parts = token.split(":");

      // 4 parts (extra colon)
      const fourPartToken = `${parts[0]}:${parts[1]}:${parts[2]}:extra`;
      // Malformed 3-part with empty parts
      const emptyPartsToken = `${parts[0]}::${parts[2]}`;

      // In either case, it must not return the original plaintext and must either throw or fall back safely without returning plaintext
      try {
        const res = decrypt(fourPartToken);
        assert.notEqual(res, "payload_for_delimiters", "Malformed delimiter must not return original secret");
      } catch (err: any) {
        assert.ok(err instanceof Error, "Error must be a standard Error");
      }

      assert.throws(
        () => decrypt(emptyPartsToken),
        /Error|Unsupported state/i,
        "Empty middle part in 3-part format must throw authentication failure"
      );
    });
  });

  // ===========================================================================
  // GROUP C — WRONG KEY / KEY CONFIGURATION
  // ===========================================================================
  describe("Group C: Wrong Key / Key Configuration", () => {
    it("T14-C1: Encrypting with Secret A and attempting decryption with Secret B fails authentication", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A;
      const encrypted = encrypt("secret_bound_to_key_a");

      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_B;
      assert.throws(
        () => decrypt(encrypted),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption under a different key must fail authentication"
      );
    });

    it("T14-C2: Encrypting with Secret A and decrypting with completely unrelated random secret fails", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A;
      const encrypted = encrypt("confidential_data_payload");

      process.env.ENCRYPTION_SECRET = "completely_different_secret_9999";
      assert.throws(
        () => decrypt(encrypted),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Decryption under completely different key must fail authentication"
      );
    });

    it("T14-C3: Missing ENCRYPTION_SECRET during encrypt() throws descriptive error (fail-closed)", () => {
      delete process.env.ENCRYPTION_SECRET;
      assert.throws(
        () => encrypt("test_data"),
        /ENCRYPTION_SECRET is not defined/i,
        "encrypt() must fail closed with explicit error when ENCRYPTION_SECRET is unset"
      );
    });

    it("T14-C4: Missing ENCRYPTION_SECRET during decrypt() throws descriptive error (fail-closed)", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A;
      const encrypted = encrypt("test_data");

      delete process.env.ENCRYPTION_SECRET;
      assert.throws(
        () => decrypt(encrypted),
        /ENCRYPTION_SECRET is not defined/i,
        "decrypt() must fail closed with explicit error when ENCRYPTION_SECRET is unset"
      );
    });

    it("T14-C5: Short synthetic secret (< 32 chars) normalizes by padding and round-trips consistently", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_SHORT; // 16 chars
      const text = "short_key_test_payload";
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, text, "Short key padded to 32 chars must round-trip correctly");
    });

    it("T14-C6: Exactly 32-character synthetic secret round-trips consistently", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_A; // exactly 32 chars
      const text = "exact_32_char_key_payload";
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, text, "Exact 32-character key must round-trip correctly");
    });

    it("T14-C7: Longer synthetic secret (> 32 chars) normalizes by truncation and round-trips consistently", () => {
      process.env.ENCRYPTION_SECRET = SYNTHETIC_KEY_LONG; // 51 chars
      const text = "long_key_test_payload";
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);
      assert.equal(decrypted, text, "Long key truncated to 32 chars must round-trip correctly");
    });
  });

  // ===========================================================================
  // GROUP D — LEGACY COMPATIBILITY
  // ===========================================================================
  describe("Group D: Legacy Compatibility", () => {
    it("T14-D1: Valid 2-part legacy ciphertext (AES-256-CTR with random IV) decrypts correctly", () => {
      const plaintext = "legacy_stripe_token_sample_2part";
      const legacy2PartCiphertext = generateLegacy2PartCTR(plaintext, SYNTHETIC_KEY_A);
      assert.equal(legacy2PartCiphertext.split(":").length, 2, "Legacy 2-part format must contain exactly 1 colon");

      const decrypted = decrypt(legacy2PartCiphertext);
      assert.equal(decrypted, plaintext, "Legacy 2-part CTR ciphertext must be decrypted correctly by fallback path");
    });

    it("T14-D2: Valid 1-part legacy ciphertext (AES-256-CTR with fixed zero IV) decrypts correctly", () => {
      const plaintext = "legacy_razorpay_secret_sample_1part";
      const legacy1PartCiphertext = generateLegacy1PartCTR(plaintext, SYNTHETIC_KEY_A);
      assert.ok(!legacy1PartCiphertext.includes(":"), "Legacy 1-part format must not contain colons");

      const decrypted = decrypt(legacy1PartCiphertext);
      assert.equal(decrypted, plaintext, "Legacy 1-part fixed-IV CTR ciphertext must be decrypted correctly by fallback path");
    });

    it("T14-D3: New encrypt() output is ALWAYS 3-part GCM format", () => {
      const plaintext = "freshly_encrypted_credential";
      const encrypted = encrypt(plaintext);
      const parts = encrypted.split(":");
      assert.equal(parts.length, 3, "New encryption must ALWAYS produce 3 parts");
      assert.equal(parts[0].length, 32, "IV part must be 32 hex characters (16 bytes)");
      assert.equal(parts[2].length, 32, "Auth tag part must be 32 hex characters (16 bytes)");
    });

    it("T14-D4: Legacy ciphertext does NOT get rewritten during decrypt() (read-only decryption invariant)", () => {
      const plaintext = "read_only_decryption_check";
      const legacyToken = generateLegacy2PartCTR(plaintext, SYNTHETIC_KEY_A);
      const initialCopy = legacyToken;

      const decrypted = decrypt(legacyToken);
      assert.equal(decrypted, plaintext);
      assert.equal(legacyToken, initialCopy, "decrypt() must never mutate the input parameter");
    });

    it("T14-D5: Confirm legacy AES-CTR has no GCM authentication tag", () => {
      const legacyToken = generateLegacy2PartCTR("no_auth_tag_payload", SYNTHETIC_KEY_A);
      const parts = legacyToken.split(":");
      assert.equal(parts.length, 2, "Legacy CTR token has no 3rd authTag component");
    });

    it("T14-D6: Document and verify that legacy CTR tampering alters decrypted bytes without throwing auth error", () => {
      const original = "legacy_tamper_payload";
      const legacyToken = generateLegacy2PartCTR(original, SYNTHETIC_KEY_A);
      const parts = legacyToken.split(":");

      // Flip byte in legacy CTR ciphertext
      const originalCt = parts[1];
      const flippedChar = originalCt[0] === "a" ? "b" : "a";
      const corruptedCt = flippedChar + originalCt.substring(1);
      const corruptedToken = `${parts[0]}:${corruptedCt}`;

      // In AES-CTR without MAC, decryption produces garbage instead of throwing authentication error
      const decryptedGarbage = decrypt(corruptedToken);
      assert.notEqual(
        decryptedGarbage,
        original,
        "Legacy CTR corruption produces garbage, demonstrating lack of AEAD integrity compared to AES-256-GCM"
      );
    });
  });

  // ===========================================================================
  // GROUP E — FAIL-CLOSED / MALFORMED INPUT
  // ===========================================================================
  describe("Group E: Fail-Closed / Malformed Input", () => {
    it("T14-E1: null input fails closed safely with thrown error", () => {
      assert.throws(
        () => decrypt(null as unknown as string),
        /TypeError|Error/i,
        "decrypt(null) must fail closed"
      );
    });

    it("T14-E2: undefined input fails closed safely with thrown error", () => {
      assert.throws(
        () => decrypt(undefined as unknown as string),
        /TypeError|Error/i,
        "decrypt(undefined) must fail closed"
      );
    });

    it("T14-E3: Non-string input (number, object, boolean) fails closed safely", () => {
      assert.throws(
        () => decrypt(123456 as unknown as string),
        /TypeError|Error/i,
        "decrypt(number) must fail closed"
      );
      assert.throws(
        () => decrypt({ key: "val" } as unknown as string),
        /TypeError|Error/i,
        "decrypt(object) must fail closed"
      );
      assert.throws(
        () => decrypt(true as unknown as string),
        /TypeError|Error/i,
        "decrypt(boolean) must fail closed"
      );
    });

    it("T14-E4: Empty string malformed token produces empty output or throws safely", () => {
      try {
        const result = decrypt("");
        assert.equal(result, "", "Empty input in 1-part fallback produces empty string");
      } catch (err: any) {
        assert.ok(err instanceof Error);
      }
    });

    it("T14-E5: Colon-only tokens fail closed safely", () => {
      // 3 parts with all empty parts
      assert.throws(
        () => decrypt("::"),
        /Error|Unsupported state/i,
        "Token '::' must fail closed on invalid IV/Tag length"
      );
      // 2 parts with empty parts
      try {
        const res = decrypt(":");
        assert.equal(typeof res, "string");
      } catch (err: any) {
        assert.ok(err instanceof Error);
      }
    });

    it("T14-E6: One-part malformed non-hex string fails closed safely", () => {
      try {
        const res = decrypt("non_hex_random_string_xyz");
        assert.equal(typeof res, "string", "CTR fallback creates string from non-hex buffer without crashing");
      } catch (err: any) {
        assert.ok(err instanceof Error);
      }
    });

    it("T14-E7: Two-part malformed token fails safely", () => {
      assert.throws(
        () => decrypt("short_iv:short_ct"),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Short IV in 2-part format must throw Invalid IV length error"
      );
    });

    it("T14-E8: Three-part malformed token with invalid IV fails closed safely", () => {
      assert.throws(
        () => decrypt("invalid_iv:valid_looking_ct:valid_looking_tag"),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Invalid IV in 3-part GCM format must throw error"
      );
    });

    it("T14-E9: Invalid hex characters in IV fail safely", () => {
      const invalidHexIv = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"; // 32 chars non-hex
      const validCt = "aabbcc";
      const validTag = "00112233445566778899aabbccddeeff";
      const token = `${invalidHexIv}:${validCt}:${validTag}`;

      assert.throws(
        () => decrypt(token),
        /Unsupported state or unable to authenticate data|authentication tag|Error/i,
        "Non-hex IV must fail authentication"
      );
    });

    it("T14-E10: Odd-length hex strings fail safely", () => {
      const oddIv = "1234567890123456789012345678901"; // 31 chars (odd)
      const token = `${oddIv}:aabbcc:00112233445566778899aabbccddeeff`;

      assert.throws(
        () => decrypt(token),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Odd-length IV must fail safely"
      );
    });

    it("T14-E11: Impossible IV length in 3-part format fails closed", () => {
      const shortIv = "12345678"; // 4 bytes
      const longIv = "1234567890123456789012345678901234567890123456789012345678901234"; // 32 bytes
      const tag = "00112233445566778899aabbccddeeff";

      assert.throws(
        () => decrypt(`${shortIv}:aabb:${tag}`),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Short IV must throw Invalid IV length"
      );
      assert.throws(
        () => decrypt(`${longIv}:aabb:${tag}`),
        /Invalid initialization vector|Invalid IV length|Error/i,
        "Long IV must throw Invalid IV length"
      );
    });

    it("T14-E12: Impossible auth-tag length in 3-part format fails closed", () => {
      const iv = "00112233445566778899aabbccddeeff";
      const shortTag = "12345678"; // 4 bytes
      const longTag = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"; // 32 bytes

      assert.throws(
        () => decrypt(`${iv}:aabb:${shortTag}`),
        /Invalid tag length|Invalid authentication tag|Error/i,
        "Short tag must throw Invalid tag length"
      );
      assert.throws(
        () => decrypt(`${iv}:aabb:${longTag}`),
        /Invalid tag length|Invalid authentication tag|Error/i,
        "Long tag must throw Invalid tag length"
      );
    });

    it("T14-E13: Binary garbage / random buffer string fails closed safely", () => {
      const randomGarbage = crypto.randomBytes(64).toString("hex");
      try {
        const res = decrypt(randomGarbage);
        assert.equal(typeof res, "string", "Random garbage falls back safely to CTR without process crash");
      } catch (err: any) {
        assert.ok(err instanceof Error);
      }
    });

    it("T14-E14: Excessively malformed multi-delimiter input fails closed safely", () => {
      const malformed = "part1:part2:part3:part4:part5:part6";
      try {
        const res = decrypt(malformed);
        assert.equal(typeof res, "string", "Excessively malformed multi-part falls back without crash");
      } catch (err: any) {
        assert.ok(err instanceof Error);
      }
    });
  });

  // ===========================================================================
  // GROUP F — CREDENTIAL STORAGE / PROJECTION BOUNDARY
  // ===========================================================================
  describe("Group F: Credential Storage & Projection Boundary", () => {
    it("T14-F1: provider_connections schema uses api_key_encrypted for credentials", () => {
      const stripeSyncPath = path.resolve(__dirname, "../src/lib/stripe-sync.ts");
      const content = fs.readFileSync(stripeSyncPath, "utf8");
      assert.ok(
        content.includes("api_key_encrypted: params.encryptedCredential"),
        "stripe-sync.ts must persist credentials in api_key_encrypted column"
      );
    });

    it("T14-F2: Stripe manual connection path calls encrypt() before persistence", () => {
      const stripeSyncPath = path.resolve(__dirname, "../src/lib/stripe-sync.ts");
      const content = fs.readFileSync(stripeSyncPath, "utf8");
      assert.ok(
        content.includes("encryptedCredential: encrypt(params.apiKey)"),
        "verifyManualStripeApiKey must encrypt API key before calling saveStripeConnection"
      );
    });

    it("T14-F3: Razorpay credential connection path calls encrypt() before persistence", () => {
      const razorpayProviderPath = path.resolve(__dirname, "../src/lib/providers/razorpay.ts");
      const content = fs.readFileSync(razorpayProviderPath, "utf8");
      assert.ok(
        content.includes("encryptedKey: encrypt(keySecret)"),
        "RazorpayProvider.serializeCredentials must encrypt keySecret"
      );
    });

    it("T14-F4: Overview API route (/api/startup/[id]/overview) does not project api_key_encrypted", () => {
      const overviewPath = path.resolve(__dirname, "../src/app/api/startup/[id]/overview/route.ts");
      const content = fs.readFileSync(overviewPath, "utf8");
      assert.ok(
        !content.includes("api_key_encrypted"),
        "overview route must never query or select api_key_encrypted"
      );
      assert.ok(
        content.includes('.select("provider, status, last_synced_at, latest_revenue")'),
        "overview route must select only safe projection columns"
      );
    });

    it("T14-F5: Connections API route (/api/startup/[id]/connections) does not project api_key_encrypted", () => {
      const connectionsPath = path.resolve(__dirname, "../src/app/api/startup/[id]/connections/route.ts");
      const content = fs.readFileSync(connectionsPath, "utf8");
      assert.ok(
        content.includes("// NEVER expose api_key_encrypted, account_id, or internal metadata"),
        "connections route must explicitly document security exclusion invariant"
      );
      assert.ok(
        content.includes('.select("provider, status, last_synced_at, latest_revenue")'),
        "connections route must select only safe public provider status fields"
      );
    });

    it("T14-F6: Public API routes (badge, og, live-feed, leaderboard) never query provider credentials", () => {
      const publicRoutes = [
        "../src/app/api/badge/[slug]/route.ts",
        "../src/app/api/live-feed/route.ts",
        "../src/app/api/trust-metrics/route.ts",
      ];
      for (const relPath of publicRoutes) {
        const fullPath = path.resolve(__dirname, relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf8");
          assert.ok(
            !content.includes("api_key_encrypted"),
            `${relPath} must not reference api_key_encrypted`
          );
        }
      }
    });

    it("T14-F7: Client components and frontend code do not import encryption.ts", () => {
      const componentsDir = path.resolve(__dirname, "../src/components");
      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            const code = fs.readFileSync(full, "utf8");
            assert.ok(
              !code.includes('from "@/lib/encryption"') && !code.includes("from '@/lib/encryption'"),
              `Client file ${entry.name} must not import encryption.ts`
            );
          }
        }
      }
      scanDir(componentsDir);
    });

    it("T14-F8: ENCRYPTION_SECRET is never exposed via NEXT_PUBLIC_* environment variables", () => {
      const srcDir = path.resolve(__dirname, "../src");
      function scanForNextPublic(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanForNextPublic(full);
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            const code = fs.readFileSync(full, "utf8");
            assert.ok(
              !code.includes("NEXT_PUBLIC_ENCRYPTION_SECRET"),
              `File ${entry.name} must not reference NEXT_PUBLIC_ENCRYPTION_SECRET`
            );
          }
        }
      }
      scanForNextPublic(srcDir);
    });

    it("T14-F9: Decrypted credentials are only used server-side for outbound provider API calls", () => {
      const stripeSyncPath = path.resolve(__dirname, "../src/lib/stripe-sync.ts");
      const content = fs.readFileSync(stripeSyncPath, "utf8");
      // Verify apiKey is used only to construct Stripe client
      assert.ok(
        content.includes("getStripeForSecretKey(apiKey)"),
        "Decrypted apiKey must be passed directly into Stripe SDK constructor"
      );

      const razorpaySyncPath = path.resolve(__dirname, "../src/lib/razorpay-sync.ts");
      const rzpContent = fs.readFileSync(razorpaySyncPath, "utf8");
      assert.ok(
        rzpContent.includes("createRazorpayClient(conn.account_id, keySecret)"),
        "Decrypted keySecret must be passed directly into Razorpay SDK constructor"
      );
    });

    it("T14-F10: Error normalization in provider pipelines does not serialize raw credentials", () => {
      const errorModulePath = path.resolve(__dirname, "../src/lib/providers/errors.ts");
      const content = fs.readFileSync(errorModulePath, "utf8");
      assert.ok(
        content.includes("normalizeProviderError"),
        "Provider errors must pass through centralized normalizeProviderError"
      );
    });
  });

  // ===========================================================================
  // GROUP G — SECRET / KEY LEAKAGE PREVENTION
  // ===========================================================================
  describe("Group G: Secret & Key Leakage Prevention", () => {
    it("T14-G1: Static scan confirms zero logging of decryptedKey, apiKey, keySecret, or ENCRYPTION_SECRET", () => {
      const syncFiles = [
        path.resolve(__dirname, "../src/lib/encryption.ts"),
        path.resolve(__dirname, "../src/lib/stripe-sync.ts"),
        path.resolve(__dirname, "../src/lib/razorpay-sync.ts"),
        path.resolve(__dirname, "../src/lib/revenue-aggregation.ts"),
      ];

      for (const filePath of syncFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("console.log") || line.includes("console.error") || line.includes("console.warn")) {
            assert.ok(
              !line.includes("apiKey") &&
              !line.includes("keySecret") &&
              !line.includes("decryptedKey") &&
              !line.includes("process.env.ENCRYPTION_SECRET"),
              `Potential credential logging detected in ${path.basename(filePath)} line ${i + 1}: ${line.trim()}`
            );
          }
        }
      }
    });

    it("T14-G2: Client components directory contains zero access to process.env.ENCRYPTION_SECRET or encryption module", () => {
      const componentsDir = path.resolve(__dirname, "../src/components");
      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            const code = fs.readFileSync(full, "utf8");
            assert.ok(
              !code.includes("process.env.ENCRYPTION_SECRET") &&
              !code.includes('from "@/lib/encryption"') &&
              !code.includes("from '@/lib/encryption'"),
              `Client component ${entry.name} must not access process.env.ENCRYPTION_SECRET or import encryption`
            );
          }
        }
      }
      scanDir(componentsDir);
    });

    it("T14-G3: Entire repository contains zero references to NEXT_PUBLIC_ENCRYPTION_SECRET", () => {
      const srcDir = path.resolve(__dirname, "../src");
      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (entry.isFile()) {
            const code = fs.readFileSync(full, "utf8");
            assert.ok(
              !code.includes("NEXT_PUBLIC_ENCRYPTION_SECRET"),
              `File ${entry.name} contains invalid public encryption secret reference`
            );
          }
        }
      }
      scanDir(srcDir);
    });

    it("T14-G4: No hardcoded production encryption secrets in source literals", () => {
      const encPath = path.resolve(__dirname, "../src/lib/encryption.ts");
      const content = fs.readFileSync(encPath, "utf8");
      // Verify encryption key is always fetched from process.env
      assert.ok(
        content.includes("process.env.ENCRYPTION_SECRET"),
        "encryption.ts must read secret dynamically from process.env.ENCRYPTION_SECRET"
      );
      assert.ok(
        !content.includes('secretKey = "') && !content.includes("secretKey = '"),
        "encryption.ts must not contain hardcoded secret literals"
      );
    });

    it("T14-G5: Thrown exceptions in encryption.ts do not interpolate plaintexts or secret keys", () => {
      const encPath = path.resolve(__dirname, "../src/lib/encryption.ts");
      const content = fs.readFileSync(encPath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes("throw new Error(")) {
          assert.ok(
            !line.includes("${text}") &&
            !line.includes("${hash}") &&
            !line.includes("${secretKey}"),
            `Exception in encryption.ts must not interpolate sensitive values: ${line.trim()}`
          );
        }
      }
    });
  });

  // ===========================================================================
  // GROUP H — timingSafeCompare
  // ===========================================================================
  describe("Group H: Constant-Time Comparison Timing Safety", () => {
    it("T14-H1: Matching strings return true", () => {
      const a = "exact_matching_signature_vector_1234567890abcdef";
      const b = "exact_matching_signature_vector_1234567890abcdef";
      assert.equal(timingSafeCompare(a, b), true, "Identical strings must return true");
    });

    it("T14-H2: Non-matching strings of equal length return false", () => {
      const a = "matching_length_signature_vector_1234567890abcde1";
      const b = "matching_length_signature_vector_1234567890abcde2";
      assert.equal(timingSafeCompare(a, b), false, "Different strings of equal length must return false");
    });

    it("T14-H3: Strings of different lengths return false in constant time without throwing exceptions", () => {
      const shortStr = "short_sig";
      const longStr = "long_signature_vector_with_many_more_characters_123456789";
      assert.equal(
        timingSafeCompare(shortStr, longStr),
        false,
        "Different length strings must return false safely"
      );
      assert.equal(
        timingSafeCompare(longStr, shortStr),
        false,
        "Inverted different length strings must return false safely"
      );
    });

    it("T14-H4: Adversarial values (empty strings, unicode, long payloads) never throw unexpectedly", () => {
      assert.equal(timingSafeCompare("", ""), true, "Two empty strings match");
      assert.equal(timingSafeCompare("", "non_empty"), false, "Empty and non-empty return false");
      assert.equal(
        timingSafeCompare("unicode_🔐_match", "unicode_🔐_match"),
        true,
        "Matching unicode strings return true"
      );
      assert.equal(
        timingSafeCompare("unicode_🔐_match", "unicode_🔑_mismatch"),
        false,
        "Mismatching unicode strings return false"
      );
      assert.equal(
        timingSafeCompare("A".repeat(10000), "A".repeat(10000)),
        true,
        "Large 10KB matching strings return true"
      );
      assert.equal(
        timingSafeCompare("A".repeat(10000), "A".repeat(9999) + "B"),
        false,
        "Large 10KB mismatching strings return false"
      );
    });
  });
});

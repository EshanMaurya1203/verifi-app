import crypto from "crypto";

export const REAUTH_PROOF_TTL_SECONDS = 120; // 2 minutes (120 seconds)
export const REAUTH_PROOF_TTL_MS = REAUTH_PROOF_TTL_SECONDS * 1000;
export const REAUTH_INTENT_TTL_MS = 300_000; // 5 minutes for intent survival across OAuth redirect
export const REAUTH_PROOF_COOKIE_NAME = "vrf_reauth_proof";

function getSecretKey(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is required for reauth proof cryptographic operations.");
  }
  return secret;
}

/**
 * Validates that an action string follows allowed formats:
 * - "delete-account"
 * - "delete-startup:<id>"
 */
export function isValidReauthAction(action: string): boolean {
  if (action === "delete-account") return true;
  if (action.startsWith("delete-startup:") && action.length > "delete-startup:".length) {
    const id = action.slice("delete-startup:".length);
    return !isNaN(Number(id)) && Number(id) > 0;
  }
  return false;
}

/**
 * Generates an HMAC-signed intent token to protect the deletion action from URL tampering.
 * Format: base64url("intent:action:issuedAtMs:hmacHex")
 */
export function signReauthIntent(action: string): string {
  if (!isValidReauthAction(action)) throw new Error(`Invalid reauth action: ${action}`);

  const secret = getSecretKey();
  const issuedAt = Date.now();
  const body = `intent:${action}:${issuedAt}`;

  const hmacHex = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const rawToken = `${body}:${hmacHex}`;
  return Buffer.from(rawToken, "utf8").toString("base64url");
}

/**
 * Verifies an HMAC-signed re-authentication intent token.
 */
export function verifyReauthIntent(intentToken: string | undefined | null): { valid: boolean; action?: string; reason?: string } {
  if (!intentToken) {
    return { valid: false, reason: "Missing re-authentication intent token." };
  }

  try {
    const rawToken = Buffer.from(intentToken, "base64url").toString("utf8");
    const parts = rawToken.split(":");
    
    // Expecting ["intent", action (or action:id), issuedAt, hmacHex]
    if (parts.length < 4 || parts[0] !== "intent") {
      return { valid: false, reason: "Malformed re-authentication intent token format." };
    }

    const hmacHex = parts[parts.length - 1];
    const issuedAtRaw = parts[parts.length - 2];
    const action = parts.slice(1, parts.length - 2).join(":");

    if (!isValidReauthAction(action)) {
      return { valid: false, reason: "Invalid action inside intent token." };
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return { valid: false, reason: "Invalid timestamp in intent token." };
    }

    const now = Date.now();
    if (now - issuedAt > REAUTH_INTENT_TTL_MS) {
      return { valid: false, reason: "Re-authentication intent token has expired." };
    }

    const secret = getSecretKey();
    const body = `intent:${action}:${issuedAt}`;
    const expectedHmacHex = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedHmacHex, "hex");
    const receivedBuf = Buffer.from(hmacHex, "hex");

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return { valid: false, reason: "Invalid re-authentication intent signature." };
    }

    return { valid: true, action };
  } catch {
    return { valid: false, reason: "Failed to parse or verify re-authentication intent token." };
  }
}

/**
 * Generates an HMAC-signed, base64url-encoded re-authentication proof token.
 * Format: base64url("userId:action:issuedAtMs:hmacHex")
 */
export function signReauthProof(userId: string, action: string): string {
  if (!userId) throw new Error("userId is required to sign reauth proof.");
  if (!isValidReauthAction(action)) throw new Error(`Invalid reauth action: ${action}`);

  const secret = getSecretKey();
  const issuedAt = Date.now();
  const body = `${userId}:${action}:${issuedAt}`;

  const hmacHex = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const rawToken = `${body}:${hmacHex}`;
  return Buffer.from(rawToken, "utf8").toString("base64url");
}

/**
 * Verifies an HMAC-signed re-authentication proof token.
 * Uses Buffer.from(..., "hex") and crypto.timingSafeEqual for constant-time signature comparison.
 */
export function verifyReauthProof(
  token: string | undefined | null,
  expectedUserId: string,
  expectedAction: string
): { valid: boolean; reason?: string } {
  if (!token) {
    return { valid: false, reason: "Missing re-authentication proof token." };
  }

  if (!expectedUserId) {
    return { valid: false, reason: "Expected user ID is missing." };
  }

  if (!isValidReauthAction(expectedAction)) {
    return { valid: false, reason: "Invalid target re-authentication action." };
  }

  try {
    const rawToken = Buffer.from(token, "base64url").toString("utf8");
    const parts = rawToken.split(":");

    if (parts.length < 4) {
      return { valid: false, reason: "Malformed re-authentication proof token format." };
    }

    const hmacHex = parts[parts.length - 1];
    const issuedAtRaw = parts[parts.length - 2];
    const userId = parts[0];
    const action = parts.slice(1, parts.length - 2).join(":");

    if (userId !== expectedUserId) {
      return { valid: false, reason: "Re-authentication proof user mismatch." };
    }

    if (action !== expectedAction) {
      return { valid: false, reason: "Re-authentication proof action mismatch." };
    }

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) {
      return { valid: false, reason: "Invalid timestamp in re-authentication proof token." };
    }

    const now = Date.now();
    if (now - issuedAt > REAUTH_PROOF_TTL_MS) {
      return { valid: false, reason: `Re-authentication proof token has expired (exceeded ${REAUTH_PROOF_TTL_SECONDS} seconds).` };
    }

    if (issuedAt > now + 5000) {
      return { valid: false, reason: "Re-authentication proof timestamp is in the future." };
    }

    // Recompute HMAC
    const secret = getSecretKey();
    const body = `${userId}:${action}:${issuedAt}`;
    const expectedHmacHex = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    // Convert hex strings to raw binary buffers for timingSafeEqual
    const expectedBuf = Buffer.from(expectedHmacHex, "hex");
    const receivedBuf = Buffer.from(hmacHex, "hex");

    if (expectedBuf.length !== receivedBuf.length) {
      return { valid: false, reason: "Invalid re-authentication signature." };
    }

    const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    if (!isValid) {
      return { valid: false, reason: "Invalid re-authentication signature." };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Failed to parse or verify re-authentication proof token." };
  }
}

export interface ReauthConsumptionResult {
  valid: boolean;
  reason?: string;
  status?: number;
}

let testRedisClient: any = null;

/**
 * Injects a mock/stub Redis client for automated testing of distributed race conditions and outages.
 */
export function setReauthRedisClientForTesting(client: any): void {
  testRedisClient = client;
}

/**
 * Resets the test Redis client back to default environment resolution.
 */
export function resetReauthRedisClientForTesting(): void {
  testRedisClient = null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Redis timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Authoritatively verifies and consumes an HMAC-signed re-authentication proof token
 * using the distributed consumption store (Upstash Redis).
 *
 * FAILS CLOSED: If Redis is unavailable, unconfigured, or times out, the proof consumption
 * cannot be authoritatively established across distributed instances, and the operation is rejected.
 */
export async function consumeAndVerifyReauthProof(
  token: string | undefined | null,
  expectedUserId: string,
  expectedAction: string
): Promise<ReauthConsumptionResult> {
  // 1. Statically and cryptographically verify the token first
  const verification = verifyReauthProof(token, expectedUserId, expectedAction);
  if (!verification.valid || !token) {
    return { ...verification, status: 403 };
  }

  // 2. Authoritative distributed single-use consumption check
  const proofHash = crypto.createHash("sha256").update(token).digest("hex");
  const redisKey = `reauth_consumed:${proofHash}`;

  try {
    let redis = testRedisClient;

    if (!redis) {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!redisUrl || !redisToken) {
        console.error(
          "[consumeAndVerifyReauthProof] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. Failing closed."
        );
        return {
          valid: false,
          reason: "Security verification service configuration error. Single-use consumption cannot be verified.",
          status: 503,
        };
      }

      const { Redis } = await import("@upstash/redis");
      redis = new Redis({ url: redisUrl, token: redisToken });
    }

    // Atomic SET NX with 180-second TTL (guarantees single-use across the 120-second token lifecycle)
    const setResult = await withTimeout(
      redis.set(redisKey, "1", { nx: true, ex: 180 }),
      2000
    );

    // Upstash Redis returns "OK" (or true) when key was set, or null/false if key already existed
    if (setResult !== "OK" && setResult !== true) {
      return {
        valid: false,
        reason: "Re-authentication proof has already been consumed.",
        status: 403,
      };
    }

    return { valid: true };
  } catch (err: any) {
    console.error(
      "[consumeAndVerifyReauthProof] Redis error/timeout during atomic single-use consumption:",
      err.message
    );
    return {
      valid: false,
      reason: "Security verification service temporarily unavailable. Re-authentication proof cannot be verified.",
      status: 503,
    };
  }
}

/**
 * Safely retrieves the re-authentication proof token from an incoming HTTP Request
 * or from Next.js request headers.
 */
export async function getReauthProofToken(request?: Request): Promise<string | undefined> {
  if (request) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REAUTH_PROOF_COOKIE_NAME}=([^;]*)`));
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    return cookieStore.get(REAUTH_PROOF_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}



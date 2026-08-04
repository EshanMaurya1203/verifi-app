// ─── VRF-ONBOARD-001E.12C.1 — Deterministic Hash Engine ────────────────

export interface HashResult {
  hash: string;
  bucket: number;
}

/**
 * Deterministic 32-bit MurmurHash3 implementation (x86_32).
 * Returns an unsigned 32-bit integer.
 */
export function murmur3_32(key: string, seed: number = 0): number {
  let k1: number;
  let h1 = seed;

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  const len = key.length;
  const roundedEnd = len & ~0x3;

  for (let i = 0; i < roundedEnd; i += 4) {
    k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);

    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }

  k1 = 0;
  const val = len & 3;
  if (val === 3) {
    k1 ^= (key.charCodeAt(roundedEnd + 2) & 0xff) << 16;
  }
  if (val >= 2) {
    k1 ^= (key.charCodeAt(roundedEnd + 1) & 0xff) << 8;
  }
  if (val >= 1) {
    k1 ^= key.charCodeAt(roundedEnd) & 0xff;
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
  }

  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Computes a deterministic, version-aware assignment hash and bucket (0–99).
 *
 * Hash key format: `${identifier}:${experimentId}:v${experimentVersion}`
 */
export function computeAssignmentHash(
  identifier: string,
  experimentId: string,
  experimentVersion: number
): HashResult {
  if (!identifier || identifier.trim() === "") {
    throw new Error("Identifier cannot be empty.");
  }
  if (!experimentId || experimentId.trim() === "") {
    throw new Error("ExperimentId cannot be empty.");
  }
  if (typeof experimentVersion !== "number" || experimentVersion <= 0) {
    throw new Error("ExperimentVersion must be a positive integer.");
  }

  const key = `${identifier.trim()}:${experimentId.trim()}:v${experimentVersion}`;
  const rawHash = murmur3_32(key);
  const bucket = rawHash % 100;
  const hashHex = rawHash.toString(16).padStart(8, "0");

  return {
    hash: hashHex,
    bucket,
  };
}

import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
    );
  }

  redisInstance = new Redis({
    url,
    token,
  });

  return redisInstance;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 2000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error("Redis timeout")),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Strict IPv4 / IPv6 syntax validation to reject injection payloads,
 * malformed delimiters, and oversized inputs before constructing Redis keys.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45 || ip.length < 3) return false;
  // IPv4: 4 octets 0-255
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/;
  if (ipv4Regex.test(ip)) return true;
  // IPv6: standard RFC format validation
  const ipv6Regex =
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^::1$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$/;
  return ipv6Regex.test(ip);
}

/**
 * Deterministic, compact 32-bit FNV-1a hash to produce bounded ASCII tokens
 * for anonymous fallback. Prevents key injection and unbounded key lengths.
 */
export function hashToken(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getCanonicalPath(request: Request, explicitNamespace?: string): string {
  if (explicitNamespace && typeof explicitNamespace === "string" && explicitNamespace.trim()) {
    return explicitNamespace.trim();
  }
  try {
    const url = new URL(request.url);
    return url.pathname || "unknown_route";
  } catch {
    return "unknown_route";
  }
}

/**
 * Extracts a secure, authoritative client identifier for rate limiting.
 *
 * Trust Hierarchy:
 * 1. Verified server-side Supabase user.id (authoritative for authenticated routes)
 * 2. Trusted runtime request.ip (socket remote address from NextRequest/runtime if present)
 * 3. Empirically verified platform identity (x-vercel-forwarded-for on Vercel Edge)
 * 4. Bounded anonymous fallback (anon_<hash(ua)>:<canonical_path>)
 *
 * Note: Untrusted/client-controllable headers (such as standalone x-forwarded-for or x-real-ip)
 * are NOT trusted as authoritative identity sources to prevent trivial rate-limit bypass via header rotation.
 */
export function getClientIdentifier(
  request: Request,
  userIdOrOptions?: string | { userId?: string; namespace?: string }
): string {
  let userId: string | undefined;
  let explicitNamespace: string | undefined;

  if (typeof userIdOrOptions === "string") {
    userId = userIdOrOptions.trim() || undefined;
  } else if (userIdOrOptions && typeof userIdOrOptions === "object") {
    userId = userIdOrOptions.userId?.trim() || undefined;
    explicitNamespace = userIdOrOptions.namespace?.trim() || undefined;
  }

  const canonicalPath = getCanonicalPath(request, explicitNamespace);

  // 1. Authenticated User Identity (Authoritative)
  if (userId) {
    return `usr_${userId}:${canonicalPath}`;
  }

  // 2. Trusted Runtime Socket IP (if provided by Next.js / server runtime)
  const runtimeIp = (request as any).ip;
  if (typeof runtimeIp === "string" && isValidIp(runtimeIp.trim())) {
    return `ip_${runtimeIp.trim()}:${canonicalPath}`;
  }

  // 3. Empirically Verified Platform Header (Vercel Edge)
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const candidate = vercelForwardedFor.split(",")[0].trim();
    if (isValidIp(candidate)) {
      return `ip_${candidate}:${canonicalPath}`;
    }
  }

  // 4. Bounded Anonymous Fallback
  const rawUa = request.headers.get("user-agent") || "unknown_agent";
  const uaToken = hashToken(rawUa);
  return `anon_${uaToken}:${canonicalPath}`;
}

/**
 * Production-grade Upstash Redis rate limiter using atomic INCR + EXPIRE algorithm.
 *
 * Fail behavior on Redis errors:
 * - Default (failOpen: false): Blocks the request (fail-closed). Use for critical/destructive endpoints.
 * - failOpen: true: Allows the request. Use for non-critical/read-only endpoints.
 *
 * @param key Client identifier string
 * @param windowMs Time window in milliseconds
 * @param maxRequests Maximum allowed requests in the time window
 * @param options Optional. { failOpen?: boolean } - defaults to fail-closed.
 */
export async function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
  options?: {
    failOpen?: boolean;
  }
): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const failOpen = options?.failOpen ?? false;
  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rate_limit:${key}`;

  try {
    const redis = getRedis();

    const count = await withTimeout(redis.incr(redisKey));

    if (count === 1) {
      await withTimeout(redis.expire(redisKey, windowSeconds));
    }

    const allowed = count <= maxRequests;
    const remaining = allowed ? maxRequests - count : 0;

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[RateLimit] key:${redisKey} count:${count} remaining:${remaining} allowed:${allowed}`
      );
    }

    return {
      allowed,
      remaining,
    };
  } catch (error) {
    console.error("[RateLimit] Redis error or timeout:", error);

    if (failOpen) {
      // Non-critical endpoint: allow request so Redis outages don't block legitimate users
      return {
        allowed: true,
        remaining: maxRequests,
      };
    }

    // Critical endpoint: block request to prevent abuse during Redis outages
    return {
      allowed: false,
      remaining: 0,
    };
  }
}

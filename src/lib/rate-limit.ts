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
 * Extracts a unique identifier for the client based on IP and the requested route.
 * Priority:
 * 1. x-forwarded-for
 * 2. x-real-ip
 * 3. anonymous:${userAgent}:${pathname}
 */
export function getClientIdentifier(request: Request): string {
  let pathname = "";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    pathname = "unknown";
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  let ip = "";

  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  }

  if (!ip) {
    const ua = request.headers.get("user-agent") || "unknown";
    return `anonymous:${ua}:${pathname}`;
  }

  return `${ip}:${pathname}`;
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

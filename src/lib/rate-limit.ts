type RateLimitRecord = {
  count: number;
  windowStart: number;
};

const store = new Map<string, RateLimitRecord>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_THRESHOLD_MS = CLEANUP_INTERVAL_MS;

// Clean up expired entries periodically to prevent memory leaks
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.windowStart > CLEANUP_THRESHOLD_MS) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Extracts a unique identifier for the client based on IP and the requested route.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  let ip = "";

  if (forwarded) {
    ip = forwarded.split(",")[0].trim();
  } else if (realIp) {
    ip = realIp.trim();
  }

  // Final validation for IP part
  if (!ip || ip.toLowerCase() === "unknown") {
    ip = "127.0.0.1";
  }

  let pathname = "/unknown";
  try {
    const url = new URL(request.url);
    pathname = url.pathname;
    if (!pathname || pathname === "") {
      pathname = "/";
    }
  } catch {
    // Keep fallback
  }

  return `${ip}:${pathname}`;
}

export function checkRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = store.get(key);

  if (!record || now - record.windowStart > windowMs) {
    record = { count: 0, windowStart: now };
  }

  const allowed = record.count < maxRequests;

  if (process.env.NODE_ENV === "development") {
    console.log(`[RateLimit] key=${key} count=${record.count} allowed=${allowed}`);
  }

  if (!allowed) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  store.set(key, record);

  return {
    allowed: true,
    remaining: maxRequests - record.count,
  };
}

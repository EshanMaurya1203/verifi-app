import { NextResponse } from "next/server";
import crypto from "crypto";

function hash(val: string | null): string | null {
  if (!val) return null;
  return crypto.createHash("sha256").update(val.trim()).digest("hex").slice(0, 12);
}

export async function GET(request: Request) {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const forwardedFor = request.headers.get("x-forwarded-for");
  const requestIp = (request as any).ip;

  return NextResponse.json({
    diagnostics: {
      hasVercelForwardedFor: Boolean(vercelForwardedFor),
      hasRealIp: Boolean(realIp),
      hasForwardedFor: Boolean(forwardedFor),
      hasRequestIp: Boolean(requestIp),
      hashVercelForwardedFor: hash(vercelForwardedFor),
      hashRealIp: hash(realIp),
      hashForwardedFor: hash(forwardedFor),
      matchesVercelAndReal: vercelForwardedFor && realIp ? vercelForwardedFor.trim() === realIp.trim() : null,
      matchesVercelAndForwarded: vercelForwardedFor && forwardedFor ? forwardedFor.includes(vercelForwardedFor.trim()) : null,
    },
    timestamp: new Date().toISOString(),
  });
}

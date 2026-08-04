import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import {
  validateEvent,
  validateStep,
  sanitizeMetadata,
} from "@/lib/analytics/validators";

// ─── Rate Limiter Configuration ───────────────────────────────────────

const ANALYTICS_WINDOW_MS = 60000;
const ANALYTICS_MAX_REQUESTS = 20;

// ─── Route Handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Authenticate user via server session
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Reuse existing production rate limiter (20 events / min per user)
    const rateLimitKey = `analytics:${user.id}`;
    const { allowed } = checkRateLimit(
      rateLimitKey,
      ANALYTICS_WINDOW_MS,
      ANALYTICS_MAX_REQUESTS
    );
    if (!allowed) {
      // Analytics failures / rate limits must never block onboarding
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 3. Parse & validate request payload
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid analytics payload" },
        { status: 400 }
      );
    }

    const event = validateEvent(body.event);
    if (!event) {
      return NextResponse.json(
        { error: "Invalid analytics payload" },
        { status: 400 }
      );
    }

    // Validate step (optional, must be integer 1–4 if present)
    let step: number | undefined = undefined;
    if (body.step !== undefined && body.step !== null) {
      step = validateStep(body.step);
      if (step === undefined) {
        return NextResponse.json(
          { error: "Invalid analytics payload" },
          { status: 400 }
        );
      }
    }

    // Validate startupId (optional, must be positive integer if present)
    let startupId: number | undefined = undefined;
    if (body.startupId !== undefined && body.startupId !== null) {
      if (
        typeof body.startupId !== "number" ||
        !Number.isInteger(body.startupId) ||
        body.startupId <= 0
      ) {
        return NextResponse.json(
          { error: "Invalid analytics payload" },
          { status: 400 }
        );
      }
      startupId = body.startupId;
    }

    // Verify startup ownership if startupId is provided
    if (startupId) {
      const { data: startup, error: startupError } = await supabaseServer
        .from("startup_submissions")
        .select("id")
        .eq("id", startupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (startupError || !startup) {
        return NextResponse.json(
          { error: "Invalid analytics payload" },
          { status: 400 }
        );
      }
    }

    // Sanitize metadata
    const metadata = sanitizeMetadata(body.metadata);

    // 4. Insert into onboarding_events table using service_role client
    // JUSTIFICATION: onboarding_events has RLS enabled with 0 client policies.
    // Writes are server-authorized via user.id from getAuthenticatedUser().
    const { error: dbError } = await supabaseServer
      .from("onboarding_events")
      .insert({
        user_id: user.id,
        startup_id: startupId ?? null,
        event_name: event,
        step: step ?? null,
        metadata,
      });

    if (dbError) {
      console.error("[analytics]", dbError);
      // Fail silently to client with 200 OK
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[analytics]", err);
    // Guarantee zero thrown exposure on client side
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

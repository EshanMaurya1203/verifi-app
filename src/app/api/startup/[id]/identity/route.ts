import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { canStartupBePublic } from "@/lib/visibility";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logger, LogEvent } from "@/lib/logger";
import { z } from "zod";

const urlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Explicitly reject localhost and private IPs if necessary, but HTTPS enforces a lot.
        // Also blocks javascript:, data:, vbscript:
        return parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTPS URL" }
  )
  .or(z.literal(""));

const identitySchema = z.object({
  founder_name: z.string().trim().min(1, "Name is required").max(120),
  founder_bio: z.string().trim().max(2000).optional().default(""),
  founder_avatar: urlSchema.optional().default(""),
  startup_logo: urlSchema.optional().default(""),
  is_public: z.boolean(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identifier = getClientIdentifier(request);
    const { allowed } = await checkRateLimit(identifier, 120000, 5, { failOpen: true });

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const resolvedParams = await params;
    const startupId = resolvedParams.id;

    // Enforce authentication and strict startup ownership validation
    const { authenticated, owned, startup } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    const rawBody = await request.json();
    const result = identitySchema.safeParse(rawBody);
    
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
    const { founder_name, founder_avatar, startup_logo, founder_bio, is_public } = result.data;

    // Visibility gate: founders may always hide (is_public=false), but
    // publishing requires the startup to meet platform eligibility criteria.
    if (is_public === true) {
      const eligibility = canStartupBePublic(startup);
      if (!eligibility.eligible) {
        return NextResponse.json(
          { error: eligibility.reason },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabaseServer
      .from("startup_submissions")
      .update({
        founder_name,
        founder_avatar,
        startup_logo,
        founder_bio,
        is_public
      })
      .eq("id", startupId)
      .select()
      .single();

    if (error) {
      logger.error("[Update Identity] Error", { event: LogEvent.IDENTITY_UPDATE_FAILED, startupId: Number(startupId), error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info("[Update Identity] Success", { event: LogEvent.IDENTITY_UPDATED, startupId: Number(startupId) });
    return NextResponse.json({ success: true, startup: data });
  } catch (err: any) {
    logger.error("[Update Identity] Exception", { event: LogEvent.IDENTITY_UPDATE_FAILED, error: err.message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

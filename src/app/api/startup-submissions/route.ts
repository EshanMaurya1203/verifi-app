import { NextResponse } from "next/server";
import { calculateVerificationScore } from "@/lib/verification";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { detectFraud } from "@/lib/fraud";
import { logger, LogEvent } from "@/lib/logger";
import { PostgresError } from "@/types/postgres";

type StartupSubmissionPayload = {
  name: string;
  email: string;
  startup_name: string;
  website?: string;
  biz_type: string;
  mrr: string | number;
  arr: string | number;
  payment_methods: string[];
  twitter?: string;
  linkedin?: string;
  city: string;
  notes?: string;
  verification_type?: string;
  proof_object_id?: string | null;
  confidence_score?: number;
  verified_revenue?: number | null;
  verification_source?: string | null;
};

import {
  validateOnboarding,
  normalizeStartupName,
  slugify,
  mapConstraintToConflictCode,
  ConflictResponse,
} from "@/lib/validation/onboarding";

/**
 * Server-only helper to generate a unique, sequential routing slug.
 * Behavior: acme-ai, acme-ai-2, acme-ai-3, acme-ai-4
 */
async function generateUniqueSlug(startupName: string): Promise<string> {
  const baseSlug = slugify(startupName) || "startup";

  // Check if baseSlug is available
  const { data: existingBase } = await supabaseServer
    .from("startup_submissions")
    .select("slug")
    .eq("slug", baseSlug)
    .maybeSingle();

  if (!existingBase) {
    return baseSlug;
  }

  // Fetch all existing slugs matching `${baseSlug}-%`
  const { data: existingSlugs } = await supabaseServer
    .from("startup_submissions")
    .select("slug")
    .like("slug", `${baseSlug}-%`);

  const slugSet = new Set((existingSlugs || []).map((r) => r.slug));

  let counter = 2;
  while (slugSet.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}

const allowedVerificationTypes = new Set(["manual", "social", "proof", "api"]);

const allowedPaymentMethods = new Set([
  "razorpay",
  "stripe",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isNumericValue(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function isWithinMaxLength(value: string | undefined, maxLength: number): boolean {
  if (typeof value !== "string") return true;
  return value.trim().length <= maxLength;
}



function validatePayload(payload: StartupSubmissionPayload): string | null {
  if (!isNonEmptyString(payload.name)) return "name is required";
  if (!isNonEmptyString(payload.email)) return "email is required";
  if (!isValidEmail(payload.email.trim())) return "email is invalid";
  if (!isNonEmptyString(payload.startup_name)) return "startup_name is required";
  if (!isNonEmptyString(payload.biz_type)) return "biz_type is required";
  if (payload.mrr == null || payload.mrr === "") return "mrr is required";
  if (payload.arr == null || payload.arr === "") return "arr is required";
  if (!isNonEmptyString(payload.city)) return "city is required";
  if (!isWithinMaxLength(payload.name, 120)) return "name is too long";
  if (!isWithinMaxLength(payload.startup_name, 120))
    return "startup_name is too long";
  if (!isWithinMaxLength(payload.website, 200)) return "website is too long";
  if (!isWithinMaxLength(payload.biz_type, 80)) return "biz_type is too long";
  if (!isWithinMaxLength(payload.city, 120)) return "city is too long";
  if (!isWithinMaxLength(payload.twitter, 120)) return "twitter is too long";
  if (!isWithinMaxLength(payload.linkedin, 200)) return "linkedin is too long";
  if (!isWithinMaxLength(payload.notes, 2000)) return "notes is too long";

  if (!Array.isArray(payload.payment_methods) || payload.payment_methods.length < 1) {
    return "payment_methods must have at least one entry";
  }

  const hasInvalidMethod = payload.payment_methods.some(
    (method) => !allowedPaymentMethods.has(method)
  );
  if (hasInvalidMethod) {
    return "payment_methods contains unsupported provider";
  }

  return null;
}

import { getAuthenticatedUser } from "@/lib/auth-server";
import { handleFirstStartupCreated } from "@/lib/onboarding/service";

async function findExistingActiveStartup(userId: string, startupName: string) {
  const { data } = await supabaseServer
    .rpc("find_active_startup", { p_user_id: userId, p_startup_name: startupName })
    .select("*")
    .maybeSingle();
  return data as any;
}

export async function POST(req: Request) {
  try {
    const identifier = getClientIdentifier(req);
    const { allowed } = await checkRateLimit(identifier, 120000, 5);

    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = user.id;
    const rawPayload = await req.json();

    const validation = validateOnboarding(rawPayload);
    if (!validation.isValid || !validation.data) {
      const primaryError = validation.errors[0]?.message || "Validation failed";
      return NextResponse.json(
        {
          success: false,
          error: primaryError,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;
    const normalizedStartupName = normalizeStartupName(data.startup_name);
    const mrrValue = data.mrr;
    const arrValue = data.arr;
    const validVerificationType = data.verification_type;

    const confidenceScore = calculateVerificationScore(data);

    let canonical_proof_url: string | null = null;

    if (data.proof_object_id) {
      // 1. Verify existence using .list() scoped to the authenticated user's namespace
      const { data: files, error: listError } = await supabaseServer.storage
        .from('proofs')
        .list(userId, { search: data.proof_object_id });

      if (listError || !files || files.length === 0) {
        return NextResponse.json({ success: false, error: "Uploaded proof file not found" }, { status: 400 });
      }

      // Ensure exact match in the returned files
      const fileMetadata = files.find(f => f.name === data.proof_object_id);
      if (!fileMetadata) {
        return NextResponse.json({ success: false, error: "Uploaded proof file not found" }, { status: 400 });
      }

      // 2. Validate Size (Max 10MB limit, reject empty)
      const size = fileMetadata.metadata?.size;
      if (typeof size === "number" && size === 0) {
        return NextResponse.json({ success: false, error: "Uploaded file is corrupted." }, { status: 400 });
      }
      if (typeof size !== "number" || size > 10 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "File exceeds 10 MB limit." }, { status: 400 });
      }

      // 3. Download object to perform magic-byte validation
      const { data: fileBlob, error: downloadError } = await supabaseServer.storage
        .from('proofs')
        .download(`${userId}/${fileMetadata.name}`);
      
      if (downloadError || !fileBlob || fileBlob.size === 0) {
        return NextResponse.json({ success: false, error: "Uploaded file is corrupted." }, { status: 400 });
      }

      // 4. Magic-byte / MIME validation (PNG, JPEG, WEBP, PDF)
      const arrayBuffer = await fileBlob.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        return NextResponse.json({ success: false, error: "Uploaded file is corrupted." }, { status: 400 });
      }
      const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
      
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isWEBP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // RIFF
      const isPDF =
        fileBlob.type === "application/pdf" &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46; // %PDF
      
      if (!isPNG && !isJPEG && !isWEBP && !isPDF) {
        return NextResponse.json({ success: false, error: "Only PDF, PNG, JPG, and WEBP files are allowed." }, { status: 400 });
      }

      // 5. Save the exact canonical object key returned by Storage
      canonical_proof_url = `${userId}/${fileMetadata.name}`;
    }

    let verification_status = "pending";

    if (canonical_proof_url) {
      verification_status = "proof_submitted";
    }

    let verification_label = "Pending";

    if (canonical_proof_url) {
      verification_label = "Proof Verified";
    }

    const fraudAssessment = detectFraud({
      amount: mrrValue,
      previousTransactions: [],
      timestamps: [],
      now: Date.now()
    });

    const risk_level = fraudAssessment.isFraud ? "high" : "low";
    const fraud_score = fraudAssessment.isFraud ? 30 : 100;

    let trust_score = 0;

    // Proof upload signal
    if (canonical_proof_url) {
      trust_score += 20;
    }

    // Profile signals
    if (data.website) {
      trust_score += 5;
    }

    if (data.twitter || data.linkedin) {
      trust_score += 5;
    }

    if (data.startup_name && data.city) {
      trust_score += 5;
    }

    // Fraud adjustment
    if (risk_level === "low") {
      trust_score += 10;
    }

    if (risk_level === "high") {
      trust_score -= 30;
    }

    // Cap score bounds (0 to 100)
    trust_score = Math.max(0, trust_score);
    trust_score = Math.min(trust_score, 100);

    const final_score = trust_score;

    const trust_breakdown = {
      api_verified: false,
      proof_uploaded: !!canonical_proof_url,
      has_website: !!data.website,
      has_socials: !!(data.twitter || data.linkedin),
      complete_profile: !!(data.startup_name && data.city),
    };

    // Initialize mrr_breakdown as empty provider cache
    const mrr_breakdown: Record<string, number> = {};

    const trust_summary = [];

    if (canonical_proof_url) {
      trust_summary.push("Revenue supported by proof");
    }

    if (data.website) {
      trust_summary.push("Has active website");
    }

    if (data.twitter || data.linkedin) {
      trust_summary.push("Active social presence");
    }

    if (risk_level === "low") {
      trust_summary.push("Low fraud risk detected");
    }

    if (risk_level === "high") {
      trust_summary.push("Potential risk signals detected");
    }

    const existingBeforeInsert = await findExistingActiveStartup(userId, normalizedStartupName);

    if (existingBeforeInsert) {
      return NextResponse.json(
        {
          success: false,
          code: "STARTUP_ALREADY_EXISTS",
          message: "You already have a startup with this name.",
          startupId: String(existingBeforeInsert.id),
          slug: existingBeforeInsert.slug ?? undefined,
        } satisfies ConflictResponse,
        { status: 409 }
      );
    }

    let slugCandidate = await generateUniqueSlug(normalizedStartupName);
    let insertedData: { id: number; slug: string | null }[] | null = null;
    let insertError: { message: string; code?: string } | null = null;
    let conflictResponse: ConflictResponse | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error } = await supabaseServer
        .from("startup_submissions")
        .insert([
          {
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            startup_name: normalizedStartupName,
            website: data.website?.trim() || null,
            biz_type: data.biz_type.trim(),
            mrr: mrrValue,
            arr: arrValue,
            payment_methods: data.payment_methods,
            twitter: data.twitter?.trim() || null,
            linkedin: data.linkedin?.trim() || null,
            city: data.city.trim(),
            notes: data.notes?.trim() || null,
            user_id: userId,
            proof_url: canonical_proof_url,
            verification_type: validVerificationType,
            confidence: confidenceScore,
            verification_status,
            verified_revenue: null,
            verification_source: null,
            last_verified_at: null,
            trust_score: final_score,
            mrr_breakdown: mrr_breakdown,
            payment_connected: false,
            slug: slugCandidate,
          },
        ])
        .select("id, slug");

      if (!error && row) {
        insertedData = row;
        insertError = null;
        break;
      }

      insertError = error;
      const pgError = error as PostgresError;
      if (pgError?.code === "23505") {
        logger.warn("Duplicate startup submission", {
          event: LogEvent.STARTUP_DUPLICATE_SUBMISSION,
          userId: userId,
          startupName: normalizedStartupName,
          code: pgError.code,
          constraint: pgError.constraint,
          message: pgError.message,
        });

        const constraintName = pgError.constraint || null;
        const code = mapConstraintToConflictCode(constraintName);
        
        if (code === "STARTUP_ALREADY_EXISTS") {
          const existing = await findExistingActiveStartup(userId, normalizedStartupName);
          conflictResponse = {
            success: false,
            code: "STARTUP_ALREADY_EXISTS",
            message: "You already have a startup with this name.",
            startupId: existing ? String(existing.id) : undefined,
            slug: existing?.slug || undefined,
          };
          break;
        }

        if (code === "SLUG_CONFLICT") {
          slugCandidate = await generateUniqueSlug(normalizedStartupName);
          if (attempt === 4) {
            conflictResponse = {
              success: false,
              code: "SLUG_CONFLICT",
              message: "This startup slug already exists.",
            };
          }
          continue;
        }

        conflictResponse = {
          success: false,
          code: "DUPLICATE_SUBMISSION",
          message: "A submission already exists.",
        };
        break;
      }
      break;
    }

    if (conflictResponse) {
      return NextResponse.json(
        {
          success: false,
          code: conflictResponse.code,
          message: conflictResponse.message,
          startupId: conflictResponse.startupId,
          slug: conflictResponse.slug,
        } satisfies ConflictResponse,
        { status: 409 }
      );
    }

    if (insertError || !insertedData?.length) {
      logger.error("Failed to insert startup submission", {
        event: LogEvent.STARTUP_SUBMISSION_FAILURE,
        userId: userId,
        startupName: normalizedStartupName,
        error: insertError?.message,
        code: (insertError as PostgresError)?.code,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unable to complete submission. Please check your details and try again.",
        },
        { status: 400 }
      );
    }

    const startupId = insertedData[0]?.id;

    if (startupId) {
      // Trigger onboarding workflow as a non-blocking secondary side effect
      await handleFirstStartupCreated(
        userId,
        data.email,
        data.name,
        normalizedStartupName,
        startupId
      );
    }

    // Log Listing Created
    if (startupId) {
      try {
        const { error: logError } = await supabaseServer.from("verification_logs").insert({
          startup_id: startupId,
          event: "listing_created",
          metadata: { name: normalizedStartupName }
        });
        if (logError) {
          logger.warn("Failed to insert verification log", {
            event: LogEvent.VERIFICATION_LOG_FAILURE,
            startupId,
            userId: userId,
            error: logError.message,
            code: logError.code,
          });
        }
      } catch (err) {
        logger.warn("Exception while inserting verification log", {
          event: LogEvent.VERIFICATION_LOG_EXCEPTION,
          startupId,
          userId: userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const { count, error: countError } = await supabaseServer
      .from("startup_submissions")
      .select("*", { count: "exact", head: true });

    if (countError) {
      logger.warn("startup submission count error", {
        event: LogEvent.SUBMISSION_COUNT_ERROR,
        error: countError.message,
      });
    }

    const slotNumber = typeof count === "number" ? count : null;
    return NextResponse.json({
      success: true,
      slot_number: slotNumber,
      startup_id: startupId,
      slug: insertedData[0]?.slug ?? null,
      data: insertedData,
    });
  } catch (error) {
    logger.error("API Error during submission", {
      event: LogEvent.API_SUBMISSION_ERROR,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

const PUBLIC_STARTUP_FIELDS =
  "id, slug, startup_name, biz_type, mrr, arr, city, website, twitter, linkedin, trust_score, verification_status, payment_connected, mrr_breakdown, created_at";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = await checkRateLimit(identifier, 60000, 15, { failOpen: true });
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const { data, error } = await supabaseServer
      .from("startup_submissions")
      .select(PUBLIC_STARTUP_FIELDS)
      .eq("is_public", true)
      .order("trust_score", { ascending: false });

    if (error) {
      logger.error("startup submissions fetch error", {
        event: LogEvent.SUBMISSIONS_FETCH_ERROR,
        error: error.message,
      });
      return NextResponse.json(
        { success: false, error: "Unable to fetch submissions" },
        { status: 500 }
      );
    }

    const publicData = (data || []).map((row) => ({
      ...row,
      email: undefined,
      name: undefined,
    }));

    return NextResponse.json(
      { success: true, data: publicData },
      {
        headers: {
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
        },
      }
    );
  } catch (error) {
    logger.error("startup submissions GET exception", {
      event: LogEvent.SUBMISSIONS_GET_EXCEPTION,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}

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
  user_id: string;
  verification_type?: string;
  proof_object_id?: string | null;
  confidence_score?: number;
  verified_revenue?: number | null;
  verification_source?: string | null;
  verified_api_key?: string | null;
};

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w-]+/g, '')  // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

const allowedVerificationTypes = new Set(["manual", "social", "proof", "api"]);

const allowedPaymentMethods = new Set([
  "razorpay",
  "stripe",
  "cashfree",
  "paddle",
  "lemon-squeezy",
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
  if (!isNonEmptyString(payload.user_id)) return "user_id is required";
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
    const { allowed } = checkRateLimit(identifier, 120000, 5);

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

    const data = (await req.json()) as StartupSubmissionPayload;

    // Prevent anonymous user_id spoofing by matching with authenticated session user
    if (data.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized user ID binding" },
        { status: 403 }
      );
    }



    const validationError = validatePayload(data);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    const normalizedStartupName = data.startup_name.trim();



    const mrrValue = typeof data.mrr === "number" ? data.mrr : Number(data.mrr.trim());
    const arrValue = typeof data.arr === "number" ? data.arr : Number(data.arr.trim());

    if (isNaN(mrrValue)) return NextResponse.json({ success: false, error: "mrr must be numeric" }, { status: 400 });
    if (isNaN(arrValue)) return NextResponse.json({ success: false, error: "arr must be numeric" }, { status: 400 });

    const verificationType = data.verification_type?.trim() || "manual";
    const validVerificationType = allowedVerificationTypes.has(verificationType)
      ? verificationType
      : "manual";

    const confidenceScore = calculateVerificationScore(data);

    let canonical_proof_url: string | null = null;

    if (data.proof_object_id) {
      // 1. Verify existence using .list() scoped to the authenticated user's namespace
      const { data: files, error: listError } = await supabaseServer.storage
        .from('proofs')
        .list(user.id, { search: data.proof_object_id });

      if (listError || !files || files.length === 0) {
        return NextResponse.json({ success: false, error: "Uploaded proof file not found" }, { status: 400 });
      }

      // Ensure exact match in the returned files
      const fileMetadata = files.find(f => f.name === data.proof_object_id);
      if (!fileMetadata) {
        return NextResponse.json({ success: false, error: "Uploaded proof file not found" }, { status: 400 });
      }

      // 2. Validate Size (Max 5MB)
      const size = fileMetadata.metadata?.size;
      if (typeof size !== "number" || size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: "Invalid or oversized proof file (max 5MB limit)" }, { status: 400 });
      }

      // 3. Download object to perform magic-byte validation
      const { data: fileBlob, error: downloadError } = await supabaseServer.storage
        .from('proofs')
        .download(`${user.id}/${fileMetadata.name}`);
      
      if (downloadError || !fileBlob) {
        return NextResponse.json({ success: false, error: "Could not validate proof file contents" }, { status: 400 });
      }

      // 4. Magic-byte / MIME validation
      const arrayBuffer = await fileBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
      
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
      const isWEBP = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // RIFF
      
      if (!isPNG && !isJPEG && !isWEBP) {
        return NextResponse.json({ success: false, error: "Invalid file type. Only PNG, JPEG, and WEBP are allowed." }, { status: 400 });
      }

      // 5. Save the exact canonical object key returned by Storage
      canonical_proof_url = `${user.id}/${fileMetadata.name}`;
    }

    let verification_status = "syncing";

    if (data.verified_revenue) {
      verification_status = "api_verified";
    } else if (canonical_proof_url) {
      verification_status = "proof_submitted";
    }

    let verification_label = "Syncing";

    if (data.verified_revenue) {
      verification_label = "API Verified";
    } else if (canonical_proof_url) {
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

    // Strong signals
    if (data.verified_revenue) {
      trust_score += 50;
    }

    if (canonical_proof_url) {
      trust_score += 20;
    }

    // Weak signals
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
      api_verified: !!data.verified_revenue,
      proof_uploaded: !!canonical_proof_url,
      has_website: !!data.website,
      has_socials: !!(data.twitter || data.linkedin),
      complete_profile: !!(data.startup_name && data.city),
    };

    // Initialize mrr_breakdown
    const mrr_breakdown: Record<string, number> = {};
    if (data.verified_revenue && data.verification_source) {
      mrr_breakdown[data.verification_source] = Number(data.verified_revenue);
    }

    const trust_summary = [];

    if (data.verified_revenue) {
      trust_summary.push("Revenue verified via API");
    } else if (canonical_proof_url) {
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

    const existingBeforeInsert = await findExistingActiveStartup(data.user_id, normalizedStartupName);

    if (existingBeforeInsert) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
        startup_id: existingBeforeInsert.id,
        slug: existingBeforeInsert.slug,
        data: [existingBeforeInsert]
      });
    }

    const baseSlug = slugify(normalizedStartupName);
    let slugCandidate = `${baseSlug}-${Math.floor(Math.random() * 10000)}`;
    let insertedData: { id: number; slug: string | null }[] | null = null;
    let insertError: { message: string; code?: string } | null = null;

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
            user_id: data.user_id,
            proof_url: canonical_proof_url,
            verification_type: validVerificationType,
            confidence: confidenceScore,
            verification_status,
            verified_revenue: data.verified_revenue || null,
            verification_source: data.verification_source || null,
            last_verified_at: data.verified_revenue ? new Date().toISOString() : null,
            trust_score: final_score,
            mrr_breakdown: mrr_breakdown,
            payment_connected: !!data.verified_revenue,
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
          userId: data.user_id,
          startupName: normalizedStartupName,
          code: pgError.code,
          constraint: pgError.constraint,
          message: pgError.message,
        });

        const constraint = pgError.constraint;
        
        if (constraint === "idx_unique_active_startup_per_user") {
          const existing = await findExistingActiveStartup(data.user_id, normalizedStartupName);

          if (existing) {
            return NextResponse.json({
              success: true,
              deduplicated: true,
              startup_id: existing.id,
              slug: existing.slug,
              data: [existing],
            });
          }
          break;
        }

        if (constraint === "startup_submissions_slug_key") {
          slugCandidate = `${baseSlug}-${Math.floor(Math.random() * 100000)}`;
          continue;
        }

        break;
      }
      break;
    }

    if (insertError || !insertedData?.length) {
      logger.error("Failed to insert startup submission", {
        event: LogEvent.STARTUP_SUBMISSION_FAILURE,
        userId: data.user_id,
        startupName: normalizedStartupName,
        error: insertError?.message,
        code: (insertError as PostgresError)?.code,
      });
      return NextResponse.json(
        {
          success: false,
          error: insertError?.message || "Failed to create startup listing",
          details: insertError,
        },
        { status: 400 }
      );
    }

    const startupId = insertedData[0]?.id;

    if (startupId) {
      // Trigger onboarding workflow as a non-blocking secondary side effect
      await handleFirstStartupCreated(
        data.user_id,
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
            userId: data.user_id,
            error: logError.message,
            code: logError.code,
          });
        }
      } catch (err) {
        logger.warn("Exception while inserting verification log", {
          event: LogEvent.VERIFICATION_LOG_EXCEPTION,
          startupId,
          userId: data.user_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Save provider connection if verified
    if (startupId && data.verified_revenue && data.verification_source && data.verified_api_key) {
      try {
        const { encrypt } = await import("@/lib/encryption");
        let accountId = data.verified_api_key;
        let encryptedCredential = encrypt(data.verified_api_key);

        if (data.verification_source === "razorpay" && data.verified_api_key.includes(":")) {
          const [keyId, keySecret] = data.verified_api_key.split(":");
          accountId = keyId;
          encryptedCredential = encrypt(keySecret);
        }

        const { error: providerError } = await supabaseServer.from("provider_connections").upsert(
          {
            startup_id: startupId,
            provider: data.verification_source,
            account_id: accountId,
            api_key_encrypted: encryptedCredential,
            status: "connected",
            latest_revenue: Number(data.verified_revenue),
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "startup_id,provider" }
        );
        if (providerError) {
          logger.warn("Failed to upsert provider connection", {
            event: LogEvent.PROVIDER_CONNECTION_FAILURE,
            startupId,
            userId: data.user_id,
            provider: data.verification_source,
            error: providerError.message,
            code: providerError.code,
          });
        } else {
          // Trigger Provider Connected notification (best-effort side effect)
          try {
            const { handleProviderConnected } = await import("@/lib/providers/service");
            await handleProviderConnected({
              startupId,
              userId: data.user_id,
              startupName: data.startup_name,
              provider: data.verification_source,
            });
          } catch (err) {
            // Non-blocking catch per ADR-023
          }
        }
      } catch (err) {
        logger.warn("Exception while upserting provider connection", {
          event: LogEvent.PROVIDER_CONNECTION_EXCEPTION,
          startupId,
          userId: data.user_id,
          provider: data.verification_source,
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
  const { allowed } = checkRateLimit(identifier, 120000, 5);
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

    return NextResponse.json({ success: true, data: publicData });
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

# Founder Onboarding Audit Bundle

Repository commit (if available): N/A (Local Workspace)
Framework: Next.js (React), Supabase
Total files: 36
Generated timestamp: 2026-07-18T13:48:02.835Z

## File Inventory
- src/app/api/razorpay/verify/route.ts
- src/app/api/startup/[id]/proof/route.ts
- src/app/api/startup-submissions/count/route.ts
- src/app/api/startup-submissions/route.ts
- src/app/api/stripe/connect/route.ts
- src/app/api/stripe/verify/route.ts
- src/app/api/verify/one-off/route.ts
- src/app/api/verify/revenue/route.ts
- src/app/submit/layout.tsx
- src/app/submit/page.tsx
- src/components/startup/ConnectionStatus.tsx
- src/components/startup/FounderVerificationFlow.tsx
- src/components/startup/RazorpayOnboarding.tsx
- src/components/startup/VerificationFlow.tsx
- src/lib/providers/error-mapping.ts
- src/lib/providers/errors.ts
- src/lib/providers/index.ts
- src/lib/providers/pipeline.ts
- src/lib/providers/provider.ts
- src/lib/providers/razorpay.ts
- src/lib/providers/registry.ts
- src/lib/providers/services/fraud-service.ts
- src/lib/providers/services/index.ts
- src/lib/providers/services/revenue-service.ts
- src/lib/providers/stripe.ts
- src/lib/providers/types.ts
- src/lib/stripe-connect.ts
- src/lib/verification-confidence.ts
- src/lib/verification-config.ts
- src/lib/verification-data.ts
- src/lib/verification-state.ts
- src/lib/verification.ts
- supabase/migrations/20260520000000_submission_fields.sql
- supabase/migrations/20260716000000_proofs_storage_rls.sql
- supabase/migrations/20260716120000_unique_active_startup_per_user.sql
- supabase/migrations/20260716130000_find_active_startup_rpc.sql


====================================================
FILE: src/app/api/razorpay/verify/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { verifyRazorpayApiKeys } from "@/lib/razorpay-sync";

/**
 * Razorpay Verification API (/api/razorpay/verify)
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { key_id, key_secret, startup_id } = await req.json();

    if (!key_id || !key_secret || !startup_id) {
      return NextResponse.json(
        { success: false, error: "Missing keys or startup ID" },
        { status: 400 }
      );
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startup_id);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user!.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required to connect integration" },
        { status: 403 }
      );
    }

    const result = await verifyRazorpayApiKeys({
      keyId: key_id,
      keySecret: key_secret,
      startupId: Number(startup_id),
    });

    return NextResponse.json({
      success: true,
      message: "Razorpay connected and initial sync complete",
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
    });
  } catch (err: any) {
    const { getFriendlyErrorMessage } = await import("@/lib/providers/error-mapping");
    const isProviderError = err && err.name === "ProviderError";
    const message = getFriendlyErrorMessage("razorpay", err);
    const isClientError =
      message.includes("No revenue") ||
      message.includes("Invalid") ||
      message.includes("Missing") ||
      message.includes("Live Razorpay authentication failed");

    const status = isProviderError && err.statusCode !== 500
      ? err.statusCode
      : (isClientError ? 400 : 500);

    // Ensure logs contain the full structured object
    console.error("[Razorpay Verify] Error:", isProviderError ? (err.originalError || err) : err);

    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

```

====================================================
FILE: src/app/api/startup/[id]/proof/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/isAdmin";
import { getAuthenticatedUser } from "@/lib/auth-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // 1. Get authenticated user
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch the submission
    const { data: submission, error: submissionError } = await supabaseServer
      .from("startup_submissions")
      .select("user_id, proof_url")
      .eq("id", id)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!submission.proof_url) {
      return NextResponse.json({ error: "No proof uploaded" }, { status: 404 });
    }

    // 3. Verify access (Must be the owner or an admin)
    const isOwner = submission.user_id === user.id;
    const adminUser = isAdmin(user.email);

    if (!isOwner && !adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Use the canonical proof_url directly
    const filePath = submission.proof_url;

    // 5. Generate the signed URL (valid for 60 seconds)
    const { data, error } = await supabaseServer.storage
      .from("proofs")
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      console.error("Signed URL generation failed:", error);
      return NextResponse.json(
        { error: "Failed to generate access URL" },
        { status: 500 }
      );
    }

    // 6. Redirect to the signed URL
    return NextResponse.redirect(data.signedUrl);
  } catch (err: any) {
    console.error("Proof API Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

```

====================================================
FILE: src/app/api/startup-submissions/count/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const { count, error } = await supabaseServer
    .from("startup_submissions")
    .select("*", { count: "exact", head: true })
    .eq("is_public", true);

  if (error) {
    console.error("startup submissions count error", error.message);
    return NextResponse.json(
      { count: 0, error: "Unable to fetch submission count" },
      { status: 500 }
    );
  }

  return NextResponse.json({ count: count ?? 0 });
}

```

====================================================
FILE: src/app/api/startup-submissions/route.ts
====================================================

```typescript
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

```

====================================================
FILE: src/app/api/stripe/connect/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import {
  buildStripeConnectAuthorizeUrl,
  signStripeOAuthState,
} from "@/lib/stripe-connect";

/**
 * Starts Stripe Connect OAuth (read-only).
 * GET /api/stripe/connect?startup_id={id}
 */
export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 10);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startupIdRaw = searchParams.get("startup_id");
    const startupId = Number(startupIdRaw);

    if (!startupIdRaw || !Number.isFinite(startupId)) {
      return NextResponse.json({ error: "startup_id is required" }, { status: 400 });
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startupId);
    if (!authenticated || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required to connect integration" },
        { status: 403 }
      );
    }

    const state = signStripeOAuthState({ startupId, userId: user.id });
    const authorizeUrl = buildStripeConnectAuthorizeUrl(state);

    return NextResponse.redirect(authorizeUrl);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unable to start Stripe Connect";
    console.error("[Stripe Connect] Start error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

```

====================================================
FILE: src/app/api/stripe/verify/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { verifyStartupOwnership } from "@/lib/auth-server";
import { verifyManualStripeApiKey } from "@/lib/stripe-sync";

/**
 * Stripe Verification API (/api/stripe/verify)
 * Manual secret-key connection (existing UI flow).
 */
export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { apiKey, startupId } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }

    if (!startupId) {
      return NextResponse.json({ error: "startupId is required" }, { status: 400 });
    }

    const { authenticated, owned, user } = await verifyStartupOwnership(startupId);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json(
        { error: "Unauthorized startup ownership check failed" },
        { status: 403 }
      );
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user!.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required to connect integration" },
        { status: 403 }
      );
    }

    const result = await verifyManualStripeApiKey({
      apiKey,
      startupId: Number(startupId),
    });

    return NextResponse.json({
      revenue: result.revenue,
      breakdown: result.breakdown,
      currency: result.currency,
      total_transactions: result.total_transactions,
      connection_type: result.connection_type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe verification failed";
    const isClientError =
      message.includes("No revenue") ||
      message.includes("Invalid") ||
      message.includes("required");

    console.error("[Stripe Verify] Error:", err);
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}

```

====================================================
FILE: src/app/api/verify/one-off/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import Razorpay from "razorpay";

import { getAuthenticatedUser } from "@/lib/auth-server";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { provider, apiKey, keyId, keySecret } = await req.json();

    if (provider === "stripe") {
      if (!apiKey) return NextResponse.json({ error: "Missing Stripe key" }, { status: 400 });
      const stripe = new Stripe(apiKey, { apiVersion: "2023-10-16" as any });
      
      const subscriptions = await stripe.subscriptions.list({
        status: "active",
        expand: ["data.default_payment_method"],
      });

      let mrr = 0;
      for (const sub of subscriptions.data) {
        const item = sub.items.data[0];
        if (item && item.plan && item.plan.amount) {
          const amount = item.plan.amount;
          const interval = item.plan.interval;
          const quantity = item.quantity || 1;

          let monthlyAmount = amount;
          if (interval === "year") monthlyAmount = amount / 12;
          if (interval === "week") monthlyAmount = amount * 4;
          
          mrr += (monthlyAmount / 100) * quantity;
        }
      }
      
      return NextResponse.json({ success: true, revenue: mrr, currency: "USD" });
    }

    if (provider === "razorpay") {
      if (!keyId || !keySecret) {
        return NextResponse.json({ error: "Missing Razorpay credentials" }, { status: 400 });
      }
      
      const { providerRegistry } = await import("@/lib/providers");
      const rzpProvider = providerRegistry.get("razorpay");
      if (!rzpProvider) {
        return NextResponse.json({ error: "Razorpay provider not found" }, { status: 500 });
      }

      const valid = await rzpProvider.verifyCredentials({ keyId, keySecret });
      if (!valid) {
        return NextResponse.json({ error: "Invalid Razorpay credentials" }, { status: 400 });
      }

      const result = await rzpProvider.fetchRevenue(keyId, keySecret);
      return NextResponse.json({ success: true, revenue: result.revenue, currency: result.currency });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (err: any) {
    const { normalizeProviderError } = await import("@/lib/providers/errors");
    const { getFriendlyErrorMessage } = await import("@/lib/providers/error-mapping");
    const normalized = normalizeProviderError(err);
    const friendlyMessage = getFriendlyErrorMessage("razorpay", normalized);
    console.error("One-off verification error:", normalized.originalError);
    return NextResponse.json({ error: friendlyMessage }, { status: normalized.statusCode });
  }
}

```

====================================================
FILE: src/app/api/verify/revenue/route.ts
====================================================

```typescript
import { NextResponse } from "next/server";
import { getClientIdentifier, checkRateLimit } from "@/lib/rate-limit";
import { getAggregatedRevenue } from "@/lib/revenue-aggregation";

/**
 * Unified Revenue Verification API
 *
 * Fetches live revenue from ALL connected providers for a startup,
 * aggregates the total, persists the result, and returns it.
 *
 * POST /api/verify/revenue
 * Body: { startup_id: number }
 */
import { verifyStartupOwnership } from "@/lib/auth-server";

export async function POST(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const { startup_id } = await req.json();

    if (!startup_id) {
      return NextResponse.json(
        { success: false, error: "Missing startup_id" },
        { status: 400 }
      );
    }

    // Enforce authentication and strict startup ownership validation
    const { authenticated, owned, user } = await verifyStartupOwnership(startup_id);
    if (!authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!owned) {
      return NextResponse.json({ error: "Unauthorized startup ownership check failed" }, { status: 403 });
    }

    const { getUserPlan } = await import("@/lib/subscriptions");
    const plan = await getUserPlan(user!.id);
    if (plan.plan_code === "viewer") {
      return NextResponse.json(
        { error: "Subscription required for manual sync" },
        { status: 403 }
      );
    }

    const result = await getAggregatedRevenue(startup_id);

    if (result.providers.length === 0) {
      return NextResponse.json(
        { success: false, error: "No connected revenue sources found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      revenue: result.totalRevenue,
      breakdown: result.breakdown,
      providers: result.providers.map((p) => ({
        provider: p.provider,
        revenue: p.revenue,
        currency: p.currency,
        status: p.success ? "synced" : "error",
        error: p.error,
      })),
    });
  } catch (error: any) {
    console.error("Revenue aggregation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

```

====================================================
FILE: src/app/submit/layout.tsx
====================================================

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit Startup",
  description: "Submit your startup to Verifii's verified revenue database and get your public profile.",
  alternates: {
    canonical: "https://www.verifii.in/submit/",
  }
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://www.verifii.in/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Submit Startup",
      "item": "https://www.verifii.in/submit/"
    }
  ]
};

export default function SubmitLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}

```

====================================================
FILE: src/app/submit/page.tsx
====================================================

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { supabase } from "@/lib/supabase";
import { safeFetch, safeSupabaseQuery } from "@/lib/safe-network";
import { getClientOAuthRedirect } from "@/lib/oauth-redirect";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type PaymentMethod = {
  id: string;
  label: string;
  badge: "API Verified" | "Coming Soon";
};

type FormState = {
  fullName: string;
  email: string;
  startupName: string;
  website: string;
  businessType: string;
  mrr: string;
  arr: string;
  twitter: string;
  linkedin: string;
  cityCountry: string;
  notes: string;
  paymentMethods: string[];
  verificationType: string;
  apiProvider: string;
  apiKey: string;
};

type FormErrors = Partial<Record<keyof FormState | "paymentMethods", string>>;
type Step = 1 | 2 | 3 | 4;

const paymentMethodOptions: PaymentMethod[] = [
  { id: "razorpay", label: "Razorpay", badge: "API Verified" },
  { id: "stripe", label: "Stripe", badge: "API Verified" },
  { id: "cashfree", label: "Cashfree", badge: "Coming Soon" },
  { id: "paddle", label: "Paddle", badge: "Coming Soon" },
  { id: "lemon-squeezy", label: "Lemon Squeezy", badge: "Coming Soon" },
];

const businessTypeOptions = [
  "SaaS/Software",
  "Artificial Intelligence",
  "Mobile App",
  "D2C/E-commerce",
  "Content/Creator",
  "Agency/Services",
  "Developer Tools",
  "Marketing Tools",
];

const initialForm: FormState = {
  fullName: "",
  email: "",
  startupName: "",
  website: "",
  businessType: "",
  mrr: "",
  arr: "",
  twitter: "",
  linkedin: "",
  cityCountry: "",
  notes: "",
  paymentMethods: [],
  verificationType: "",
  apiProvider: "stripe",
  apiKey: "",
};

function badgeClassName(type: PaymentMethod["badge"]) {
  if (type === "API Verified") {
    return "border border-primary/20 bg-primary/20 text-primary";
  }
  return "border border-white/10 bg-white/5 text-neutral-400";
}

export default function SubmitPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [claimedCount, setClaimedCount] = useState(0);
  const [slotNumber, setSlotNumber] = useState<number | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{ mrr: number; currency: string } | null>(null);
  const [verifiedRevenue, setVerifiedRevenue] = useState<number | null>(null);
  const [authError, setAuthError] = useState("");


  const handleVerifyRevenue = async () => {
    setSubmitError("");
    if (form.apiProvider === "stripe" && !form.apiKey) {
      setSubmitError("Please enter your Stripe Secret Key");
      return;
    }
    if (form.apiProvider === "razorpay" && !form.apiKey.includes(":")) {
      setSubmitError("Please enter Razorpay Key ID and Secret separated by a colon (ID:SECRET)");
      return;
    }

    setIsVerifying(true);
    const payload: any = { provider: form.apiProvider };
    if (form.apiProvider === "stripe") {
      payload.apiKey = form.apiKey;
    } else {
      const [id, secret] = form.apiKey.split(":");
      payload.keyId = id;
      payload.keySecret = secret;
    }

    const { data, ok, error } = await safeFetch<any>("/api/verify/one-off", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (ok && data && data.revenue !== undefined) {
      setVerifyStatus({ mrr: data.revenue, currency: data.currency });
      setVerifiedRevenue(data.revenue);
      // Automatically update the MRR field with the verified value
      onInputChange("mrr", Math.round(data.revenue).toString());
      setSuccessMessage(`Verified MRR: ${data.currency} ${Math.round(data.revenue)}`);
    } else {
      setSubmitError(error?.message || data?.error || "Verification failed");
    }
    setIsVerifying(false);
  };


  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleGoogleLogin = async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const nextParam = searchParams.get("next") || `${window.location.pathname}${window.location.search}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getClientOAuthRedirect("/auth/callback"),
      },
    });
  };

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-[#161616] px-4 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 focus:border-border";
  const labelClass =
    "mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground";
  const sectionTitleClass =
    "mb-4 border-b border-border pb-2 text-sm font-extrabold text-white uppercase tracking-wider";

  const twitterShareUrl = useMemo(() => {
    const text =
      "Just joined Verifii's founding member cohort. Building in public with verified revenue.";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }, []);
  const totalSpots = 50;
  const progressPercentage = Math.max(
    0,
    Math.min(100, (claimedCount / totalSpots) * 100)
  );
  const stepProgressPercentage = (step / 4) * 100;

  useEffect(() => {
    let isMounted = true;

    const initAuthAndData = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (currentUser) {
          setUser(currentUser);
          
          // Check action=verify redirect
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.get("action") === "verify") {
            const { data: startups } = await supabase
              .from("startup_submissions")
              .select("slug")
              .eq("user_id", currentUser.id)
              .order("created_at", { ascending: false });

            if (startups && startups.length > 0) {
              router.push(`/startup/${encodeURIComponent(startups[0].slug)}/verify`);
              return;
            }
          }
          setIsLoading(false);
        } else {
          // Unauthenticated user — show login prompt instead of auto-redirecting
          // Auto-redirecting creates an OAuth loop causing "bad_oauth_state" errors
          setIsLoading(false);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Auth] Current user verification deferred or interrupted:", err);
        }
        if (isMounted) {
          setIsLoading(false);
        }
      }

      const { data: countData, ok } = await safeFetch<any>("/api/startup-submissions/count");
      if (ok && countData && isMounted && typeof countData.count === "number") {
        setClaimedCount(countData.count);
      }
    };

    initAuthAndData();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          setIsLoading(false);
        } else if (event === "SIGNED_OUT") {
          setIsLoading(false);
        }
      }
    );

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = searchParams.get("error") || hashParams.get("error");
    const errorDesc = searchParams.get("error_description") || hashParams.get("error_description");
    
    if (error && isMounted) {
      setAuthError(errorDesc || error);
    }

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.email.trim()) nextErrors.email = "Email is required";
    if (!form.startupName.trim())
      nextErrors.startupName = "Startup / Business name is required";
    if (!form.businessType.trim())
      nextErrors.businessType = "Business type is required";
    if (!form.mrr.trim()) nextErrors.mrr = "MRR is required";
    if (!form.arr.trim()) nextErrors.arr = "ARR is required";
    if (!form.verificationType) nextErrors.verificationType = "Please select a verification method";
    if (!form.cityCountry.trim())
      nextErrors.cityCountry = "City / Country is required";
    if (!form.paymentMethods.length) {
      nextErrors.paymentMethods = "Select at least one payment method";
    }
    if (form.verificationType === "proof" && !proofFile) {
      nextErrors.verificationType = "Upload proof of revenue before submitting";
    }
    return nextErrors;
  };

  const validateStep = (stepToValidate: Step): FormErrors => {
    const nextErrors: FormErrors = {};

    if (stepToValidate === 1) {
      if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
      if (!form.email.trim()) nextErrors.email = "Email is required";
    }

    if (stepToValidate === 2) {
      if (!form.startupName.trim())
        nextErrors.startupName = "Startup / Business name is required";
      if (!form.businessType.trim())
        nextErrors.businessType = "Business type is required";
    }

    if (stepToValidate === 3) {
      if (!form.mrr.trim()) nextErrors.mrr = "MRR is required";
      if (!form.arr.trim()) nextErrors.arr = "ARR is required";
      if (!form.verificationType) nextErrors.verificationType = "Please select a verification method";
      if (!form.paymentMethods.length) {
        nextErrors.paymentMethods = "Select at least one payment method";
      }
      if (form.verificationType === "proof" && !proofFile) {
        nextErrors.verificationType = "Upload proof of revenue to continue";
      }
    }

    if (stepToValidate === 4) {
      if (!form.cityCountry.trim())
        nextErrors.cityCountry = "City / Country is required";
    }

    return nextErrors;
  };

  const handleNextStep = () => {
    const stepErrors = validateStep(step);
    setErrors((prev) => ({ ...prev, ...stepErrors }));
    if (Object.keys(stepErrors).length > 0) return;
    setStep((prev) => (prev < 4 ? ((prev + 1) as Step) : prev));
  };

  const handlePrevStep = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const onInputChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const togglePaymentMethod = (id: string) => {
    setForm((prev) => {
      const isSelected = prev.paymentMethods.includes(id);
      const paymentMethods = isSelected
        ? prev.paymentMethods.filter((item) => item !== id)
        : [...prev.paymentMethods, id];
      return { ...prev, paymentMethods };
    });
    setErrors((prev) => ({ ...prev, paymentMethods: undefined }));
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError("");

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      // Re-verify user is still authenticated
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setSubmitError("You must be logged in. Please refresh and try again.");
        setIsSubmitting(false);
        return;
      }

      let proof_object_id: string | null = null;

      if (proofFile) {
        const fileId = crypto.randomUUID();
        const uploadPath = `${authData.user.id}/${fileId}`;

        const { error: uploadError } = await supabase.storage
          .from("proofs")
          .upload(uploadPath, proofFile);

        if (uploadError) {
          console.error("UPLOAD ERROR:", uploadError);
          setSubmitError(uploadError.message);
          setIsSubmitting(false);
          return;
        }

        proof_object_id = fileId;
      }

      const confidenceMap: Record<string, number> = {
        manual: 20,
        social: 40,
        proof: 70,
        api: 100,
      };

      const payload = {
        name: form.fullName,
        email: form.email,
        startup_name: form.startupName,
        website: form.website,
        biz_type: form.businessType,
        mrr: Number(form.mrr),
        arr: Number(form.arr),
        verification_type: form.verificationType,
        payment_methods: form.paymentMethods,
        twitter: form.twitter,
        linkedin: form.linkedin,
        city: form.cityCountry,
        notes: form.notes,
        user_id: authData.user.id,
        proof_object_id: proof_object_id,
        confidence_score: confidenceMap[form.verificationType] ?? 0,
        verified_revenue: verifiedRevenue || null,
        verification_source: verifiedRevenue ? form.apiProvider : null,
        verified_api_key: verifiedRevenue ? form.apiKey : null,
      };



      const { data: result, ok, error } = await safeFetch<any>("/api/startup-submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!ok || !result || !result.success) {
        setSubmitError(error?.message || result?.error || "Submission failed. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const created = result.data?.[0] ?? result.data;
      const slug = result.slug ?? created?.slug;

      if (slug) {
        router.push(`/startup/${encodeURIComponent(slug)}/verify`);
        return;
      }

      setSuccessMessage("Startup submitted successfully!");
      setIsSuccess(true);
      if (typeof result.slot_number === "number") {
        setSlotNumber(result.slot_number);
      }
      setForm(initialForm);
      setStep(1);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("Submission error:", err);
      }
      setSubmitError("Submission failed. Please try again in a few moments.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#040406] text-white">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-primary border-r-2 border-r-transparent" />
        </div>
        <p className="mt-4 font-syne text-[10px] font-bold uppercase tracking-wider text-neutral-500 animate-pulse">
          Hydrating secure session...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#040406] px-6 text-white">
        <div className="w-full max-w-[400px] p-8 rounded-[2rem] bg-neutral-900/40 border border-white/5 relative overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full opacity-[0.05] bg-primary blur-3xl pointer-events-none" />
          
          <div className="text-center relative z-10">
            <h2 className="font-syne text-2xl font-black tracking-[-1px] text-white mb-2">
              Authentication Required
            </h2>
            <p className="text-xs font-semibold text-neutral-500 leading-relaxed mb-6">
              Listing your startup on Verifii requires a verified Google account.
            </p>

            {authError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Google Auth Error
                </p>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {authError === "unsupported_provider" || authError.toLowerCase().includes("not enabled") 
                    ? "Google OAuth provider is not enabled in your Supabase Auth settings. Please enable the Google provider in your Supabase Dashboard."
                    : authError}
                </p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              className="w-full h-12 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] transition-transform duration-100"
            >
              Continue with Google
            </button>
            
            <p className="text-[10px] font-bold text-neutral-600 tracking-wider mt-6 uppercase">
              Secure Auth by Supabase
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 text-foreground">
      <Navbar />

      <header className="mx-auto max-w-[640px] px-6 pt-12 text-center">
        <h1 className="font-syne text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
          List your startup on Verifii — <span className="text-primary">free</span>
        </h1>
        <p className="mt-3 text-base font-normal text-muted-foreground">
          Get verified and join the most transparent startup revenue database.
        </p>
      </header>

      <section className="mx-auto mt-8 max-w-[640px] px-6">
        <div className="rounded-xl border border-[rgba(245,166,35,0.2)] bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] text-muted-foreground">
              🔥 Founding member spots
            </div>
            <div className="font-syne text-[14px] font-bold text-[#f5a623]">
              {claimedCount} / {totalSpots} claimed
            </div>
          </div>
          <div className="mt-2.5 h-[3px] rounded-full bg-accent">
            <div
              className="h-[3px] rounded-full bg-[#f5a623]"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[640px] px-6 pb-20">
        <div className="relative mt-0 overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-10">
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-[#b9ff4b] to-transparent" />

          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-[60px] text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(185,255,75,0.3)] bg-primary/20">
                <Check className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-6 font-syne text-[32px] font-extrabold">You&apos;re in!</h2>
              <div className="mt-3 inline-flex rounded-lg border border-[rgba(185,255,75,0.3)] bg-primary/20 px-4 py-2 font-syne text-[16px] font-bold text-primary">
                Founding Member #{slotNumber ?? claimedCount + 1}
              </div>
              <p className="mt-4 max-w-[520px] text-[14px] text-muted-foreground">
                Your startup was created. Continue to connect your payment provider and
                complete verification.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={twitterShareUrl}
                  target="_blank"
                  className="rounded-xl border border-border bg-[#161616] px-4 py-2 text-sm text-foreground transition-colors hover:border-border"
                >
                  Share on Twitter
                </Link>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <ErrorBanner message={submitError} onClose={() => setSubmitError("")} className="mb-6" />
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>Step {step} of 4</span>
                  <span>{Math.round(stepProgressPercentage)}%</span>
                </div>
                <div className="h-2 rounded-full bg-accent">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${stepProgressPercentage}%` }}
                  />
                </div>
              </div>

              {step === 1 && (
                <section>
                  <h3 className={sectionTitleClass}>Founder info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Full name <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.fullName ? "border-border" : ""}`}
                        value={form.fullName}
                        onChange={(e) => onInputChange("fullName", e.target.value)}
                      />
                      {errors.fullName ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.fullName}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>
                        Email <span className="text-primary">*</span>
                      </label>
                      <input
                        type="email"
                        className={`${inputClass} ${errors.email ? "border-border" : ""}`}
                        value={form.email}
                        onChange={(e) => onInputChange("email", e.target.value)}
                      />
                      {errors.email ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.email}</p>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h3 className={sectionTitleClass}>Startup info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        Startup / Business name{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.startupName ? "border-border" : ""}`}
                        value={form.startupName}
                        onChange={(e) => onInputChange("startupName", e.target.value)}
                      />
                      {errors.startupName ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.startupName}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>Website URL</label>
                      <input
                        className={inputClass}
                        value={form.website}
                        onChange={(e) => onInputChange("website", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>
                      Business type <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <select
                        className={`${inputClass} appearance-none pr-10 ${errors.businessType ? "border-border" : ""}`}
                        value={form.businessType}
                        onChange={(e) => onInputChange("businessType", e.target.value)}
                      >
                        <option value="">Select business type</option>
                        {businessTypeOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    {errors.businessType ? (
                      <p className="mt-1 text-xs text-[#ff4b4b]">{errors.businessType}</p>
                    ) : null}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <h3 className={sectionTitleClass}>Revenue info</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>
                        MRR — Monthly Recurring Revenue{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.mrr ? "border-border" : ""}`}
                        value={form.mrr}
                        onChange={(e) => onInputChange("mrr", e.target.value)}
                      />
                      {errors.mrr ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.mrr}</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelClass}>
                        ARR — Annual Recurring Revenue{" "}
                        <span className="text-primary">*</span>
                      </label>
                      <input
                        className={`${inputClass} ${errors.arr ? "border-border" : ""}`}
                        value={form.arr}
                        onChange={(e) => onInputChange("arr", e.target.value)}
                      />
                      {errors.arr ? (
                        <p className="mt-1 text-xs text-[#ff4b4b]">{errors.arr}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-8">
                    <label className={labelClass}>
                      How do you want to verify your revenue? <span className="text-primary">*</span>
                    </label>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { id: "manual", label: "Manual", description: "(self-reported)" },
                        { id: "social", label: "Social proof", description: "(social profile confirmation)" },
                        { id: "proof", label: "Upload proof", description: "(invoice or dashboard export)" },
                        { id: "api", label: "Connect API", description: "(direct API integration, recommended)" },
                      ].map((option) => {
                        const isSelected = form.verificationType === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-150 relative ${
                              isSelected
                                ? "border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)]"
                                : "border-border bg-[#161616] hover:border-border"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected
                                    ? "border-primary text-primary"
                                    : "border-muted-foreground"
                                }`}
                              >
                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                              <span className="text-[14px] font-medium text-foreground">
                                {option.label}
                              </span>
                            </div>
                            <span className="ml-7 mt-1 text-[12px] text-muted-foreground">
                              {option.description}
                            </span>
                            <input
                              type="radio"
                              name="verificationType"
                              value={option.id}
                              checked={isSelected}
                              onChange={(e) => onInputChange("verificationType", e.target.value)}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                    {errors.verificationType ? (
                      <p className="mt-2 text-xs text-[#ff4b4b]">{errors.verificationType}</p>
                    ) : null}

                    {form.verificationType && (
                      <div className="mt-4">
                        {form.verificationType === "manual" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4 text-[13px] text-muted-foreground">
                            No extra fields required. We will manually verify your revenue.
                          </div>
                        )}

                        {form.verificationType === "social" && (
                          <div className="rounded-lg border border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)] p-4">
                            <p className="mb-4 text-[13px] text-primary">
                              Please review your social links below. (Also shown in Step 4)
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <label className={labelClass}>Twitter / X handle</label>
                                <input
                                  className={`${inputClass} border-[rgba(185,255,75,0.4)] focus:border-primary`}
                                  value={form.twitter}
                                  onChange={(e) => onInputChange("twitter", e.target.value)}
                                />
                              </div>
                              <div>
                                <label className={labelClass}>LinkedIn URL</label>
                                <input
                                  className={`${inputClass} border-[rgba(185,255,75,0.4)] focus:border-primary`}
                                  value={form.linkedin}
                                  onChange={(e) => onInputChange("linkedin", e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {form.verificationType === "proof" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4">
                            <p className="mb-3 text-[13px] text-muted-foreground">
                              Please upload a screenshot (image) of your revenue dashboard.
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-primary-foreground hover:file:bg-[#a8e630] cursor-pointer"
                              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        )}

                        {form.verificationType === "api" && (
                          <div className="rounded-lg border border-border bg-[#161616] p-4">
                            <p className="mb-4 text-[13px] text-muted-foreground">
                              Connect your payment provider using a read-only API key.
                            </p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div>
                                <label className={labelClass}>Provider</label>
                                <div className="relative">
                                  <select
                                    className={`${inputClass} appearance-none pr-10`}
                                    value={form.apiProvider}
                                    onChange={(e) => onInputChange("apiProvider", e.target.value)}
                                  >
                                    <option value="stripe">Stripe</option>
                                    <option value="razorpay">Razorpay</option>
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                </div>
                              </div>
                              <div>
                                <label className={labelClass}>API Key</label>
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    className={inputClass}
                                    value={form.apiKey}
                                    onChange={(e) => onInputChange("apiKey", e.target.value)}
                                    placeholder={form.apiProvider === "stripe" ? "sk_live_..." : "ID:SECRET"}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleVerifyRevenue}
                                    disabled={isVerifying}
                                    className="h-11 rounded-lg bg-white/10 px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                                  >
                                    {isVerifying ? "Verifying..." : "Verify"}
                                  </button>
                                </div>
                                {verifyStatus && (
                                  <p className="mt-2 text-xs text-primary">
                                    ✓ Verified {verifyStatus.currency} {Math.round(verifyStatus.mrr)} MRR
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    <p className="mb-3 text-[12px] text-muted-foreground">
                      Select all payment processors you use
                    </p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {paymentMethodOptions.map((item) => {
                        const isChecked = form.paymentMethods.includes(item.id);
                        const isComingSoon = item.badge === "Coming Soon";
                        
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => !isComingSoon && togglePaymentMethod(item.id)}
                            aria-pressed={isChecked}
                            role="checkbox"
                            aria-checked={isChecked}
                            disabled={isComingSoon}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-150 ${
                              isComingSoon
                                ? "border-border bg-[#161616]/50 opacity-60 cursor-not-allowed"
                                : isChecked
                                  ? "border-[rgba(185,255,75,0.4)] bg-[rgba(185,255,75,0.03)]"
                                  : "border-border bg-[#161616] hover:border-border"
                            }`}
                          >
                            <input
                              type="checkbox"
                              tabIndex={-1}
                              className="sr-only"
                              checked={isChecked}
                              readOnly
                              aria-hidden="true"
                              disabled={isComingSoon}
                            />
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] ${
                                isChecked
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="flex-1 text-[13px] text-muted-foreground">
                              {item.label}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClassName(item.badge)}`}
                            >
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {errors.paymentMethods ? (
                      <p className="mt-2 text-xs text-[#ff4b4b]">{errors.paymentMethods}</p>
                    ) : null}
                  </div>
                </section>
              )}

              {step === 4 && (
                <section>
                  <h3 className={sectionTitleClass}>Social links</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>Twitter / X handle</label>
                      <input
                        className={inputClass}
                        value={form.twitter}
                        onChange={(e) => onInputChange("twitter", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>LinkedIn URL</label>
                      <input
                        className={inputClass}
                        value={form.linkedin}
                        onChange={(e) => onInputChange("linkedin", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelClass}>
                      City / Country <span className="text-primary">*</span>
                    </label>
                    <input
                      className={`${inputClass} ${errors.cityCountry ? "border-border" : ""}`}
                      value={form.cityCountry}
                      onChange={(e) => onInputChange("cityCountry", e.target.value)}
                    />
                    {errors.cityCountry ? (
                      <p className="mt-1 text-xs text-[#ff4b4b]">{errors.cityCountry}</p>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <label className={labelClass}>Notes</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border border-border bg-[#161616] px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-150 focus:border-border"
                      placeholder="Your story, what you're building, questions..."
                      value={form.notes}
                      onChange={(e) => onInputChange("notes", e.target.value)}
                    />
                  </div>
                </section>
              )}

            {successMessage && (
              <div className="mt-6 rounded-lg bg-green-900/40 border border-green-500/30 px-4 py-3 text-green-300">
                {successMessage}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="h-[52px] rounded-xl border border-border px-6 text-[14px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  Back
                </button>
              ) : null}

                {step < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex h-[52px] flex-1 items-center justify-center rounded-xl bg-primary font-syne text-[16px] font-bold text-primary-foreground transition-colors hover:bg-[#a8e630]"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-syne text-[16px] font-bold text-primary-foreground transition-colors hover:bg-[#a8e630] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
                        Submitting...
                      </>
                    ) : (
                      "Claim my founding member spot →"
                    )}
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Free forever to list. No spam. We&apos;ll reach out within 24 hours.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

```

====================================================
FILE: src/components/startup/ConnectionStatus.tsx
====================================================

```typescript
"use client";

import React from "react";
import { CheckCircle2, XCircle, RefreshCw, Activity } from "lucide-react";

interface Connection {
  provider: string;
  connected: boolean;
  last_sync: number | null;
  mrr: number;
}

interface ConnectionStatusProps {
  connections: Connection[];
}

/**
 * ConnectionStatus Component
 * 
 * Displays a grid of payment provider connections with their current health,
 * MRR contribution, and synchronization status.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ connections }) => {
  const [now] = React.useState(() => Date.now());

  const formatTime = (ms: number | null) => {
    if (!ms) return "Never";
    const date = new Date(ms);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatus = (conn: Connection) => {
    if (!conn.connected) {
      return { 
        label: "Monitoring", 
        color: "text-neutral-500 bg-neutral-500/10", 
        icon: Activity,
        dot: "bg-neutral-500"
      };
    }
    
    // Logic: Yellow "Syncing" status if last_sync was within the last 5 minutes
    const isRecent = conn.last_sync && (now - conn.last_sync < 5 * 60 * 1000);
    if (isRecent) {
      return { 
        label: "Syncing", 
        color: "text-amber-500 bg-amber-500/10", 
        icon: RefreshCw,
        dot: "bg-amber-500"
      };
    }
    
    return { 
      label: "Connected", 
      color: "text-emerald-500 bg-emerald-500/10", 
      icon: CheckCircle2,
      dot: "bg-emerald-500"
    };
  };

  if (connections.length === 0) {
    return (
      <div className="p-8 text-center bg-neutral-900/40 border border-white/5 rounded-[2rem]">
        <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest leading-relaxed">
          No external gateways linked to this audit
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {connections.map((conn) => {
        const status = getStatus(conn);
        const Icon = status.icon;

        return (
          <div 
            key={conn.provider} 
            className="group relative p-6 bg-neutral-900/40 border border-white/5 rounded-[2rem] transition-all duration-500 hover:border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${status.dot} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                  {conn.provider}
                </h3>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
                <Icon className={`w-3.5 h-3.5 translate-y-[-0.5px] ${status.label === "Syncing" ? "animate-spin" : ""}`} />
                {status.label}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[9px] font-black text-neutral-600 uppercase tracking-[0.2em]">
                  30D Volume
                </span>
                <span className="text-xl font-black text-white tabular-nums">
                  ₹{conn.mrr.toLocaleString()}
                </span>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.2em]">
                  Last Ping
                </span>
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                  {formatTime(conn.last_sync)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

```

====================================================
FILE: src/components/startup/FounderVerificationFlow.tsx
====================================================

```typescript
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeFetch } from "@/lib/safe-network";
import { 
  ShieldCheck, 
  CreditCard, 
  Globe, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Fingerprint,
  ScanSearch,
  Activity,
  KeyRound
} from "lucide-react";
import { formatScore } from "@/lib/formatters";
import { RazorpayOnboarding } from "./RazorpayOnboarding";

type VerificationStep = "connect" | "syncing" | "analyzing" | "summary" | "incomplete";

interface FounderVerificationFlowProps {
  startupId: string;
  slug: string;
  isDemo?: boolean;
}

const FounderVerificationFlowInner: React.FC<FounderVerificationFlowProps> = ({ startupId, slug, isDemo = false }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stripeStatus = searchParams?.get("stripe");
  
  const [currentStep, setCurrentStep] = useState<VerificationStep>("connect");
  const [hasMadeDecision, setHasMadeDecision] = useState<boolean>(!!stripeStatus);
  const [provider, setProvider] = useState<"stripe" | "razorpay" | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  
  // Form State
  const [stripeKey, setStripeKey] = useState("");
  const [rzpKeyId, setRzpKeyId] = useState("");
  const [rzpKeySecret, setRzpKeySecret] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result State
  const [overviewData, setOverviewData] = useState<any>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(45);
  const [autoForwardSeconds, setAutoForwardSeconds] = useState(5);

  const STEPS = [
    { id: "connect", label: "Choose Your Payment Provider" },
    { id: "syncing", label: "Sync Revenue" },
    { id: "analyzing", label: "Check Consistency" },
    { id: "summary", label: "Verification Result" }
  ];

  const getStepIndex = (step: VerificationStep) => {
    if (step === "incomplete") return 1;
    return STEPS.findIndex(s => s.id === step);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((currentStep === "syncing" || currentStep === "analyzing") && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [currentStep, timeLeft]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (currentStep === "summary" && autoForwardSeconds > 0) {
      timer = setInterval(() => setAutoForwardSeconds(prev => prev - 1), 1000);
    } else if (currentStep === "summary" && autoForwardSeconds === 0) {
      handlePublish();
    }
    return () => clearInterval(timer);
  }, [currentStep, autoForwardSeconds]);

  // Handle Stripe Connect OAuth Redirect Status
  useEffect(() => {
    if (stripeStatus === "error" && !errorMsg) {
      setErrorMsg("Stripe connection failed or was cancelled.");
      router.replace(`/startup/${slug}/verify`, { scroll: false });
    } else if (stripeStatus === "success" && currentStep === "connect" && !isAutoSyncing) {
      setIsAutoSyncing(true);
      router.replace(`/startup/${slug}/verify`, { scroll: false });
      handleAutoSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeStatus, currentStep, isAutoSyncing]);

  const runSyncProcess = async (bodyPayload: any) => {
    setErrorMsg(null);
    setStartTime(Date.now());
    setCurrentStep("syncing");
    setTimeLeft(45);

    try {
      const endpoint = bodyPayload.key_id ? "/api/sync/razorpay" : "/api/sync/stripe";
      const syncResult = await safeFetch<any>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!syncResult.ok || !syncResult.data) {
        const errorMsg = syncResult.error?.message || "Verification connection failed.";
        
        // Treat 400, 401, 403 and typical validation messages as expected UI state
        const isExpectedFailure = 
          syncResult.status === 400 || 
          syncResult.status === 401 || 
          syncResult.status === 403 || 
          errorMsg.includes("401") ||
          errorMsg.toLowerCase().includes("invalid") ||
          errorMsg.toLowerCase().includes("authentication failed");

        if (isExpectedFailure) {
          let friendlyError = errorMsg;
          if (friendlyError.includes("401") || syncResult.status === 401) {
            friendlyError = "Invalid API Key: Please verify your credentials and try again.";
          }
          
          setErrorMsg(friendlyError);
          setCurrentStep("incomplete");
          setIsAutoSyncing(false);
          return;
        }

        // Throw for genuine unexpected application/network failures
        throw new Error(errorMsg);
      }

      // Sync successful, move to analysis
      setCurrentStep("analyzing");

      // Fetch overview data for consistency and verification score securely
      const overviewRes = await safeFetch<any>(`/api/startup/${startupId}/overview`);
      
      if (!overviewRes.ok || !overviewRes.data) {
        throw new Error(overviewRes.error?.message || "Failed to generate verification profile");
      }

      setOverviewData(overviewRes.data);
      
      const timeTaken = startTime ? (Date.now() - startTime) / 1000 : 0;
      if (process.env.NODE_ENV === "development") {
        console.log(`[Verification] Time to first verification: ${timeTaken.toFixed(2)}s`);
      }
      
      // Auto-progress to summary
      setCurrentStep("summary");

    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.error(err);
      }
      let friendlyError = err.message || "An unexpected error occurred";
      if (friendlyError.includes("failed to fetch")) friendlyError = "Network error: Please check your connection and try again.";
      if (friendlyError.includes("401")) friendlyError = "Invalid API Key: Please verify your credentials and try again.";
      
      setErrorMsg(friendlyError);
      setCurrentStep("incomplete");
      setIsAutoSyncing(false);
    }
  };

  const handleAutoSync = () => {
    if (isDemo) return;
    runSyncProcess({ startup_id: startupId });
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) return;
    
    const bodyPayload = provider === "stripe" 
      ? { apiKey: stripeKey, startup_id: startupId }
      : { key_id: rzpKeyId, key_secret: rzpKeySecret, startup_id: startupId };

    await runSyncProcess(bodyPayload);
  };

  const handlePublish = () => {
    router.push(`/startup/${slug}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ── Progress Bar ────────────────────────────────────────── */}
      <div className="mb-12 relative">
        <div className="flex items-center justify-between relative z-10">
          {STEPS.map((step, idx) => {
            const isActive = getStepIndex(currentStep) === idx;
            const isCompleted = getStepIndex(currentStep) > idx || currentStep === "summary";
            const isFailed = currentStep === "incomplete" && idx === 1;

            return (
              <div key={step.id} className="flex flex-col items-center gap-3 w-1/4">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                  ${isCompleted ? "bg-[#b9ff4b] border-[#b9ff4b] text-[#080808]" : 
                    isActive ? "bg-neutral-900 border-[#b9ff4b] text-[#b9ff4b] shadow-[0_0_15px_rgba(185,255,75,0.3)]" : 
                    isFailed ? "bg-red-500/10 border-red-500 text-red-500" :
                    "bg-neutral-900 border-white/10 text-neutral-600"}
                `}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4 text-[#080808]" /> : 
                   isFailed ? <AlertTriangle className="w-4 h-4" /> :
                   <span className="text-xs font-black">{idx + 1}</span>}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-center
                  ${isActive || isCompleted ? "text-neutral-300" : isFailed ? "text-red-400" : "text-neutral-600"}
                `}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Track Line */}
        <div className="absolute top-4 left-0 right-0 h-[2px] bg-white/5 -z-0 rounded-full" />
        <div 
          className="absolute top-4 left-0 h-[2px] bg-[#b9ff4b] -z-0 transition-all duration-700 ease-in-out"
          style={{ width: `${(getStepIndex(currentStep === "incomplete" ? "syncing" : currentStep) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="bg-neutral-900/40 border border-white/5 rounded-[2rem] p-8 min-h-[400px] flex flex-col relative overflow-hidden">
        
        {/* 1. Connect Provider / Decision Screen */}
        {(currentStep === "connect" || currentStep === "incomplete") && (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!hasMadeDecision ? (
              <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-white">Startup Saved Successfully</h2>
                <div className="space-y-4 mb-8 text-sm text-neutral-400 font-medium">
                  <p>Your startup details have been securely saved.</p>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3 text-left">
                    <ShieldCheck className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Your startup is currently <strong className="text-white">Private</strong>. Verification publishes your startup and makes it visible to the community.
                    </p>
                  </div>
                </div>
                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={() => setHasMadeDecision(true)}
                    className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[12px] hover:bg-neutral-200 transition-colors shadow-xl shadow-white/10"
                  >
                    Verify Now
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full bg-transparent border border-white/10 text-white py-4 rounded-xl font-bold uppercase tracking-[0.1em] text-[11px] hover:bg-white/5 transition-colors"
                  >
                    Verify Later
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Choose Your Payment Provider</h2>
                  <p className="text-sm text-neutral-500 font-medium">Link your payment gateway for read-only automated verification.</p>
                </div>

            {errorMsg && errorMsg.includes("Live Razorpay authentication failed") ? (
              <div className="mb-6 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide">Unable to connect to Razorpay</h3>
                </div>
                <div className="text-xs text-red-300/90 leading-relaxed space-y-3">
                  <p>We couldn't authenticate your Razorpay account.</p>
                  <p>Before trying again, please verify:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>You're using Live API Keys</li>
                    <li>Your website has been approved by Razorpay</li>
                    <li>Your Key ID and Key Secret belong to the same account</li>
                  </ul>
                  <p>Test Mode API Keys are not supported.</p>
                </div>
              </div>
            ) : errorMsg ? (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <p className="text-xs text-red-400 font-bold uppercase tracking-wide leading-relaxed whitespace-pre-wrap">{errorMsg}</p>
              </div>
            ) : null}

            {isDemo ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-neutral-400">
                  This is a sandbox profile. Payment connection is not required for the demo.
                </p>
                <button
                  type="button"
                  onClick={handlePublish}
                  className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[11px] hover:bg-neutral-200 transition-colors"
                >
                  View public profile
                </button>
              </div>
            ) : !provider ? (
              <div className="flex flex-col gap-8">
                {/* Razorpay Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🇮🇳</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#2D81F7]">Recommended for Indian Founders</span>
                  </div>
                  <button 
                    onClick={() => setProvider("razorpay")}
                    className="w-full bg-[#2D81F7] text-white py-4 px-6 rounded-xl font-black uppercase tracking-widest text-[12px] hover:bg-[#2069D3] transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(45,129,247,0.3)] hover:shadow-[0_0_30px_rgba(45,129,247,0.5)]"
                  >
                    <KeyRound className="w-5 h-5" /> Connect Razorpay
                  </button>
                  <p className="text-xs text-neutral-500 text-center font-medium">Recommended for Indian startups. Supports INR and UPI.</p>
                </div>
                
                {/* Stripe Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4 w-full mb-1">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-xl">🌍</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Other Supported Providers</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  <button 
                    onClick={() => setProvider("stripe")}
                    className="w-full bg-neutral-900 border border-white/10 text-white py-4 px-6 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-neutral-800 transition-colors flex items-center justify-center gap-3"
                  >
                    <KeyRound className="w-5 h-5 text-neutral-500" /> Stripe Verification
                  </button>
                  <p className="text-[10px] text-neutral-500 text-center font-medium">Best for international SaaS & global payments.</p>
                </div>
              </div>
            ) : provider === "razorpay" ? (
              <RazorpayOnboarding
                rzpKeyId={rzpKeyId}
                rzpKeySecret={rzpKeySecret}
                onKeyIdChange={setRzpKeyId}
                onKeySecretChange={setRzpKeySecret}
                onSubmit={handleConnect}
                onBack={() => setProvider(null)}
                errorMsg={errorMsg}
              />
            ) : (
              <form onSubmit={handleConnect} className="space-y-6">
                <button 
                  type="button" 
                  onClick={() => setProvider(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                >
                  ← Back to Providers
                </button>

                {provider === "stripe" && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">Stripe Secret Key</label>
                    <input 
                      required 
                      type="password" 
                      placeholder="sk_live_..." 
                      value={stripeKey}
                      onChange={(e) => setStripeKey(e.target.value)}
                      className="w-full bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-primary font-mono text-sm"
                    />
                  </div>
                )}

                <div className="p-4 bg-white/5 rounded-xl flex items-start gap-3 border border-white/5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                    Keys are encrypted at rest (AES-256-GCM) and used exclusively for read-only revenue aggregation.
                  </p>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[11px] hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                >
                  Start Verification Process <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
              </>
            )}
          </div>
        )}

        {/* 2. & 3. Syncing / Analyzing */}
        {(currentStep === "syncing" || currentStep === "analyzing") && (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[#b9ff4b]/15 rounded-full blur-xl animate-pulse" />
              <div className="w-20 h-20 bg-[#0f0f0f] border border-white/10 rounded-full flex items-center justify-center relative z-10">
                {currentStep === "syncing" ? (
                  <Activity className="w-8 h-8 text-[#b9ff4b] animate-pulse" />
                ) : (
                  <ScanSearch className="w-8 h-8 text-[#b9ff4b] animate-spin-slow" />
                )}
              </div>
              <div className="absolute top-0 left-0 w-full h-full border-2 border-[#b9ff4b]/20 border-t-[#b9ff4b] rounded-full animate-spin" />
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-widest mb-3">
              {currentStep === "syncing" ? "Syncing Revenue History" : "Verifying Revenue Data"}
            </h3>
            <p className="text-sm text-neutral-500 font-medium max-w-xs mx-auto mb-6">
              {currentStep === "syncing" 
                ? "Connecting to payment provider and syncing recent transactions..." 
                : "Analyzing transaction patterns and checking for provider consistency..."}
            </p>

            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
              <Loader2 className="w-3 h-3 text-[#b9ff4b] animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Estimated time remaining: {timeLeft}s
              </span>
            </div>
          </div>
        )}

        {/* 4. Summary Screen */}
        {currentStep === "summary" && overviewData && (
          <div className="flex-1 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full mb-4 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Verification Complete</h2>
              <p className="text-neutral-500 font-medium">Your verification profile has been successfully generated.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Verification Score */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <ShieldCheck className="w-5 h-5 text-primary mb-3" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Verification Score</span>
                <span className="text-3xl font-black tabular-nums text-white">{formatScore(overviewData.startup.trust_score, 0)}<span className="text-sm text-neutral-600">/100</span></span>
              </div>

              {/* Consistency */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <Fingerprint className={`w-5 h-5 mb-3 ${
                  overviewData.authenticity?.level === "Organic" ? "text-emerald-400" :
                  overviewData.authenticity?.level === "Moderate" ? "text-amber-400" : "text-orange-400"
                }`} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Consistency</span>
                <span className="text-xl font-black uppercase tracking-tight text-white">{overviewData.authenticity?.level || "N/A"}</span>
              </div>

              {/* Confidence */}
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl flex flex-col items-center text-center">
                <ScanSearch className="w-5 h-5 text-cyan-400 mb-3" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-1">Confidence</span>
                <span className="text-3xl font-black tabular-nums text-white">{overviewData.verification?.verification_confidence || 0}<span className="text-sm text-neutral-600">%</span></span>
              </div>
            </div>

            <button 
              onClick={handlePublish}
              className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] hover:bg-neutral-200 hover:scale-[1.02] transition-all shadow-xl shadow-white/10 flex flex-col items-center justify-center gap-1 group"
            >
              <div className="flex items-center gap-2">
                Publish Verified Startup <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
              <span className="text-[9px] text-neutral-500 font-bold">Auto-redirecting in {autoForwardSeconds}s...</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export const FounderVerificationFlow: React.FC<FounderVerificationFlowProps> = (props) => {
  return (
    <Suspense fallback={
      <div className="w-full max-w-2xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
      </div>
    }>
      <FounderVerificationFlowInner {...props} />
    </Suspense>
  );
};

```

====================================================
FILE: src/components/startup/RazorpayOnboarding.tsx
====================================================

```typescript
"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Settings,
  LayoutDashboard,
  ClipboardPaste,
  AlertTriangle,
  Lock,
  CreditCard,
  Wallet,
  Settings2,
  Info,
  CheckCircle2,
} from "lucide-react";

/* ─────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────── */
interface RazorpayOnboardingProps {
  rzpKeyId: string;
  rzpKeySecret: string;
  onKeyIdChange: (v: string) => void;
  onKeySecretChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  errorMsg: string | null;
}

type OnboardingStep = 1 | 2 | 3 | 4;

/* ─────────────────────────────────────────────────────
 * Constants
 * ───────────────────────────────────────────────────── */
const RAZORPAY_BLUE = "#2D81F7";
const RAZORPAY_BLUE_DIM = "rgba(45, 129, 247, 0.08)";
const RAZORPAY_BLUE_BORDER = "rgba(45, 129, 247, 0.25)";

const GUIDED_STEPS = [
  {
    step: 1 as OnboardingStep,
    icon: LayoutDashboard,
    title: "Open Razorpay Dashboard",
    description: "Log in to your Razorpay dashboard with your registered account.",
    action: "Go to Dashboard",
    link: "https://dashboard.razorpay.com",
  },
  {
    step: 2 as OnboardingStep,
    icon: Settings,
    title: "Navigate to API Keys",
    description: "In the left sidebar, go to Account & Settings → API Keys.",
    action: "Settings → API Keys",
    link: "https://dashboard.razorpay.com/app/website-app-settings/api-keys",
  },
  {
    step: 3 as OnboardingStep,
    icon: KeyRound,
    title: "Generate API Key",
    description: "Click \"Generate Key\" to create a new key pair. Copy both Key ID and Key Secret immediately — the secret is shown only once.",
    action: null,
    link: null,
  },
  {
    step: 4 as OnboardingStep,
    icon: ClipboardPaste,
    title: "Paste Credentials",
    description: "Paste your Key ID and Key Secret in the fields below to complete verification.",
    action: null,
    link: null,
  },
];

const TRUST_ITEMS = [
  { icon: Eye, text: "Read-only verification", detail: "We only read payment data" },
  { icon: CreditCard, text: "Cannot create payments", detail: "No charges will be made" },
  { icon: Wallet, text: "Cannot withdraw money", detail: "No payouts or transfers" },
  { icon: Settings2, text: "Cannot modify account settings", detail: "Your settings stay untouched" },
];

/* ─────────────────────────────────────────────────────
 * Validation helpers
 * ───────────────────────────────────────────────────── */
type ValidationState = "idle" | "valid" | "invalid" | "warning";

function validateKeyId(value: string): { state: ValidationState; message: string } {
  if (!value) return { state: "idle", message: "" };
  if (value.startsWith("rzp_test_")) return { state: "warning", message: "This is a test key — use rzp_live_ for production verification" };
  if (!value.startsWith("rzp_live_")) return { state: "invalid", message: "Key ID should start with rzp_live_ or rzp_test_" };
  if (value.length < 18) return { state: "invalid", message: "Key ID appears too short" };
  return { state: "valid", message: "Valid Razorpay Key ID format" };
}

function validateKeySecret(value: string): { state: ValidationState; message: string } {
  if (!value) return { state: "idle", message: "" };
  if (value.length < 10) return { state: "invalid", message: "Key Secret appears too short" };
  if (value.length >= 10) return { state: "valid", message: "Key Secret format looks good" };
  return { state: "idle", message: "" };
}

function getValidationColor(state: ValidationState): string {
  switch (state) {
    case "valid": return "text-emerald-400";
    case "invalid": return "text-red-400";
    case "warning": return "text-amber-400";
    default: return "text-neutral-500";
  }
}

function getValidationBorder(state: ValidationState): string {
  switch (state) {
    case "valid": return "border-emerald-500/40 focus:border-emerald-500";
    case "invalid": return "border-red-500/40 focus:border-red-500";
    case "warning": return "border-amber-500/40 focus:border-amber-500";
    default: return "border-white/10 focus:border-[#2D81F7]";
  }
}

/* ─────────────────────────────────────────────────────
 * Copy button sub-component
 * ───────────────────────────────────────────────────── */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-all duration-200 group"
      title={`Copy ${label}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 group-hover:text-[#2D81F7] transition-colors" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────
 * Main Component
 * ───────────────────────────────────────────────────── */
export const RazorpayOnboarding: React.FC<RazorpayOnboardingProps> = ({
  rzpKeyId,
  rzpKeySecret,
  onKeyIdChange,
  onKeySecretChange,
  onSubmit,
  onBack,
  errorMsg,
}) => {
  const [activeStep, setActiveStep] = useState<OnboardingStep>(1);
  const [showSecret, setShowSecret] = useState(false);
  const [trustExpanded, setTrustExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const keyIdValidation = validateKeyId(rzpKeyId);
  const keySecretValidation = validateKeySecret(rzpKeySecret);
  const isFormValid = keyIdValidation.state === "valid" && (keySecretValidation.state === "valid" || keySecretValidation.state === "warning");
  const canProceedToStep4 = activeStep >= 3;

  // Auto-advance to step 4 when user starts typing credentials
  useEffect(() => {
    if ((rzpKeyId || rzpKeySecret) && activeStep < 4) {
      setActiveStep(4);
    }
  }, [rzpKeyId, rzpKeySecret, activeStep]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: RAZORPAY_BLUE_DIM, border: `1px solid ${RAZORPAY_BLUE_BORDER}` }}
          >
            <KeyRound className="w-3.5 h-3.5" style={{ color: RAZORPAY_BLUE }} />
          </div>
          <span className="text-sm font-bold text-white">Razorpay Verification</span>
        </div>
      </div>

      {/* ── Error Message ──────────────────────────── */}
      {errorMsg && (
        <div className="p-4 bg-red-500/8 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            {errorMsg.includes("Live Razorpay authentication failed") ? (
              <p className="text-xs text-red-400 font-bold uppercase tracking-wide leading-relaxed">Verification Failed</p>
            ) : (
              <>
                <p className="text-xs text-red-400 font-bold uppercase tracking-wide leading-relaxed whitespace-pre-wrap">{errorMsg}</p>
                <p className="text-[10px] text-red-400/60 mt-1">Check that your Key ID and Key Secret are correct and try again.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Guided Steps ───────────────────────────── */}
      <div className="rounded-2xl border border-white/5 bg-neutral-900/40 overflow-hidden">
        <div
          className="px-5 py-3 border-b border-white/5 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${RAZORPAY_BLUE_DIM}, transparent)` }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            Setup Guide
          </span>
          <span className="text-[10px] font-bold text-neutral-500">
            Step {activeStep} of 4
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {GUIDED_STEPS.map((step) => {
            const isActive = activeStep === step.step;
            const isCompleted = activeStep > step.step;
            const Icon = step.icon;

            return (
              <div
                key={step.step}
                role="button"
                tabIndex={0}
                onClick={() => setActiveStep(step.step)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveStep(step.step);
                  }
                }}
                className={`
                  w-full cursor-pointer px-5 py-4 flex items-start gap-4 text-left transition-all duration-300 group
                  ${isActive ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}
                `}
              >
                {/* Step indicator */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 mt-0.5
                  ${isCompleted
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : isActive
                      ? "border-[#2D81F7] text-[#2D81F7] shadow-[0_0_12px_rgba(45,129,247,0.2)]"
                      : "border-white/10 text-neutral-600"
                  }
                `}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold transition-colors duration-200 ${isActive || isCompleted ? "text-white" : "text-neutral-500"}`}>
                      {step.title}
                    </span>
                    {isCompleted && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                        Done
                      </span>
                    )}
                  </div>

                  {/* Expanded content for active step */}
                  <div className={`overflow-hidden transition-all duration-300 ${isActive ? "max-h-40 opacity-100 mt-1.5" : "max-h-0 opacity-0"}`}>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {step.description}
                    </p>

                    {step.link && (
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02]"
                          style={{
                            background: RAZORPAY_BLUE_DIM,
                            border: `1px solid ${RAZORPAY_BLUE_BORDER}`,
                            color: RAZORPAY_BLUE,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {step.action}
                        </a>
                        <CopyButton text={step.link} label="Copy link" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <ArrowRight className={`w-4 h-4 shrink-0 mt-1 transition-all duration-200 ${isActive ? "text-[#2D81F7] rotate-90" : "text-neutral-700 group-hover:text-neutral-500"}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Credentials Form ───────────────────────── */}
      <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4" style={{ color: RAZORPAY_BLUE }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
              API Credentials
            </span>
          </div>

          {/* Key ID Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="rzp-key-id" className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D81F7]" />
                Razorpay Key ID
                <span className="text-red-400">*</span>
              </label>
              {keyIdValidation.state !== "idle" && (
                <span className={`text-[10px] font-bold ${getValidationColor(keyIdValidation.state)} flex items-center gap-1 animate-in fade-in duration-200`}>
                  {keyIdValidation.state === "valid" && <CheckCircle2 className="w-3 h-3" />}
                  {keyIdValidation.state === "invalid" && <AlertTriangle className="w-3 h-3" />}
                  {keyIdValidation.state === "warning" && <Info className="w-3 h-3" />}
                  {keyIdValidation.message}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="rzp-key-id"
                required
                type="text"
                placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                value={rzpKeyId}
                onChange={(e) => onKeyIdChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={`
                  w-full bg-black/60 border ${getValidationBorder(keyIdValidation.state)}
                  p-4 pl-11 rounded-xl outline-none font-mono text-sm text-white
                  placeholder:text-neutral-600 transition-all duration-200
                `}
              />
              <LayoutDashboard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            </div>
            <p className="text-[10px] text-neutral-600 leading-relaxed pl-1">
              Found in Razorpay Dashboard → Account & Settings → API Keys
            </p>
          </div>

          {/* Key Secret Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label htmlFor="rzp-key-secret" className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2D81F7]" />
                Razorpay Key Secret
                <span className="text-red-400">*</span>
              </label>
              {keySecretValidation.state !== "idle" && (
                <span className={`text-[10px] font-bold ${getValidationColor(keySecretValidation.state)} flex items-center gap-1 animate-in fade-in duration-200`}>
                  {keySecretValidation.state === "valid" && <CheckCircle2 className="w-3 h-3" />}
                  {keySecretValidation.state === "invalid" && <AlertTriangle className="w-3 h-3" />}
                  {keySecretValidation.message}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="rzp-key-secret"
                required
                type={showSecret ? "text" : "password"}
                placeholder="Enter your Key Secret"
                value={rzpKeySecret}
                onChange={(e) => onKeySecretChange(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className={`
                  w-full bg-black/60 border ${getValidationBorder(keySecretValidation.state)}
                  p-4 pl-11 pr-12 rounded-xl outline-none font-mono text-sm text-white
                  placeholder:text-neutral-600 transition-all duration-200
                `}
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                title={showSecret ? "Hide secret" : "Show secret"}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 leading-relaxed pl-1">
              The Key Secret is only shown once when generated. If lost, generate a new key pair.
            </p>
          </div>
        </div>

        {/* ── Trust Messaging ──────────────────────── */}
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] overflow-hidden">
          <button
            type="button"
            onClick={() => setTrustExpanded(!trustExpanded)}
            className="w-full px-5 py-3.5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-emerald-400/90">Your account is safe — read-only access only</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-emerald-500/40 transition-transform duration-200 ${trustExpanded ? "rotate-90" : ""}`} />
          </button>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${trustExpanded ? "max-h-80" : "max-h-0"}`}>
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRUST_ITEMS.map((item, idx) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10"
                  >
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ItemIcon className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-300 block">{item.text}</span>
                      <span className="text-[10px] text-emerald-500/60">{item.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 pb-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  Keys are encrypted at rest using AES-256-GCM and used exclusively for read-only revenue aggregation.
                  We never store raw transaction details — only aggregated metrics.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Submit Button ────────────────────────── */}
        <button
          type="submit"
          disabled={!rzpKeyId || !rzpKeySecret}
          className={`
            w-full py-4 rounded-xl font-black uppercase tracking-[0.15em] text-[11px]
            flex items-center justify-center gap-2 transition-all duration-300
            ${rzpKeyId && rzpKeySecret
              ? isFormValid
                ? "bg-white text-black hover:bg-neutral-200 hover:scale-[1.01] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                : "bg-white/80 text-black/80 hover:bg-white"
              : "bg-white/10 text-neutral-500 cursor-not-allowed"
            }
          `}
        >
          {isFormValid && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          Start Verification Process
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* ── Validation Summary ───────────────────── */}
        {(rzpKeyId || rzpKeySecret) && !isFormValid && (
          <div className="text-center animate-in fade-in duration-200">
            <p className="text-[10px] text-neutral-500">
              {!rzpKeyId && !rzpKeySecret
                ? "Enter your API credentials above"
                : keyIdValidation.state === "invalid"
                  ? "Fix the Key ID format to continue"
                  : keySecretValidation.state === "invalid"
                    ? "Fix the Key Secret to continue"
                    : "Complete both fields to continue"
              }
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

```

====================================================
FILE: src/components/startup/VerificationFlow.tsx
====================================================

```typescript
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Globe, User, ShieldCheck, XCircle, ArrowRight, CircleDashed, Award, Zap, TrendingUp, X, Upload, CreditCard, Loader2, Link as LinkIcon, Sparkles, Video } from "lucide-react";
import { safeFetch, safeSupabaseQuery } from "@/lib/safe-network";

type StartupProfile = {
  id: number;
  startup_name?: string;
  founder_name?: string;
  website?: string;
  proof_url?: string;
  verification_method?: string;
  verification_status?: string;
  founder_linkedin?: string;
  founder_twitter?: string;
  trust_breakdown?: any;
  video_url?: string;
  trust_score?: number;
  mrr?: number;
  email?: string;
};

interface VerificationFlowProps {
  initialStartup: StartupProfile;
  id: number | string;
}

export default function VerificationFlow({ initialStartup, id }: VerificationFlowProps) {
  const [startup, setStartup] = useState<StartupProfile>(initialStartup);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pointsGained, setPointsGained] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ field: string; message: string } | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [stripeKey, setStripeKey] = useState("");
  const [paymentView, setPaymentView] = useState<"options" | "razorpay" | "stripe">("options");
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);

  const [connections, setConnections] = useState<{provider: string; amount: number}[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    async function fetchConnections() {
      const { data, ok } = await safeFetch<any>(`/api/startup/${id}/connections`);
      if (ok && data) {
        if (data.providers) setConnections(data.providers);
        if (data.totalMRR !== undefined) setTotalRevenue(data.totalMRR);
      }
    }
    fetchConnections();
  }, [id, successMsg]);

  // --- Logic ---
  const isApproved = startup?.verification_status === "approved";
  const hasProof = !!startup?.proof_url;
  const hasWebsite = !!startup?.website && !startup.website.includes('@');
  const hasIdentity = !!startup?.founder_name;
  const hasLinkedIn = !!startup?.founder_linkedin;
  const hasPaymentSource = startup?.verification_method === "api" || startup?.verification_method === "razorpay" || startup?.verification_method === "stripe" || connections.length > 0;
  const hasVideo = !!startup?.video_url;

  const hasStripe = connections.some(c => c.provider === "stripe");
  const hasRazorpay = connections.some(c => c.provider === "razorpay");

  const [isRefreshing, setIsRefreshing] = useState(false);

  const steps = [hasProof, hasWebsite, hasIdentity, connections.length > 0, hasVideo];
  const stepsCompleted = steps.filter(Boolean).length;
  const totalSteps = steps.length;

  const progress = startup?.trust_score !== undefined ? startup.trust_score : 0;

  const getStrengthLevel = (score: number) => {
    if (score <= 30) return { label: "Self Reported", color: "text-neutral-400", bg: "bg-neutral-400/10", msg: "Connect a payment provider to increase verification confidence" };
    if (score <= 70) return { label: "Payment Connected", color: "text-amber-400", bg: "bg-amber-400/10", msg: "Building transaction history to verify revenue" };
    if (score <= 85) return { label: "Revenue Verified", color: "text-blue-400", bg: "bg-blue-400/10", msg: "Consistent revenue data confirmed by provider" };
    return { label: "High Confidence", color: "text-green-400", bg: "bg-green-400/10", msg: "Multi-signal verification complete — highest trust tier" };
  };
  const strength = getStrengthLevel(progress);

  // --- Actions ---
  const updateStartup = async (data: any, msg: string, pointsVal: number) => {
    setLoading(true);
    const { data: updated, error, ok } = await safeSupabaseQuery<any>(
      supabase.from("startup_submissions").update(data).eq("id", id).select().single()
    );
    
    if (ok && updated) {
      // Trigger deterministic re-score securely
      const { data: scoreData, ok: scoreOk } = await safeFetch<any>("/api/trust/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startup_id: id })
      });
      
      if (scoreOk && scoreData) {
        setStartup({ ...updated, ...scoreData });
        setSuccessMsg(msg);
        setPointsGained(pointsVal);
        setActiveModal(null);
        setTimeout(() => { setSuccessMsg(null); setPointsGained(null); }, 4000);
      }
    }
    setLoading(false);
  };

  const [selectedCountry, setSelectedCountry] = useState("US");

  const handleStripeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeKey.startsWith("sk_")) {
      setStripeError("Invalid format. Key must start with sk_");
      return;
    }
    setLoading(true);
    setStripeError(null);
    
    const { data, ok, error } = await safeFetch<any>("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: stripeKey,
        startupId: id
      })
    });
    
    if (ok && data && data.revenue !== undefined) {
      setStripeSuccess(true);
      await updateStartup({
        payment_connected: true,
        last_verified_at: new Date().toISOString()
      }, "Stripe connected: Revenue synced!", 50);
      
      // Modal will stay open for a moment to show success state before auto-closing
      setTimeout(() => {
        setActiveModal(null);
        setPaymentView("options");
        setStripeSuccess(false);
        setStripeKey("");
      }, 2500);
    } else {
      setStripeError(error?.message || data?.error || "Stripe verification failed");
    }
    setLoading(false);
  };

  const handleRazorpayVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setRazorpayError(null);

    const { data, ok, error } = await safeFetch<any>("/api/razorpay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key_id: keyId,
        key_secret: keySecret,
        startup_id: id
      })
    });

    if (ok && data && data.success) {
      await updateStartup({
        payment_connected: true,
        last_verified_at: new Date().toISOString()
      }, "Razorpay connected & revenue audited!", 50);
      setPaymentView("options");
    } else {
      setRazorpayError(error?.message || data?.error || "Connection failed");
    }
    setLoading(false);
  };

  const handleRefreshRevenue = async () => {
    setIsRefreshing(true);
    const { data, ok } = await safeFetch<any>("/api/verify/revenue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startup_id: id
      })
    });
    
    if (ok && data && data.success) {
      await updateStartup({
        last_verified_at: new Date().toISOString()
      }, `Revenue refreshed: ₹${Math.round(data.revenue).toLocaleString()}`, 10);
    }
    setIsRefreshing(false);
  };

  const isRazorpayValid = keyId.startsWith("rzp_") && keySecret.length > 10;
  const isStripeValid = stripeKey.startsWith("sk_") && stripeKey.length > 20;

  return (
    <div className="relative">
      {pointsGained && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[110] bg-white text-black px-6 py-4 rounded-3xl font-black shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="bg-green-500 p-1 rounded-full"><ShieldCheck className="w-5 h-5 text-white" /></div>
          <span className="uppercase tracking-tighter">+{pointsGained} Score Gained</span>
          <Sparkles className="w-5 h-5 text-amber-500" />
        </div>
      )}

      {successMsg && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-white/10 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-400" /> {successMsg}
      </div>}

      {/* Strength Section */}
      <section className="mt-12 bg-neutral-900/40 border border-white/5 rounded-3xl overflow-hidden p-8 flex flex-col md:flex-row gap-10 items-center">
        {!hasPaymentSource ? (
          <div className="flex flex-col md:flex-row gap-8 items-center w-full">
            <div className="w-20 h-20 rounded-2xl bg-neutral-800/40 border border-white/5 flex items-center justify-center shrink-0">
              <CircleDashed className="w-10 h-10 text-neutral-500 animate-spin" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold uppercase tracking-wider text-neutral-300">Awaiting Verification Data</h2>
              <p className="text-sm text-neutral-500 font-medium mt-1 leading-relaxed">
                Connect Stripe or Razorpay to initiate real-time revenue verification and calculate your dynamic trust metrics.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * progress) / 100} className={`transition-all duration-1000 ${strength.color}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black">{progress}%</span>
                <span className="text-[10px] uppercase font-bold text-neutral-500">Score</span>
              </div>
            </div>
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <h2 className="text-xl font-bold">Verification Score</h2>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-tighter ${strength.color} ${strength.bg}`}>{strength.label}</span>
              </div>
              <p className="text-sm text-neutral-400 font-medium">{strength.msg}</p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-2xl text-[10px] uppercase font-bold text-neutral-500 text-center">
                  Verification <p className="text-sm font-bold text-primary">{stepsCompleted}/{totalSteps} Steps</p>
                </div>
                {hasPaymentSource && (
                  <button
                    onClick={handleRefreshRevenue}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-2xl text-[10px] uppercase font-bold text-primary hover:bg-primary/20 transition-all flex items-center gap-2"
                  >
                    {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Refresh Revenue
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Revenue Sources */}
      <section className="mt-6 bg-neutral-900/20 border border-white/5 p-8 rounded-3xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">Connect your revenue sources</h3>
            <p className="text-sm text-neutral-500 font-medium tracking-tight">Link multiple providers. Verification score increments dynamically per provider.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest block">Aggregated Total MRR</span>
            <span className="text-2xl font-black text-green-400">
              ₹{totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-5 rounded-3xl border transition-all ${hasStripe ? 'bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(99,91,255,0.05)]' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${hasStripe ? 'bg-primary/10' : 'bg-white/5'}`}>
                  <Globe className={`w-6 h-6 ${hasStripe ? 'text-primary' : 'text-neutral-500'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Stripe Global</h4>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-wider">USD / Global</p>
                </div>
              </div>
              {hasStripe ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-widest border border-green-500/20 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</span>
              ) : (
                <button onClick={() => { setPaymentView('stripe'); setActiveModal('payment'); }} className="px-4 py-2 bg-white text-black text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10">Connect</button>
              )}
            </div>
            {hasStripe && (
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest">Provider MRR</span>
                <span className="text-xl font-bold">₹{connections.find(c => c.provider === 'stripe')?.amount?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>

          <div className={`p-5 rounded-3xl border transition-all ${hasRazorpay ? 'bg-blue-500/5 border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.05)]' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${hasRazorpay ? 'bg-blue-500/10' : 'bg-white/5'}`}>
                  <CreditCard className={`w-6 h-6 ${hasRazorpay ? 'text-blue-400' : 'text-neutral-500'}`} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Razorpay</h4>
                  <p className="text-[10px] text-neutral-500 uppercase font-black tracking-wider">INR / India</p>
                </div>
              </div>
              {hasRazorpay ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] uppercase font-bold tracking-widest border border-green-500/20 rounded-lg flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</span>
              ) : (
                <button onClick={() => { setPaymentView('razorpay'); setActiveModal('payment'); }} className="px-4 py-2 bg-white text-black text-[10px] uppercase font-black tracking-widest rounded-xl hover:bg-neutral-200 transition-colors shadow-lg shadow-white/10">Connect</button>
              )}
            </div>
            {hasRazorpay && (
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest">Provider MRR</span>
                <span className="text-xl font-bold">₹{connections.find(c => c.provider === 'razorpay')?.amount?.toLocaleString() || 0}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Improvement Actions */}
      <section className="mt-6 bg-neutral-900/20 border border-white/5 p-8 rounded-3xl space-y-6">
        <h3 className="text-xs uppercase font-black text-neutral-500 tracking-[0.2em]">Improve your profile:</h3>
        <div className="space-y-3">
          <button onClick={() => setActiveModal('website')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasWebsite ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><Globe className="w-4 h-4" /> <span className="text-sm font-medium">Add website (+10)</span></div>
            {!hasWebsite && <ArrowRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setActiveModal('kyc')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasIdentity ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><User className="w-4 h-4" /> <span className="text-sm font-medium">Complete KYC (+20)</span></div>
            {!hasIdentity && <ArrowRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setActiveModal('video')} className={`w-full flex items-center justify-between p-4 rounded-2xl border ${hasVideo ? 'bg-green-500/5 border-green-500/10 opacity-60' : 'bg-neutral-900 border-white/5 hover:border-white/10'}`}>
            <div className="flex items-center gap-3"><Video className="w-4 h-4" /> <span className="text-sm font-medium">Founder video (+30)</span></div>
            {!hasVideo && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </section>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-neutral-900 border border-white/10 w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-neutral-500" /></button>

            {activeModal === 'website' && (
              <form onSubmit={async (e) => { e.preventDefault(); await updateStartup({ website: (e.target as any).website.value }, "Website linked!", 10); }} className="space-y-6">
                <h3 className="text-xl font-bold">Business Website</h3>
                <input name="website" placeholder="startup.com" defaultValue={startup?.website} required autoFocus className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-primary" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Save Website (+10)"}</button>
              </form>
            )}

            {activeModal === 'kyc' && (
              <form onSubmit={async (e) => { e.preventDefault(); const form = e.target as any; await updateStartup({ founder_name: form.founder.value, founder_linkedin: form.linkedin.value, founder_twitter: form.twitter.value }, "Identity updated!", 20); }} className="space-y-4">
                <h3 className="text-xl font-bold">Founder Identity</h3>
                <input name="founder" placeholder="Full Name" defaultValue={startup?.founder_name} required className="w-full bg-neutral-950 border border-white/5 p-3 rounded-xl outline-none" />
                <input name="linkedin" placeholder="LinkedIn URL" defaultValue={startup?.founder_linkedin} className="w-full bg-neutral-950 border border-white/5 p-3 rounded-xl outline-none" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Save Identity (+20)"}</button>
              </form>
            )}

            {activeModal === 'video' && (
              <form onSubmit={async (e) => { e.preventDefault(); await updateStartup({ video_url: (e.target as any).video.value }, "Founder video linked!", 30); }} className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Founder Video Verification</h3>
                  <p className="text-sm text-neutral-500">Provide a Loom or YouTube link of the founder explaining the business for maximum trust (+30).</p>
                </div>
                <input name="video" placeholder="loom.com/share/..." required autoFocus className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-primary" />
                <button disabled={loading} className="w-full bg-white text-black py-4 rounded-xl font-bold uppercase tracking-[0.1em]">{loading ? "Saving..." : "Link founder video (+30)"}</button>
              </form>
            )}

            {activeModal === 'payment' && (
              <div className="space-y-8 text-center pb-4">
                {paymentView === "stripe" && (
                  <form onSubmit={handleStripeVerify} className="space-y-6 text-left">
                    <button type="button" onClick={() => setActiveModal(null)} className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                      ← Close
                    </button>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">Stripe Verification</h3>
                      <p className="text-xs text-neutral-500 font-medium">Link your account via secret API key.</p>
                    </div>

                    {stripeError && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                        <div className="text-xs text-red-400 font-bold uppercase tracking-tighter">
                          {stripeError}
                        </div>
                        <p className="text-[10px] text-red-400/60 font-medium">Please double check your credentials and try again.</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Stripe Secret Key</label>
                        <input
                          type="password"
                          required
                          placeholder="sk_live_..."
                          value={stripeKey}
                          onChange={(e) => setStripeKey(e.target.value)}
                          disabled={loading || stripeSuccess}
                          className={`w-full bg-neutral-950 border p-4 rounded-xl outline-none transition-colors text-sm font-mono ${stripeSuccess ? 'border-green-500/20 text-green-500/50' : 'border-white/5 focus:border-primary'}`}
                          autoFocus
                        />
                      </div>

                      {stripeSuccess ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                            <div className="space-y-0.5">
                              <p className="text-sm font-black text-green-400 uppercase tracking-tighter">Stripe connected successfully</p>
                              <p className="text-[10px] text-green-500/60 font-bold uppercase tracking-widest">Revenue synced</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                              <CircleDashed className="w-3 h-3 animate-spin" />
                              Last synced: Just now
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] text-neutral-600 font-medium leading-relaxed">
                            Find this in <span className="text-neutral-400 italic">Stripe Dashboard → Developers → API keys</span>
                          </p>
                          <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3" />
                            Keys are encrypted and used only for read-only audits.
                          </p>
                        </div>
                      )}
                    </div>

                    {!stripeSuccess && (
                      <button
                        type="submit"
                        disabled={loading || !isStripeValid}
                        className="w-full bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Sync Revenue"}
                      </button>
                    )}
                  </form>
                )}
                {paymentView === "razorpay" && (
                  <form onSubmit={handleRazorpayVerify} className="space-y-6 text-left">
                    <button type="button" onClick={() => setActiveModal(null)} className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1 hover:text-white transition-colors">
                      ← Close
                    </button>
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold">Razorpay Credentials</h3>
                      <p className="text-xs text-neutral-500 font-medium">Link your account to verify real-time revenue.</p>
                    </div>

                    {razorpayError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold uppercase tracking-tighter">
                        {razorpayError}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Key ID</label>
                        <input
                          type="text"
                          required
                          placeholder="rzp_test_..."
                          value={keyId}
                          onChange={(e) => setKeyId(e.target.value)}
                          className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-primary transition-colors text-sm font-mono"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Key Secret</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••••••"
                          value={keySecret}
                          onChange={(e) => setKeySecret(e.target.value)}
                          className="w-full bg-neutral-950 border border-white/5 p-4 rounded-xl outline-none focus:border-primary transition-colors text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] text-neutral-600 font-medium leading-relaxed">
                          Find your keys in <span className="text-neutral-400 italic">Razorpay Dashboard → Settings → API Keys</span>
                        </p>
                        <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-tight flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3" />
                          Keys are encrypted and used only for read-only audits.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !isRazorpayValid}
                      className="w-full bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Connection"}
                    </button>
                  </form>
                )}
                <p className="text-[10px] text-neutral-600 uppercase font-bold tracking-[0.2em] pt-4">Linking enables automated revenue audits</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

```

====================================================
FILE: src/lib/providers/error-mapping.ts
====================================================

```typescript
import { ProviderError, ProviderApiErrorShape } from "./errors";

export interface ErrorMappingRule {
  match: (error: ProviderApiErrorShape | ProviderError) => boolean;
  message: string;
}

const providerMappings: Record<string, ErrorMappingRule[]> = {
  razorpay: [
    {
      match: (err) => {
        const oe = err.originalError;
        return (
          err.statusCode === 401 &&
          oe?.code === "BAD_REQUEST_ERROR" &&
          typeof oe?.description === "string" &&
          oe.description.includes("Authentication failed")
        );
      },
      message: `Live Razorpay authentication failed

Please make sure you are using LIVE Razorpay API credentials.

Common causes:
• Test Mode API keys
• Incorrect Key ID or Key Secret
• Regenerated or revoked API keys
• Live API access has not yet been enabled on your Razorpay account

Please verify your Live credentials and try again.`,
    },
  ],
  stripe: [
    // Future Stripe rules can be added here
  ],
};

/**
 * Maps technical provider errors to user-friendly messages for the UI.
 * Retains original status codes while improving clarity.
 */
export function getFriendlyErrorMessage(
  providerId: string,
  error: any
): string {
  // If it's a ProviderError or mapped ProviderApiErrorShape
  if (error && (error.name === "ProviderError" || typeof error.statusCode === "number")) {
    const rules = providerMappings[providerId] || [];
    for (const rule of rules) {
      if (rule.match(error as ProviderApiErrorShape | ProviderError)) {
        return rule.message;
      }
    }
  }

  // Fallback generic extraction
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error.message === "string") {
    return error.message;
  }

  return "Provider verification failed";
}

```

====================================================
FILE: src/lib/providers/errors.ts
====================================================

```typescript
export interface ProviderApiErrorShape {
  statusCode: number;
  message: string;
  originalError: any;
}

export function normalizeProviderError(error: any): ProviderApiErrorShape {
  let statusCode = 500;
  if (error && typeof error === "object") {
    if (typeof error.statusCode === "number") {
      statusCode = error.statusCode;
    } else if (typeof error.status === "number") {
      statusCode = error.status;
    }
  }

  let message = "Provider verification failed";
  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object") {
    if (typeof error.description === "string") {
      message = error.description;
    } else if (typeof error.message === "string") {
      message = error.message;
    } else if (typeof error.code === "string") {
      message = error.code;
    } else {
      try {
        message = JSON.stringify(error);
      } catch (e) {
        message = String(error);
      }
    }
  } else if (typeof error === "string") {
    message = error;
  }

  return {
    statusCode,
    message,
    originalError: error,
  };
}

export class ProviderError extends Error {
  public statusCode: number;
  public originalError: any;

  constructor(normalized: ProviderApiErrorShape) {
    super(normalized.message);
    this.name = "ProviderError";
    this.statusCode = normalized.statusCode;
    this.originalError = normalized.originalError;
  }
}

```

====================================================
FILE: src/lib/providers/index.ts
====================================================

```typescript
export * from "./provider";
export * from "./registry";
export * from "./pipeline";
export * from "./razorpay";

// Register providers at module load time
import { providerRegistry } from "./registry";
import { razorpayProvider } from "./razorpay";

providerRegistry.register(razorpayProvider);

```

====================================================
FILE: src/lib/providers/pipeline.ts
====================================================

```typescript
import { Provider, ProviderCredentials } from "./provider";
import { NormalizedPayment } from "./types";
import { supabaseServer } from "@/lib/supabase-server";
import { computeTrustScore } from "@/lib/scoring";
import { fraudService } from "./services/fraud-service";
import { revenueService } from "./services/revenue-service";
import { normalizeProviderError, ProviderError } from "./errors";

export interface VerificationPipelineContext {
  startupId: number;
  provider: Provider;
  rawCredentials?: ProviderCredentials;
  // State populated incrementally as the pipeline executes
  serializedCredentials?: { accountId: string; encryptedKey: string };
  transactions?: NormalizedPayment[];
  fraudDetected?: boolean;
  revenueResult?: { revenue: number; currency: string; transactionCount: number };
  aggregatedRevenue?: { totalRevenue: number; breakdown: Record<string, number> };
  snapshotCreated?: boolean;
  trustScoreComputed?: boolean;
}

export interface VerificationPipelineResult {
  success: boolean;
  startupId: number;
  providerId: string;
  revenue?: number;
  breakdown?: Record<string, number>;
  currency?: string;
  totalTransactions?: number;
  fraudDetected?: boolean;
  error?: Error;
}

/**
 * Central Verification Pipeline
 * Orchestrates the execution of shared verification and synchronization logic.
 *
 * This is the canonical execution path for all provider verifications.
 * Razorpay is the reference implementation; Stripe will follow.
 */
export class VerificationPipeline {
  constructor(private context: VerificationPipelineContext) {}

  /**
   * Executes the full verification pipeline sequentially.
   * The stage ordering is CRITICAL — do not reorder.
   */
  async execute(): Promise<VerificationPipelineResult> {
    try {
      await this.stage1_verifyCredentials();
      await this.stage2_normalizeData();
      await this.stage3_runFraudDetection();
      await this.stage4_upsertTransactions();
      await this.stage5_aggregateRevenue();
      await this.stage6_generateSnapshot();
      await this.stage7_computeTrustScore();
      await this.stage8_updateConnectionStatus();
      await this.stage9_updateStartupStatus();
      await this.stage10_logEvent();

      return {
        success: true,
        startupId: this.context.startupId,
        providerId: this.context.provider.id,
        revenue: this.context.aggregatedRevenue?.totalRevenue ?? this.context.revenueResult?.revenue,
        breakdown: this.context.aggregatedRevenue?.breakdown,
        currency: this.context.revenueResult?.currency,
        totalTransactions: this.context.transactions?.length,
        fraudDetected: this.context.fraudDetected,
      };
    } catch (error) {
      console.error(`[VerificationPipeline] Error executing pipeline for startup ${this.context.startupId}:`, error);
      return {
        success: false,
        startupId: this.context.startupId,
        providerId: this.context.provider.id,
        error: new ProviderError(normalizeProviderError(error)),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Pipeline Stages
  // ---------------------------------------------------------------------------

  /**
   * Stage 1: Verify provider credentials
   * If rawCredentials are provided, validate them via the provider.
   * If not (resync case), credentials were already verified previously.
   */
  private async stage1_verifyCredentials(): Promise<void> {
    if (this.context.rawCredentials) {
      const valid = await this.context.provider.verifyCredentials(this.context.rawCredentials);
      if (!valid) {
        throw new Error(`Invalid ${this.context.provider.name} API credentials`);
      }
    }
  }

  /**
   * Stage 2: Normalize provider data
   * Serialize credentials and fetch normalized transactions.
   */
  private async stage2_normalizeData(): Promise<void> {
    // Serialize credentials if raw ones were provided
    if (this.context.rawCredentials) {
      this.context.serializedCredentials = await this.context.provider.serializeCredentials(
        this.context.rawCredentials
      );
    }

    if (!this.context.serializedCredentials) {
      throw new Error("No credentials available for fetching transactions");
    }

    const { accountId, encryptedKey } = this.context.serializedCredentials;

    // For fetchTransactions we need the decrypted key — but we receive it
    // already decrypted from the caller (resync) or from raw credentials.
    // The pipeline context stores the decrypted key for fetching.
    // We use a convention: if rawCredentials exist, pass the raw secret;
    // otherwise the caller must supply serializedCredentials with the decrypted key
    // stored temporarily in encryptedKey field for the fetch call.
    const transactions = await this.context.provider.fetchTransactions(
      accountId,
      encryptedKey
    );

    if (transactions.length === 0) {
      throw new Error("No revenue detected in the last 30 days");
    }

    const revenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currency = transactions[0]?.currency || "USD";

    if (revenue === 0) {
      throw new Error("No revenue detected in the last 30 days");
    }

    this.context.transactions = transactions;
    this.context.revenueResult = {
      revenue,
      currency,
      transactionCount: transactions.length,
    };
  }

  /**
   * Stage 3: Run fraud detection
   */
  private async stage3_runFraudDetection(): Promise<void> {
    if (!this.context.transactions || this.context.transactions.length === 0) return;

    const amounts = this.context.transactions.map(tx => tx.amount);
    const currentMaxTx = Math.max(...amounts);

    const result = await fraudService.runChecks({
      startupId: this.context.startupId,
      currentMaxAmount: currentMaxTx,
      insertSignalOnSpike: true,
      signalDescription: `Revenue spike detected via ${this.context.provider.name} verification`,
    });

    this.context.fraudDetected = result.spikeDetected;
  }

  /**
   * Stage 4: Upsert transactions
   */
  private async stage4_upsertTransactions(): Promise<void> {
    if (!this.context.transactions) return;

    const result = await revenueService.upsertTransactions({
      startupId: this.context.startupId,
      provider: this.context.provider.id,
      transactions: this.context.transactions,
    });
    
    if (result.failed > 0) {
      console.warn(`[VerificationPipeline] ${result.failed} transactions failed to insert for startup ${this.context.startupId}. Errors:`, result.errors);
    }
  }

  /**
   * Stage 5: Aggregate revenue
   */
  private async stage5_aggregateRevenue(): Promise<void> {
    const prefetched: Record<string, any> = {};
    if (this.context.revenueResult) {
      prefetched[this.context.provider.id] = {
        provider: this.context.provider.id,
        originalRevenue: this.context.revenueResult.revenue,
        originalCurrency: this.context.revenueResult.currency,
        revenue: this.context.revenueResult.revenue,
        currency: "INR",
        transactionCount: this.context.revenueResult.transactionCount,
        success: true,
      };
    }
    const aggregated = await revenueService.aggregateRevenue(this.context.startupId, prefetched, true);
    this.context.aggregatedRevenue = aggregated;
  }

  /**
   * Stage 6: Generate revenue snapshot
   * Mirrors the exact logic from the existing sync files.
   */
  private async stage6_generateSnapshot(): Promise<void> {
    const snapshotRevenue = this.context.aggregatedRevenue?.totalRevenue
      ?? this.context.revenueResult?.revenue
      ?? 0;

    const { data: lastSnap } = await supabaseServer
      .from("revenue_snapshots")
      .select("total_revenue")
      .eq("startup_id", this.context.startupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!lastSnap?.length || lastSnap[0]?.total_revenue !== snapshotRevenue) {
      await supabaseServer.from("revenue_snapshots").insert({
        startup_id: this.context.startupId,
        total_revenue: snapshotRevenue,
        provider_breakdown:
          this.context.aggregatedRevenue?.breakdown || { [this.context.provider.id]: snapshotRevenue },
        provider: this.context.provider.id,
        created_at: new Date().toISOString(),
      });
      this.context.snapshotCreated = true;
    }
  }

  /**
   * Stage 7: Compute trust score
   */
  private async stage7_computeTrustScore(): Promise<void> {
    await computeTrustScore(this.context.startupId);
    this.context.trustScoreComputed = true;
  }

  /**
   * Stage 8: Update provider connection status
   */
  private async stage8_updateConnectionStatus(): Promise<void> {
    const fallbackRevenue = this.context.revenueResult?.revenue ?? 0;
    const providerRevenue = this.context.aggregatedRevenue?.breakdown?.[this.context.provider.id] ?? fallbackRevenue;

    const payload: any = {
      startup_id: this.context.startupId,
      provider: this.context.provider.id,
      latest_revenue: providerRevenue,
      last_synced_at: new Date().toISOString(),
      status: "connected",
    };

    if (this.context.serializedCredentials) {
      payload.account_id = this.context.serializedCredentials.accountId;
      payload.api_key_encrypted = this.context.serializedCredentials.encryptedKey;
    }

    await supabaseServer
      .from("provider_connections")
      .upsert(payload, { onConflict: "startup_id,provider" });
  }

  /**
   * Stage 9: Update startup verification status
   */
  private async stage9_updateStartupStatus(): Promise<void> {
    const payload: any = {
      payment_connected: true,
      verification_status: "api_verified",
      last_verified_at: new Date().toISOString(),
      raw_metrics: {
        payment_count: this.context.transactions?.length ?? 0,
        spike_detected: this.context.fraudDetected ?? false,
      },
    };

    if (this.context.aggregatedRevenue) {
      payload.mrr = Math.round(this.context.aggregatedRevenue.totalRevenue);
      payload.mrr_breakdown = this.context.aggregatedRevenue.breakdown;
    } else if (this.context.revenueResult) {
      payload.mrr = Math.round(this.context.revenueResult.revenue);
      payload.mrr_breakdown = { [this.context.provider.id]: this.context.revenueResult.revenue };
    }

    await supabaseServer
      .from("startup_submissions")
      .update(payload)
      .eq("id", this.context.startupId);
  }

  /**
   * Stage 10: Log verification event
   */
  private async stage10_logEvent(): Promise<void> {
    const snapshotRevenue = this.context.aggregatedRevenue?.totalRevenue
      ?? this.context.revenueResult?.revenue
      ?? 0;

    await supabaseServer.from("verification_logs").insert({
      startup_id: this.context.startupId,
      event: `${this.context.provider.id}_sync_success`,
      metadata: {
        mrr: snapshotRevenue,
        count: this.context.transactions?.length ?? 0,
      },
    });
  }
}


```

====================================================
FILE: src/lib/providers/provider.ts
====================================================

```typescript
export interface ProviderCredentials {
  [key: string]: any;
}

export interface SerializedCredentials {
  accountId: string;
  encryptedKey: string;
}

export interface ProviderRevenueResult {
  revenue: number;
  currency: string;
  transactionCount: number;
}

export interface WebhookResult {
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
}

export interface Provider {
  readonly id: string;
  readonly name: string;

  connect(startupId: string, credentials: ProviderCredentials): Promise<void>;
  disconnect(startupId: string): Promise<void>;
  verifyCredentials(credentials: ProviderCredentials): Promise<boolean>;
  fetchRevenue(accountId: string, decryptedKey: string): Promise<ProviderRevenueResult>;
  fetchTransactions(accountId: string, decryptedKey: string, options?: any): Promise<any[]>;
  serializeCredentials(credentials: ProviderCredentials): Promise<SerializedCredentials>;
  parseWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  healthCheck(): Promise<boolean>;
}

```

====================================================
FILE: src/lib/providers/razorpay.ts
====================================================

```typescript
import Razorpay from "razorpay";
import { encrypt } from "@/lib/encryption";
import {
  Provider,
  ProviderCredentials,
  SerializedCredentials,
  ProviderRevenueResult,
  WebhookResult,
} from "./provider";
import { NormalizedPayment } from "./types";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

/**
 * RazorpayProvider — Reference implementation of the Provider interface.
 *
 * Responsible ONLY for:
 *   - Credential verification against Razorpay API
 *   - Fetching raw payment data from Razorpay
 *   - Normalizing Razorpay responses into NormalizedPayment[]
 *   - Serializing credentials for encrypted storage
 *
 * All orchestration (fraud, snapshots, trust, persistence) is handled
 * by the VerificationPipeline and shared services.
 */
export class RazorpayProvider implements Provider {
  readonly id = "razorpay";
  readonly name = "Razorpay";

  // ---------------------------------------------------------------------------
  // Provider Interface — Core Methods
  // ---------------------------------------------------------------------------

  async verifyCredentials(credentials: ProviderCredentials): Promise<boolean> {
    const { keyId, keySecret } = credentials;
    if (!keyId || !keySecret) return false;

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    try {
      await razorpay.payments.all({ count: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async fetchTransactions(
    accountId: string,
    decryptedKey: string
  ): Promise<NormalizedPayment[]> {
    const razorpay = new Razorpay({ key_id: accountId, key_secret: decryptedKey });
    const from = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC;
    const to = Math.floor(Date.now() / 1000);
    const collected: NormalizedPayment[] = [];
    let skip = 0;
    const pageSize = 100;

    while (true) {
      const response = await razorpay.payments.all({
        from,
        to,
        count: pageSize,
        skip,
      });

      const items = response?.items || [];
      if (items.length === 0) break;

      for (const p of items) {
        if (p.status !== "captured") continue;
        collected.push({
          external_payment_id: p.id,
          amount: (Number(p.amount) || 0) / 100,
          currency: ((p.currency as string) || "INR").toUpperCase(),
          timestamp: (Number(p.created_at) || 0) * 1000,
          status: p.status,
          provider: "razorpay",
        });
      }

      if (items.length < pageSize) break;
      skip += pageSize;
    }

    return collected;
  }

  async fetchRevenue(
    accountId: string,
    decryptedKey: string
  ): Promise<ProviderRevenueResult> {
    const transactions = await this.fetchTransactions(accountId, decryptedKey);
    const revenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const currency = transactions[0]?.currency || "INR";
    return { revenue, currency, transactionCount: transactions.length };
  }

  async serializeCredentials(
    credentials: ProviderCredentials
  ): Promise<SerializedCredentials> {
    const { keyId, keySecret } = credentials;
    return {
      accountId: keyId,
      encryptedKey: encrypt(keySecret),
    };
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Lifecycle Methods
  // ---------------------------------------------------------------------------

  async connect(_startupId: string, _credentials: ProviderCredentials): Promise<void> {
    // Connection persistence is handled by the pipeline's Stage 8
  }

  async disconnect(_startupId: string): Promise<void> {
    // Disconnection is handled externally via API routes
  }

  // ---------------------------------------------------------------------------
  // Provider Interface — Webhook & Health
  // ---------------------------------------------------------------------------

  async parseWebhook(payload: any, _signature?: string): Promise<WebhookResult> {
    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    if (!paymentEntity) {
      throw new Error("Invalid Razorpay webhook payload");
    }

    return {
      paymentId: paymentEntity.id,
      amount: (Number(paymentEntity.amount) || 0) / 100,
      currency: ((paymentEntity.currency as string) || "INR").toUpperCase(),
      status: event === "payment.captured" ? "captured" : paymentEntity.status,
      provider: "razorpay",
    };
  }

  async healthCheck(): Promise<boolean> {
    // Razorpay does not expose a dedicated health endpoint.
    return true;
  }
}

export const razorpayProvider = new RazorpayProvider();

```

====================================================
FILE: src/lib/providers/registry.ts
====================================================

```typescript
import { Provider } from "./provider";

export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();

  register(provider: Provider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with id '${provider.id}' is already registered.`);
    }
    this.providers.set(provider.id, provider);
  }

  get(id: string): Provider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider with id '${id}' not found. Please ensure it is registered.`);
    }
    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): Provider[] {
    return Array.from(this.providers.values());
  }
}

// Export a singleton instance for standard use across the app
export const providerRegistry = new ProviderRegistry();

```

====================================================
FILE: src/lib/providers/services/fraud-service.ts
====================================================

```typescript
import { detectFraud } from "@/lib/fraud";
import { supabaseServer } from "@/lib/supabase-server";

export interface FraudServiceCheckRequest {
  startupId: number | string;
  provider?: string;
  currentMaxAmount: number;
  insertSignalOnSpike?: boolean;
  signalDescription?: string;
}

export interface FraudServiceCheckResult {
  isFraud: boolean;
  spikeDetected: boolean;
  rateLimitTriggered: boolean;
  reason?: string;
}

/**
 * Service for centralizing provider-agnostic fraud detection.
 * Orchestrates the existing `detectFraud` logic.
 */
export class FraudService {
  async runChecks(request: FraudServiceCheckRequest): Promise<FraudServiceCheckResult> {
    const { data: history } = await supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", request.startupId)
      .order("created_at", { ascending: false })
      .limit(4);

    const prevTxAmounts = (history ?? []).map(h => Number(h.amount));
    const prevTimestamps = (history ?? []).map(h => new Date(h.created_at).getTime());

    const fraud = detectFraud({
      amount: request.currentMaxAmount,
      previousTransactions: prevTxAmounts,
      timestamps: prevTimestamps,
      now: Date.now(),
    });

    const spikeDetected = fraud.reason === "spike";
    const rateLimitTriggered = fraud.reason === "rate_limit";

    if (spikeDetected && request.insertSignalOnSpike) {
      await supabaseServer.from("fraud_signals").insert({
        startup_id: request.startupId,
        signal_type: "REVENUE_SPIKE",
        severity: 3,
        description: request.signalDescription || `Revenue spike detected via ${request.provider || "API"} verification`,
      });
    }

    return {
      isFraud: fraud.isFraud,
      spikeDetected,
      rateLimitTriggered,
      reason: fraud.reason || undefined,
    };
  }
}

export const fraudService = new FraudService();

```

====================================================
FILE: src/lib/providers/services/index.ts
====================================================

```typescript
export * from "./fraud-service";
export * from "./revenue-service";

```

====================================================
FILE: src/lib/providers/services/revenue-service.ts
====================================================

```typescript
import { supabaseServer } from "@/lib/supabase-server";
import { getAggregatedRevenue, ProviderRevenue } from "@/lib/revenue-aggregation";
import { NormalizedPayment } from "../types";

export interface UpsertTransactionsRequest {
  startupId: number | string;
  provider: string;
  transactions: NormalizedPayment[];
}

export interface UpsertTransactionsResult {
  successful: number;
  failed: number;
  errors: any[];
}

export interface AggregateRevenueResult {
  totalRevenue: number;
  breakdown: Record<string, number>;
}

/**
 * Service for handling raw transaction persistence and MRR aggregation.
 */
export class RevenueService {
  /**
   * Upserts newly fetched normalized transactions to the database.
   * Returns the number of successfully synced transactions.
   */
  async upsertTransactions(request: UpsertTransactionsRequest): Promise<UpsertTransactionsResult> {
    let successful = 0;
    let failed = 0;
    const errors: any[] = [];
    
    for (const tx of request.transactions) {
      const { error } = await supabaseServer.from("revenue_transactions").upsert(
        {
          startup_id: request.startupId,
          provider: request.provider,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          external_id: tx.external_payment_id,
          payment_id: tx.external_payment_id,
          created_at: new Date(tx.timestamp).toISOString(),
        },
        { onConflict: "external_id" }
      );
      if (error) {
        if (!error.message?.toLowerCase().includes("duplicate")) {
          failed++;
          errors.push(error);
        } else {
          successful++;
        }
      } else {
        successful++;
      }
    }
    return { successful, failed, errors };
  }

  /**
   * Calculates the current total MRR across all providers.
   */
  async aggregateRevenue(
    startupId: number | string,
    prefetchedProviders?: Record<string, ProviderRevenue>,
    skipPersist: boolean = false
  ): Promise<AggregateRevenueResult> {
    const aggregated = await getAggregatedRevenue(Number(startupId), prefetchedProviders, skipPersist);
    return {
      totalRevenue: aggregated?.totalRevenue ?? 0,
      breakdown: aggregated?.breakdown || {},
    };
  }
}

export const revenueService = new RevenueService();

```

====================================================
FILE: src/lib/providers/stripe.ts
====================================================

```typescript
import Stripe from "stripe";
import { RevenueProvider, NormalizedPayment } from "./types";
import { getPlatformStripe, getStripeForSecretKey } from "@/lib/stripe";

export class StripeProvider implements RevenueProvider {
  private stripe: Stripe;
  private stripeAccountId?: string;

  constructor(apiKeyOrAccountId: string, options?: { connectAccount?: boolean }) {
    if (options?.connectAccount) {
      this.stripe = getPlatformStripe();
      this.stripeAccountId = apiKeyOrAccountId;
    } else {
      this.stripe = getStripeForSecretKey(apiKeyOrAccountId);
    }
  }

  async fetchPayments(): Promise<NormalizedPayment[]> {
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    );
    const requestOptions = this.stripeAccountId
      ? { stripeAccount: this.stripeAccountId }
      : undefined;

    let allTransactions: Stripe.BalanceTransaction[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const response = await this.stripe.balanceTransactions.list(
        {
          limit: 100,
          starting_after: startingAfter,
          created: { gte: thirtyDaysAgo },
        },
        requestOptions
      );

      allTransactions = allTransactions.concat(
        response.data.filter(
          (tx) => tx.type === "charge" || tx.type === "payment"
        )
      );
      hasMore = response.has_more;

      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      } else {
        break;
      }
    }

    return allTransactions.map((tx) => ({
      external_payment_id: tx.id,
      amount: tx.amount / 100,
      currency: tx.currency,
      timestamp: tx.created * 1000,
      status: "successful",
      provider: "stripe",
    }));
  }
}

```

====================================================
FILE: src/lib/providers/types.ts
====================================================

```typescript
export interface NormalizedPayment {
  external_payment_id: string;
  amount: number; // In the base unit (e.g. INR / USD), not cents/paise
  currency: string;
  timestamp: number; // in milliseconds
  status: string;
  provider: string;
}

export interface RevenueProvider {
  fetchPayments(): Promise<NormalizedPayment[]>;
}

```

====================================================
FILE: src/lib/stripe-connect.ts
====================================================

```typescript
import crypto from "crypto";
import { getSiteUrl } from "@/lib/site-url";
import { requireStripeSecretKey } from "@/lib/stripe";

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

function oauthStateSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is not configured");
  }
  return secret;
}

export function getStripeConnectRedirectUri(): string {
  const base = getSiteUrl();
  if (!base) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for Stripe Connect redirects");
  }
  return `${base}/api/stripe/callback`;
}

export function signStripeOAuthState(payload: {
  startupId: number;
  userId: string;
}): string {
  const issuedAt = Date.now();
  const body = `${payload.startupId}:${payload.userId}:${issuedAt}`;
  const sig = crypto
    .createHmac("sha256", oauthStateSecret())
    .update(body)
    .digest("hex");
  return Buffer.from(`${body}:${sig}`).toString("base64url");
}

export function verifyStripeOAuthState(
  state: string
): { startupId: number; userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [startupIdRaw, userId, issuedAtRaw, sig] = parts;
    const body = `${startupIdRaw}:${userId}:${issuedAtRaw}`;
    const expected = crypto
      .createHmac("sha256", oauthStateSecret())
      .update(body)
      .digest("hex");

    if (sig !== expected) return null;

    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > OAUTH_STATE_TTL_MS) {
      return null;
    }

    const startupId = Number(startupIdRaw);
    if (!Number.isFinite(startupId) || !userId) return null;

    return { startupId, userId };
  } catch {
    return null;
  }
}

export function buildStripeConnectAuthorizeUrl(state: string): string {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRIPE_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    redirect_uri: getStripeConnectRedirectUri(),
    state,
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export type StripeOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  stripe_user_id: string;
  scope?: string;
  livemode?: boolean;
};

export async function exchangeStripeConnectCode(
  code: string
): Promise<StripeOAuthTokenResponse> {
  const clientId = process.env.STRIPE_CLIENT_ID;
  if (!clientId) {
    throw new Error("STRIPE_CLIENT_ID is not configured");
  }

  const body = new URLSearchParams({
    client_secret: requireStripeSecretKey(),
    client_id: clientId,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data?.error_description === "string"
        ? data.error_description
        : typeof data?.error === "string"
          ? data.error
          : "Stripe OAuth token exchange failed";
    throw new Error(message);
  }

  if (!data.stripe_user_id || !data.access_token) {
    throw new Error("Stripe OAuth response missing account credentials");
  }

  return data as StripeOAuthTokenResponse;
}

```

====================================================
FILE: src/lib/verification-confidence.ts
====================================================

```typescript
/**
 * Verification Confidence Engine
 *
 * Composite score (0–100) from observable pipeline signals only.
 * Does not assign public verification tiers — see verification-state.ts.
 */

const WEIGHTS = {
  transactionVolume: 0.35,
  providerSync: 0.25,
  consistencySignal: 0.25,
  fraudClearance: 0.15,
} as const;

const VOLUME_TIERS = [
  { min: 20, score: 100 },
  { min: 10, score: 80 },
  { min: 5, score: 60 },
  { min: 3, score: 40 },
  { min: 1, score: 20 },
  { min: 0, score: 0 },
] as const;

const SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export type VerificationStatus = "VERIFIED" | "SYNCING" | "LOW CONFIDENCE";

export interface VerificationConfidenceInput {
  transactionCount: number;
  providers: string[];
  consistencyScore: number;
  fraudFlagCount: number;
  deduplicationActive: boolean;
  lastSyncAt: string | null;
}

export interface VerificationConfidenceResult {
  verification_confidence: number;
  verified_transaction_count: number;
  duplicate_protection_active: boolean;
  fraud_check_status: "passed" | "flagged" | "no_data";
  verification_status: VerificationStatus;
  provider_details: {
    provider: string;
    sync_active: boolean;
    last_sync: string | null;
  }[];
}

function providerSyncScore(
  providers: string[],
  lastSyncAt: string | null
): number {
  if (providers.length === 0) return 0;
  if (!lastSyncAt) return 40;
  const fresh = Date.now() - new Date(lastSyncAt).getTime() <= SYNC_FRESH_MS;
  return fresh ? 100 : 50;
}

export function computeVerificationConfidence(
  input: VerificationConfidenceInput
): VerificationConfidenceResult {
  const {
    transactionCount,
    providers,
    consistencyScore,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt,
  } = input;

  let volumeScore = 0;
  for (const tier of VOLUME_TIERS) {
    if (transactionCount >= tier.min) {
      volumeScore = tier.score;
      break;
    }
  }

  const syncScore = providerSyncScore(providers, lastSyncAt);
  const consistencySignal = Math.max(0, Math.min(100, consistencyScore));

  let fraudScore: number;
  if (transactionCount === 0) {
    fraudScore = 0;
  } else if (fraudFlagCount === 0) {
    fraudScore = 100;
  } else if (fraudFlagCount <= 2) {
    fraudScore = 50;
  } else {
    fraudScore = 20;
  }

  const dedupMultiplier = deduplicationActive ? 1 : 0.85;
  const raw =
    (volumeScore * WEIGHTS.transactionVolume +
      syncScore * WEIGHTS.providerSync +
      consistencySignal * WEIGHTS.consistencySignal +
      fraudScore * WEIGHTS.fraudClearance) *
    dedupMultiplier;

  const confidence = Math.round(Math.max(0, Math.min(100, raw)));

  let fraudCheckStatus: "passed" | "flagged" | "no_data";
  if (transactionCount === 0) {
    fraudCheckStatus = "no_data";
  } else if (fraudFlagCount > 0) {
    fraudCheckStatus = "flagged";
  } else {
    fraudCheckStatus = "passed";
  }

  const providerDetails = providers.map((p) => ({
    provider: p,
    sync_active:
      !!lastSyncAt &&
      Date.now() - new Date(lastSyncAt).getTime() <= SYNC_FRESH_MS,
    last_sync: lastSyncAt,
  }));

  return {
    verification_confidence: confidence,
    verified_transaction_count: transactionCount,
    duplicate_protection_active: deduplicationActive,
    fraud_check_status: fraudCheckStatus,
    verification_status: getVerificationStatus(
      confidence,
      providers.length,
      lastSyncAt
    ),
    provider_details: providerDetails,
  };
}

function getVerificationStatus(
  confidence: number,
  connectedProviderCount: number,
  lastSyncAt: string | null
): VerificationStatus {
  if (connectedProviderCount === 0) return "LOW CONFIDENCE";
  if (!lastSyncAt) return "SYNCING";
  if (confidence >= 70) return "VERIFIED";
  if (confidence >= 40) return "SYNCING";
  return "LOW CONFIDENCE";
}

```

====================================================
FILE: src/lib/verification-config.ts
====================================================

```typescript
import { ShieldCheck, ScanSearch, CheckCircle2, Award, LucideIcon } from "lucide-react";
import { ConfidenceTier } from "./verification-state";

export interface TierConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  icon: LucideIcon;
  description: string;
}

export const VERIFICATION_TIER_CONFIG: Record<ConfidenceTier, TierConfig> = {
  SELF_REPORTED: {
    label: "Self Reported",
    color: "text-neutral-400",
    bg: "bg-neutral-500/10",
    border: "border-neutral-500/20",
    glow: "",
    icon: ScanSearch,
    description: "Revenue data self-declared without a connected payment provider",
  },
  PAYMENT_CONNECTED: {
    label: "Payment Connected",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_15px_rgba(251,191,36,0.1)]",
    icon: Award,
    description: "Payment provider linked; building verified transaction history",
  },
  REVENUE_VERIFIED: {
    label: "Revenue Verified",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    icon: ShieldCheck,
    description: "Provider-backed revenue history with a recent sync",
  },
};

export const FALLBACK_VERIFICATION_TIER: ConfidenceTier = "SELF_REPORTED";

```

====================================================
FILE: src/lib/verification-data.ts
====================================================

```typescript
import { supabaseServer } from "@/lib/supabase-server";
import {
  buildVerificationStateInput,
  computeVerificationState,
  VerificationStateResult,
} from "@/lib/verification-state";

export function isDemoStartupUserId(userId: string | null | undefined): boolean {
  return !!userId?.startsWith("00000000-0000-0000-0000-");
}

export async function computeVerificationStateForStartup(
  startupId: number,
  options?: { isDemoProfile?: boolean }
): Promise<VerificationStateResult> {
  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("amount, created_at")
      .eq("startup_id", startupId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabaseServer
      .from("provider_connections")
      .select("provider, status, last_synced_at, latest_revenue")
      .eq("startup_id", startupId),
    supabaseServer
      .from("fraud_signals")
      .select("signal_type")
      .eq("startup_id", startupId),
    supabaseServer
      .from("startup_submissions")
      .select("penalty_count, user_id, verification_type, proof_url")
      .eq("id", startupId)
      .maybeSingle(),
  ]);

  const isDemo =
    options?.isDemoProfile ??
    isDemoStartupUserId(startupRes.data?.user_id);

  return computeVerificationState(
    buildVerificationStateInput({
      revenueTransactions: revenueRes.data || [],
      providerConnections: providerRes.data || [],
      fraudSignals: fraudRes.data || [],
      penaltyCount: Number(startupRes.data?.penalty_count) || 0,
      isDemoProfile: isDemo,
      verificationType: startupRes.data?.verification_type,
      hasProofUpload: !!startupRes.data?.proof_url,
    })
  );
}

export async function computeVerificationStatesForStartups(
  startupIds: number[],
  demoUserIds: Map<number, string | null>
): Promise<Map<number, VerificationStateResult>> {
  const results = new Map<number, VerificationStateResult>();
  if (startupIds.length === 0) return results;

  const [revenueRes, providerRes, fraudRes, startupRes] = await Promise.all([
    supabaseServer
      .from("revenue_transactions")
      .select("startup_id, amount, created_at")
      .in("startup_id", startupIds)
      .order("created_at", { ascending: true }),
    supabaseServer
      .from("provider_connections")
      .select("startup_id, provider, status, last_synced_at, latest_revenue")
      .in("startup_id", startupIds),
    supabaseServer
      .from("fraud_signals")
      .select("startup_id, signal_type")
      .in("startup_id", startupIds),
    supabaseServer
      .from("startup_submissions")
      .select("id, penalty_count, user_id, verification_type, proof_url")
      .in("id", startupIds),
  ]);

  const revenueByStartup = new Map<number, { amount: number; created_at: string }[]>();
  for (const row of revenueRes.data || []) {
    const list = revenueByStartup.get(row.startup_id) || [];
    list.push({ amount: row.amount, created_at: row.created_at });
    revenueByStartup.set(row.startup_id, list);
  }

  const providersByStartup = new Map<
    number,
    { provider: string; status: string; last_synced_at: string | null; latest_revenue?: number }[]
  >();
  for (const row of providerRes.data || []) {
    const list = providersByStartup.get(row.startup_id) || [];
    list.push({
      provider: row.provider,
      status: row.status,
      last_synced_at: row.last_synced_at,
      latest_revenue: row.latest_revenue,
    });
    providersByStartup.set(row.startup_id, list);
  }

  const fraudByStartup = new Map<number, { signal_type: string }[]>();
  for (const row of fraudRes.data || []) {
    const list = fraudByStartup.get(row.startup_id) || [];
    list.push({ signal_type: row.signal_type });
    fraudByStartup.set(row.startup_id, list);
  }

  const penaltyByStartup = new Map<number, number>();
  for (const row of startupRes.data || []) {
    penaltyByStartup.set(row.id, Number(row.penalty_count) || 0);
    demoUserIds.set(row.id, row.user_id);
  }

  for (const id of startupIds) {
    const startupRow = (startupRes.data || []).find((r) => r.id === id);
    const state = computeVerificationState(
      buildVerificationStateInput({
        revenueTransactions: revenueByStartup.get(id) || [],
        providerConnections: providersByStartup.get(id) || [],
        fraudSignals: fraudByStartup.get(id) || [],
        penaltyCount: penaltyByStartup.get(id) || 0,
        isDemoProfile: isDemoStartupUserId(demoUserIds.get(id)),
        verificationType: startupRow?.verification_type,
        hasProofUpload: !!startupRow?.proof_url,
      })
    );
    results.set(id, state);
  }

  return results;
}

```

====================================================
FILE: src/lib/verification-state.ts
====================================================

```typescript
import { computeVerificationConfidence } from "./verification-confidence";
import { analyzeRevenueConsistency } from "./revenue-consistency";
import { calculateTrustScore } from "./scoring";

// ─── Confidence-Based Trust Tiers (data-derived only) ───────────────────────
//
//   SELF_REPORTED     → No connected payment provider
//   PAYMENT_CONNECTED → Provider linked; insufficient provider-backed revenue history
//   REVENUE_VERIFIED  → Provider linked + transaction history + recent sync

export type ConfidenceTier =
  | "SELF_REPORTED"
  | "PAYMENT_CONNECTED"
  | "REVENUE_VERIFIED";

/** @deprecated Use REVENUE_VERIFIED — kept for callers not yet updated */
export type LegacyConfidenceTier = ConfidenceTier | "HIGH_CONFIDENCE";

export type InternalAnomalyFlag =
  | "RATE_LIMIT_TRIGGERED"
  | "REVENUE_SPIKE_DETECTED"
  | "CONSISTENCY_LOW"
  | "PENALTY_ACTIVE"
  | "PROVIDER_STALE";

export interface VerificationStateInput {
  revenueTransactions: { amount: number; timestamp: number }[];
  providerConnections: {
    provider: string;
    status: string;
    last_synced_at: string | null;
    latest_revenue?: number;
  }[];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  /** Sandbox/demo profiles must not inherit simulated DB metrics as verified */
  isDemoProfile?: boolean;
  /** From startup_submissions.verification_type (api, manual, proof, social) */
  verificationType?: string | null;
  hasProofUpload?: boolean;
}

export interface VerificationStateResult {
  confidenceTier: ConfidenceTier;
  verificationConfidence: number;
  providersConnected: string[];
  duplicateProtectionActive: boolean;
  fraudChecksPassed: boolean;
  consistencyLevel: string;
  consistencyScore: number;
  consistencyFlags: string[];
  trustScore: number;
  lastSyncAt: string | null;
  transactionCount: number;
  hasConnectedProviders: boolean;
  providerBreakdown: { provider: string; amount: number; percentage: number }[];
  verificationDepth: number;
  internalFlags: InternalAnomalyFlag[];
  /** @deprecated Use confidenceTier */
  verificationStatus: string;
  /** Submission verification_type */
  verificationMethod: string;
  verificationMethodLabel: string;
  /** Primary revenue evidence channel */
  dataSource: string;
  dataSourceLabel: string;
  /** Provider-backed revenue with recent sync — required before "verified" UI */
  hasVerificationEvidence: boolean;
}

const MIN_PROVIDER_TRANSACTIONS = 3;
const SYNC_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function formatLastSyncRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatVerificationMethodLabel(
  verificationType: string | null | undefined
): string {
  switch (verificationType?.toLowerCase()) {
    case "api":
      return "Payment API";
    case "proof":
      return "Proof upload";
    case "social":
      return "Social links";
    case "manual":
      return "Manual declaration";
    default:
      return "Manual declaration";
  }
}

export function resolveTrustDataSource(params: {
  confidenceTier: ConfidenceTier;
  providersConnected: string[];
  verificationType?: string | null;
  hasProofUpload?: boolean;
  isDemoProfile?: boolean;
}): { dataSource: string; dataSourceLabel: string } {
  if (params.isDemoProfile) {
    return { dataSource: "sandbox", dataSourceLabel: "Sandbox sample data" };
  }

  if (params.providersConnected.length > 0) {
    const names = params.providersConnected.map(
      (p) => p.charAt(0).toUpperCase() + p.slice(1)
    );
    const label =
      params.confidenceTier === "REVENUE_VERIFIED"
        ? names.join(" + ")
        : `${names.join(" + ")} (awaiting sync)`;
    return { dataSource: params.providersConnected[0], dataSourceLabel: label };
  }

  if (params.hasProofUpload || params.verificationType === "proof") {
    return {
      dataSource: "proof",
      dataSourceLabel: "Uploaded proof (not ledger-backed)",
    };
  }

  if (params.verificationType === "api") {
    return {
      dataSource: "pending_api",
      dataSourceLabel: "Payment API (not connected)",
    };
  }

  return {
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
  };
}

export function hasVerificationEvidence(
  state: Pick<VerificationStateResult, "confidenceTier">
): boolean {
  return state.confidenceTier === "REVENUE_VERIFIED";
}

function normalizeSignalType(signal: string): string {
  return signal.toLowerCase().replace(/_/g, "");
}

function sumTransactionAmounts(
  transactions: { amount: number; timestamp: number }[]
): number {
  return transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

function hasDuplicateProtection(
  transactions: { amount: number; timestamp: number }[]
): boolean {
  if (transactions.length < 2) return false;
  const keys = new Set(
    transactions.map((t) => `${t.timestamp}:${Number(t.amount)}`)
  );
  return keys.size >= 2;
}

/**
 * Tier rules use only observable pipeline data (no trust-score or reliability priors).
 */
export function resolveConfidenceTierFromData(params: {
  hasProviders: boolean;
  transactionCount: number;
  providerRevenueTotal: number;
  lastSyncAt: string | null;
}): ConfidenceTier {
  if (!params.hasProviders) {
    return "SELF_REPORTED";
  }

  const syncFresh =
    !!params.lastSyncAt &&
    Date.now() - new Date(params.lastSyncAt).getTime() <= SYNC_FRESH_MS;

  const hasProviderRevenueHistory =
    params.transactionCount >= MIN_PROVIDER_TRANSACTIONS &&
    params.providerRevenueTotal > 0;

  if (hasProviderRevenueHistory && syncFresh) {
    return "REVENUE_VERIFIED";
  }

  return "PAYMENT_CONNECTED";
}

function detectInternalAnomalies(
  fraudSignals: { signal_type: string }[],
  penaltyCount: number,
  consistencyScore: number,
  lastSyncAt: string | null
): InternalAnomalyFlag[] {
  const flags: InternalAnomalyFlag[] = [];

  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("ratelimit"))
  ) {
    flags.push("RATE_LIMIT_TRIGGERED");
  }
  if (
    fraudSignals.some((f) => normalizeSignalType(f.signal_type).includes("spike"))
  ) {
    flags.push("REVENUE_SPIKE_DETECTED");
  }
  if (consistencyScore < 30 && consistencyScore > 0) {
    flags.push("CONSISTENCY_LOW");
  }
  if (penaltyCount > 0) {
    flags.push("PENALTY_ACTIVE");
  }
  if (lastSyncAt) {
    const staleThreshold = Date.now() - SYNC_FRESH_MS;
    if (new Date(lastSyncAt).getTime() < staleThreshold) {
      flags.push("PROVIDER_STALE");
    }
  }

  return flags;
}

function selfReportedResult(
  penaltyCount: number,
  fraudSignals: { signal_type: string }[],
  verificationType?: string | null,
  hasProofUpload?: boolean,
  isDemoProfile?: boolean
): VerificationStateResult {
  const method = verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: "SELF_REPORTED",
    providersConnected: [],
    verificationType: method,
    hasProofUpload,
    isDemoProfile,
  });

  return {
    confidenceTier: "SELF_REPORTED",
    verificationConfidence: 0,
    providersConnected: [],
    duplicateProtectionActive: false,
    fraudChecksPassed: false,
    consistencyLevel: "Refining",
    consistencyScore: 0,
    consistencyFlags: [],
    trustScore: 0,
    lastSyncAt: null,
    transactionCount: 0,
    hasConnectedProviders: false,
    providerBreakdown: [],
    verificationDepth: 1,
    internalFlags: detectInternalAnomalies(fraudSignals, penaltyCount, 0, null),
    verificationStatus: "SELF_REPORTED",
    verificationMethod: method,
    verificationMethodLabel: formatVerificationMethodLabel(method),
    dataSource,
    dataSourceLabel,
    hasVerificationEvidence: false,
  };
}

export function computeVerificationState(
  input: VerificationStateInput
): VerificationStateResult {
  if (input.isDemoProfile) {
    return selfReportedResult(
      input.penaltyCount,
      input.fraudSignals,
      input.verificationType,
      input.hasProofUpload,
      true
    );
  }

  const activeProviders = input.providerConnections
    .filter((p) => p.status === "connected")
    .map((p) => p.provider);

  const latestSync =
    input.providerConnections
      .map((p) => p.last_synced_at)
      .filter(Boolean)
      .sort()
      .pop() || null;

  const fraudFlagCount = input.fraudSignals.length;
  const fraudMetrics = {
    rate_limit_violations: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("ratelimit")
    ).length,
    spike_events: input.fraudSignals.filter((f) =>
      normalizeSignalType(f.signal_type).includes("spike")
    ).length,
    penalty_count: input.penaltyCount,
  };

  const trustResult = calculateTrustScore(
    input.revenueTransactions,
    fraudMetrics
  );
  const authResult = analyzeRevenueConsistency(input.revenueTransactions);
  const deduplicationActive = hasDuplicateProtection(input.revenueTransactions);
  const hasProviders = activeProviders.length > 0;
  const providerRevenueTotal = sumTransactionAmounts(input.revenueTransactions);

  const confResult = computeVerificationConfidence({
    transactionCount: input.revenueTransactions.length,
    providers: activeProviders,
    consistencyScore: authResult.consistency_score,
    fraudFlagCount,
    deduplicationActive,
    lastSyncAt: latestSync,
  });

  const confidenceTier = resolveConfidenceTierFromData({
    hasProviders,
    transactionCount: input.revenueTransactions.length,
    providerRevenueTotal,
    lastSyncAt: latestSync,
  });

  const fraudChecksPassed =
    fraudFlagCount === 0 &&
    input.revenueTransactions.length > 0 &&
    hasProviders;

  const internalFlags = detectInternalAnomalies(
    input.fraudSignals,
    input.penaltyCount,
    authResult.consistency_score,
    latestSync
  );

  const depthMap: Record<ConfidenceTier, number> = {
    SELF_REPORTED: 1,
    PAYMENT_CONNECTED: 2,
    REVENUE_VERIFIED: 3,
  };

  const result: VerificationStateResult = {
    confidenceTier,
    verificationConfidence: confResult.verification_confidence,
    providersConnected: activeProviders,
    duplicateProtectionActive: deduplicationActive,
    fraudChecksPassed,
    consistencyLevel: authResult.consistency_level,
    consistencyScore: authResult.consistency_score,
    consistencyFlags: authResult.consistency_flags,
    trustScore: trustResult,
    lastSyncAt: latestSync,
    transactionCount: input.revenueTransactions.length,
    hasConnectedProviders: hasProviders,
    providerBreakdown: input.providerConnections
      .filter((p) => p.status === "connected")
      .map((p) => ({
        provider: p.provider,
        amount: Number(p.latest_revenue) || 0,
        percentage: 0,
      })),
    verificationDepth: depthMap[confidenceTier],
    internalFlags,
    verificationStatus: confidenceTier,
    verificationMethod: "manual",
    verificationMethodLabel: "Manual declaration",
    dataSource: "self_reported",
    dataSourceLabel: "Self-reported declaration",
    hasVerificationEvidence: confidenceTier === "REVENUE_VERIFIED",
  };

  const totalMrr = result.providerBreakdown.reduce((acc, p) => acc + p.amount, 0);
  if (totalMrr > 0) {
    result.providerBreakdown = result.providerBreakdown.map((p) => ({
      ...p,
      percentage: Math.round((p.amount / totalMrr) * 100),
    }));
  }

  const verificationMethod = input.verificationType || "manual";
  const { dataSource, dataSourceLabel } = resolveTrustDataSource({
    confidenceTier: result.confidenceTier,
    providersConnected: result.providersConnected,
    verificationType: verificationMethod,
    hasProofUpload: input.hasProofUpload,
    isDemoProfile: false,
  });

  result.verificationMethod = verificationMethod;
  result.verificationMethodLabel = formatVerificationMethodLabel(verificationMethod);
  result.dataSource = dataSource;
  result.dataSourceLabel = dataSourceLabel;
  result.hasVerificationEvidence = result.confidenceTier === "REVENUE_VERIFIED";

  return result;
}

/** True only when provider-backed revenue has a recent sync (evidence-backed). */
export function isVerifiedConfidenceTier(tier: ConfidenceTier): boolean {
  return tier === "REVENUE_VERIFIED";
}

export function buildVerificationStateInput(params: {
  revenueTransactions: { amount: number; created_at: string }[];
  providerConnections: VerificationStateInput["providerConnections"];
  fraudSignals: { signal_type: string }[];
  penaltyCount: number;
  isDemoProfile?: boolean;
  verificationType?: string | null;
  hasProofUpload?: boolean;
}): VerificationStateInput {
  return {
    revenueTransactions: params.revenueTransactions.map((event) => ({
      amount: Number(event.amount) || 0,
      timestamp: new Date(event.created_at).getTime(),
    })),
    providerConnections: params.providerConnections,
    fraudSignals: params.fraudSignals,
    penaltyCount: params.penaltyCount,
    isDemoProfile: params.isDemoProfile,
    verificationType: params.verificationType,
    hasProofUpload: params.hasProofUpload,
  };
}

```

====================================================
FILE: src/lib/verification.ts
====================================================

```typescript
/**
 * Legacy submission scoring — does not determine public verification tiers.
 * Public tiers are computed by computeVerificationState() from provider + transaction data.
 */
export function calculateVerificationScore(submission: {
  verification_type?: string;
  proof_url?: string | null;
  payment_methods?: unknown[];
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  mrr?: number | string;
  arr?: number | string;
  payment_connected?: boolean;
}): number {
  let score = 0;

  if (submission.payment_connected) {
    score += 40;
  }

  if (submission.proof_url) score += 20;
  if (submission.payment_methods && submission.payment_methods.length > 0) {
    score += 10;
  }
  if (submission.website) score += 10;
  if (submission.twitter || submission.linkedin) score += 10;
  if (Number(submission.mrr || 0) > 0) score += 10;
  if (Number(submission.arr || 0) > 0) score += 10;

  return Math.min(score, 100);
}

```

====================================================
FILE: supabase/migrations/20260520000000_submission_fields.sql
====================================================

```sql
-- Fields required by startup submission API (first-customer alignment)
alter table public.startup_submissions
  add column if not exists proof_url text,
  add column if not exists verified_revenue numeric,
  add column if not exists verification_source text,
  add column if not exists notes text;

comment on column public.startup_submissions.proof_url is 'Founder-uploaded revenue proof screenshot URL';

```

====================================================
FILE: supabase/migrations/20260716000000_proofs_storage_rls.sql
====================================================

```sql
-- Ensure the proofs bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload files to their own directory
CREATE POLICY "Users can upload to their own directory" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their own files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

```

====================================================
FILE: supabase/migrations/20260716120000_unique_active_startup_per_user.sql
====================================================

```sql
-- Prevent duplicate active startups per user.
-- Rejected startups are excluded so founders can resubmit after rejection.
-- Uses IS DISTINCT FROM to safely handle NULL verification_status values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_startup_per_user
ON public.startup_submissions (user_id, lower(trim(startup_name)))
WHERE verification_status IS DISTINCT FROM 'rejected';

```

====================================================
FILE: supabase/migrations/20260716130000_find_active_startup_rpc.sql
====================================================

```sql
create or replace function find_active_startup(p_user_id uuid, p_startup_name text)
returns setof startup_submissions
language sql
security definer
as $$
  select * from startup_submissions
  where user_id = p_user_id
    and lower(trim(startup_name)) = lower(trim(p_startup_name))
    and verification_status is distinct from 'rejected'
  limit 1;
$$;

```


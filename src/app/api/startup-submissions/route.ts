import { NextResponse } from "next/server";
import { calculateVerificationScore } from "@/lib/verification";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase-server";
import { detectFraud } from "@/lib/fraud";

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
  proof_url?: string | null;
  confidence_score?: number;
  verified_revenue?: number | null;
  verification_source?: string | null;
  verified_api_key?: string | null;
};

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

    const data = (await req.json()) as StartupSubmissionPayload;
    console.log("Incoming body:", data);
    const validationError = validatePayload(data);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400 }
      );
    }

    // Avoid logging full payload to protect user PII.
    console.log("startup submission accepted", {
      startup_name: data.startup_name,
      payment_methods_count: data.payment_methods.length,
    });

    const mrrValue = typeof data.mrr === "number" ? data.mrr : Number(data.mrr.trim());
    const arrValue = typeof data.arr === "number" ? data.arr : Number(data.arr.trim());

    if (isNaN(mrrValue)) return NextResponse.json({ success: false, error: "mrr must be numeric" }, { status: 400 });
    if (isNaN(arrValue)) return NextResponse.json({ success: false, error: "arr must be numeric" }, { status: 400 });

    const verificationType = data.verification_type?.trim() || "manual";
    const validVerificationType = allowedVerificationTypes.has(verificationType)
      ? verificationType
      : "manual";

    const confidenceScore = calculateVerificationScore(data);

    let verification_status = "unverified";

    if (data.verified_revenue) {
      verification_status = "api_verified";
    } else if (data.proof_url) {
      verification_status = "proof_submitted";
    }

    let verification_label = "Unverified";

    if (data.verified_revenue) {
      verification_label = "API Verified";
    } else if (data.proof_url) {
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

    if (data.proof_url) {
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

    if (risk_level === "medium") {
      trust_score -= 15;
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
      proof_uploaded: !!data.proof_url,
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
    } else if (data.proof_url) {
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

    const { data: insertedData, error: insertError } = await supabaseServer
      .from("startup_submissions")
      .insert([
        {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          startup_name: data.startup_name.trim(),
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
          verification_type: validVerificationType,
          proof_url: data.proof_url || null,
          confidence_score: confidenceScore,
          verification_status,
          verification_label,
          verified_revenue: data.verified_revenue || null,
          verification_source: data.verification_source || null,
          last_verified_at: data.verified_revenue ? new Date().toISOString() : null,
          final_score,
          fraud_score,
          risk_level,
          trust_breakdown,
          trust_summary,
          mrr_breakdown: mrr_breakdown,
          payment_connected: !!data.verified_revenue,
        },
      ])
      .select();

    if (insertError) {
      console.error("SUPABASE ERROR:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: insertError.message,
          details: insertError,
        },
        { status: 400 }
      );
    }

    const startupId = insertedData[0]?.id;

    // Save provider connection if verified
    if (startupId && data.verified_revenue && data.verification_source && data.verified_api_key) {
      let keyId = data.verified_api_key;
      let keySecret = null;
      
      if (data.verification_source === 'razorpay' && data.verified_api_key.includes(':')) {
        [keyId, keySecret] = data.verified_api_key.split(':');
      }

      await supabaseServer.from('provider_connections').insert({
        startup_id: startupId,
        provider: data.verification_source,
        key_id: keyId,
        key_secret: keySecret,
        last_mrr: Number(data.verified_revenue),
        is_active: true
      });
    }

    const { count, error: countError } = await supabaseServer
      .from("startup_submissions")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("startup submission count error", countError.message);
    }

    const slotNumber = typeof count === "number" ? count : null;
    return NextResponse.json({ success: true, slot_number: slotNumber, data: insertedData });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  const identifier = getClientIdentifier(req);
  const { allowed } = checkRateLimit(identifier, 120000, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {

    const { data, error } = await supabaseServer
      .from("startup_submissions")
      .select("*")
      .order("trust_score", { ascending: false });

    if (error) {
      console.error("startup submissions fetch error", error.message);
      return NextResponse.json(
        { success: false, error: "Unable to fetch submissions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("startup submissions GET error", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}

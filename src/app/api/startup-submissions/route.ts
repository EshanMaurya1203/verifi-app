import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type StartupSubmissionPayload = {
  name: string;
  email: string;
  startup_name: string;
  website?: string;
  biz_type: string;
  mrr: string;
  arr: string;
  payment_methods: string[];
  twitter?: string;
  linkedin?: string;
  city: string;
  notes?: string;
};

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

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function validatePayload(payload: StartupSubmissionPayload): string | null {
  if (!isNonEmptyString(payload.name)) return "name is required";
  if (!isNonEmptyString(payload.email)) return "email is required";
  if (!isValidEmail(payload.email.trim())) return "email is invalid";
  if (!isNonEmptyString(payload.startup_name)) return "startup_name is required";
  if (!isNonEmptyString(payload.biz_type)) return "biz_type is required";
  if (!isNonEmptyString(payload.mrr)) return "mrr is required";
  if (!isNonEmptyString(payload.arr)) return "arr is required";
  if (!isNumericValue(payload.mrr)) return "mrr must be numeric";
  if (!isNumericValue(payload.arr)) return "arr must be numeric";
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

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const clientIp = getClientIp(req);
    const rate = enforceRateLimit(`startup-submissions:${clientIp}`, 5, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const data = (await req.json()) as StartupSubmissionPayload;
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

    const mrrValue = Number(data.mrr.trim());
    const arrValue = Number(data.arr.trim());

    const { error: insertError } = await supabaseAdmin
      .from("startup_submissions")
      .insert({
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
      });

    if (insertError) {
      console.error("startup submission insert error", insertError.message);
      return NextResponse.json(
        { success: false, error: "Unable to save submission" },
        { status: 500 }
      );
    }

    const { count, error: countError } = await supabaseAdmin
      .from("startup_submissions")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("startup submission count error", countError.message);
    }

    const slotNumber = typeof count === "number" ? count : null;
    return NextResponse.json({ success: true, slot_number: slotNumber });
  } catch (error) {
    console.error("startup submission error", error);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

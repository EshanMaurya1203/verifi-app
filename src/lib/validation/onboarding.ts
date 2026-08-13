/**
 * Shared Onboarding Validation Schema & Parity Module
 * Enforces unified validation rules across Client, Server API, and Database expectations.
 */

export interface OnboardingPayload {
  name: string;
  email: string;
  startup_name: string;
  website?: string | null;
  biz_type: string;
  mrr: number | string;
  arr: number | string;
  payment_methods: string[];
  twitter?: string | null;
  linkedin?: string | null;
  city: string;
  notes?: string | null;
  verification_type?: string | null;
  proof_object_id?: string | null;
  confidence_score?: number;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
  data?: {
    name: string;
    email: string;
    startup_name: string;
    website: string | null;
    biz_type: string;
    mrr: number;
    arr: number;
    payment_methods: string[];
    twitter: string | null;
    linkedin: string | null;
    city: string;
    notes: string | null;
    verification_type: string;
    proof_object_id: string | null;
    confidence_score: number;
    verified_revenue: null;
    verification_source: null;
  };
}

export const ALLOWED_PAYMENT_METHODS = new Set([
  "razorpay",
  "stripe",
]);

export const ALLOWED_VERIFICATION_TYPES = new Set([
  "manual",
  "social",
  "proof",
  "api",
]);

export const MAX_REVENUE_VALUE = 999999999; // 999,999,999

export type ConflictResponseCode =
  | "STARTUP_ALREADY_EXISTS"
  | "SLUG_CONFLICT"
  | "DUPLICATE_SUBMISSION";

export interface ConflictResponse {
  success: false;
  code: ConflictResponseCode;
  message: string;
  startupId?: string;
  slug?: string;
}

export const DB_CONSTRAINTS = {
  UNIQUE_ACTIVE_STARTUP: "idx_unique_active_startup_per_user",
  UNIQUE_SLUG: "startup_submissions_slug_key",
} as const;

export function mapConstraintToConflictCode(constraint?: string | null): ConflictResponseCode {
  if (!constraint) return "DUPLICATE_SUBMISSION";
  if (constraint === DB_CONSTRAINTS.UNIQUE_ACTIVE_STARTUP) return "STARTUP_ALREADY_EXISTS";
  if (constraint === DB_CONSTRAINTS.UNIQUE_SLUG) return "SLUG_CONFLICT";
  return "DUPLICATE_SUBMISSION";
}

export function normalizeStartupName(name: string): string {
  if (typeof name !== "string") return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugify(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")       // Replace spaces with -
    .replace(/[^\w-]+/g, "")    // Remove all non-word chars
    .replace(/--+/g, "-")       // Replace multiple - with single -
    .replace(/^-+|-+$/g, "");   // Trim leading/trailing hyphens
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();

  // Stage 1: Structural regex check
  const regexCheck = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!regexCheck) return false;

  // Stage 2: Platform-aware validation
  if (typeof document !== "undefined") {
    // Client-side: use browser's built-in email validation
    const input = document.createElement("input");
    input.type = "email";
    input.value = trimmed;
    return input.checkValidity();
  } else {
    // Server-side: use URL mailto: parsing
    try {
      const parsed = new URL(`mailto:${trimmed}`);
      return parsed.protocol === "mailto:" && parsed.pathname === trimmed;
    } catch {
      return false;
    }
  }
}

export function normalizeWebsiteUrl(urlStr: string): { url: string | null; error: string | null } {
  const trimmed = urlStr.trim();
  if (!trimmed) return { url: null, error: null };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { url: null, error: "Website URL contains unsupported or unsafe protocol." };
  }

  let targetUrl = trimmed;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { url: null, error: "Website URL must use http:// or https://" };
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { url: null, error: "Please enter a valid domain name (e.g. acme.com)" };
    }
    if (targetUrl.length > 200) {
      return { url: null, error: "Website URL is too long (max 200 characters)." };
    }
    return { url: targetUrl, error: null };
  } catch {
    return { url: null, error: "Please enter a valid website URL." };
  }
}

export function normalizeTwitterHandle(twitterStr: string): { url: string | null; error: string | null } {
  const trimmed = twitterStr.trim();
  if (!trimmed) return { url: null, error: null };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { url: null, error: "Twitter / X link contains an unsafe protocol." };
  }

  // Handle @handle or raw handle → normalize to https://x.com/{handle}
  if (/^@?[a-zA-Z0-9_]{1,15}$/.test(trimmed)) {
    const handle = trimmed.replace(/^@/, "");
    return { url: `https://x.com/${handle}`, error: null };
  }

  let targetUrl = trimmed;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (host !== "x.com" && host !== "www.x.com" && host !== "twitter.com" && host !== "www.twitter.com") {
      return { url: null, error: "Twitter / X link must be a valid x.com or twitter.com URL." };
    }
    if (targetUrl.length > 120) {
      return { url: null, error: "Twitter / X link is too long (max 120 characters)." };
    }
    // Normalize twitter.com URLs to x.com
    if (host === "twitter.com" || host === "www.twitter.com") {
      parsed.hostname = "x.com";
      return { url: parsed.toString(), error: null };
    }
    return { url: targetUrl, error: null };
  } catch {
    return { url: null, error: "Twitter / X link must be a valid profile URL or handle." };
  }
}

export function normalizeLinkedInUrl(linkedinStr: string): { url: string | null; error: string | null } {
  const trimmed = linkedinStr.trim();
  if (!trimmed) return { url: null, error: null };

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { url: null, error: "LinkedIn link contains an unsafe protocol." };
  }

  let targetUrl = trimmed;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && host !== "www.linkedin.com") {
      return { url: null, error: "LinkedIn link must be a valid linkedin.com URL." };
    }
    if (targetUrl.length > 200) {
      return { url: null, error: "LinkedIn link is too long (max 200 characters)." };
    }
    return { url: targetUrl, error: null };
  } catch {
    return { url: null, error: "LinkedIn link must be a valid profile URL." };
  }
}

export const onboardingSchema = {
  validate: validateOnboarding,
};

export function validateOnboarding(rawPayload: unknown): ValidationResult {
  const errors: ValidationErrorItem[] = [];

  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      isValid: false,
      errors: [{ field: "payload", message: "Invalid submission payload structure." }],
    };
  }

  const payload = rawPayload as Record<string, any>;

  // 1. Name
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    errors.push({ field: "name", message: "Full name is required." });
  } else if (name.length < 2 || name.length > 120) {
    errors.push({ field: "name", message: "Full name must be between 2 and 120 characters." });
  }

  // 2. Email
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) {
    errors.push({ field: "email", message: "Email is required." });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Please enter a valid email address." });
  }

  // 3. Startup Name (3–80 characters)
  const rawStartupName = typeof payload.startup_name === "string" ? payload.startup_name.trim() : "";
  const startupName = normalizeStartupName(rawStartupName);
  if (!rawStartupName) {
    errors.push({ field: "startup_name", message: "Startup name is required." });
  } else if (rawStartupName.length < 3 || rawStartupName.length > 80) {
    errors.push({ field: "startup_name", message: "Startup name must be between 3 and 80 characters." });
  }

  // 4. Business Type
  const bizType = typeof payload.biz_type === "string" ? payload.biz_type.trim() : "";
  if (!bizType) {
    errors.push({ field: "biz_type", message: "Business type is required." });
  } else if (bizType.length < 2 || bizType.length > 80) {
    errors.push({ field: "biz_type", message: "Business type must be between 2 and 80 characters." });
  }

  // 5. MRR (Numeric, 0 to 999,999,999)
  const rawMrr = payload.mrr;
  let mrrValue = NaN;
  if (typeof rawMrr === "number") {
    mrrValue = rawMrr;
  } else if (typeof rawMrr === "string" && rawMrr.trim() !== "") {
    mrrValue = Number(rawMrr.trim());
  }

  if (isNaN(mrrValue) || !isFinite(mrrValue)) {
    errors.push({ field: "mrr", message: "MRR must be a valid number." });
  } else if (mrrValue < 0 || mrrValue > MAX_REVENUE_VALUE) {
    errors.push({ field: "mrr", message: `MRR must be between 0 and $${MAX_REVENUE_VALUE.toLocaleString()}.` });
  }

  // 6. ARR (Numeric, 0 to 999,999,999)
  const rawArr = payload.arr;
  let arrValue = NaN;
  if (typeof rawArr === "number") {
    arrValue = rawArr;
  } else if (typeof rawArr === "string" && rawArr.trim() !== "") {
    arrValue = Number(rawArr.trim());
  }

  if (isNaN(arrValue) || !isFinite(arrValue)) {
    errors.push({ field: "arr", message: "ARR must be a valid number." });
  } else if (arrValue < 0 || arrValue > MAX_REVENUE_VALUE) {
    errors.push({ field: "arr", message: `ARR must be between 0 and $${MAX_REVENUE_VALUE.toLocaleString()}.` });
  }

  // 7. City / Country
  const city = typeof payload.city === "string" ? payload.city.trim() : "";
  if (!city) {
    errors.push({ field: "city", message: "City / Country is required." });
  } else if (city.length < 2 || city.length > 120) {
    errors.push({ field: "city", message: "City / Country must be between 2 and 120 characters." });
  }

  // 8. Payment Methods (1 to 10, valid options — only Stripe and Razorpay)
  const paymentMethods = Array.isArray(payload.payment_methods) ? payload.payment_methods : [];
  if (paymentMethods.length < 1 || paymentMethods.length > 10) {
    errors.push({ field: "payment_methods", message: "Please select between 1 and 10 payment processors." });
  } else {
    const invalidMethod = paymentMethods.find((m) => !ALLOWED_PAYMENT_METHODS.has(String(m)));
    if (invalidMethod) {
      errors.push({ field: "payment_methods", message: "Only Stripe and Razorpay are currently supported." });
    }
  }

  // 9. Website URL (Optional, but strictly validated if provided)
  let normalizedWebsite: string | null = null;
  if (payload.website && typeof payload.website === "string" && payload.website.trim() !== "") {
    const res = normalizeWebsiteUrl(payload.website);
    if (res.error) {
      errors.push({ field: "website", message: res.error });
    } else {
      normalizedWebsite = res.url;
    }
  }

  // 10. Twitter URL (Optional) — centralized normalization
  let normalizedTwitter: string | null = null;
  if (payload.twitter && typeof payload.twitter === "string" && payload.twitter.trim() !== "") {
    const res = normalizeTwitterHandle(payload.twitter);
    if (res.error) {
      errors.push({ field: "twitter", message: res.error });
    } else {
      normalizedTwitter = res.url;
    }
  }

  // 11. LinkedIn URL (Optional) — centralized normalization
  let normalizedLinkedIn: string | null = null;
  if (payload.linkedin && typeof payload.linkedin === "string" && payload.linkedin.trim() !== "") {
    const res = normalizeLinkedInUrl(payload.linkedin);
    if (res.error) {
      errors.push({ field: "linkedin", message: res.error });
    } else {
      normalizedLinkedIn = res.url;
    }
  }

  // 12. Notes (Max 5000 chars)
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;
  if (notes && notes.length > 5000) {
    errors.push({ field: "notes", message: "Notes cannot exceed 5000 characters." });
  }

  // 13. Verification Type
  const verificationType = typeof payload.verification_type === "string" && payload.verification_type.trim()
    ? payload.verification_type.trim()
    : "manual";
  if (!ALLOWED_VERIFICATION_TYPES.has(verificationType)) {
    errors.push({ field: "verification_type", message: "Invalid verification method selected." });
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    data: {
      name,
      email,
      startup_name: startupName,
      website: normalizedWebsite,
      biz_type: bizType,
      mrr: mrrValue,
      arr: arrValue,
      payment_methods: paymentMethods,
      twitter: normalizedTwitter,
      linkedin: normalizedLinkedIn,
      city,
      notes: notes || null,
      verification_type: verificationType,
      proof_object_id: payload.proof_object_id || null,
      confidence_score: typeof payload.confidence_score === "number" ? payload.confidence_score : 0,
      verified_revenue: null,
      verification_source: null,
    },
  };
}

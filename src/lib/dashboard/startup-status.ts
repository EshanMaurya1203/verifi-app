import { VERIFIED_STATUSES, PENDING_STATUSES } from "./constants";

export interface StartupSubmissionRow {
  id: number;
  user_id?: string;
  startup_name?: string;
  slug?: string;
  is_public?: boolean;
  payment_connected?: boolean;
  verification_status?: string;
  verification_source?: string;
  trust_tier?: string;
  mrr?: number | null;
  last_synced_at?: string | null;
  proof_url?: string | null;
  created_at?: string;
  connected_at?: string | null;
  published_at?: string | null;
}

export interface StartupStatus {
  profile: "incomplete" | "complete";
  publication: "private" | "public";
  payment: "disconnected" | "connected";
  verification: "unverified" | "pending" | "verified";
  revenue: "undeclared" | "declared" | "synced";
  proof: "none" | "submitted";
}

export function buildStartupStatus(startup: Partial<StartupSubmissionRow> | null | undefined): StartupStatus {
  if (!startup) {
    return {
      profile: "incomplete",
      publication: "private",
      payment: "disconnected",
      verification: "unverified",
      revenue: "undeclared",
      proof: "none",
    };
  }

  const profile = (startup.startup_name && startup.slug) ? "complete" : "incomplete";
  const publication = startup.is_public ? "public" : "private";
  
  const payment = startup.payment_connected ? "connected" : "disconnected";

  const isVerified = startup.payment_connected || (startup.verification_status && VERIFIED_STATUSES.includes(startup.verification_status));
  const isPending = startup.verification_status && PENDING_STATUSES.includes(startup.verification_status);
  
  let verification: "unverified" | "pending" | "verified" = "unverified";
  if (isVerified) {
    verification = "verified";
  } else if (isPending) {
    verification = "pending";
  }

  let revenue: "undeclared" | "declared" | "synced" = "undeclared";
  if (startup.mrr != null) {
    revenue = startup.last_synced_at ? "synced" : "declared";
  }

  const proof: "none" | "submitted" = startup.proof_url ? "submitted" : "none";

  return {
    profile,
    publication,
    payment,
    verification,
    revenue,
    proof,
  };
}

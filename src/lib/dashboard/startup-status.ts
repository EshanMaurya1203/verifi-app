// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Startup = any;

export interface StartupStatus {
  profile: "incomplete" | "complete";
  publication: "private" | "public";
  payment: "disconnected" | "connected";
  verification: "unverified" | "pending" | "verified";
  revenue: "undeclared" | "declared" | "synced";
  proof: "none" | "submitted";
}

export function buildStartupStatus(startup: Startup): StartupStatus {
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

  const verifiedStatuses = [
    "api_verified",
    "stripe_connected",
    "PAYMENT_CONNECTED",
    "REVENUE_VERIFIED",
    "HIGH_CONFIDENCE",
    "verified",
    "approved",
    "identity_verified"
  ];
  
  const pendingStatuses = ["syncing", "proof_submitted"];
  
  const isVerified = startup.payment_connected || verifiedStatuses.includes(startup.verification_status);
  
  let verification: "unverified" | "pending" | "verified" = "unverified";
  if (isVerified) {
    verification = "verified";
  } else if (pendingStatuses.includes(startup.verification_status)) {
    verification = "pending";
  }

  let revenue: "undeclared" | "declared" | "synced" = "undeclared";
  if (startup.mrr != null) {
    revenue = startup.last_synced_at ? "synced" : "declared";
  }

  let proof: "none" | "submitted" = "none";
  if (startup.proof_url || startup.payment_connected || isVerified || pendingStatuses.includes(startup.verification_status)) {
    proof = "submitted";
  }

  return {
    profile,
    publication,
    payment,
    verification,
    revenue,
    proof,
  };
}

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

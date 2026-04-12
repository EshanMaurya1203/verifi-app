export function calculateVerificationScore(submission: any) {
  let score = 0;

  // Proof uploaded
  if (submission.proof_url) score += 30;

  // Payment method present
  if (submission.payment_methods?.length > 0) score += 20;

  // Has website
  if (submission.website) score += 10;

  // Has social links
  if (submission.twitter || submission.linkedin) score += 10;

  // Has MRR > 0
  if (submission.mrr > 0) score += 20;

  // Has ARR > 0
  if (submission.arr > 0) score += 10;

  return Math.min(score, 100);
}

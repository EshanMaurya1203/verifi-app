import Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STRIPE_API_VERSION = "2024-04-10" as any;

export function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}

export function getPlatformStripe(): Stripe {
  return new Stripe(requireStripeSecretKey(), {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function getStripeForSecretKey(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function isStripeConnectAccountId(
  accountId: string | null | undefined
): boolean {
  return !!accountId && accountId.startsWith("acct_");
}

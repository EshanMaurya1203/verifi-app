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

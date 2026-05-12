import Stripe from "stripe";
import { RevenueProvider, NormalizedPayment } from "./types";

export class StripeProvider implements RevenueProvider {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: "2024-04-10" as any,
    });
  }

  async fetchPayments(): Promise<NormalizedPayment[]> {
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    
    let allPayments: Stripe.PaymentIntent[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    while (hasMore) {
      const response = await this.stripe.paymentIntents.list({
        limit: 100,
        starting_after: startingAfter,
        created: { gte: thirtyDaysAgo }
      });

      allPayments = allPayments.concat(response.data);
      hasMore = response.has_more;

      if (response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      } else {
        break;
      }
    }

    return allPayments.map(p => ({
      external_payment_id: p.id,
      amount: p.amount / 100, // Stripe amount is in cents
      currency: p.currency,
      timestamp: p.created * 1000,
      status: p.status === "succeeded" ? "successful" : p.status, // Normalized status
      provider: "stripe",
    }));
  }
}

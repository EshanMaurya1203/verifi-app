import Razorpay from "razorpay";
import { RevenueProvider, NormalizedPayment } from "./types";

export class RazorpayProvider implements RevenueProvider {
  private razorpay: Razorpay;

  constructor(keyId: string, keySecret: string) {
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async fetchPayments(): Promise<NormalizedPayment[]> {
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const now = Math.floor(Date.now() / 1000);

    let allPayments: any[] = [];
    let skip = 0;
    const count = 100;
    
    // Fetch all payments in the last 30 days
    while (true) {
      const response = await this.razorpay.payments.all({
        from: thirtyDaysAgo,
        to: now,
        count: count,
        skip: skip,
      });

      if (!response || !response.items || response.items.length === 0) {
        break;
      }

      allPayments = allPayments.concat(response.items);
      
      if (response.items.length < count) {
        break;
      }
      skip += count;
    }

    return allPayments.map((p: any) => ({
      external_payment_id: p.id,
      amount: p.amount / 100, // Razorpay amount is in paise
      currency: p.currency,
      timestamp: p.created_at * 1000,
      status: p.status === "captured" ? "successful" : p.status, // Normalized status
      provider: "razorpay",
    }));
  }
}

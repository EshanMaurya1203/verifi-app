import { getSupabaseServer } from "./supabase-server";

/**
 * Revenue Verification Library
 * Fetches revenue data from payment providers last 30 days.
 */

export type RevenueResult = {
  success: boolean;
  totalAmount: number; // in base currency (e.g. INR/USD)
  currency: string;
  items?: any[]; // Raw transaction items
  error?: string;
};

export async function verifyRazorpayRevenue(keyId: string, keySecret: string): Promise<RevenueResult> {
  try {
    const from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const to = Math.floor(Date.now() / 1000);

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch(
      `https://api.razorpay.com/v1/payments?from=${from}&to=${to}&count=100`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, totalAmount: 0, currency: 'INR', error: errorData.error?.description || 'Failed to fetch from Razorpay' };
    }

    const data = await response.json();
    const total = data.items.reduce((acc: number, item: any) => {
      // Sum captured payments
      if (item.status === 'captured') {
        return acc + item.amount;
      }
      return acc;
    }, 0);

    const filteredItems = data.items.filter((i: any) => i.status === 'captured');

    return {
      success: true,
      totalAmount: total / 100, // Razorpay amount is in paise
      currency: data.items[0]?.currency || 'INR',
      items: filteredItems,
    };
  } catch (error: any) {
    return { success: false, totalAmount: 0, currency: 'INR', items: [], error: error.message };
  }
}

export async function verifyStripeRevenue(apiKey: string): Promise<RevenueResult> {
  try {
    const from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Using fetch directly to avoid installing stripe package if not needed yet
    const response = await fetch(
      `https://api.stripe.com/v1/balance_transactions?created[gte]=${from}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, totalAmount: 0, currency: 'USD', error: errorData.error?.message || 'Failed to fetch from Stripe' };
    }

    const data = await response.json();
    const total = data.data.reduce((acc: number, item: any) => {
      // Net amount includes fees, 'amount' is gross. User usually wants MRR (gross).
      if (item.type === 'charge' || item.type === 'payment') {
        return acc + item.amount;
      }
      return acc;
    }, 0);

    return {
      success: true,
      totalAmount: total / 100, // Stripe amount is in cents
      currency: data.data[0]?.currency.toUpperCase() || 'USD',
      items: data.data.filter((i: any) => i.type === 'charge' || i.type === 'payment'),
    };
  } catch (error: any) {
    return { success: false, totalAmount: 0, currency: 'USD', error: error.message };
  }
}

// calculateMRR has been replaced by getAggregatedRevenue() in @/lib/revenue-aggregation.ts
// That function is now the ONLY source of truth for startup revenue.

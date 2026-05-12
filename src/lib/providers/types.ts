export interface NormalizedPayment {
  external_payment_id: string;
  amount: number; // In the base unit (e.g. INR / USD), not cents/paise
  currency: string;
  timestamp: number; // in milliseconds
  status: string;
  provider: string;
}

export interface RevenueProvider {
  fetchPayments(): Promise<NormalizedPayment[]>;
}

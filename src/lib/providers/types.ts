export interface NormalizedPayment {
  external_payment_id: string;
  amount: number; // Net amount in the base unit (e.g. INR / USD), not cents/paise
  currency: string;
  timestamp: number; // in milliseconds
  status: string;
  provider: string;
  gross_amount?: number;
  refund_amount?: number;
  net_amount?: number;
}

export interface RevenueProvider {
  fetchPayments(): Promise<NormalizedPayment[]>;
}

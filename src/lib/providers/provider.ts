/**
 * Runtime credentials exist ONLY in server memory during request execution.
 * Passed exclusively to provider API clients.
 * Must NEVER be written to the database or logged.
 */
export interface RuntimeCredentials {
  accountId: string;  // e.g. Razorpay key_id or Stripe account ID
  secretKey: string;  // Plaintext secret key held in memory
}

/**
 * Serialized credentials contain encrypted material intended for persistence.
 * Must NEVER be passed directly to provider API clients.
 */
export interface SerializedCredentials {
  accountId: string;   // e.g. key_id or account_id
  encryptedKey: string;// Authenticated AES-256-GCM ciphertext ONLY
}

export interface ProviderRevenueResult {
  revenue: number;
  currency: string;
  transactionCount: number;
}

export interface WebhookResult {
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
}

export interface Provider {
  readonly id: string;
  readonly name: string;

  connect(startupId: string, credentials: RuntimeCredentials): Promise<void>;
  disconnect(startupId: string): Promise<void>;
  verifyCredentials(credentials: RuntimeCredentials): Promise<boolean>;
  fetchRevenue(credentials: RuntimeCredentials): Promise<ProviderRevenueResult>;
  fetchTransactions(credentials: RuntimeCredentials, options?: any): Promise<any[]>;
  serializeCredentials(credentials: RuntimeCredentials): Promise<SerializedCredentials>;
  parseWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  healthCheck(): Promise<boolean>;
}

export interface ProviderCredentials {
  [key: string]: any;
}

export interface SerializedCredentials {
  accountId: string;
  encryptedKey: string;
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

  connect(startupId: string, credentials: ProviderCredentials): Promise<void>;
  disconnect(startupId: string): Promise<void>;
  verifyCredentials(credentials: ProviderCredentials): Promise<boolean>;
  fetchRevenue(accountId: string, decryptedKey: string): Promise<ProviderRevenueResult>;
  fetchTransactions(accountId: string, decryptedKey: string, options?: any): Promise<any[]>;
  serializeCredentials(credentials: ProviderCredentials): Promise<SerializedCredentials>;
  parseWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  healthCheck(): Promise<boolean>;
}

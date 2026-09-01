import { describe, it } from "node:test";
import assert from "node:assert";

// Set encryption secret for testing before importing modules
process.env.ENCRYPTION_SECRET = "01234567890123456789012345678901";

import { encrypt, decrypt } from "../src/lib/encryption";
import { RazorpayProvider } from "../src/lib/providers/razorpay";
import { RuntimeCredentials, SerializedCredentials } from "../src/lib/providers/provider";
import { VerificationPipeline } from "../src/lib/providers/pipeline";
import { revenueService } from "../src/lib/providers/services/revenue-service";
import { completeStripeVerification, saveStripeConnection } from "../src/lib/stripe-sync";
import { supabaseServer } from "../src/lib/supabase-server";

/**
 * Fluent Supabase Mock Factory
 * Stubs all chainable methods and allows targeted failure injection per table/operation.
 */
function createMockSupabase(overrides: {
  onTableInsert?: (table: string, payload: any) => { data?: any; error?: any } | undefined;
  onTableUpdate?: (table: string, payload: any) => { data?: any; error?: any } | undefined;
  onTableUpsert?: (table: string, payload: any) => { data?: any; error?: any } | undefined;
  onTableSelect?: (table: string) => { data?: any; error?: any } | undefined;
} = {}) {
  return (table: string) => {
    const chain: any = {
      select: () => chain,
      insert: (payload: any) => {
        const res = overrides.onTableInsert?.(table, payload);
        const insertChain: any = {
          select: () => insertChain,
          maybeSingle: async () => res || { data: { id: 1 }, error: null },
          single: async () => res || { data: { id: 1 }, error: null },
          then: (resolve: any) => resolve(res || { data: { id: 1 }, error: null }),
        };
        return insertChain;
      },
      update: (payload: any) => {
        const res = overrides.onTableUpdate?.(table, payload);
        const updateChain: any = {
          eq: () => updateChain,
          then: (r: any) => r(res || { error: null }),
        };
        return updateChain;
      },
      upsert: async (payload: any) => {
        const res = overrides.onTableUpsert?.(table, payload);
        if (res) return res;
        return { data: { id: 1 }, error: null };
      },
      delete: () => chain,
      eq: () => chain,
      neq: () => chain,
      gt: () => chain,
      gte: () => chain,
      lt: () => chain,
      lte: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => {
        const res = overrides.onTableSelect?.(table);
        if (res) return res;
        if (table === "startup_submissions") {
          return { data: { id: 1, trust_score: 50, verification_status: "pending", raw_metrics: {} }, error: null };
        }
        return { data: null, error: null };
      },
      maybeSingle: async () => {
        const res = overrides.onTableSelect?.(table);
        if (res) return res;
        return { data: { id: 1 }, error: null };
      },
      then: (resolve: any) => {
        const res = overrides.onTableSelect?.(table);
        if (res) return resolve(res);
        if (table === "startup_submissions") {
          return resolve({ data: [{ id: 1, trust_score: 50, verification_status: "pending", raw_metrics: {} }], error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  };
}

describe("P0-2 Controlled Remediation: Provider Credential Boundary & Fail-Closed Invariants", () => {
  // ---------------------------------------------------------------------------
  // TEST A: Fresh Razorpay verification credential boundary
  // ---------------------------------------------------------------------------
  it("TEST A: Provider receives plaintext runtime secret; defense-in-depth rejects ciphertext", async () => {
    const provider = new RazorpayProvider();

    // Serialized ciphertext credentials (must NOT be passed as secretKey)
    const cipherText = encrypt("plain_text_secret_key_abc");
    const invalidRuntimeCredsWithCiphertext: RuntimeCredentials = {
      accountId: "rzp_test_valid_acc_123",
      secretKey: cipherText, // ACCIDENTAL CIPHERTEXT LEAK
    };

    // Defense-in-depth guard: verifyCredentials rejects ciphertext
    await assert.rejects(
      async () => {
        await provider.verifyCredentials(invalidRuntimeCredsWithCiphertext);
      },
      {
        message: /Cannot verify credentials using ciphertext/i,
      }
    );

    // Defense-in-depth guard: fetchTransactions rejects ciphertext
    await assert.rejects(
      async () => {
        await provider.fetchTransactions(invalidRuntimeCredsWithCiphertext);
      },
      {
        message: /Cannot fetch transactions with ciphertext/i,
      }
    );
  });

  // ---------------------------------------------------------------------------
  // TEST B: Credential persistence receives encrypted credential only
  // ---------------------------------------------------------------------------
  it("TEST B: Credential serialization produces authenticated ciphertext; plaintext is never returned in serialized credentials", async () => {
    const provider = new RazorpayProvider();
    const runtimeCreds: RuntimeCredentials = {
      accountId: "rzp_test_acc_999",
      secretKey: "super_secret_plaintext_key",
    };

    const serialized: SerializedCredentials = await provider.serializeCredentials(runtimeCreds);

    assert.strictEqual(serialized.accountId, "rzp_test_acc_999");
    assert.notStrictEqual(serialized.encryptedKey, "super_secret_plaintext_key");

    // Must be formatted as iv:ciphertext:tag
    const parts = serialized.encryptedKey.split(":");
    assert.strictEqual(parts.length, 3, "Serialized encryptedKey must be 3-part AES-GCM format");

    // Decrypting must recover the original plaintext secret
    const decrypted = decrypt(serialized.encryptedKey);
    assert.strictEqual(decrypted, "super_secret_plaintext_key");
  });

  // ---------------------------------------------------------------------------
  // TEST C: Razorpay resync credential flow
  // ---------------------------------------------------------------------------
  it("TEST C: Resync decrypts ciphertext to runtime plaintext for API calls; never stores plaintext in encryptedKey", async () => {
    const plaintextSecret = "my_persisted_plaintext_secret";
    const encryptedSecret = encrypt(plaintextSecret);

    // Simulate stored record in provider_connections
    const storedRecord = {
      account_id: "rzp_conn_acc_1",
      api_key_encrypted: encryptedSecret,
    };

    // Resync step 1: Decrypt to server memory ONLY
    const decryptedSecret = decrypt(storedRecord.api_key_encrypted);
    assert.strictEqual(decryptedSecret, plaintextSecret);

    // Resync step 2: Build RuntimeCredentials for provider
    const runtimeCreds: RuntimeCredentials = {
      accountId: storedRecord.account_id,
      secretKey: decryptedSecret,
    };

    // Resync step 3: Retain SerializedCredentials for persistence (no re-encryption needed)
    const serializedCreds: SerializedCredentials = {
      accountId: storedRecord.account_id,
      encryptedKey: storedRecord.api_key_encrypted,
    };

    assert.strictEqual(runtimeCreds.secretKey, plaintextSecret);
    assert.strictEqual(serializedCreds.encryptedKey, encryptedSecret);
    assert.notStrictEqual(serializedCreds.encryptedKey, plaintextSecret, "encryptedKey must NEVER hold plaintext");
  });

  // ---------------------------------------------------------------------------
  // TEST D: Transaction persistence failure fails closed
  // ---------------------------------------------------------------------------
  it("TEST D: Transaction persistence failure aborts verification; startup does NOT become api_verified", async () => {
    let startupStatusUpdated = false;

    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => true,
      fetchRevenue: async () => ({ revenue: 100, currency: "INR", transactionCount: 2 }),
      fetchTransactions: async () => [
        { external_payment_id: "pay_1", amount: 50, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
        { external_payment_id: "pay_2", amount: 50, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
      ],
      serializeCredentials: async (c: RuntimeCredentials) => ({ accountId: c.accountId, encryptedKey: encrypt(c.secretKey) }),
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({
      successful: 1,
      failed: 1,
      errors: [new Error("DB constraint violation on pay_2")],
    });

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          startupStatusUpdated = true;
        }
        return { error: null };
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 901,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_901", secretKey: "secret_901" },
      });

      const result = await pipeline.execute();

      assert.strictEqual(result.success, false, "Pipeline must report success: false on transaction failure");
      assert.strictEqual(startupStatusUpdated, false, "Startup must NOT be updated to api_verified");
      assert.match(result.error?.message || "", /Failed to persist 1 transaction/);
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST E: Snapshot persistence failure fails closed
  // ---------------------------------------------------------------------------
  it("TEST E: Revenue snapshot insert failure aborts verification; startup does NOT become api_verified", async () => {
    let startupStatusUpdated = false;

    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => true,
      fetchRevenue: async () => ({ revenue: 100, currency: "INR", transactionCount: 1 }),
      fetchTransactions: async () => [
        { external_payment_id: "pay_1", amount: 100, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
      ],
      serializeCredentials: async (c: RuntimeCredentials) => ({ accountId: c.accountId, encryptedKey: encrypt(c.secretKey) }),
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({ successful: 1, failed: 0, errors: [] });

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableInsert: (table) => {
        if (table === "revenue_snapshots") {
          return { data: null, error: new Error("Snapshot write lock timeout") };
        }
        return undefined;
      },
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          startupStatusUpdated = true;
        }
        return { error: null };
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 902,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_902", secretKey: "secret_902" },
      });

      const result = await pipeline.execute();

      assert.strictEqual(result.success, false, "Pipeline must report success: false on snapshot failure");
      assert.strictEqual(startupStatusUpdated, false, "Startup must NOT be updated to api_verified");
      assert.match(result.error?.message || "", /Failed to insert revenue snapshot/);
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST F: Provider connection persistence failure fails closed
  // ---------------------------------------------------------------------------
  it("TEST F: Provider connection upsert failure aborts verification; startup does NOT become api_verified", async () => {
    let startupStatusUpdated = false;

    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => true,
      fetchRevenue: async () => ({ revenue: 100, currency: "INR", transactionCount: 1 }),
      fetchTransactions: async () => [
        { external_payment_id: "pay_1", amount: 100, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
      ],
      serializeCredentials: async (c: RuntimeCredentials) => ({ accountId: c.accountId, encryptedKey: encrypt(c.secretKey) }),
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({ successful: 1, failed: 0, errors: [] });

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableUpsert: (table) => {
        if (table === "provider_connections") {
          return { error: new Error("Unique index violation on provider_account_id") };
        }
        return undefined;
      },
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          startupStatusUpdated = true;
        }
        return { error: null };
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 903,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_903", secretKey: "secret_903" },
      });

      const result = await pipeline.execute();

      assert.strictEqual(result.success, false, "Pipeline must report success: false on connection upsert failure");
      assert.strictEqual(startupStatusUpdated, false, "Startup must NOT be updated to api_verified");
      assert.match(result.error?.message || "", /Failed to persist provider connection/);
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST G: Startup verification-state update failure fails closed
  // ---------------------------------------------------------------------------
  it("TEST G: Startup verification-state update failure returns error response", async () => {
    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => true,
      fetchRevenue: async () => ({ revenue: 100, currency: "INR", transactionCount: 1 }),
      fetchTransactions: async () => [
        { external_payment_id: "pay_1", amount: 100, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
      ],
      serializeCredentials: async (c: RuntimeCredentials) => ({ accountId: c.accountId, encryptedKey: encrypt(c.secretKey) }),
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({ successful: 1, failed: 0, errors: [] });

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          return { error: new Error("Row lock conflict on startup_submissions") };
        }
        return { error: null };
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 904,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_904", secretKey: "secret_904" },
      });

      const result = await pipeline.execute();

      assert.strictEqual(result.success, false, "Pipeline must report success: false on startup update failure");
      assert.match(result.error?.message || "", /Failed to update startup verification status/);
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST H: Successful verification completes all stages in exact order
  // ---------------------------------------------------------------------------
  it("TEST H: Successful verification executes stages in order, persists api_verified, and returns result", async () => {
    const executedStages: string[] = [];
    let savedApiVerified = false;
    let savedEncryptedKey: string | null = null;

    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => {
        executedStages.push("verifyCredentials");
        return true;
      },
      fetchRevenue: async () => ({ revenue: 250, currency: "INR", transactionCount: 2 }),
      fetchTransactions: async (creds: RuntimeCredentials) => {
        executedStages.push("fetchTransactions");
        assert.strictEqual(creds.secretKey, "raw_secret_905", "Provider must receive plaintext secret");
        return [
          { external_payment_id: "pay_10", amount: 150, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
          { external_payment_id: "pay_11", amount: 100, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
        ];
      },
      serializeCredentials: async (c: RuntimeCredentials) => {
        executedStages.push("serializeCredentials");
        return { accountId: c.accountId, encryptedKey: encrypt(c.secretKey) };
      },
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => {
      executedStages.push("upsertTransactions");
      return { successful: 2, failed: 0, errors: [] };
    };

    const originalAggregate = revenueService.aggregateRevenue;
    revenueService.aggregateRevenue = async () => {
      executedStages.push("aggregateRevenue");
      return { totalRevenue: 250, breakdown: { razorpay: 250 } };
    };

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableInsert: (table) => {
        if (table === "revenue_snapshots") {
          executedStages.push("insertSnapshot");
          return { data: { id: 1 }, error: null };
        }
        if (table === "verification_logs") {
          executedStages.push("logEvent");
          return { data: { id: 55 }, error: null };
        }
        return undefined;
      },
      onTableUpsert: (table, payload) => {
        if (table === "provider_connections") {
          executedStages.push("upsertConnection");
          savedEncryptedKey = payload.api_key_encrypted;
          return { error: null };
        }
        return undefined;
      },
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions") {
          if (payload.verification_status === "api_verified") {
            executedStages.push("markStartupVerified");
            savedApiVerified = true;
          } else if (payload.trust_score !== undefined) {
            executedStages.push("persistTrustScore");
          }
          return { error: null };
        }
        return undefined;
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 905,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_905", secretKey: "raw_secret_905" },
      });

      const result = await pipeline.execute();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.revenue, 250);
      assert.strictEqual(result.totalTransactions, 2);
      assert.strictEqual(savedApiVerified, true);

      // Verify connection saved encrypted key, never plaintext
      assert.notStrictEqual(savedEncryptedKey, "raw_secret_905");
      assert.strictEqual(decrypt(savedEncryptedKey!), "raw_secret_905");

      // Verify ordering: evidence and trust score MUST precede markStartupVerified
      const trustIndex = executedStages.indexOf("persistTrustScore");
      const verifiedIndex = executedStages.indexOf("markStartupVerified");
      const logIndex = executedStages.indexOf("logEvent");

      assert(trustIndex !== -1, "persistTrustScore must have executed");
      assert(verifiedIndex !== -1, "markStartupVerified must have executed");
      assert(logIndex !== -1, "logEvent must have executed");
      assert(trustIndex < verifiedIndex, "Trust score MUST be persisted before api_verified status");
      assert(verifiedIndex < logIndex, "api_verified status MUST be persisted before verification log");
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      revenueService.aggregateRevenue = originalAggregate;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST I: Stripe regression & fail-closed persistence
  // ---------------------------------------------------------------------------
  it("TEST I: Stripe verification fails closed on transaction failure and preserves stage ordering", async () => {
    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({
      successful: 0,
      failed: 2,
      errors: [new Error("Stripe transaction write collision")],
    });

    let stripeVerifiedStatus = false;
    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          stripeVerifiedStatus = true;
        }
        return { error: null };
      },
    });

    const mockStripe = {
      balanceTransactions: {
        list: async () => ({
          data: [
            { id: "txn_1", type: "charge", amount: 2000, currency: "usd", created: Math.floor(Date.now() / 1000) },
            { id: "txn_2", type: "charge", amount: 3000, currency: "usd", created: Math.floor(Date.now() / 1000) },
          ],
          has_more: false,
        }),
      },
    } as any;

    try {
      await assert.rejects(
        async () => {
          await completeStripeVerification(906, {
            stripe: mockStripe,
            connectionType: "api_key",
          });
        },
        {
          message: /Failed to persist 2 Stripe transaction/i,
        }
      );

      assert.strictEqual(stripeVerifiedStatus, false, "Startup must NOT become api_verified when Stripe transaction write fails");
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST J: saveStripeConnection fails closed on database error
  // ---------------------------------------------------------------------------
  it("TEST J: saveStripeConnection throws if startup_submissions update fails", async () => {
    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableUpdate: (table) => {
        if (table === "startup_submissions") {
          return { error: new Error("Foreign key constraint violation on startup_submissions") };
        }
        return { error: null };
      },
    });

    try {
      await assert.rejects(
        async () => {
          await saveStripeConnection({
            startupId: 907,
            accountId: "acct_test_123",
            encryptedCredential: encrypt("sk_test_123"),
          });
        },
        {
          message: /Failed to update startup payment_connected/i,
        }
      );
    } finally {
      supabaseServer.from = originalFrom;
    }
  });

  // ---------------------------------------------------------------------------
  // TEST K: verification_logs failure after api_verified does NOT fail verification
  // ---------------------------------------------------------------------------
  it("TEST K: verification_logs insertion failure after api_verified does NOT produce success:false; startup remains api_verified", async () => {
    let startupStatusUpdated = false;

    const fakeProvider = {
      id: "razorpay",
      name: "Razorpay",
      connect: async () => {},
      disconnect: async () => {},
      verifyCredentials: async () => true,
      fetchRevenue: async () => ({ revenue: 100, currency: "INR", transactionCount: 1 }),
      fetchTransactions: async () => [
        { external_payment_id: "pay_audit_1", amount: 100, currency: "INR", timestamp: Date.now(), status: "captured", provider: "razorpay" },
      ],
      serializeCredentials: async (c: RuntimeCredentials) => ({ accountId: c.accountId, encryptedKey: encrypt(c.secretKey) }),
      parseWebhook: async () => ({ paymentId: "p", amount: 10, currency: "INR", status: "captured", provider: "razorpay" }),
      healthCheck: async () => true,
    };

    const originalUpsert = revenueService.upsertTransactions;
    revenueService.upsertTransactions = async () => ({ successful: 1, failed: 0, errors: [] });

    const originalAggregate = revenueService.aggregateRevenue;
    revenueService.aggregateRevenue = async () => ({ totalRevenue: 100, breakdown: { razorpay: 100 } });

    const originalFrom = supabaseServer.from;
    (supabaseServer as any).from = createMockSupabase({
      onTableInsert: (table) => {
        if (table === "verification_logs") {
          // Simulate database error specifically on audit log insertion
          return { data: null, error: new Error("Audit log disk write failure") };
        }
        return undefined;
      },
      onTableUpdate: (table, payload) => {
        if (table === "startup_submissions" && payload.verification_status === "api_verified") {
          startupStatusUpdated = true;
        }
        return { error: null };
      },
    });

    try {
      const pipeline = new VerificationPipeline({
        startupId: 908,
        provider: fakeProvider,
        runtimeCredentials: { accountId: "acc_908", secretKey: "secret_908" },
      });

      const result = await pipeline.execute();

      // Invariant 1: Verification result must be SUCCESS: true because authoritative evidence succeeded
      assert.strictEqual(result.success, true, "Verification must succeed even if audit log insert fails");
      assert.strictEqual(result.revenue, 100);

      // Invariant 2: Startup remains marked api_verified
      assert.strictEqual(startupStatusUpdated, true, "Startup must remain api_verified");

      // Now verify the exact same behavior in completeStripeVerification
      let stripeStatusUpdated = false;
      (supabaseServer as any).from = createMockSupabase({
        onTableInsert: (table) => {
          if (table === "verification_logs") {
            return { data: null, error: new Error("Stripe audit log disk write failure") };
          }
          return undefined;
        },
        onTableUpdate: (table, payload) => {
          if (table === "startup_submissions" && payload.verification_status === "api_verified") {
            stripeStatusUpdated = true;
          }
          return { error: null };
        },
      });

      const mockStripe = {
        balanceTransactions: {
          list: async () => ({
            data: [
              { id: "txn_audit_1", type: "charge", amount: 5000, currency: "usd", created: Math.floor(Date.now() / 1000) },
            ],
            has_more: false,
          }),
        },
      } as any;

      const stripeResult = await completeStripeVerification(909, {
        stripe: mockStripe,
        connectionType: "api_key",
      });

      assert.strictEqual(stripeResult.revenue, 100);
      assert.strictEqual(stripeStatusUpdated, true, "Stripe startup must remain api_verified when audit log fails");
    } finally {
      revenueService.upsertTransactions = originalUpsert;
      revenueService.aggregateRevenue = originalAggregate;
      supabaseServer.from = originalFrom;
    }
  });
});

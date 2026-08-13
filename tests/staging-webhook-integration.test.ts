/**
 * Real Staging Webhook Integration Test Suite
 * Executes RPC calls directly against Staging PostgreSQL (oppasxypeacbrqbnqrnk)
 * via Supabase SQL Management API.
 */

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
if (!accessToken) {
  throw new Error("Missing SUPABASE_ACCESS_TOKEN environment variable for Staging test suite");
}
const STAGING_REF = "oppasxypeacbrqbnqrnk";

async function executeSqlOnStaging(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  return await res.json();
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Integration Test Assertion Failed: ${message}`);
  }
}

export async function runStagingIntegrationTests() {
  console.log("==========================================================");
  console.log(" REAL STAGING WEBHOOK INTEGRATION TEST SUITE (PostgreSQL) ");
  console.log("==========================================================\n");

  const STAGING_STARTUP_ID = 999001;
  const STAGING_ACCOUNT_ID = "acct_test_staging_1786523556470";
  const TEST_EVENT_ID = "evt_real_staging_integration_" + Date.now();
  const TEST_PAYMENT_ID = "pay_real_staging_integration_" + Date.now();

  // 1. Legitimate Stripe Account -> Correct Startup Revenue
  console.log("1. Testing Legitimate Stripe Account RPC Execution on Staging...");
  const sql1 = `
    SELECT public.process_stripe_payment_webhook(
      'stripe', '${TEST_EVENT_ID}', 'payment_intent.succeeded', ${STAGING_STARTUP_ID}, 150.00, '${TEST_PAYMENT_ID}', '${STAGING_ACCOUNT_ID}'
    ) AS rpc_result;
  `;
  const res1 = await executeSqlOnStaging(sql1);
  const rpcRes1 = res1[0]?.rpc_result;
  assert(rpcRes1?.processed === true && rpcRes1?.duplicate === false, `Legitimate RPC execution failed: ${JSON.stringify(res1)}`);
  console.log("✓ Legitimate Stripe account successfully credited startup revenue.");

  // 2. Mismatched Metadata Startup ID -> Must NOT credit attacker-selected startup
  console.log("\n2. Testing Mismatched Startup ID RPC Execution on Staging...");
  const ATTACKER_TARGET_STARTUP_ID = 888888;
  const sql2 = `
    SELECT public.process_stripe_payment_webhook(
      'stripe', 'evt_mismatch_${Date.now()}', 'payment_intent.succeeded', ${ATTACKER_TARGET_STARTUP_ID}, 500.00, 'pay_mismatch_${Date.now()}', '${STAGING_ACCOUNT_ID}'
    ) AS rpc_result;
  `;
  const res2 = await executeSqlOnStaging(sql2);
  const rpcRes2 = res2[0]?.rpc_result;
  assert(rpcRes2?.processed === false && rpcRes2?.error === "unmapped_provider_account", `Mismatched startup ID was not rejected: ${JSON.stringify(res2)}`);
  console.log("✓ Mismatched startup ID rejected cleanly with unmapped_provider_account.");

  // 3. Unknown Provider Account -> Zero Revenue Mutation
  console.log("\n3. Testing Unknown Provider Account RPC Execution on Staging...");
  const sql3 = `
    SELECT public.process_stripe_payment_webhook(
      'stripe', 'evt_unknown_${Date.now()}', 'payment_intent.succeeded', ${STAGING_STARTUP_ID}, 500.00, 'pay_unknown_${Date.now()}', 'acct_UNKNOWN_999999'
    ) AS rpc_result;
  `;
  const res3 = await executeSqlOnStaging(sql3);
  const rpcRes3 = res3[0]?.rpc_result;
  assert(rpcRes3?.processed === false && rpcRes3?.error === "unmapped_provider_account", `Unknown account was not rejected: ${JSON.stringify(res3)}`);
  console.log("✓ Unknown provider account rejected cleanly with unmapped_provider_account.");

  // 4. NULL Provider Account -> Zero Revenue Mutation
  console.log("\n4. Testing NULL Provider Account RPC Execution on Staging...");
  const sql4 = `
    SELECT public.process_stripe_payment_webhook(
      'stripe', 'evt_null_${Date.now()}', 'payment_intent.succeeded', ${STAGING_STARTUP_ID}, 500.00, 'pay_null_${Date.now()}', NULL
    ) AS rpc_result;
  `;
  const res4 = await executeSqlOnStaging(sql4);
  const rpcRes4 = res4[0]?.rpc_result;
  assert(rpcRes4?.processed === false && rpcRes4?.error === "missing_provider_account", `NULL account was not rejected: ${JSON.stringify(res4)}`);
  console.log("✓ NULL provider account rejected cleanly with missing_provider_account.");

  // 5. Replay Event -> Zero Duplicate Mutation
  console.log("\n5. Testing Event Replay RPC Execution on Staging...");
  const sql5 = `
    SELECT public.process_stripe_payment_webhook(
      'stripe', '${TEST_EVENT_ID}', 'payment_intent.succeeded', ${STAGING_STARTUP_ID}, 150.00, '${TEST_PAYMENT_ID}', '${STAGING_ACCOUNT_ID}'
    ) AS rpc_result;
  `;
  const res5 = await executeSqlOnStaging(sql5);
  const rpcRes5 = res5[0]?.rpc_result;
  assert(rpcRes5?.duplicate === true && rpcRes5?.processed === false, `Replay event was not detected as duplicate: ${JSON.stringify(res5)}`);
  console.log("✓ Replay event detected as duplicate with zero duplicate mutation.");

  console.log("\n==========================================================");
  console.log(" ALL REAL STAGING WEBHOOK INTEGRATION TESTS PASSED!       ");
  console.log("==========================================================\n");
}

if (require.main === module) {
  runStagingIntegrationTests().catch((err) => {
    console.error("Staging Integration Test Error:", err);
    process.exit(1);
  });
}

import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { TEST_TOKENS, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL, createTestLogger } from "./_shared_utils";

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function makeX402Request(
  x402Client: X402PaymentClient,
  endpoint: string,
  method: "GET" | "POST",
  body: any,
  tokenType: TokenType,
  logger: ReturnType<typeof createTestLogger>
): Promise<{ status: number; data: any }> {
  // First request - expect 402
  const initialRes = await fetch(`${X402_WORKER_URL}${endpoint}?tokenType=${tokenType}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (initialRes.status !== 402) {
    const text = await initialRes.text();
    return { status: initialRes.status, data: text };
  }

  const paymentReq: X402PaymentRequired = await initialRes.json();
  logger.debug("402 Payment req", paymentReq);

  const signResult = await x402Client.signPayment(paymentReq);
  logger.debug("Signed payment", signResult);

  // Retry with payment
  const retryRes = await fetch(`${X402_WORKER_URL}${endpoint}?tokenType=${tokenType}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": signResult.signedTransaction,
      "X-PAYMENT-TOKEN-TYPE": tokenType,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await retryRes.json().catch(() => retryRes.text());
  return { status: retryRes.status, data };
}

export interface LifecycleTestResult {
  passed: number;
  total: number;
  success: boolean;
}

export async function runKvLifecycle(verbose = false): Promise<LifecycleTestResult> {
  if (!X402_CLIENT_PK) {
    throw new Error("Set X402_CLIENT_PK env var with testnet private key mnemonic");
  }

  const { address, key } = await deriveChildAccount(X402_NETWORK, X402_CLIENT_PK, 0);
  const logger = createTestLogger("kv-storage", verbose);
  logger.info(`Test wallet address: ${address}`);

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey: key,
  });

  // Test with first token type only to save on payments
  const tokenType: TokenType = "STX";
  const testKey = `test-key-${Date.now()}`;
  const testValue = { message: "Hello from KV test", timestamp: Date.now() };

  let successCount = 0;
  const totalTests = 5;

  // Test 1: Set a value
  logger.info("1. Testing /api/kv/set...");
  const setResult = await makeX402Request(
    x402Client,
    "/api/kv/set",
    "POST",
    { key: testKey, value: testValue, ttl: 300, visibility: "private" },
    tokenType,
    logger
  );

  if (setResult.status === 200 && setResult.data.success) {
    logger.success(`Set key "${testKey}" (${setResult.data.bytes} bytes)`);
    successCount++;
  } else {
    logger.error(`Set failed: ${JSON.stringify(setResult.data)}`);
    // Bail out early - no state to test if initial set fails
    logger.info("Bailing out: initial set failed, skipping remaining tests");
    logger.summary(0, totalTests);
    return { passed: 0, total: totalTests, success: false };
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 2: Get the value back
  logger.info("2. Testing /api/kv/get...");
  const getResult = await makeX402Request(
    x402Client,
    "/api/kv/get",
    "POST",
    { key: testKey },
    tokenType,
    logger
  );

  if (
    getResult.status === 200 &&
    getResult.data.value?.message === testValue.message
  ) {
    logger.success(`Got value: "${getResult.data.value.message}"`);
    successCount++;
  } else {
    logger.error(`Get failed: ${JSON.stringify(getResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 3: List keys
  logger.info("3. Testing /api/kv/list...");
  const listResult = await makeX402Request(
    x402Client,
    "/api/kv/list",
    "POST",
    { prefix: "test-key-", visibility: "private" },
    tokenType,
    logger
  );

  if (listResult.status === 200 && Array.isArray(listResult.data.keys)) {
    const foundKey = listResult.data.keys.find((k: any) => k.key === testKey);
    if (foundKey) {
      logger.success(`Listed ${listResult.data.keys.length} keys, found test key`);
      successCount++;
    } else {
      logger.error(`List returned keys but test key not found`);
    }
  } else {
    logger.error(`List failed: ${JSON.stringify(listResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 4: Set a public value and retrieve it
  logger.info("4. Testing public visibility...");
  const publicKey = `public-test-${Date.now()}`;
  const publicSetResult = await makeX402Request(
    x402Client,
    "/api/kv/set",
    "POST",
    { key: publicKey, value: "public value", visibility: "public" },
    tokenType,
    logger
  );

  if (publicSetResult.status === 200) {
    const publicGetResult = await makeX402Request(
      x402Client,
      "/api/kv/get",
      "POST",
      { key: publicKey },
      tokenType,
      logger
    );

    if (publicGetResult.status === 200 && publicGetResult.data.visibility === "public") {
      logger.success(`Public key set and retrieved`);
      successCount++;
    } else {
      logger.error(`Public get failed: ${JSON.stringify(publicGetResult.data)}`);
    }

    // Clean up public key
    await makeX402Request(x402Client, "/api/kv/delete", "POST", { key: publicKey }, tokenType, logger);
  } else {
    logger.error(`Public set failed: ${JSON.stringify(publicSetResult.data)}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Test 5: Delete the key
  logger.info("5. Testing /api/kv/delete...");
  const deleteResult = await makeX402Request(
    x402Client,
    "/api/kv/delete",
    "POST",
    { key: testKey },
    tokenType,
    logger
  );

  if (deleteResult.status === 200 && deleteResult.data.success) {
    // Verify it's gone
    const verifyResult = await makeX402Request(
      x402Client,
      "/api/kv/get",
      "POST",
      { key: testKey },
      tokenType,
      logger
    );

    if (verifyResult.status === 404) {
      logger.success(`Deleted key "${testKey}" and verified removal`);
      successCount++;
    } else {
      logger.error(`Key still exists after delete`);
    }
  } else {
    logger.error(`Delete failed: ${JSON.stringify(deleteResult.data)}`);
  }

  logger.summary(successCount, totalTests);
  return { passed: successCount, total: totalTests, success: successCount === totalTests };
}

// Legacy export for backwards compatibility
export const testKvStorageLifecycle = runKvLifecycle;

// Run if executed directly
if (import.meta.main) {
  const verbose = process.argv.includes("-v") || process.argv.includes("--verbose");
  runKvLifecycle(verbose)
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}

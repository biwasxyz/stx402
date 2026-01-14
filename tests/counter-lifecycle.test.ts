/**
 * Counter Lifecycle Tests
 *
 * Tests the full lifecycle of Counter endpoints:
 * 1. Increment - create a new counter
 * 2. Get - retrieve counter value
 * 3. Increment with bounds - test min/max capping
 * 4. Decrement - decrease counter
 * 5. Reset - reset to specific value
 * 6. List - list all counters
 * 7. Delete - remove counter
 *
 * Usage:
 *   bun run tests/counter-lifecycle.test.ts
 *
 * Environment:
 *   X402_CLIENT_PK  - Mnemonic for payments (required)
 *   X402_WORKER_URL - API URL (default: http://localhost:8787)
 *   VERBOSE=1       - Enable verbose logging
 */

import type { TokenType, NetworkType } from "x402-stacks";
import { X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import {
  COLORS,
  X402_CLIENT_PK,
  X402_NETWORK,
  X402_WORKER_URL,
} from "./_shared_utils";

// =============================================================================
// Configuration
// =============================================================================

const VERBOSE = process.env.VERBOSE === "1";
const TOKEN_TYPE: TokenType = "STX";
const TEST_COUNTER_NAME = `test-counter-${Date.now()}`;

// =============================================================================
// Test Helpers
// =============================================================================

function log(message: string, ...args: unknown[]) {
  if (VERBOSE) {
    console.log(`  ${COLORS.gray}${message}${COLORS.reset}`, ...args);
  }
}

function logStep(step: number, total: number, name: string) {
  console.log(`\n${COLORS.bright}[${step}/${total}]${COLORS.reset} ${COLORS.cyan}${name}${COLORS.reset}`);
}

function logSuccess(message: string) {
  console.log(`  ${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string) {
  console.log(`  ${COLORS.red}✗${COLORS.reset} ${message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// X402 Payment Flow
// =============================================================================

interface PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

async function makeX402Request(
  endpoint: string,
  method: "GET" | "POST",
  x402Client: X402PaymentClient,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const fullUrl = `${X402_WORKER_URL}${endpoint}`;
  const tokenParam = endpoint.includes("?") ? `&tokenType=${TOKEN_TYPE}` : `?tokenType=${TOKEN_TYPE}`;

  log(`Requesting ${method} ${endpoint}...`);

  const initialRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (initialRes.status !== 402) {
    let data: unknown;
    const text = await initialRes.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: initialRes.status, data, headers: initialRes.headers };
  }

  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequired = JSON.parse(paymentText);
  log(`Payment required: ${paymentReq.maxAmountRequired} ${paymentReq.tokenType}`);

  const signResult = await x402Client.signPayment(paymentReq);
  log("Payment signed");

  const paidRes = await fetch(`${fullUrl}${tokenParam}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-PAYMENT": signResult.signedTransaction,
      "X-PAYMENT-TOKEN-TYPE": TOKEN_TYPE,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: unknown;
  const responseText = await paidRes.text();
  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }
  return { status: paidRes.status, data, headers: paidRes.headers };
}

// =============================================================================
// Test Context
// =============================================================================

interface TestContext {
  x402Client: X402PaymentClient;
  ownerAddress: string;
  network: "mainnet" | "testnet";
}

// =============================================================================
// Counter Tests
// =============================================================================

async function testCounterIncrement(ctx: TestContext): Promise<boolean> {
  logStep(1, 7, "Counter: Increment (create new)");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/increment",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 5 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; value: number; previousValue: number; capped: boolean };
    if (result.name !== TEST_COUNTER_NAME) {
      logError(`Name mismatch: ${result.name}`);
      return false;
    }
    if (result.previousValue !== 0) {
      logError(`Expected previousValue 0, got ${result.previousValue}`);
      return false;
    }
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Created counter: ${result.name} = ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterGet(ctx: TestContext): Promise<boolean> {
  logStep(2, 7, "Counter: Get");

  try {
    const { status, data } = await makeX402Request(
      `/api/counter/get?name=${encodeURIComponent(TEST_COUNTER_NAME)}`,
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; value: number; createdAt: string; updatedAt: string };
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Got counter: ${result.name} = ${result.value} (created: ${result.createdAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterIncrementWithBounds(ctx: TestContext): Promise<boolean> {
  logStep(3, 7, "Counter: Increment with max bound");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/increment",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 10, max: 8 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number; capped: boolean };
    if (result.value !== 8) {
      logError(`Expected value capped at 8, got ${result.value}`);
      return false;
    }
    if (!result.capped) {
      logError(`Expected capped=true`);
      return false;
    }

    logSuccess(`Capped at max: ${result.previousValue} → ${result.value} (capped: ${result.capped})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterDecrement(ctx: TestContext): Promise<boolean> {
  logStep(4, 7, "Counter: Decrement");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/decrement",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, step: 3 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number };
    if (result.previousValue !== 8) {
      logError(`Expected previousValue 8, got ${result.previousValue}`);
      return false;
    }
    if (result.value !== 5) {
      logError(`Expected value 5, got ${result.value}`);
      return false;
    }

    logSuccess(`Decremented: ${result.previousValue} → ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterReset(ctx: TestContext): Promise<boolean> {
  logStep(5, 7, "Counter: Reset");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/reset",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME, resetTo: 100 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { value: number; previousValue: number };
    if (result.value !== 100) {
      logError(`Expected value 100, got ${result.value}`);
      return false;
    }

    logSuccess(`Reset: ${result.previousValue} → ${result.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterList(ctx: TestContext): Promise<boolean> {
  logStep(6, 7, "Counter: List all");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/list",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { counters: Array<{ name: string; value: number }>; count: number };
    const ourCounter = result.counters.find((c) => c.name === TEST_COUNTER_NAME);

    if (!ourCounter) {
      logError(`Our counter not found in list of ${result.count}`);
      return false;
    }

    logSuccess(`Listed ${result.count} counter(s), found ours with value ${ourCounter.value}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testCounterDelete(ctx: TestContext): Promise<boolean> {
  logStep(7, 7, "Counter: Delete");

  try {
    const { status, data } = await makeX402Request(
      "/api/counter/delete",
      "POST",
      ctx.x402Client,
      { name: TEST_COUNTER_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { deleted: boolean; name: string };
    if (!result.deleted) {
      logError(`Expected deleted=true`);
      return false;
    }

    logSuccess(`Deleted counter: ${result.name}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

// =============================================================================
// Exported Test Runner
// =============================================================================

export interface LifecycleTestResult {
  passed: number;
  total: number;
  success: boolean;
}

export async function runCounterLifecycle(verbose = false): Promise<LifecycleTestResult> {
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  COUNTER LIFECYCLE TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    return { passed: 0, total: 7, success: false };
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    return { passed: 0, total: 7, success: false };
  }

  const network: NetworkType = X402_NETWORK;
  const { address, key } = await deriveChildAccount(network, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  console.log(`  Account: ${address}`);
  console.log(`  Network: ${network}`);
  console.log(`  Server:  ${X402_WORKER_URL}`);
  console.log(`  Counter: ${TEST_COUNTER_NAME}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 7;
  let passed = 0;

  const incrementResult = await testCounterIncrement(ctx);
  if (!incrementResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial increment failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testCounterGet,
    testCounterIncrementWithBounds,
    testCounterDecrement,
    testCounterReset,
    testCounterList,
    testCounterDelete,
  ];

  for (const test of remainingTests) {
    if (await test(ctx)) {
      passed++;
    }
    await sleep(300);
  }

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  const pct = ((passed / totalTests) * 100).toFixed(1);
  console.log(`  ${passed}/${totalTests} tests passed (${pct}%)`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);

  return { passed, total: totalTests, success: passed === totalTests };
}

// =============================================================================
// Main (when run directly)
// =============================================================================

if (import.meta.main) {
  runCounterLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

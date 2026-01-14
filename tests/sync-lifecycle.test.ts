/**
 * Sync (Distributed Locks) Lifecycle Tests
 *
 * Tests the full lifecycle of Sync endpoints:
 * 1. Lock - acquire a new lock
 * 2. Check - verify lock is held
 * 3. Extend - extend lock TTL
 * 4. List - list all locks
 * 5. Unlock - release the lock
 * 6. Check (verify release) - confirm lock is released
 *
 * Usage:
 *   bun run tests/sync-lifecycle.test.ts
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
const TEST_LOCK_NAME = `test-lock-${Date.now()}`;

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
  lockToken: string; // Token returned when lock is acquired
}

// =============================================================================
// Sync Tests
// =============================================================================

async function testSyncLock(ctx: TestContext): Promise<boolean> {
  logStep(1, 6, "Sync: Lock (acquire)");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/lock",
      "POST",
      ctx.x402Client,
      { name: TEST_LOCK_NAME, ttl: 300 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { acquired: boolean; name: string; token?: string; expiresAt?: string };
    if (!result.acquired) {
      logError(`Lock not acquired: ${JSON.stringify(data)}`);
      return false;
    }
    if (!result.token) {
      logError(`No token returned`);
      return false;
    }

    ctx.lockToken = result.token;

    logSuccess(`Acquired lock: ${result.name} (token: ${result.token.substring(0, 8)}..., expires: ${result.expiresAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSyncCheck(ctx: TestContext): Promise<boolean> {
  logStep(2, 6, "Sync: Check (verify held)");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/check",
      "POST",
      ctx.x402Client,
      { name: TEST_LOCK_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; locked: boolean; expiresAt?: string };
    if (!result.locked) {
      logError(`Lock should be held but is not`);
      return false;
    }

    logSuccess(`Lock is held: ${result.name} (expires: ${result.expiresAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSyncExtend(ctx: TestContext): Promise<boolean> {
  logStep(3, 6, "Sync: Extend");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/extend",
      "POST",
      ctx.x402Client,
      { name: TEST_LOCK_NAME, token: ctx.lockToken, ttl: 300 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { extended: boolean; name: string; expiresAt?: string };
    if (!result.extended) {
      logError(`Lock not extended: ${JSON.stringify(data)}`);
      return false;
    }

    logSuccess(`Extended lock: ${result.name} (new expiry: ${result.expiresAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSyncList(ctx: TestContext): Promise<boolean> {
  logStep(4, 6, "Sync: List");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/list",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { locks: Array<{ name: string; expiresAt: string }>; count: number };
    const ourLock = result.locks.find((l) => l.name === TEST_LOCK_NAME);

    if (!ourLock) {
      logError(`Our lock not found in list of ${result.count}`);
      return false;
    }

    logSuccess(`Listed ${result.count} lock(s), found ours: ${ourLock.name}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSyncUnlock(ctx: TestContext): Promise<boolean> {
  logStep(5, 6, "Sync: Unlock");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/unlock",
      "POST",
      ctx.x402Client,
      { name: TEST_LOCK_NAME, token: ctx.lockToken }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { released: boolean; name: string };
    if (!result.released) {
      logError(`Lock not released: ${JSON.stringify(data)}`);
      return false;
    }

    logSuccess(`Released lock: ${result.name}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSyncCheckAfterUnlock(ctx: TestContext): Promise<boolean> {
  logStep(6, 6, "Sync: Check (verify release)");

  try {
    const { status, data } = await makeX402Request(
      "/api/sync/check",
      "POST",
      ctx.x402Client,
      { name: TEST_LOCK_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { name: string; locked: boolean };
    if (result.locked) {
      logError(`Lock should be released but is still held`);
      return false;
    }

    logSuccess(`Verified release: ${result.name} is no longer locked`);
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

export async function runSyncLifecycle(verbose = false): Promise<LifecycleTestResult> {
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  SYNC (DISTRIBUTED LOCKS) LIFECYCLE TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    return { passed: 0, total: 6, success: false };
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    return { passed: 0, total: 6, success: false };
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
  console.log(`  Lock:    ${TEST_LOCK_NAME}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
    lockToken: "",
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 6;
  let passed = 0;

  const lockResult = await testSyncLock(ctx);
  if (!lockResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial lock failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testSyncCheck,
    testSyncExtend,
    testSyncList,
    testSyncUnlock,
    testSyncCheckAfterUnlock,
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
  runSyncLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

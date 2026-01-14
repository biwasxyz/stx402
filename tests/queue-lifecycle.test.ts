/**
 * Queue (Job Queue) Lifecycle Tests
 *
 * Tests the full lifecycle of Queue endpoints:
 * 1. Push - add a job to the queue
 * 2. Status - check queue status
 * 3. Pop - retrieve the job
 * 4. Complete - mark job as completed
 * 5. Push another - add second job
 * 6. Pop and Fail - retrieve and fail job
 * 7. Status (verify empty) - confirm queue is processed
 *
 * Usage:
 *   bun run tests/queue-lifecycle.test.ts
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
const TEST_QUEUE_NAME = `test-queue-${Date.now()}`;

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
  jobId1: string;
  jobId2: string;
}

// =============================================================================
// Queue Tests
// =============================================================================

async function testQueuePush(ctx: TestContext): Promise<boolean> {
  logStep(1, 7, "Queue: Push (add job)");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/push",
      "POST",
      ctx.x402Client,
      {
        queue: TEST_QUEUE_NAME,
        payload: { task: "process-data", data: { id: 1, name: "test" } },
        priority: 0,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { jobId: string; queue: string; position: number };
    if (!result.jobId) {
      logError(`No jobId returned`);
      return false;
    }

    ctx.jobId1 = result.jobId;

    logSuccess(`Pushed job: ${result.jobId} to ${result.queue} (position: ${result.position})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueueStatus(ctx: TestContext): Promise<boolean> {
  logStep(2, 7, "Queue: Status");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/status",
      "POST",
      ctx.x402Client,
      { queue: TEST_QUEUE_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { queue: string; pending: number; processing: number; completed: number; failed: number };
    if (result.pending < 1) {
      logError(`Expected at least 1 pending job, got ${result.pending}`);
      return false;
    }

    logSuccess(`Queue status: ${result.pending} pending, ${result.processing} processing, ${result.completed} completed`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueuePop(ctx: TestContext): Promise<boolean> {
  logStep(3, 7, "Queue: Pop (retrieve job)");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/pop",
      "POST",
      ctx.x402Client,
      { queue: TEST_QUEUE_NAME, visibility: 60 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { jobId?: string; payload?: unknown; attempt?: number; empty?: boolean };
    if (result.empty) {
      logError(`Queue was empty, expected a job`);
      return false;
    }
    if (!result.jobId) {
      logError(`No jobId in popped result`);
      return false;
    }

    logSuccess(`Popped job: ${result.jobId} (attempt: ${result.attempt})`);
    log("Payload:", result.payload);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueueComplete(ctx: TestContext): Promise<boolean> {
  logStep(4, 7, "Queue: Complete");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/complete",
      "POST",
      ctx.x402Client,
      { jobId: ctx.jobId1 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { completed: boolean; jobId: string };
    if (!result.completed) {
      logError(`Job not marked as completed`);
      return false;
    }

    logSuccess(`Completed job: ${result.jobId}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueuePushSecond(ctx: TestContext): Promise<boolean> {
  logStep(5, 7, "Queue: Push (second job)");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/push",
      "POST",
      ctx.x402Client,
      {
        queue: TEST_QUEUE_NAME,
        payload: { task: "send-email", to: "test@example.com" },
        priority: 1,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { jobId: string; queue: string };
    ctx.jobId2 = result.jobId;

    logSuccess(`Pushed second job: ${result.jobId}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueuePopAndFail(ctx: TestContext): Promise<boolean> {
  logStep(6, 7, "Queue: Pop and Fail");

  try {
    // Pop the job
    const { status: popStatus, data: popData } = await makeX402Request(
      "/api/queue/pop",
      "POST",
      ctx.x402Client,
      { queue: TEST_QUEUE_NAME, visibility: 60 }
    );

    if (popStatus !== 200) {
      logError(`Pop failed: ${popStatus}`);
      return false;
    }

    const popResult = popData as { jobId?: string; empty?: boolean };
    if (popResult.empty || !popResult.jobId) {
      logError(`No job to pop`);
      return false;
    }

    // Fail the job
    const { status: failStatus, data: failData } = await makeX402Request(
      "/api/queue/fail",
      "POST",
      ctx.x402Client,
      { jobId: popResult.jobId, error: "Test failure - simulated error" }
    );

    if (failStatus !== 200) {
      logError(`Fail request failed: ${failStatus}`);
      return false;
    }

    const failResult = failData as { failed: boolean; willRetry: boolean; jobId: string };

    logSuccess(`Failed job: ${failResult.jobId} (willRetry: ${failResult.willRetry})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testQueueStatusFinal(ctx: TestContext): Promise<boolean> {
  logStep(7, 7, "Queue: Status (final)");

  try {
    const { status, data } = await makeX402Request(
      "/api/queue/status",
      "POST",
      ctx.x402Client,
      { queue: TEST_QUEUE_NAME }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { queue: string; pending: number; processing: number; completed: number; failed: number };

    logSuccess(`Final status: ${result.pending} pending, ${result.processing} processing, ${result.completed} completed, ${result.failed} failed`);
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

export async function runQueueLifecycle(verbose = false): Promise<LifecycleTestResult> {
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  QUEUE (JOB QUEUE) LIFECYCLE TEST${COLORS.reset}`);
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
  console.log(`  Queue:   ${TEST_QUEUE_NAME}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
    jobId1: "",
    jobId2: "",
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 7;
  let passed = 0;

  const pushResult = await testQueuePush(ctx);
  if (!pushResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial push failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testQueueStatus,
    testQueuePop,
    testQueueComplete,
    testQueuePushSecond,
    testQueuePopAndFail,
    testQueueStatusFinal,
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
  runQueueLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

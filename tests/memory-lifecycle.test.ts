/**
 * Memory (Agent Memory) Lifecycle Tests
 *
 * Tests the full lifecycle of Memory endpoints:
 * 1. Store - store a memory with embedding
 * 2. Recall - retrieve by exact key
 * 3. List - list all memories
 * 4. Search - semantic search
 * 5. Store another - add second memory
 * 6. Search (verify both) - search should find both
 * 7. Forget - delete first memory
 * 8. List (verify deletion) - confirm memory is gone
 *
 * Usage:
 *   bun run tests/memory-lifecycle.test.ts
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
const TEST_MEMORY_KEY_1 = `test-memory-${Date.now()}-1`;
const TEST_MEMORY_KEY_2 = `test-memory-${Date.now()}-2`;

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
// Memory Tests
// =============================================================================

async function testMemoryStore(ctx: TestContext): Promise<boolean> {
  logStep(1, 8, "Memory: Store (with embedding)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/store",
      "POST",
      ctx.x402Client,
      {
        key: TEST_MEMORY_KEY_1,
        content: "The capital of France is Paris. It is known for the Eiffel Tower.",
        metadata: { tags: ["geography", "europe"], type: "fact", importance: 8 },
        generateEmbedding: true,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { key: string; stored: boolean; hasEmbedding: boolean };
    if (!result.stored) {
      logError(`Memory not stored`);
      return false;
    }
    if (!result.hasEmbedding) {
      logError(`Embedding not generated`);
      return false;
    }

    logSuccess(`Stored memory: ${result.key} (hasEmbedding: ${result.hasEmbedding})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemoryRecall(ctx: TestContext): Promise<boolean> {
  logStep(2, 8, "Memory: Recall (by key)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/recall",
      "POST",
      ctx.x402Client,
      { key: TEST_MEMORY_KEY_1 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { key: string; content: string; metadata?: unknown; hasEmbedding: boolean };
    if (result.key !== TEST_MEMORY_KEY_1) {
      logError(`Key mismatch: ${result.key}`);
      return false;
    }
    if (!result.content.includes("Paris")) {
      logError(`Content mismatch: ${result.content}`);
      return false;
    }

    logSuccess(`Recalled memory: ${result.key} - "${result.content.substring(0, 40)}..."`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemoryList(ctx: TestContext): Promise<boolean> {
  logStep(3, 8, "Memory: List");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/list",
      "POST",
      ctx.x402Client,
      { limit: 10 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { memories: Array<{ key: string }>; total: number; hasMore: boolean };
    const ourMemory = result.memories.find((m) => m.key === TEST_MEMORY_KEY_1);

    if (!ourMemory) {
      logError(`Our memory not found in list of ${result.total}`);
      return false;
    }

    logSuccess(`Listed ${result.total} memories, found ours`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemorySearch(ctx: TestContext): Promise<boolean> {
  logStep(4, 8, "Memory: Search (semantic)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/search",
      "POST",
      ctx.x402Client,
      { query: "What is the capital city of France?", limit: 5 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { query: string; results: Array<{ key: string; content: string; score?: number }>; count: number };
    if (result.count < 1) {
      logError(`No search results`);
      return false;
    }

    const topResult = result.results[0];
    if (!topResult.content.includes("Paris")) {
      logError(`Top result doesn't mention Paris: ${topResult.content}`);
      return false;
    }

    logSuccess(`Search found ${result.count} result(s), top: "${topResult.content.substring(0, 40)}..."`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemoryStoreSecond(ctx: TestContext): Promise<boolean> {
  logStep(5, 8, "Memory: Store (second memory)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/store",
      "POST",
      ctx.x402Client,
      {
        key: TEST_MEMORY_KEY_2,
        content: "Berlin is the capital of Germany. It has a rich history and the Brandenburg Gate.",
        metadata: { tags: ["geography", "europe"], type: "fact", importance: 7 },
        generateEmbedding: true,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { key: string; stored: boolean };
    logSuccess(`Stored second memory: ${result.key}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemorySearchBoth(ctx: TestContext): Promise<boolean> {
  logStep(6, 8, "Memory: Search (verify both)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/search",
      "POST",
      ctx.x402Client,
      { query: "European capital cities", limit: 10 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { results: Array<{ key: string; content: string }>; count: number };

    // Check if both memories are found
    const hasParis = result.results.some((r) => r.content.includes("Paris"));
    const hasBerlin = result.results.some((r) => r.content.includes("Berlin"));

    if (!hasParis || !hasBerlin) {
      logError(`Search should find both Paris and Berlin memories`);
      return false;
    }

    logSuccess(`Search found both memories (${result.count} total results)`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemoryForget(ctx: TestContext): Promise<boolean> {
  logStep(7, 8, "Memory: Forget (delete both)");

  try {
    // Delete first memory
    const { status: status1, data: data1 } = await makeX402Request(
      "/api/memory/forget",
      "POST",
      ctx.x402Client,
      { key: TEST_MEMORY_KEY_1 }
    );

    if (status1 !== 200) {
      logError(`Expected 200 for first forget, got ${status1}: ${JSON.stringify(data1)}`);
      return false;
    }

    // Delete second memory
    const { status: status2, data: data2 } = await makeX402Request(
      "/api/memory/forget",
      "POST",
      ctx.x402Client,
      { key: TEST_MEMORY_KEY_2 }
    );

    if (status2 !== 200) {
      logError(`Expected 200 for second forget, got ${status2}: ${JSON.stringify(data2)}`);
      return false;
    }

    logSuccess(`Forgot both memories: ${TEST_MEMORY_KEY_1}, ${TEST_MEMORY_KEY_2}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testMemoryListAfterForget(ctx: TestContext): Promise<boolean> {
  logStep(8, 8, "Memory: List (verify deletion)");

  try {
    const { status, data } = await makeX402Request(
      "/api/memory/list",
      "POST",
      ctx.x402Client,
      { limit: 100 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { memories: Array<{ key: string }>; total: number };

    // Check that our test memories are gone
    const foundFirst = result.memories.find((m) => m.key === TEST_MEMORY_KEY_1);
    const foundSecond = result.memories.find((m) => m.key === TEST_MEMORY_KEY_2);

    if (foundFirst || foundSecond) {
      logError(`Deleted memories still present in list`);
      return false;
    }

    logSuccess(`Verified deletion: test memories no longer in list (${result.total} remaining)`);
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

export async function runMemoryLifecycle(verbose = false): Promise<LifecycleTestResult> {
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  MEMORY (AGENT MEMORY) LIFECYCLE TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    return { passed: 0, total: 8, success: false };
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    return { passed: 0, total: 8, success: false };
  }

  const network: NetworkType = X402_NETWORK;
  const { address, key } = await deriveChildAccount(network, X402_CLIENT_PK, 0);

  const x402Client = new X402PaymentClient({
    network,
    privateKey: key,
  });

  console.log(`  Account:  ${address}`);
  console.log(`  Network:  ${network}`);
  console.log(`  Server:   ${X402_WORKER_URL}`);
  console.log(`  Memory 1: ${TEST_MEMORY_KEY_1}`);
  console.log(`  Memory 2: ${TEST_MEMORY_KEY_2}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 8;
  let passed = 0;

  const storeResult = await testMemoryStore(ctx);
  if (!storeResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial store failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testMemoryRecall,
    testMemoryList,
    testMemorySearch,
    testMemoryStoreSecond,
    testMemorySearchBoth,
    testMemoryForget,
    testMemoryListAfterForget,
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
  runMemoryLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

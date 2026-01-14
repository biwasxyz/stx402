/**
 * Paste Lifecycle Tests
 *
 * Tests the full lifecycle of Paste endpoints:
 * 1. Create - create a paste with auto-generated code
 * 2. Get - retrieve the paste by code
 * 3. Create with language - create paste with syntax highlighting
 * 4. Delete - remove the paste
 * 5. Get (verify deletion) - confirm paste is gone
 *
 * Usage:
 *   bun run tests/paste-lifecycle.test.ts
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

  // If not 402, return as-is
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

  // Get payment requirements
  const paymentText = await initialRes.text();
  const paymentReq: PaymentRequired = JSON.parse(paymentText);
  log(`Payment required: ${paymentReq.maxAmountRequired} ${paymentReq.tokenType}`);

  // Sign payment
  const signResult = await x402Client.signPayment(paymentReq);
  log("Payment signed");

  // Retry with payment
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
  createdCode: string; // Track the auto-generated code
  secondCode: string;  // Track the second paste code
}

// =============================================================================
// Paste Tests
// =============================================================================

async function testPasteCreate(ctx: TestContext): Promise<boolean> {
  logStep(1, 5, "Paste: Create");

  try {
    const { status, data } = await makeX402Request(
      "/api/paste/create",
      "POST",
      ctx.x402Client,
      { content: "Hello, World! This is a test paste.", ttl: 300 }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { code: string; url: string; expiresAt: string; bytes: number };
    if (!result.code) {
      logError(`No code returned`);
      return false;
    }
    if (!result.url.includes(result.code)) {
      logError(`URL doesn't contain code`);
      return false;
    }

    // Store the code for later tests
    ctx.createdCode = result.code;

    logSuccess(`Created paste: ${result.code} (${result.bytes} bytes, expires: ${result.expiresAt})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testPasteGet(ctx: TestContext): Promise<boolean> {
  logStep(2, 5, "Paste: Get");

  try {
    const { status, data } = await makeX402Request(
      `/api/paste/${ctx.createdCode}`,
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { code: string; content: string; language?: string; createdAt: string };
    if (result.code !== ctx.createdCode) {
      logError(`Code mismatch: ${result.code}`);
      return false;
    }
    if (!result.content.includes("Hello, World!")) {
      logError(`Content mismatch: ${result.content}`);
      return false;
    }

    logSuccess(`Retrieved paste: ${result.code} - "${result.content.substring(0, 30)}..."`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testPasteCreateWithLanguage(ctx: TestContext): Promise<boolean> {
  logStep(3, 5, "Paste: Create with language");

  try {
    const { status, data } = await makeX402Request(
      "/api/paste/create",
      "POST",
      ctx.x402Client,
      {
        content: "function hello() {\n  console.log('Hello, World!');\n}",
        language: "javascript",
        ttl: 300,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { code: string; url: string; language?: string };
    if (!result.code) {
      logError(`No code returned`);
      return false;
    }

    ctx.secondCode = result.code;

    logSuccess(`Created paste with language: ${result.code} (language: ${result.language || "none"})`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testPasteDelete(ctx: TestContext): Promise<boolean> {
  logStep(4, 5, "Paste: Delete");

  try {
    // Delete first paste
    const { status: status1, data: data1 } = await makeX402Request(
      "/api/paste/delete",
      "POST",
      ctx.x402Client,
      { code: ctx.createdCode }
    );

    if (status1 !== 200) {
      logError(`Expected 200 for first delete, got ${status1}: ${JSON.stringify(data1)}`);
      return false;
    }

    // Delete second paste
    const { status: status2, data: data2 } = await makeX402Request(
      "/api/paste/delete",
      "POST",
      ctx.x402Client,
      { code: ctx.secondCode }
    );

    if (status2 !== 200) {
      logError(`Expected 200 for second delete, got ${status2}: ${JSON.stringify(data2)}`);
      return false;
    }

    logSuccess(`Deleted both pastes: ${ctx.createdCode}, ${ctx.secondCode}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testPasteGetAfterDelete(ctx: TestContext): Promise<boolean> {
  logStep(5, 5, "Paste: Get (verify deletion)");

  try {
    const { status, data } = await makeX402Request(
      `/api/paste/${ctx.createdCode}`,
      "GET",
      ctx.x402Client
    );

    if (status === 404) {
      logSuccess(`Verified deletion: paste ${ctx.createdCode} no longer exists`);
      return true;
    }

    logError(`Expected 404, got ${status}: ${JSON.stringify(data)}`);
    return false;
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

export async function runPasteLifecycle(verbose = false): Promise<LifecycleTestResult> {
  // Override verbose if env is set
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  PASTE LIFECYCLE TEST${COLORS.reset}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  if (!X402_CLIENT_PK) {
    console.error(`${COLORS.red}Error: Set X402_CLIENT_PK env var${COLORS.reset}`);
    return { passed: 0, total: 5, success: false };
  }

  if (X402_NETWORK !== "mainnet" && X402_NETWORK !== "testnet") {
    console.error(`${COLORS.red}Error: Invalid X402_NETWORK${COLORS.reset}`);
    return { passed: 0, total: 5, success: false };
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
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
    createdCode: "",
    secondCode: "",
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 5;
  let passed = 0;

  const createResult = await testPasteCreate(ctx);
  if (!createResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial create failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testPasteGet,
    testPasteCreateWithLanguage,
    testPasteDelete,
    testPasteGetAfterDelete,
  ];

  for (const test of remainingTests) {
    if (await test(ctx)) {
      passed++;
    }
    await sleep(300);
  }

  // Summary
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
  runPasteLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

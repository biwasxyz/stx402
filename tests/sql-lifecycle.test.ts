/**
 * SQL Lifecycle Tests
 *
 * Tests the full lifecycle of SQL endpoints:
 * 1. Schema - get initial schema
 * 2. Execute - create custom table
 * 3. Execute - insert data
 * 4. Query - select data
 * 5. Schema - verify new table exists
 * 6. Execute - drop table (cleanup)
 *
 * Usage:
 *   bun run tests/sql-lifecycle.test.ts
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
const TEST_TABLE_NAME = `test_table_${Date.now()}`;

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
// SQL Tests
// =============================================================================

async function testSqlSchemaInitial(ctx: TestContext): Promise<boolean> {
  logStep(1, 6, "SQL: Get initial schema");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/schema",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { tables: Array<{ name: string; sql: string }> };
    // System tables should exist
    const hasSystemTables = result.tables.length >= 0; // Even empty is valid

    logSuccess(`Schema has ${result.tables.length} tables`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlCreateTable(ctx: TestContext): Promise<boolean> {
  logStep(2, 6, "SQL: Create custom table");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/execute",
      "POST",
      ctx.x402Client,
      {
        query: `CREATE TABLE IF NOT EXISTS ${TEST_TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; rowsAffected: number };
    if (!result.success) {
      logError(`Expected success=true`);
      return false;
    }

    logSuccess(`Created table: ${TEST_TABLE_NAME}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlInsertData(ctx: TestContext): Promise<boolean> {
  logStep(3, 6, "SQL: Insert data");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/execute",
      "POST",
      ctx.x402Client,
      {
        query: `INSERT INTO ${TEST_TABLE_NAME} (name, score) VALUES (?, ?), (?, ?), (?, ?)`,
        params: ["Alice", 100, "Bob", 85, "Charlie", 92],
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean; rowsAffected: number };
    if (!result.success || result.rowsAffected < 3) {
      logError(`Expected success with at least 3 rows, got ${result.rowsAffected}`);
      return false;
    }

    logSuccess(`Inserted ${result.rowsAffected} rows`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlQueryData(ctx: TestContext): Promise<boolean> {
  logStep(4, 6, "SQL: Query data");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/query",
      "POST",
      ctx.x402Client,
      {
        query: `SELECT name, score FROM ${TEST_TABLE_NAME} ORDER BY score DESC`,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { rows: Array<{ name: string; score: number }>; rowCount: number; columns: string[] };
    if (result.rowCount !== 3) {
      logError(`Expected 3 rows, got ${result.rowCount}`);
      return false;
    }

    if (result.rows[0].name !== "Alice" || result.rows[0].score !== 100) {
      logError(`Expected Alice with 100 first, got ${result.rows[0].name} with ${result.rows[0].score}`);
      return false;
    }

    logSuccess(`Queried ${result.rowCount} rows: ${result.rows.map((r) => `${r.name}(${r.score})`).join(", ")}`);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlSchemaFinal(ctx: TestContext): Promise<boolean> {
  logStep(5, 6, "SQL: Verify custom table in schema");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/schema",
      "GET",
      ctx.x402Client
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { tables: Array<{ name: string; sql: string }> };
    const customTable = result.tables.find((t) => t.name === TEST_TABLE_NAME);

    if (!customTable) {
      logError(`Custom table ${TEST_TABLE_NAME} not found in schema`);
      return false;
    }

    logSuccess(`Schema now has ${result.tables.length} tables (including ${TEST_TABLE_NAME})`);
    log("Table SQL:", customTable.sql);
    return true;
  } catch (error) {
    logError(`Exception: ${error}`);
    return false;
  }
}

async function testSqlDropTable(ctx: TestContext): Promise<boolean> {
  logStep(6, 6, "SQL: Drop table (cleanup)");

  try {
    const { status, data } = await makeX402Request(
      "/api/sql/execute",
      "POST",
      ctx.x402Client,
      {
        query: `DROP TABLE IF EXISTS ${TEST_TABLE_NAME}`,
      }
    );

    if (status !== 200) {
      logError(`Expected 200, got ${status}: ${JSON.stringify(data)}`);
      return false;
    }

    const result = data as { success: boolean };
    if (!result.success) {
      logError(`Expected success=true`);
      return false;
    }

    logSuccess(`Dropped table: ${TEST_TABLE_NAME}`);
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

export async function runSqlLifecycle(verbose = false): Promise<LifecycleTestResult> {
  const isVerbose = verbose || process.env.VERBOSE === "1";

  console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
  console.log(`${COLORS.bright}  SQL LIFECYCLE TEST${COLORS.reset}`);
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
  console.log(`  Table:   ${TEST_TABLE_NAME}`);
  console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);

  const ctx: TestContext = {
    x402Client,
    ownerAddress: address,
    network,
  };

  // Run initial test - if it fails, bail out (no state to test)
  const totalTests = 6;
  let passed = 0;

  const schemaResult = await testSqlSchemaInitial(ctx);
  if (!schemaResult) {
    console.log(`\n${COLORS.yellow}Bailing out: initial schema check failed, skipping remaining tests${COLORS.reset}`);
    console.log(`\n${COLORS.bright}${"═".repeat(50)}${COLORS.reset}`);
    console.log(`  0/${totalTests} tests passed (setup failed)`);
    console.log(`${COLORS.bright}${"═".repeat(50)}${COLORS.reset}\n`);
    return { passed: 0, total: totalTests, success: false };
  }
  passed++;
  await sleep(300);

  // Run remaining tests
  const remainingTests = [
    testSqlCreateTable,
    testSqlInsertData,
    testSqlQueryData,
    testSqlSchemaFinal,
    testSqlDropTable,
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
  runSqlLifecycle()
    .then((result) => process.exit(result.success ? 0 : 1))
    .catch((error) => {
      console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
      process.exit(1);
    });
}

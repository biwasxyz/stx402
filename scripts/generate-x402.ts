#!/usr/bin/env bun
/**
 * Generate x402.json for StacksX402 scanner discovery.
 *
 * Fetches OpenAPI spec from a running server and transforms it to x402 format.
 *
 * Usage:
 *   bun run scripts/generate-x402.ts [options]
 *
 * Options:
 *   --url <url>       Base URL of the server (default: http://localhost:8787)
 *   --network <net>   Network: mainnet or testnet (default: from .env or mainnet)
 *   --pay-to <addr>   Payment address (default: from .env)
 *   --output <path>   Output file path, use "-" for stdout (default: public/x402.json)
 *   --help            Show this help message
 *
 * Environment Variables (from .env):
 *   X402_NETWORK        - Network (mainnet/testnet)
 *   X402_SERVER_ADDRESS - Payment recipient address
 *   X402_WORKER_URL     - Default server URL
 *
 * Examples:
 *   bun run scripts/generate-x402.ts
 *   bun run scripts/generate-x402.ts --url https://stx402.com
 *   bun run scripts/generate-x402.ts --network testnet --output x402-testnet.json
 *   bun run scripts/generate-x402.ts --output -
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { generateX402SchemaFromUrl, type GeneratorConfig } from "../src/utils/x402-schema";

// Load .env file if present
const envPath = join(import.meta.dir, "..", ".env");
if (existsSync(envPath)) {
  const envContent = Bun.file(envPath);
  const text = await envContent.text();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// Parse command line arguments
function parseArgs(): {
  url: string;
  network: "mainnet" | "testnet";
  payTo: string;
  output: string;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    url: process.env.X402_WORKER_URL || "http://localhost:8787",
    network: (process.env.X402_NETWORK || "mainnet") as "mainnet" | "testnet",
    payTo: process.env.X402_SERVER_ADDRESS || "",
    output: "public/x402.json",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--url":
        result.url = next || result.url;
        i++;
        break;
      case "--network":
        if (next === "mainnet" || next === "testnet") {
          result.network = next;
        }
        i++;
        break;
      case "--pay-to":
        result.payTo = next || result.payTo;
        i++;
        break;
      case "--output":
        result.output = next || result.output;
        i++;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
Generate x402.json for StacksX402 scanner discovery.

Usage:
  bun run scripts/generate-x402.ts [options]

Options:
  --url <url>       Base URL of the server (default: http://localhost:8787)
  --network <net>   Network: mainnet or testnet (default: from .env or mainnet)
  --pay-to <addr>   Payment address (default: from .env)
  --output <path>   Output file path, use "-" for stdout (default: public/x402.json)
  --help            Show this help message

Environment Variables (from .env):
  X402_NETWORK        - Network (mainnet/testnet)
  X402_SERVER_ADDRESS - Payment recipient address
  X402_WORKER_URL     - Default server URL

Examples:
  bun run scripts/generate-x402.ts
  bun run scripts/generate-x402.ts --url https://stx402.com
  bun run scripts/generate-x402.ts --network testnet --output x402-testnet.json
  bun run scripts/generate-x402.ts --output -
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.payTo) {
    console.error("Error: Payment address is required.");
    console.error("Set X402_SERVER_ADDRESS in .env or use --pay-to <address>");
    process.exit(1);
  }

  console.log("Generating x402.json schema...\n");
  console.log(`  Server URL: ${args.url}`);
  console.log(`  Network:    ${args.network}`);
  console.log(`  Pay To:     ${args.payTo}`);
  console.log(`  Output:     ${args.output === "-" ? "stdout" : args.output}`);
  console.log("");

  try {
    // Generate the schema
    const config: Partial<GeneratorConfig> = {
      network: args.network,
      payTo: args.payTo,
      name: "stx402 Directory",
      image: args.url.includes("localhost")
        ? "https://stx402.com/favicon.svg"
        : `${args.url}/favicon.svg`,
    };

    const schema = await generateX402SchemaFromUrl(args.url, config);

    // Format output
    const json = JSON.stringify(schema, null, 2);

    // Write to file or stdout
    if (args.output === "-") {
      console.log(json);
    } else {
      const outputPath = join(import.meta.dir, "..", args.output);
      const outputDir = dirname(outputPath);

      // Create directory if needed
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      writeFileSync(outputPath, json);
      console.log(`Generated x402.json with ${schema.accepts.length} endpoint entries`);
      console.log(`  (${schema.accepts.length / 3} unique endpoints x 3 tokens)`);
      console.log(`\nWritten to: ${outputPath}`);
    }
  } catch (error) {
    console.error("Error generating x402.json:", error);
    process.exit(1);
  }
}

main();

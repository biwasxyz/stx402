#!/usr/bin/env bun
/**
 * Clean up orphaned metrics stored with full paths (including parameter values).
 *
 * This script:
 * 1. Reads current metrics from KV via wrangler
 * 2. Finds entries with paths that don't match ENDPOINT_TIERS keys
 * 3. Aggregates their data into the correct normalized paths
 * 4. Outputs a cleaned metrics object
 *
 * Usage:
 *   # Preview changes (dry run)
 *   bun run scripts/cleanup-orphaned-metrics.ts
 *
 *   # Apply changes to production
 *   bun run scripts/cleanup-orphaned-metrics.ts --apply
 *
 *   # Apply to staging
 *   bun run scripts/cleanup-orphaned-metrics.ts --apply --env staging
 */

import { execSync } from "child_process";
import { ENDPOINT_TIERS } from "../src/utils/pricing";
import { ENDPOINT_CREATED_DATES } from "../src/utils/endpoint-created-dates";

const METRICS_KEY = "metrics:v1";
const validPaths = new Set(Object.keys(ENDPOINT_TIERS));

// Parse args
const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const envFlag = args.includes("--env") ? args[args.indexOf("--env") + 1] : "";
const envArg = envFlag ? `--env ${envFlag}` : "";

// Normalize a path by stripping parameter values
// e.g., /api/stacks/get-bns-name/SP123... -> /api/stacks/get-bns-name
function normalizePath(path: string): string | null {
  // Try to match against known valid paths
  for (const validPath of validPaths) {
    // Check if the path starts with the valid path
    if (path === validPath) {
      return validPath;
    }
    // Check if it's a parameterized version (valid path + / + something)
    if (path.startsWith(validPath + "/")) {
      return validPath;
    }
  }
  return null;
}

interface EndpointStats {
  calls: number;
  success: number;
  latencySum: number;
  earnings: {
    STX: number;
    sBTC: number;
    USDCx: number;
  };
  created?: string;
  lastCall: string;
}

interface MetricsData {
  version: 1;
  endpoints: Record<string, EndpointStats>;
  daily: Record<string, { calls: number }>;
  updatedAt: string;
}

// Read current metrics from KV
console.log("Reading metrics from KV...");
console.log("(Requires CLOUDFLARE_API_TOKEN environment variable)\n");
let metricsJson: string;
try {
  metricsJson = execSync(
    `npx wrangler kv key get "${METRICS_KEY}" --binding METRICS --text --remote ${envArg}`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, cwd: import.meta.dir + "/.." }
  );
} catch (e: any) {
  if (e.message?.includes("CLOUDFLARE_API_TOKEN")) {
    console.error("Missing CLOUDFLARE_API_TOKEN. Set it with:");
    console.error("  export CLOUDFLARE_API_TOKEN=your_token_here");
  } else if (e.message?.includes("Value not found")) {
    console.error("No metrics found in KV. Nothing to clean up!");
  } else {
    console.error("Failed to read metrics from KV:", e.message);
  }
  process.exit(1);
}

const metrics: MetricsData = JSON.parse(metricsJson);
console.log(`Found ${Object.keys(metrics.endpoints).length} endpoint entries\n`);

// Categorize entries
const validEntries: Record<string, EndpointStats> = {};
const orphanedEntries: Record<string, EndpointStats> = {};
const aggregations: Record<string, string[]> = {}; // normalized path -> orphaned paths

for (const [path, stats] of Object.entries(metrics.endpoints)) {
  if (validPaths.has(path)) {
    validEntries[path] = stats;
  } else {
    const normalized = normalizePath(path);
    if (normalized) {
      orphanedEntries[path] = stats;
      if (!aggregations[normalized]) {
        aggregations[normalized] = [];
      }
      aggregations[normalized].push(path);
    } else {
      // Truly orphaned - can't match to any valid path
      console.log(`  Unknown path (will be deleted): ${path}`);
      orphanedEntries[path] = stats;
    }
  }
}

console.log(`Valid entries: ${Object.keys(validEntries).length}`);
console.log(`Orphaned entries: ${Object.keys(orphanedEntries).length}`);
console.log("");

if (Object.keys(orphanedEntries).length === 0) {
  console.log("No orphaned entries found. Nothing to clean up!");
  process.exit(0);
}

// Show what will be aggregated
console.log("Aggregations to perform:");
for (const [normalized, orphans] of Object.entries(aggregations)) {
  console.log(`  ${normalized}:`);
  for (const orphan of orphans.slice(0, 3)) {
    const stats = orphanedEntries[orphan];
    console.log(`    - ${orphan} (${stats.calls} calls, ${stats.earnings.STX.toFixed(6)} STX)`);
  }
  if (orphans.length > 3) {
    console.log(`    ... and ${orphans.length - 3} more`);
  }
}
console.log("");

// Perform aggregation
const cleanedEndpoints: Record<string, EndpointStats> = { ...validEntries };

for (const [normalized, orphans] of Object.entries(aggregations)) {
  // Start with existing valid entry or create new one
  if (!cleanedEndpoints[normalized]) {
    cleanedEndpoints[normalized] = {
      calls: 0,
      success: 0,
      latencySum: 0,
      earnings: { STX: 0, sBTC: 0, USDCx: 0 },
      created: ENDPOINT_CREATED_DATES[normalized] || new Date().toISOString(),
      lastCall: "",
    };
  }

  const target = cleanedEndpoints[normalized];

  // Aggregate orphaned entries
  for (const orphan of orphans) {
    const stats = orphanedEntries[orphan];
    target.calls += stats.calls;
    target.success += stats.success;
    target.latencySum += stats.latencySum;
    target.earnings.STX += stats.earnings.STX;
    target.earnings.sBTC += stats.earnings.sBTC;
    target.earnings.USDCx += stats.earnings.USDCx;

    // Use earliest created date
    if (stats.created && (!target.created || stats.created < target.created)) {
      target.created = stats.created;
    }

    // Use latest lastCall
    if (stats.lastCall && (!target.lastCall || stats.lastCall > target.lastCall)) {
      target.lastCall = stats.lastCall;
    }
  }
}

// Build cleaned metrics
const cleanedMetrics: MetricsData = {
  version: 1,
  endpoints: cleanedEndpoints,
  daily: metrics.daily,
  updatedAt: new Date().toISOString(),
};

// Summary
const totalOrphanedCalls = Object.values(orphanedEntries).reduce((sum, s) => sum + s.calls, 0);
const totalOrphanedSTX = Object.values(orphanedEntries).reduce((sum, s) => sum + s.earnings.STX, 0);

console.log("Summary:");
console.log(`  Entries before: ${Object.keys(metrics.endpoints).length}`);
console.log(`  Entries after: ${Object.keys(cleanedEndpoints).length}`);
console.log(`  Orphaned calls recovered: ${totalOrphanedCalls}`);
console.log(`  Orphaned STX recovered: ${totalOrphanedSTX.toFixed(6)}`);
console.log("");

if (!shouldApply) {
  console.log("Dry run complete. Use --apply to write changes to KV.");
  console.log("\nCleaned metrics preview (first 5 entries):");
  const preview = Object.entries(cleanedEndpoints).slice(0, 5);
  for (const [path, stats] of preview) {
    console.log(`  ${path}: ${stats.calls} calls, ${stats.earnings.STX.toFixed(6)} STX`);
  }
} else {
  console.log("Applying changes to KV...");

  // Write to a temp file and use wrangler to upload
  const tempFile = "/tmp/cleaned-metrics.json";
  const fs = await import("fs");
  fs.writeFileSync(tempFile, JSON.stringify(cleanedMetrics));

  try {
    execSync(
      `npx wrangler kv key put "${METRICS_KEY}" --path "${tempFile}" --binding METRICS --remote ${envArg}`,
      { stdio: "inherit", cwd: import.meta.dir + "/.." }
    );
    console.log("\nMetrics cleaned successfully!");
  } catch (e) {
    console.error("Failed to write metrics to KV:", e);
    process.exit(1);
  } finally {
    fs.unlinkSync(tempFile);
  }
}

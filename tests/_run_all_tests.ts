// Stacks endpoints
import { testX402ManualFlow as testDecodeClarity } from "./decode-clarity-hex.test";
import { testX402ManualFlow as testConvertAddress } from "./convert-address-to-network.test";
import { testX402ManualFlow as testGetBns } from "./get-bns-address.test";
import { testX402ManualFlow as testValidateAddress } from "./validate-stacks-address.test";

// AI endpoints
import { testX402ManualFlow as testDadJoke } from "./dad-joke.test";
import { testX402ManualFlow as testTts } from "./tts.test";
import { testX402ManualFlow as testSummarize } from "./summarize.test";
import { testX402ManualFlow as testImageDescribe } from "./image-describe.test";
import { testX402ManualFlow as testGenerateImage } from "./generate-image.test";

import { COLORS, TEST_TOKENS } from "./_shared_utils";

async function runAllTests() {
  const verbose = process.env.VERBOSE === "1";
  const clearScreen = process.env.CLEAR_SCREEN === "1";

  if (clearScreen) console.clear();

  console.log(`${COLORS.bright}🚀 Starting all X402 tests...${COLORS.reset}\n`);

  const tests = [
    // Stacks endpoints
    { name: "decode-clarity-hex", fn: testDecodeClarity },
    { name: "convert-address-to-network", fn: testConvertAddress },
    { name: "get-bns-address", fn: testGetBns },
    { name: "validate-stacks-address", fn: testValidateAddress },
    // AI endpoints
    { name: "dad-joke", fn: testDadJoke },
    { name: "tts", fn: testTts },
    { name: "summarize", fn: testSummarize },
    { name: "image-describe", fn: testImageDescribe },
    { name: "generate-image", fn: testGenerateImage },
  ];

  interface TokenStats {
    success: number;
    total: number;
  }
  const tokenStats: Record<string, TokenStats> = {};

  for (const t of tests) {
    console.log(`${COLORS.bright}━${"━".repeat(60)}━${COLORS.reset}`);
    console.log(`${COLORS.bright}🔄 Running ${COLORS.yellow}${t.name}${COLORS.reset}`);
    console.log(`${COLORS.bright}━${"━".repeat(60)}━${COLORS.reset}\n`);

    try {
      const result = await t.fn(verbose) as { tokenResults: Record<string, boolean> };
      for (const [token, passed] of Object.entries(result.tokenResults)) {
        if (!tokenStats[token]) {
          tokenStats[token] = { success: 0, total: 0 };
        }
        tokenStats[token]!.total++;
        if (passed) {
          tokenStats[token]!.success++;
        }
      }
    } catch (e) {
      console.log(`${COLORS.bright}${COLORS.red}💥 ${t.name.toUpperCase()} CRASHED:${COLORS.reset}`);
      console.error(e);
      for (const token of TEST_TOKENS) {
        if (!tokenStats[token]) {
          tokenStats[token] = { success: 0, total: 0 };
        }
        tokenStats[token]!.total++;
      }
    }
    console.log();
  }

  const globalSuccess = Object.values(tokenStats).reduce((sum, s) => sum + s.success, 0);
  const globalTotal = Object.values(tokenStats).reduce((sum, s) => sum + s.total, 0);
  const passRate = globalTotal ? ((globalSuccess / globalTotal) * 100).toFixed(1) : "0.0";

  const summaryParts: string[] = [];
  for (const [token, stats] of Object.entries(tokenStats)) {
    const tokenRate = ((stats.success / stats.total) * 100).toFixed(1);
    summaryParts.push(`${token}:${stats.success}/${stats.total} (${tokenRate}%)`);
  }

  console.log(`${COLORS.bright}🎉 FINAL SUMMARY: ${summaryParts.join(", ")} | Total: ${globalSuccess}/${globalTotal} (${passRate}%)${COLORS.reset}`);
}

runAllTests().catch(console.error);

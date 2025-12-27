import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { TEST_TOKENS, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL, createTestLogger } from "./_shared_utils";

const X402_ENDPOINT = `/api/summarize`;

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType: TokenType;
}

export async function testX402ManualFlow(verbose = false) {
  if (!X402_CLIENT_PK) {
    throw new Error(
      "Set X402_CLIENT_PK env var with testnet private key mnemonic"
    );
  }

  const { address, key } = await deriveChildAccount(
    X402_NETWORK,
    X402_CLIENT_PK,
    0
  );

  const logger = createTestLogger("summarize", verbose);
  logger.info(`Test wallet address: ${address}`);

  const x402Client = new X402PaymentClient({
    network: X402_NETWORK,
    privateKey: key,
  });

  const tokenResults: Record<string, boolean> = TEST_TOKENS.reduce((acc, t) => {
    acc[t] = false;
    return acc;
  }, {} as Record<string, boolean>);

  const requestBody = {
    text: "The quick brown fox jumps over the lazy dog. The five boxing wizards jump quickly. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. This is sample text for AI summarization testing in STX402 service."
  };

  for (const tokenType of TEST_TOKENS) {
    logger.info(`--- Testing ${tokenType} ---`);
    const endpoint = `${X402_ENDPOINT}?tokenType=${tokenType}`;

    logger.info("1. Initial request (expect 402)...");
    const initialRes = await fetch(`${X402_WORKER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (initialRes.status !== 402) {
      throw new Error(
        `Expected 402, got ${initialRes.status}: ${await initialRes.text()}`
      );
    }

    const paymentReq: X402PaymentRequired = await initialRes.json();
    logger.debug("402 Payment req", paymentReq);

    if (paymentReq.tokenType !== tokenType)
      throw new Error(`Expected tokenType ${tokenType}`);

    const signResult = await x402Client.signPayment(paymentReq);
    logger.debug("Signed payment", signResult);

    logger.info("2. Retry with X-PAYMENT...");
    const retryRes = await fetch(`${X402_WORKER_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": signResult.signedTransaction,
        "X-PAYMENT-TOKEN-TYPE": tokenType,
      },
      body: JSON.stringify(requestBody),
    });

    logger.info(`Retry status: ${retryRes.status}`);
    if (retryRes.status !== 200) {
      const errText = await retryRes.text();
      logger.error(`Retry failed for ${tokenType} (${retryRes.status}): ${errText}`);
      logger.debug("Payment req", paymentReq);
      continue;
    }

    const data = await retryRes.json();
    if (typeof data.summary === "string" && data.summary.length > 10 && typeof data.original_length === "number" && data.tokenType === tokenType) {
      logger.success(`Summary: "${data.summary.substring(0,50)}${data.summary.length > 50 ? '...' : ''}" (${data.original_length} chars) for ${tokenType}`);
      tokenResults[tokenType] = true;
    } else {
      logger.error(`Validation failed for ${tokenType}: summary=${typeof data.summary}, len=${data.summary?.length ?? 0}, orig_len=${typeof data.original_length}, token match=${data.tokenType === tokenType}`);
      logger.debug("Full response", data);
      continue;
    }

    const paymentResp = retryRes.headers.get("x-payment-response");
    if (paymentResp) {
      const info = JSON.parse(paymentResp);
      logger.debug("Payment confirmed", info);
    }
  }
  const successCount = Object.values(tokenResults).filter(v => v).length;
  logger.summary(successCount, TEST_TOKENS.length);
  return { tokenResults };
}

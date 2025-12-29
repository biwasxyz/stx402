import { TokenType, X402PaymentClient } from "x402-stacks";
import { deriveChildAccount } from "../src/utils/wallet";
import { TEST_TOKENS, X402_CLIENT_PK, X402_NETWORK, X402_WORKER_URL, createTestLogger } from "./_shared_utils";

const X402_ENDPOINT = `/api/ai/generate-image`;

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

  const logger = createTestLogger("generate-image", verbose);
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
    prompt: "a simple red circle on a white background"
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

    const contentType = retryRes.headers.get("content-type") || "";
    if (!contentType.includes("image/png")) {
      const errText = await retryRes.text();
      logger.error(`Expected image/png, got ${contentType} for ${tokenType}: ${errText.substring(0, 200)}`);
      continue;
    }

    logger.success(`Image generated (${contentType}) for ${tokenType}`);
    tokenResults[tokenType] = true;

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

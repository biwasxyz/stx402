import {
  makeSTXTokenTransfer,
} from "@stacks/transactions";

const WORKER_URL = "https://stx402.chaos.workers.dev";
const PRIVATE_KEY = process.env.X402_CLIENT_PK!; // Set via ENV for testnet wallet
const TEST_ADDRESS = "SPKH205E1MZMBRSQ07PCZN3A1RJCGSHY5P9CM1DR"; // Has BNS: stacks.btc
const ENDPOINT = `/api/get-bns-name/${TEST_ADDRESS}`;

interface X402PaymentRequired {
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  network: "mainnet" | "testnet";
  nonce: string;
  expiresAt: string;
  tokenType?: "STX" | "sBTC";
}

async function testX402ManualFlow() {
  if (!PRIVATE_KEY_HEX) {
    throw new Error("Set X402_CLIENT_PK env var with testnet private key hex");
  }

  const network = new StacksTestnet();
  const privKey = createStacksPrivateKey(PRIVATE_KEY_HEX);
  console.log("Sender:", privKey.publicKey.toString(network));

  console.log("1. Initial request (expect 402)...");
  const initialRes = await fetch(`${WORKER_URL}${ENDPOINT}`);
  if (initialRes.status !== 402) {
    throw new Error(`Expected 402, got ${initialRes.status}: ${await initialRes.text()}`);
  }

  const paymentReq: X402PaymentRequired = await initialRes.json();
  console.log("402 Payment req:", paymentReq);

  if (paymentReq.tokenType !== "STX") throw new Error("Test assumes STX");

  console.log("2. Signing STX transfer...");
  const tx = await makeSTXTokenTransfer({
    recipient: paymentReq.payTo,
    amount: BigInt(paymentReq.maxAmountRequired), // microSTX
    senderKey: PRIVATE_KEY_HEX,
    network,
    memo: `x402 ${paymentReq.nonce.slice(0, 8)}`, // Traceable memo
  });

  const signedHex = tx.serialize().toString("hex");
  const b64SignedTx = base64FromBytes(new Uint8Array(Buffer.from(signedHex, "hex")));
  console.log("Signed tx (base64 preview):", b64SignedTx.slice(0, 50) + "...");

  console.log("3. Retry with X-PAYMENT...");
  const retryRes = await fetch(`${WORKER_URL}${ENDPOINT}`, {
    headers: {
      "X-PAYMENT": b64SignedTx,
      "X-PAYMENT-TOKEN-TYPE": "STX",
    },
  });

  console.log("Retry status:", retryRes.status);
  if (retryRes.status !== 200) {
    console.error("Failed:", await retryRes.text());
    return;
  }

  const data = await retryRes.text();
  console.log("✅ Data:", data.trim()); // "stacks.btc"

  const paymentResp = retryRes.headers.get("x-payment-response");
  if (paymentResp) {
    const info = JSON.parse(paymentResp);
    console.log("Payment confirmed:", info);
  }

  console.log("🎉 FULL SUCCESS: Paid → Got BNS name!");
}

testX402ManualFlow().catch(e => console.error("❌ Error:", e));

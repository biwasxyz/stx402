import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";

// Stacks endpoints
import { GetBnsName } from "./endpoints/getBnsName";
import { ValidateStacksAddress } from "./endpoints/validateStacksAddress";
import { ConvertAddressToNetwork } from "./endpoints/convertAddressToNetwork";
import { DecodeClarityHex } from "./endpoints/decodeClarityHex";

// Games endpoints
import { DeepThought } from "./endpoints/deepThought";
import { CoinToss } from "./endpoints/coinToss";
import { DadJoke } from "./endpoints/dadJoke";

// AI endpoints
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { GenerateImage } from "./endpoints/generateImage";

// Betting endpoints
import { BetCoinToss } from "./endpoints/betCoinToss";
import { BetDice } from "./endpoints/betDice";

import { x402PaymentMiddleware } from "./middleware/x402-stacks";
import { metricsMiddleware } from "./middleware/metrics";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["X-PAYMENT", "X-PAYMENT-TOKEN-TYPE"],
  })
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

const paymentMiddleware = x402PaymentMiddleware();
const trackMetrics = metricsMiddleware();

// Register OpenAPI endpoints

// System endpoints (free)
openapi.get("/api/health", Health);
openapi.get("/dashboard", Dashboard);

// Stacks endpoints (paid)
openapi.get("/api/get-bns-name/:address", paymentMiddleware, trackMetrics, GetBnsName as any);
openapi.get(
  "/api/validate-stacks-address/:address",
  paymentMiddleware,
  trackMetrics,
  ValidateStacksAddress as any
);
openapi.get(
  "/api/convert-address-to-network/:address",
  paymentMiddleware,
  trackMetrics,
  ConvertAddressToNetwork as any
);
openapi.post(
  "/api/decode-clarity-hex",
  paymentMiddleware,
  trackMetrics,
  DecodeClarityHex as any
);

// Games endpoints (paid)
openapi.get("/api/deep-thought", paymentMiddleware, trackMetrics, DeepThought as any);
openapi.get("/api/coin-toss", paymentMiddleware, trackMetrics, CoinToss as any);
openapi.get("/api/dad-joke", paymentMiddleware, trackMetrics, DadJoke as any);

// AI endpoints (paid)
openapi.post("/api/ai/image-describe", paymentMiddleware, trackMetrics, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, trackMetrics, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, trackMetrics, Summarize as any);
openapi.post("/api/generate-image", paymentMiddleware, trackMetrics, GenerateImage as any);

// Betting endpoints (paid)
openapi.post("/api/bet/coin-toss", paymentMiddleware, trackMetrics, BetCoinToss as any);
openapi.post("/api/bet/dice", paymentMiddleware, trackMetrics, BetDice as any);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;

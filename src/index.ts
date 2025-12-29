import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Health endpoints
import { Health } from "./endpoints/health";
import { Dashboard } from "./endpoints/dashboard";

// Stacks endpoints
import { GetBnsName } from "./endpoints/getBnsName";
import { ValidateStacksAddress } from "./endpoints/validateStacksAddress";
import { ConvertAddressToNetwork } from "./endpoints/convertAddressToNetwork";
import { DecodeClarityHex } from "./endpoints/decodeClarityHex";

// AI endpoints
import { DadJoke } from "./endpoints/dadJoke";
import { ImageDescribe } from "./endpoints/imageDescribe";
import { Tts } from "./endpoints/tts";
import { Summarize } from "./endpoints/summarize";
import { GenerateImage } from "./endpoints/generateImage";

// Random endpoints
import { RandomUuid } from "./endpoints/randomUuid";
import { RandomNumber } from "./endpoints/randomNumber";
import { RandomString } from "./endpoints/randomString";

// Text endpoints
import { TextBase64Encode } from "./endpoints/textBase64Encode";
import { TextBase64Decode } from "./endpoints/textBase64Decode";
import { TextSha256 } from "./endpoints/textSha256";
import { TextSha512 } from "./endpoints/textSha512";

// Utility endpoints
import { UtilTimestamp } from "./endpoints/utilTimestamp";

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

// Health endpoints (free)
openapi.get("/api/health", Health);
openapi.get("/dashboard", Dashboard);

// Stacks endpoints (paid)
openapi.get("/api/stacks/get-bns-name/:address", paymentMiddleware, trackMetrics, GetBnsName as any);
openapi.get(
  "/api/stacks/validate-address/:address",
  paymentMiddleware,
  trackMetrics,
  ValidateStacksAddress as any
);
openapi.get(
  "/api/stacks/convert-address/:address",
  paymentMiddleware,
  trackMetrics,
  ConvertAddressToNetwork as any
);
openapi.post(
  "/api/stacks/decode-clarity-hex",
  paymentMiddleware,
  trackMetrics,
  DecodeClarityHex as any
);

// AI endpoints (paid)
openapi.get("/api/ai/dad-joke", paymentMiddleware, trackMetrics, DadJoke as any);
openapi.post("/api/ai/image-describe", paymentMiddleware, trackMetrics, ImageDescribe as any);
openapi.post("/api/ai/tts", paymentMiddleware, trackMetrics, Tts as any);
openapi.post("/api/ai/summarize", paymentMiddleware, trackMetrics, Summarize as any);
openapi.post("/api/ai/generate-image", paymentMiddleware, trackMetrics, GenerateImage as any);

// Random endpoints (paid)
openapi.get("/api/random/uuid", paymentMiddleware, trackMetrics, RandomUuid as any);
openapi.get("/api/random/number", paymentMiddleware, trackMetrics, RandomNumber as any);
openapi.get("/api/random/string", paymentMiddleware, trackMetrics, RandomString as any);

// Text endpoints (paid)
openapi.post("/api/text/base64-encode", paymentMiddleware, trackMetrics, TextBase64Encode as any);
openapi.post("/api/text/base64-decode", paymentMiddleware, trackMetrics, TextBase64Decode as any);
openapi.post("/api/text/sha256", paymentMiddleware, trackMetrics, TextSha256 as any);
openapi.post("/api/text/sha512", paymentMiddleware, trackMetrics, TextSha512 as any);

// Utility endpoints (paid)
openapi.get("/api/util/timestamp", paymentMiddleware, trackMetrics, UtilTimestamp as any);

// Export the Hono app
export default app;

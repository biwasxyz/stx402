import { fromHono } from "chanfana";
import { Hono } from "hono";
import { Health } from "./endpoints/health";
import { GetBnsName } from "./endpoints/getBnsName";
import { ValidateStacksAddress } from "./endpoints/validateStacksAddress";
import { x402PaymentMiddleware } from "./middleware/x402-stacks";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/health", Health);

const paymentConfig = {
  amountStx: c.env.X402_PAYMENT_AMOUNT_STX,
  address: c.env.X402_SERVER_ADDRESS,
  network: c.env.X402_NETWORK as 'mainnet' | 'testnet',
  facilitatorUrl: c.env.X402_FACILITATOR_URL,
};

const paymentMiddleware = x402PaymentMiddleware(paymentConfig);

openapi.get("/api/get-bns-name/:address", paymentMiddleware, GetBnsName);
openapi.get("/api/validate-stacks-address/:address", paymentMiddleware, ValidateStacksAddress);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;

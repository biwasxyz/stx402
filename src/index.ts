import { fromHono } from "chanfana";
import { Hono } from "hono";
import type { Context } from "hono";
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

const paymentMiddleware = x402PaymentMiddleware();

type GetBnsNameHandler = (c: Context<{ Bindings: Env }, '/api/get-bns-name/:address'>) => Promise<Response>;
const handleGetBnsName: GetBnsNameHandler = (c) => new GetBnsName().handle(c);

type ValidateStacksAddressHandler = (c: Context<{ Bindings: Env }, '/api/validate-stacks-address/:address'>) => Promise<Response>;
const handleValidateStacksAddress: ValidateStacksAddressHandler = (c) => new ValidateStacksAddress().handle(c);

openapi.get("/api/get-bns-name/:address", paymentMiddleware, handleGetBnsName);
openapi.get(
  "/api/validate-stacks-address/:address",
  paymentMiddleware,
  handleValidateStacksAddress
);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export default app;

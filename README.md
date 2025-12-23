# STX402

Cloudflare Worker API for Stacks/BNS queries with [OpenAPI 3.1](https://github.com/cloudflare/chanfana) + [Hono](https://hono.dev). Paid endpoints require [X402 payment](https://x402.org) (~0.003 STX | 100 sats sBTC | 0.001 USDCx testnet). Supports `?tokenType=STX|sBTC|USDCx` (case-insensitive).

## Endpoints

OpenAPI docs: `GET /`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check *(free)* |
| `GET` | `/api/get-bns-name/:address` | Primary BNSv2 name for Stacks address *(paid)* |
| `GET` | `/api/validate-stacks-address/:address` | Validate Stacks address *(paid)* |

## Project Structure

```
.
├── src/
│   ├── endpoints/     # OpenAPIRoute classes
│   ├── middleware/    # X402 payment middleware
│   ├── utils/         # Helpers (bns.ts, wallet.ts, bigint.ts)
│   ├── types.ts       # Shared types/Zod schemas
│   └── index.ts       # Hono app + chanfana setup
├── tests/             # E2E tests for paid endpoints
├── wrangler.jsonc     # Config
├── package.json       # Dependencies
└── worker-configuration.d.ts  # Cloudflare types (read-only)
```

## Adding Endpoints

**1. Create `src/endpoints/NewEndpoint.ts`** (Hono + chanfana format):

```typescript
import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";

export class NewEndpoint extends OpenAPIRoute {
  schema = {
    summary: "New endpoint",
    parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
    responses: { "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { result: { type: "string" } } } } } }
  };

  async handle(c: AppContext) {
    const id = c.req.param("id");
    return c.json({ result: `Hello ${id}` });
  }
}
```

**2. Register in `src/index.ts`** (add middleware for paid endpoints):

```typescript
import { NewEndpoint } from "./endpoints/NewEndpoint";
// import { paymentMiddleware } from "../middleware/x402-stacks";

openapi.get("/api/new/:id", paymentMiddleware, NewEndpoint);
```

**3. Run `wrangler types` + `wrangler dev` to test.**

## Development

```bash
npm i
wrangler dev        # Local (with hot reload)
wrangler deploy     # Production
wrangler types      # Update Env types from bindings
```

## Tests

Manual E2E tests for paid endpoints (requires testnet mnemonic):

1. Copy `.env.example` → `.env`:
   ```
   cp .env.example .env
   ```

2. Edit `.env` and set `X402_CLIENT_PK="your mnemonic"`

3. Run:
   ```bash
   bun run tests/get-bns-address.test.ts
   bun run tests/validate-stacks-address.test.ts
   ```

## Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| [chanfana](https://github.com/cloudflare/chanfana) | OpenAPI 3.1 | ^2.6.3 |
| [hono](https://hono.dev) | Fast routing | ^4.6.20 |
| [@stacks/transactions](https://docs.stacks.co/stacks.js) | Stacks/BNS utils | ^7.3.1 |
| [@stacks/wallet-sdk](https://docs.stacks.co/stacks.js) | Wallet/account utils | ^7.2.0 |
| [x402-stacks](https://x402.org) | X402 payments (STX/sBTC) | ^1.0.2 |
| [zod](https://zod.dev) | Schema validation | ^3.24.1 |

Built with [Wrangler 4](https://developers.cloudflare.com/workers/wrangler/) (`npm i -D wrangler@^4.56.0`).

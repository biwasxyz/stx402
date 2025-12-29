# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

STX402 is a Cloudflare Workers API providing OpenAPI 3.1-documented endpoints for Stacks/BNS blockchain queries and AI-powered features. All paid endpoints require X402 micropayments (~0.003 STX | 100 sats sBTC | 0.001 USDCx).

## Commands

```bash
npm run dev          # Local development with hot reload (Wrangler)
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate Env types from wrangler bindings
```

### Running Tests

Tests are E2E integration tests run with Bun against a local dev server:

```bash
# Start dev server first
npm run dev

# In another terminal, run individual tests
bun run tests/get-bns-address.test.ts
bun run tests/validate-stacks-address.test.ts

# Run all tests
bun run tests/_run_all_tests.ts
```

Tests require `.env` with `X402_CLIENT_PK` (testnet mnemonic) for payment signing.

## Architecture

### Endpoint Pattern

All endpoints extend `BaseEndpoint` (which extends chanfana's `OpenAPIRoute`) and implement:
- `schema` object defining OpenAPI spec (tags, summary, parameters, responses)
- `async handle(c: AppContext)` method for request handling

```
src/endpoints/
├── BaseEndpoint.ts      # Shared methods: getTokenType(), validateAddress(), errorResponse()
├── health.ts            # Free endpoint (no payment required)
├── [Stacks]             # getBnsName, validateStacksAddress, convertAddressToNetwork, decodeClarityHex
├── [Games]              # deepThought, coinToss, dadJoke
├── [AI]                 # summarize, imageDescribe, tts, generateImage
└── [Betting]            # betCoinToss, betDice
```

### X402 Payment Flow

1. Request without `X-PAYMENT` header → 402 response with `X402PaymentRequired` object
2. Client signs payment using X402PaymentClient
3. Retry with `X-PAYMENT` header (+ optional `X-PAYMENT-TOKEN-TYPE`)
4. Server verifies via X402PaymentVerifier, settles payment
5. If valid, adds `X-PAYMENT-RESPONSE` header and continues to endpoint

Middleware location: `src/middleware/x402-stacks.ts`

### Adding a New Endpoint

1. Create `src/endpoints/NewEndpoint.ts` extending `BaseEndpoint`
2. Import and register in `src/index.ts`:
   ```typescript
   import { NewEndpoint } from "./endpoints/NewEndpoint";
   openapi.get("/api/new/:id", paymentMiddleware, NewEndpoint as any);
   ```
3. Run `npm run cf-typegen` if using new env bindings

### Utilities

- `utils/bns.ts` - BNS contract queries (get-primary function)
- `utils/clarity.ts` - Recursive Clarity value decoder
- `utils/pricing.ts` - Token conversion & payment amounts
- `utils/wallet.ts` - Account derivation from mnemonics
- `utils/addresses.ts` - Mainnet/testnet address conversion
- `utils/bigint.ts` - BigInt JSON serialization helper

## Key Dependencies

- **Hono** - HTTP routing framework for Workers
- **chanfana** - OpenAPI 3.1 documentation generator
- **@stacks/transactions** - Stacks blockchain utilities
- **x402-stacks** - X402 payment verification/signing
- **Zod** - Schema validation

## Environment Variables

Configured in `wrangler.jsonc`:
- `X402_NETWORK` - "mainnet" or "testnet"
- `X402_PK` - Server mnemonic (receives payments)
- `X402_SERVER_ADDRESS` - Payment recipient address
- `X402_FACILITATOR_URL` - X402 facilitator endpoint

## Token Types

API supports `?tokenType=STX|sBTC|USDCx` (case-insensitive):
- STX: microSTX (1 STX = 1,000,000 microSTX)
- sBTC: sats (1 BTC = 100,000,000 sats)
- USDCx: microUSDCx (testnet USDC)

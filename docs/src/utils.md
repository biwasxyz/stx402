---
title: utils
layout: default
parent: src
nav_order: 4
---

[← src](../src.md) | **utils**

# utils

> Shared utility functions for pricing, networking, Stacks integration, and common operations.

## Contents

| Item | Purpose |
|------|---------|
| [`pricing.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/pricing.ts) | Pricing tiers and endpoint-to-tier mapping |
| [`network.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/network.ts) | Network detection from address prefix |
| [`bns.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/bns.ts) | BNS contract queries (resolve names) |
| [`clarity.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/clarity.ts) | Clarity value decoder |
| [`namespace.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/namespace.ts) | KV key formatting, validation, limits |
| [`wallet.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/wallet.ts) | Wallet derivation from mnemonic |
| [`addresses.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/addresses.ts) | Address conversion utilities |
| [`hiro.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/hiro.ts) | Hiro API client for Stacks queries |
| [`logger.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/logger.ts) | Structured logging for Cloudflare Workers |
| [`erc8004.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/erc8004.ts) | ERC-8004 contract helpers, SIP-018 signing |
| [`registry.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/registry.ts) | Endpoint registry helpers |
| [`signatures.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/signatures.ts) | SIP-018 signature verification |
| [`payment.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/payment.ts) | Payment processing utilities |
| [`response.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/response.ts) | Response formatting helpers |
| [`bigint.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/bigint.ts) | BigInt serialization for JSON |
| [`hex-to-ascii.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/hex-to-ascii.ts) | Hex string to ASCII conversion |
| [`probe.ts`](https://github.com/whoabuddy/stx402/blob/master/src/utils/probe.ts) | Endpoint probing utilities |

## Key Utilities

### Pricing (`pricing.ts`)

```typescript
// Tier definitions
const PRICING_TIERS = {
  simple: { stx: 0.001 },
  ai: { stx: 0.003 },
  heavy_ai: { stx: 0.01 },
  storage_read: { stx: 0.0005 },
  storage_write: { stx: 0.001 },
};

// Endpoint to tier mapping
const ENDPOINT_TIERS = {
  "/api/stacks/bns-name/:address": "simple",
  "/api/ai/summarize": "ai",
  // ...
};
```

### Network Detection (`network.ts`)

```typescript
// Detect network from address prefix
getNetworkFromAddress("SP...") // → "mainnet"
getNetworkFromAddress("ST...") // → "testnet"
```

### BNS Queries (`bns.ts`)

```typescript
// Resolve BNS name for address
const name = await resolveBnsName(address, network);
// Returns: "satoshi.btc" or null
```

## Relationships

- **Consumed by**: All endpoints import utilities as needed
- **Depends on**: `@stacks/transactions`, `@stacks/network` for Stacks integration

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/utils) · Updated: 2025-01-07*

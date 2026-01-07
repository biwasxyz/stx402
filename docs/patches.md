---
title: patches
layout: default
nav_order: 5
---

[← Home](index.md) | **patches**

# patches

> Package patches applied via patch-package.

## Contents

| Item | Purpose |
|------|---------|
| [`x402-stacks+1.1.1.patch`](https://github.com/whoabuddy/stx402/blob/master/patches/x402-stacks%2B1.1.1.patch) | Fix token contract addresses |

## How Patches Work

Patches are applied automatically on `npm install` via the `postinstall` script:

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

## Current Patch: x402-stacks

Fixes outdated sBTC mainnet contract address in the x402-stacks library.

```diff
- sBTC: "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.sbtc-token"
+ sBTC: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
```

## Creating New Patches

```bash
# Edit file in node_modules
vim node_modules/package-name/file.js

# Create patch
npx patch-package package-name
```

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/patches) · Updated: 2025-01-07*

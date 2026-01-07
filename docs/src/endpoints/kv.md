---
title: kv
layout: default
parent: endpoints
grand_parent: src
nav_order: 3
---

[← endpoints](../endpoints.md) | **kv**

# kv

> Key-value storage endpoints using Cloudflare KV.

## Contents

| Item | Purpose |
|------|---------|
| `KvSet.ts` | Store a value |
| `KvGet.ts` | Retrieve a value |
| `KvDelete.ts` | Delete a key |
| `KvList.ts` | List keys with prefix |
| `types.ts` | Shared type definitions |

## API

### POST `/api/kv/set`
```json
{ "key": "settings", "value": { "theme": "dark" }, "expirationTtl": 3600 }
```

### GET `/api/kv/get?key=settings`
Returns the stored value.

### DELETE `/api/kv/delete?key=settings`

### GET `/api/kv/list?prefix=user:`
Returns list of keys matching prefix.

## Features

- **Namespaced**: Keys prefixed with payer address
- **JSON storage**: Values stored as JSON
- **TTL support**: Optional expiration
- **Size limits**: Per `src/utils/namespace.ts`

## Pricing

| Endpoint | Tier |
|----------|------|
| `get`, `list` | `storage_read` (0.0005 STX) |
| `set` (< 100KB) | `storage_write` (0.001 STX) |
| `set` (> 100KB) | `storage_write_large` (0.005 STX) |
| `delete` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `c.env.STORAGE` KV namespace
- **Uses**: `src/utils/namespace.ts` for key formatting

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/kv) · Updated: 2025-01-07*

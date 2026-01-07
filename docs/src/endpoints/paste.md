---
title: paste
layout: default
parent: endpoints
grand_parent: src
nav_order: 6
---

[← endpoints](../endpoints.md) | **paste**

# paste

> Text paste service with short codes.

## Contents

| Item | Purpose |
|------|---------|
| `PasteCreate.ts` | Create a paste |
| `PasteGet.ts` | Retrieve paste content |
| `PasteDelete.ts` | Delete a paste |
| `types.ts` | Shared type definitions |

## API

### POST `/api/paste/create`
```json
{ "content": "Hello, world!", "expirationTtl": 86400 }
```
Returns a short code for retrieval.

### GET `/api/paste/get?code=abc123`
Returns the paste content.

### DELETE `/api/paste/delete?code=abc123`

## Features

- **Auto-generated codes**: Short, unique identifiers
- **TTL support**: Optional expiration
- **Per-user namespace**: Pastes tied to payer address

## Pricing

| Endpoint | Tier |
|----------|------|
| `get` | `storage_read` (0.0005 STX) |
| `create` | `storage_write` (0.001 STX) |
| `delete` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `c.env.STORAGE` KV namespace

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/paste) · Updated: 2025-01-07*

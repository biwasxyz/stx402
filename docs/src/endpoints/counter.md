---
title: counter
layout: default
parent: endpoints
grand_parent: src
nav_order: 2
---

[← endpoints](../endpoints.md) | **counter**

# counter

> Atomic counter operations via Durable Objects.

## Contents

| Item | Purpose |
|------|---------|
| `CounterIncrement.ts` | Increment counter by amount |
| `CounterDecrement.ts` | Decrement counter by amount |
| `CounterGet.ts` | Get current counter value |
| `CounterReset.ts` | Reset counter to zero |
| `CounterList.ts` | List all counters |
| `CounterDelete.ts` | Delete a counter |
| `types.ts` | Shared type definitions |

## API

### POST `/api/counter/increment`
```json
{ "name": "page-views", "amount": 1, "min": 0, "max": 1000 }
```

### POST `/api/counter/decrement`
```json
{ "name": "inventory", "amount": 1, "min": 0 }
```

### GET `/api/counter/get?name=page-views`
Returns current value and metadata.

### POST `/api/counter/reset`
```json
{ "name": "page-views" }
```

### GET `/api/counter/list`
Returns all counters for the payer address.

### DELETE `/api/counter/delete?name=page-views`

## Features

- **Atomic operations**: No race conditions
- **Optional bounds**: Set min/max limits
- **Per-user isolation**: Each payer gets own counters
- **Persistent**: Stored in Durable Object SQLite

## Pricing

| Endpoint | Tier |
|----------|------|
| `get`, `list` | `storage_read` (0.0005 STX) |
| `increment`, `decrement`, `reset`, `delete` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/counter) · Updated: 2025-01-07*

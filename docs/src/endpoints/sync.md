---
title: sync
layout: default
parent: endpoints
grand_parent: src
nav_order: 9
---

[← endpoints](../endpoints.md) | **sync**

# sync

> Distributed locks with auto-expiration via Durable Objects.

## Contents

| Item | Purpose |
|------|---------|
| `SyncLock.ts` | Acquire a lock |
| `SyncUnlock.ts` | Release a lock |
| `SyncCheck.ts` | Check lock status |
| `SyncExtend.ts` | Extend lock TTL |
| `SyncList.ts` | List active locks |
| `types.ts` | Shared type definitions |

## API

### POST `/api/sync/lock`
```json
{ "name": "resource-1", "ttlMs": 30000, "token": "unique-token-123" }
```
Returns success/failure and lock details.

### POST `/api/sync/unlock`
```json
{ "name": "resource-1", "token": "unique-token-123" }
```
Token must match the one used to acquire.

### GET `/api/sync/check?name=resource-1`
Returns lock status, holder token, expiration.

### POST `/api/sync/extend`
```json
{ "name": "resource-1", "token": "unique-token-123", "ttlMs": 30000 }
```
Extend TTL if you hold the lock.

### GET `/api/sync/list`
Returns all active locks for the payer address.

## Features

- **Token-based**: Only lock holder can release/extend
- **Auto-expiration**: Locks released after TTL
- **Atomic operations**: No race conditions
- **Per-user namespace**: Locks scoped to payer address

## Use Cases

- Prevent concurrent job processing
- Resource access coordination
- Distributed mutex patterns

## Pricing

| Endpoint | Tier |
|----------|------|
| `check`, `list` | `storage_read` (0.0005 STX) |
| `lock`, `unlock`, `extend` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/sync) · Updated: 2025-01-07*

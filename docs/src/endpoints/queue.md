---
title: queue
layout: default
parent: endpoints
grand_parent: src
nav_order: 7
---

[← endpoints](../endpoints.md) | **queue**

# queue

> Job queue with priority and retries via Durable Objects.

## Contents

| Item | Purpose |
|------|---------|
| `QueuePush.ts` | Add job to queue |
| `QueuePop.ts` | Get next job |
| `QueueComplete.ts` | Mark job complete |
| `QueueFail.ts` | Mark job failed |
| `QueueStatus.ts` | Get queue status |
| `types.ts` | Shared type definitions |

## API

### POST `/api/queue/push`
```json
{ "queue": "emails", "payload": { "to": "user@example.com", "subject": "Hello" }, "priority": 10 }
```

### POST `/api/queue/pop`
```json
{ "queue": "emails" }
```
Returns the highest-priority pending job.

### POST `/api/queue/complete`
```json
{ "id": "job-123" }
```

### POST `/api/queue/fail`
```json
{ "id": "job-123", "error": "Connection timeout" }
```
Increments attempt count; job returns to queue if under max attempts.

### GET `/api/queue/status?queue=emails`
Returns pending, processing, completed, failed counts.

## Features

- **Priority ordering**: Higher priority processed first
- **Automatic retries**: Configurable max attempts
- **Status tracking**: pending → processing → completed/failed
- **Per-user isolation**: Each payer has own queues

## Pricing

| Endpoint | Tier |
|----------|------|
| `status` | `storage_read` (0.0005 STX) |
| `push`, `pop`, `complete`, `fail` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/queue) · Updated: 2025-01-07*

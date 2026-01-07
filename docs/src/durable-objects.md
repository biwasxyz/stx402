---
title: durable-objects
layout: default
parent: src
nav_order: 3
---

[← src](../src.md) | **durable-objects**

# durable-objects

> Per-user SQLite-backed Durable Objects for stateful endpoint operations.

## Contents

| Item | Purpose |
|------|---------|
| [`UserDurableObject.ts`](https://github.com/whoabuddy/stx402/blob/master/src/durable-objects/UserDurableObject.ts) | Per-user DO with counters, links, locks, queues, memories |

## Design Principles

Per Cloudflare best practices:

1. **SQLite over KV** - Use structured storage for relational data
2. **RPC methods** - Clean interface for endpoint handlers
3. **Lazy initialization** - Tables created on first use
4. **User isolation** - Each payer address gets own DO instance

## Schema

```sql
-- Atomic counters with optional bounds
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0,
  min_value INTEGER,
  max_value INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- URL shortener with click tracking
CREATE TABLE links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE link_clicks (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  clicked_at TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  country TEXT
);

-- Distributed locks with auto-expiration
CREATE TABLE locks (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  acquired_at TEXT NOT NULL
);

-- Job queue with priority and retries
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  queue_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TEXT NOT NULL
);

-- Agent memories with embeddings
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding TEXT,  -- JSON array of floats
  metadata TEXT,
  created_at TEXT NOT NULL
);
```

## RPC Methods

```typescript
// Counters
await do.increment(name, amount?, min?, max?);
await do.decrement(name, amount?, min?, max?);
await do.getCounter(name);
await do.resetCounter(name);
await do.listCounters();
await do.deleteCounter(name);

// Links
await do.createLink(slug, url, title?, expiresAt?);
await do.getLink(slug);
await do.recordClick(slug, referrer?, userAgent?, country?);
await do.getLinkStats(slug);
await do.deleteLink(slug);
await do.listLinks();

// Locks
await do.acquireLock(name, ttlMs, token);
await do.releaseLock(name, token);
await do.checkLock(name);
await do.extendLock(name, token, ttlMs);

// Queue
await do.pushJob(queue, payload, priority?);
await do.popJob(queue);
await do.completeJob(id);
await do.failJob(id, error);

// Memories (with embeddings)
await do.storeMemory(id, content, embedding?, metadata?);
await do.recallMemory(id);
await do.searchMemories(query, limit?);  // cosine similarity
await do.forgetMemory(id);
```

## Usage Pattern

```typescript
// Get DO stub for payer address
const id = c.env.USER_DO.idFromName(payerAddress);
const stub = c.env.USER_DO.get(id);

// Call RPC method
const result = await stub.increment("page-views", 1);
```

## Relationships

- **Consumed by**: All storage endpoints (`counter/`, `links/`, `sync/`, `queue/`, `memory/`, `sql/`)
- **Bound in**: `wrangler.jsonc` as `USER_DO` Durable Object binding

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/durable-objects) · Updated: 2025-01-07*

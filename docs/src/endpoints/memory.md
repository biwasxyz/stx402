---
title: memory
layout: default
parent: endpoints
grand_parent: src
nav_order: 5
---

[← endpoints](../endpoints.md) | **memory**

# memory

> Agent memory storage with semantic search via embeddings.

## Contents

| Item | Purpose |
|------|---------|
| `MemoryStore.ts` | Store memory with embedding |
| `MemoryRecall.ts` | Recall specific memory |
| `MemorySearch.ts` | Semantic similarity search |
| `MemoryList.ts` | List all memories |
| `MemoryForget.ts` | Delete a memory |
| `types.ts` | Shared type definitions |

## API

### POST `/api/memory/store`
```json
{ "id": "fact-1", "content": "The capital of France is Paris", "metadata": { "source": "geography" } }
```
Embedding is generated automatically via Cloudflare AI.

### GET `/api/memory/recall?id=fact-1`
Returns the stored memory and metadata.

### POST `/api/memory/search`
```json
{ "query": "What is the capital of France?", "limit": 5 }
```
Returns memories ranked by cosine similarity.

### GET `/api/memory/list`
Returns all memories for the payer address.

### DELETE `/api/memory/forget?id=fact-1`

## Features

- **Automatic embeddings**: Uses Cloudflare AI for vector generation
- **Semantic search**: Cosine similarity matching
- **Metadata support**: Attach arbitrary JSON to memories
- **Per-user isolation**: Each payer has own memory store

## Pricing

| Endpoint | Tier |
|----------|------|
| `recall`, `list` | `storage_read` (0.0005 STX) |
| `store`, `search` | `storage_ai` (0.003 STX) - includes embedding generation |
| `forget` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`
- **Uses**: `c.env.AI` for embedding generation

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/memory) · Updated: 2025-01-07*

---
title: sql
layout: default
parent: endpoints
grand_parent: src
nav_order: 8
---

[← endpoints](../endpoints.md) | **sql**

# sql

> Direct SQLite access via Durable Objects.

## Contents

| Item | Purpose |
|------|---------|
| `SqlQuery.ts` | Execute SELECT queries |
| `SqlExecute.ts` | Execute INSERT/UPDATE/DELETE |
| `SqlSchema.ts` | Get table schema |
| `types.ts` | Shared type definitions |

## API

### POST `/api/sql/query`
```json
{ "sql": "SELECT * FROM my_table WHERE status = ?", "params": ["active"] }
```
Read-only queries only.

### POST `/api/sql/execute`
```json
{ "sql": "INSERT INTO my_table (name, value) VALUES (?, ?)", "params": ["key1", "value1"] }
```
Returns affected row count.

### GET `/api/sql/schema`
Returns all table definitions in user's database.

## Features

- **Full SQLite**: Native SQL in Durable Objects
- **Parameterized queries**: Safe from SQL injection
- **Per-user database**: Complete isolation
- **Read/write separation**: Different endpoints for safety

## Security

- Queries run in isolated per-user Durable Object
- Cannot access other users' data
- DDL operations (CREATE TABLE) allowed via execute

## Pricing

| Endpoint | Tier |
|----------|------|
| `query`, `schema` | `storage_read` (0.0005 STX) |
| `execute` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/sql) · Updated: 2025-01-07*

---
title: links
layout: default
parent: endpoints
grand_parent: src
nav_order: 4
---

[← endpoints](../endpoints.md) | **links**

# links

> URL shortener with click tracking via Durable Objects.

## Contents

| Item | Purpose |
|------|---------|
| `LinksCreate.ts` | Create short link |
| `LinksExpand.ts` | Expand short link to URL |
| `LinksStats.ts` | Get click statistics |
| `LinksDelete.ts` | Delete a link |
| `LinksList.ts` | List all links |
| `types.ts` | Shared type definitions |

## API

### POST `/api/links/create`
```json
{ "url": "https://example.com/long-path", "slug": "my-link", "title": "Example", "expiresAt": "2025-12-31" }
```

### GET `/api/links/expand?slug=my-link`
Returns the original URL.

### GET `/api/links/stats?slug=my-link`
Returns click count, recent clicks, referrers.

### DELETE `/api/links/delete?slug=my-link`

### GET `/api/links/list`
Returns all links for the payer address.

## Features

- **Custom slugs**: Choose your short code
- **Click tracking**: Count, timestamps, referrers, user agents
- **Expiration**: Optional TTL for links
- **Per-user isolation**: Each payer has own link namespace

## Pricing

| Endpoint | Tier |
|----------|------|
| `expand`, `stats`, `list` | `storage_read` (0.0005 STX) |
| `create`, `delete` | `storage_write` (0.001 STX) |

## Relationships

- **Uses**: `src/durable-objects/UserDurableObject.ts`

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/links) · Updated: 2025-01-07*

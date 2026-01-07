---
title: components
layout: default
parent: src
nav_order: 5
---

[← src](../src.md) | **components**

# components

> Shared UI components for server-rendered HTML pages.

## Contents

| Item | Purpose |
|------|---------|
| [`nav.ts`](https://github.com/whoabuddy/stx402/blob/master/src/components/nav.ts) | Navigation bar HTML generator |

## Usage

Components return raw HTML strings for server-side rendering in Cloudflare Workers.

```typescript
import { generateNav } from "./components/nav";

// In endpoint handler
const navHtml = generateNav({ currentPage: "toolbox" });
return c.html(`
  <!DOCTYPE html>
  <html>
    <body>
      ${navHtml}
      <main>...</main>
    </body>
  </html>
`);
```

## Pages Using Components

- `/toolbox` - Interactive endpoint testing UI
- `/about` - Project information page
- `/guide` - Integration guide
- `/dashboard` - Usage metrics display

## Relationships

- **Consumed by**: HTML-rendering endpoints (`about.ts`, `guide.ts`, `toolbox.ts`, `dashboard.ts`)

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/components) · Updated: 2025-01-07*

---
title: tests
layout: default
nav_order: 3
---

[← Home](index.md) | **tests**

# tests

> End-to-end payment tests and endpoint validation.

## Contents

| Item | Purpose |
|------|---------|
| [`endpoint-registry.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/endpoint-registry.ts) | **Source of truth** for endpoint counts and test configs |
| [`_run_all_tests.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_run_all_tests.ts) | E2E payment test runner for all endpoints |
| [`_validate_endpoints.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_validate_endpoints.ts) | Validates registry stays in sync with index.ts |
| [`_shared_utils.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_shared_utils.ts) | Shared test utilities |
| [`_test_generator.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/_test_generator.ts) | Generate test boilerplate |
| [`admin-verify.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/admin-verify.ts) | Admin registry verification script |
| [`registry-manage.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/registry-manage.ts) | User endpoint management script |
| [`cleanup-registry.ts`](https://github.com/whoabuddy/stx402/blob/master/tests/cleanup-registry.ts) | Registry cleanup utilities |
| `*-lifecycle.test.ts` | Stateful endpoint lifecycle tests |
| `*.test.ts` | Individual endpoint tests |

## Running Tests

```bash
# Start dev server first
npm run dev

# Run all tests (requires .env with X402_CLIENT_PK testnet mnemonic)
bun run tests/_run_all_tests.ts

# Run individual test
bun run tests/kv-storage.test.ts

# Validate endpoint counts
bun run tests/_validate_endpoints.ts
```

## Registry Management

### User Endpoint Management

```bash
# List your registered endpoints
X402_CLIENT_PK="..." bun run tests/registry-manage.ts list

# Delete an endpoint you own
X402_CLIENT_PK="..." bun run tests/registry-manage.ts delete https://example.com/api/endpoint
```

### Admin Verification

```bash
# List pending endpoints
X402_PK="..." bun run tests/admin-verify.ts list

# Verify or reject
X402_PK="..." bun run tests/admin-verify.ts verify https://example.com/api/endpoint
```

## Test Structure

Each test config in `endpoint-registry.ts`:

```typescript
{
  path: "/api/text/sha256",
  method: "POST",
  body: { text: "hello" },
  validate: (res) => res.hash?.length === 64,
}
```

## Relationships

- **Validates against**: `src/index.ts` route registrations
- **Uses**: `x402-stacks` client for payment signing

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/tests) · Updated: 2025-01-07*

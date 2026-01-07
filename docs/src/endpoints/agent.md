---
title: agent
layout: default
parent: endpoints
grand_parent: src
nav_order: 1
---

[← endpoints](../endpoints.md) | **agent**

# agent

> ERC-8004 agent registry endpoints for identity, reputation, and validation.

## Contents

| Item | Purpose |
|------|---------|
| `AgentRegister.ts` | Register new agent identity |
| `AgentLookup.ts` | Look up agent by address |
| `AgentUpdate.ts` | Update agent metadata |
| `AgentVerify.ts` | Verify agent signature |
| `AgentRevoke.ts` | Revoke agent registration |
| `AgentList.ts` | List registered agents |
| `AgentReputation.ts` | Get agent reputation score |
| `AgentEndorse.ts` | Endorse an agent |
| `AgentReport.ts` | Report agent violation |
| `AgentChallenge.ts` | Challenge agent identity |
| `AgentResolve.ts` | Resolve challenge |
| `AgentDelegate.ts` | Delegate agent authority |
| `AgentRevokeDelegate.ts` | Revoke delegation |
| `AgentGetDelegates.ts` | List agent delegates |
| `AgentValidateCapability.ts` | Check agent capability |
| `AgentGetHistory.ts` | Get agent action history |
| `types.ts` | Shared type definitions |

## ERC-8004 Overview

Decentralized agent registry for AI agents and autonomous systems:

- **Identity**: On-chain agent registration with metadata
- **Reputation**: Trust scores based on endorsements and reports
- **Delegation**: Hierarchical authority delegation
- **Validation**: SIP-018 signed capability proofs

## Pricing

All agent endpoints use the `simple` tier (0.001 STX).

## Relationships

- **Uses**: `src/utils/erc8004.ts` for contract calls
- **Uses**: `src/utils/signatures.ts` for SIP-018 verification

---
*[View on GitHub](https://github.com/whoabuddy/stx402/tree/master/src/endpoints/agent) · Updated: 2025-01-07*

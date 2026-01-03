import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isOk,
  uint,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

/**
 * Lookup agents by scanning through sequential IDs
 * Note: This is a simple implementation that scans up to maxScan agents
 * A production implementation might use an indexer for better performance
 */
export class AgentLookup extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Lookup agents by owner address",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["owner"],
            properties: {
              owner: {
                type: "string" as const,
                description: "Owner principal to search for",
              },
              startId: {
                type: "number" as const,
                description: "Agent ID to start scanning from (default: 0)",
                default: 0,
              },
              maxScan: {
                type: "number" as const,
                description: "Maximum agents to scan (default: 100, max: 500)",
                default: 100,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["mainnet", "testnet"] as const,
          default: "testnet",
        },
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "List of agents owned by the address",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                owner: { type: "string" as const },
                agents: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      agentId: { type: "number" as const },
                      uri: { type: "string" as const },
                    },
                  },
                },
                count: { type: "number" as const },
                scanned: { type: "number" as const },
                hasMore: { type: "boolean" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "501": { description: "Network not supported" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = (c.req.query("network") || "testnet") as ERC8004Network;

    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }

    let body: { owner?: string; startId?: number; maxScan?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { owner, startId = 0, maxScan = 100 } = body;

    if (!owner) {
      return this.errorResponse(c, "owner principal is required", 400);
    }

    const effectiveMaxScan = Math.min(maxScan, 500);

    try {
      const agents: Array<{ agentId: number; uri: string | null }> = [];
      let scanned = 0;
      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 10;

      for (let id = startId; scanned < effectiveMaxScan; id++) {
        scanned++;

        try {
          const ownerResult = await callRegistryFunction(
            network,
            "identity",
            "owner-of",
            [uint(id)]
          );
          const ownerJson = clarityToJson(ownerResult);

          if (!isOk(ownerJson)) {
            // Agent doesn't exist
            consecutiveNotFound++;
            if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
              // Assume we've reached the end of registered agents
              break;
            }
            continue;
          }

          consecutiveNotFound = 0;
          const ownerValue = extractValue(ownerJson) as { value: string };

          if (ownerValue.value === owner) {
            // Found a match, get the URI too
            let uri: string | null = null;
            try {
              const uriResult = await callRegistryFunction(
                network,
                "identity",
                "get-uri",
                [uint(id)]
              );
              const uriJson = clarityToJson(uriResult);
              if (isOk(uriJson)) {
                const uriValue = extractValue(uriJson);
                if (
                  uriValue &&
                  typeof uriValue === "object" &&
                  "value" in uriValue
                ) {
                  uri = (uriValue as { value: string }).value || null;
                }
              }
            } catch {
              // URI fetch failed, continue without it
            }

            agents.push({ agentId: id, uri });
          }
        } catch {
          // Error fetching this agent, skip
          consecutiveNotFound++;
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
            break;
          }
        }
      }

      return c.json({
        owner,
        agents,
        count: agents.length,
        scanned,
        startId,
        hasMore: scanned >= effectiveMaxScan,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to lookup agents: ${String(error)}`,
        400
      );
    }
  }
}

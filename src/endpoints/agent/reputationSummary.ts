import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  uint,
  principal,
  buffer,
  list,
  none,
  some,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ReputationSummary extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get reputation summary (count, average, total score)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["agentId"],
            properties: {
              agentId: {
                type: "number" as const,
                description: "Agent ID",
              },
              filterByClients: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Optional: filter by specific client principals",
              },
              filterByTag1: {
                type: "string" as const,
                description: "Optional: filter by tag1 (hex, 32 bytes)",
              },
              filterByTag2: {
                type: "string" as const,
                description: "Optional: filter by tag2 (hex, 32 bytes)",
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
        description: "Reputation summary",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                count: { type: "number" as const },
                averageScore: { type: "number" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Agent not found" },
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

    let body: {
      agentId?: number;
      filterByClients?: string[];
      filterByTag1?: string;
      filterByTag2?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId, filterByClients, filterByTag1, filterByTag2 } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }

    try {
      // Build function arguments
      // get-summary(agent-id, opt-clients, opt-tag1, opt-tag2)
      const args = [
        uint(agentId),
        filterByClients && filterByClients.length > 0
          ? some(list(filterByClients.map((p) => principal(p))))
          : none(),
        filterByTag1 ? some(buffer(filterByTag1)) : none(),
        filterByTag2 ? some(buffer(filterByTag2)) : none(),
      ];

      const result = await callRegistryFunction(
        network,
        "reputation",
        "get-summary",
        args
      );
      const json = clarityToJson(result);

      // get-summary returns a tuple directly: { count, average-score }
      // cvToJSON structure: { type: "tuple", value: { count: { type: "uint", value: "0" }, ... } }
      const tuple = json as {
        type: string;
        value: {
          count: { type: string; value: string };
          "average-score": { type: string; value: string };
        };
      };

      if (tuple.type !== "tuple" || !tuple.value) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const count = parseInt(tuple.value.count.value, 10);
      const averageScore = parseInt(tuple.value["average-score"].value, 10);

      return c.json({
        agentId,
        count,
        averageScore,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch reputation summary: ${String(error)}`,
        400
      );
    }
  }
}

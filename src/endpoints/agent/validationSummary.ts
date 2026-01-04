import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  isTuple,
  uint,
  principal,
  buffer,
  list,
  none,
  some,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ValidationSummary extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get validation summary for agent",
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
              filterByValidators: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Optional: filter by specific validator principals",
              },
              filterByTag: {
                type: "string" as const,
                description: "Optional: filter by tag (hex, 32 bytes)",
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
        description: "Validation summary",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                count: { type: "number" as const },
                averageResponse: { type: "number" as const },
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
      filterByValidators?: string[];
      filterByTag?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId, filterByValidators, filterByTag } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }

    try {
      // get-summary(agent-id, opt-validators, opt-tag)
      const args = [
        uint(agentId),
        filterByValidators && filterByValidators.length > 0
          ? some(list(filterByValidators.map((p) => principal(p))))
          : none(),
        filterByTag ? some(buffer(filterByTag)) : none(),
      ];

      const result = await callRegistryFunction(
        network,
        "validation",
        "get-summary",
        args
      );
      const json = clarityToJson(result);

      // get-summary returns a tuple directly: { count, avg-response }
      // cvToJSON structure: { type: "(tuple ...)", value: { ... } }
      if (!isTuple(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const tuple = json as {
        type: string;
        value: {
          count: { type: string; value: string };
          "avg-response": { type: string; value: string };
        };
      };

      const count = parseInt(tuple.value.count.value, 10);
      const averageResponse = parseInt(tuple.value["avg-response"].value, 10);

      return c.json({
        agentId,
        count,
        averageResponse,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validation summary: ${String(error)}`,
        400
      );
    }
  }
}

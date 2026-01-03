import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isOk,
  getErrorCode,
  getErrorMessage,
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
                averageScore: { type: "number" as const },
                totalScore: { type: "number" as const },
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

      if (!isOk(json)) {
        const errorCode = getErrorCode(json);
        if (errorCode === 2001) {
          return this.errorResponse(c, "Agent not found", 404, { agentId });
        }
        return this.errorResponse(c, getErrorMessage(errorCode || 0), 400);
      }

      const summary = extractValue(json) as {
        value: {
          count: { value: string };
          "average-score": { value: string };
          "total-score": { value: string };
        };
      };

      return c.json({
        agentId,
        count: parseInt(summary.value.count.value, 10),
        averageScore: parseInt(summary.value["average-score"].value, 10),
        totalScore: parseInt(summary.value["total-score"].value, 10),
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

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
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ValidationList extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) List all validation request hashes for agent",
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
        description: "List of validation request hashes",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                validations: {
                  type: "array" as const,
                  items: { type: "string" as const },
                  description: "Request hashes (hex)",
                },
                count: { type: "number" as const },
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

    let body: { agentId?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }

    try {
      const result = await callRegistryFunction(
        network,
        "validation",
        "get-agent-validations",
        [uint(agentId)]
      );
      const json = clarityToJson(result);

      if (!isOk(json)) {
        const errorCode = getErrorCode(json);
        if (errorCode === 2001) {
          return this.errorResponse(c, "Agent not found", 404, { agentId });
        }
        return this.errorResponse(c, getErrorMessage(errorCode || 0), 400);
      }

      const validationsList = extractValue(json) as {
        value: Array<{ value: string }>;
      };

      const validations = validationsList.value.map((item) => item.value);

      return c.json({
        agentId,
        validations,
        count: validations.length,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch agent validations: ${String(error)}`,
        400
      );
    }
  }
}

import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  extractTypedValue,
  isSome,
  isNone,
  uint,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class AgentOwner extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get agent owner by ID",
    parameters: [
      {
        name: "agentId",
        in: "query" as const,
        required: true,
        schema: { type: "number" as const },
        description: "Agent ID",
      },
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
        description: "Agent owner",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                owner: { type: "string" as const },
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
    const agentIdStr = c.req.query("agentId");

    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }

    if (!agentIdStr) {
      return this.errorResponse(c, "agentId query parameter is required", 400);
    }

    const agentId = parseInt(agentIdStr, 10);
    if (isNaN(agentId) || agentId < 0) {
      return this.errorResponse(c, "agentId must be a non-negative number", 400);
    }

    try {
      // owner-of returns (optional principal)
      const result = await callRegistryFunction(
        network,
        "identity",
        "owner-of",
        [uint(agentId)]
      );
      const json = clarityToJson(result);

      if (isNone(json)) {
        return this.errorResponse(c, "Agent not found", 404, { agentId });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      const ownerValue = extractValue(json);
      const owner = extractTypedValue(ownerValue) as string;

      return c.json({
        agentId,
        owner,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Failed to fetch owner: ${String(error)}`, 400);
    }
  }
}

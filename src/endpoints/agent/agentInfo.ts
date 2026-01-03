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

export class AgentInfo extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get full agent info (owner, URI)",
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
                description: "Agent ID (sequential, starting from 0)",
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
        description: "Stacks network to query",
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
        description: "Agent info",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                owner: { type: "string" as const },
                uri: { type: "string" as const },
                network: { type: "string" as const },
                contractId: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Agent not found" },
      "501": { description: "Network not supported (mainnet not yet deployed)" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = (c.req.query("network") || "testnet") as ERC8004Network;

    // Check if mainnet is deployed
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
      // Fetch owner
      const ownerResult = await callRegistryFunction(
        network,
        "identity",
        "owner-of",
        [uint(agentId)]
      );
      const ownerJson = clarityToJson(ownerResult);

      if (!isOk(ownerJson)) {
        const errorCode = getErrorCode(ownerJson);
        if (errorCode === 1001) {
          return this.errorResponse(c, "Agent not found", 404, { agentId });
        }
        return this.errorResponse(
          c,
          getErrorMessage(errorCode || 0),
          400,
          { errorCode }
        );
      }

      const owner = extractValue(ownerJson) as { value: string };

      // Fetch URI
      const uriResult = await callRegistryFunction(
        network,
        "identity",
        "get-uri",
        [uint(agentId)]
      );
      const uriJson = clarityToJson(uriResult);
      let uri: string | null = null;
      if (isOk(uriJson)) {
        const uriValue = extractValue(uriJson);
        if (uriValue && typeof uriValue === "object" && "value" in uriValue) {
          uri = (uriValue as { value: string }).value;
        }
      }

      const contracts = ERC8004_CONTRACTS[network]!;

      return c.json({
        agentId,
        owner: owner.value,
        uri,
        network,
        contractId: contracts.identity,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch agent info: ${String(error)}`,
        400
      );
    }
  }
}

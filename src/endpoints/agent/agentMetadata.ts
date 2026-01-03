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
  stringUtf8,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class AgentMetadata extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get specific metadata key for agent",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["agentId", "key"],
            properties: {
              agentId: {
                type: "number" as const,
                description: "Agent ID",
              },
              key: {
                type: "string" as const,
                description: "Metadata key (max 128 UTF-8 chars)",
                maxLength: 128,
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
        description: "Metadata value",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                key: { type: "string" as const },
                value: { type: "string" as const },
                valueHex: { type: "string" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Agent or key not found" },
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

    let body: { agentId?: number; key?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId, key } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }
    if (!key || key.length > 128) {
      return this.errorResponse(
        c,
        "key is required and must be <= 128 characters",
        400
      );
    }

    try {
      const result = await callRegistryFunction(
        network,
        "identity",
        "get-metadata",
        [uint(agentId), stringUtf8(key)]
      );
      const json = clarityToJson(result);

      if (!isOk(json)) {
        const errorCode = getErrorCode(json);
        if (errorCode === 1001) {
          return this.errorResponse(c, "Agent not found", 404, { agentId });
        }
        return this.errorResponse(c, getErrorMessage(errorCode || 0), 400);
      }

      const valueWrapper = extractValue(json);

      // Handle optional (none) response
      if (
        !valueWrapper ||
        (typeof valueWrapper === "object" &&
          "type" in valueWrapper &&
          (valueWrapper as { type: string }).type === "none")
      ) {
        return this.errorResponse(c, "Metadata key not found", 404, {
          agentId,
          key,
        });
      }

      // Extract the actual buffer value
      let valueHex = "";
      if (
        typeof valueWrapper === "object" &&
        "value" in valueWrapper &&
        valueWrapper.value
      ) {
        const inner = valueWrapper.value as { value?: string };
        valueHex = inner.value || "";
      }

      // Try to decode as UTF-8 text
      let valueText = "";
      try {
        const cleanHex = valueHex.startsWith("0x") ? valueHex.slice(2) : valueHex;
        const bytes = new Uint8Array(
          cleanHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
        );
        valueText = new TextDecoder().decode(bytes);
      } catch {
        valueText = valueHex;
      }

      return c.json({
        agentId,
        key,
        value: valueText,
        valueHex,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch metadata: ${String(error)}`,
        400
      );
    }
  }
}

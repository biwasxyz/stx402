import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isSome,
  isNone,
  buffer,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ValidationStatus extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get validation status by request hash",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["requestHash"],
            properties: {
              requestHash: {
                type: "string" as const,
                description: "Validation request hash (hex, 32 bytes)",
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
        description: "Validation status",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                requestHash: { type: "string" as const },
                validator: { type: "string" as const },
                agentId: { type: "number" as const },
                score: { type: "number" as const },
                responseHash: { type: "string" as const },
                tag: { type: "string" as const },
                lastUpdate: { type: "number" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Validation not found" },
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

    let body: { requestHash?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { requestHash } = body;
    if (!requestHash) {
      return this.errorResponse(c, "requestHash is required", 400);
    }

    // Validate hex format (32 bytes = 64 hex chars)
    const cleanHash = requestHash.startsWith("0x")
      ? requestHash.slice(2)
      : requestHash;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanHash)) {
      return this.errorResponse(
        c,
        "requestHash must be 32 bytes (64 hex characters)",
        400
      );
    }

    try {
      // get-validation-status returns (optional tuple)
      const result = await callRegistryFunction(
        network,
        "validation",
        "get-validation-status",
        [buffer(cleanHash)]
      );
      const json = clarityToJson(result);

      if (isNone(json)) {
        return this.errorResponse(c, "Validation not found", 404, {
          requestHash,
        });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract tuple from some
      const tupleValue = extractValue(json) as {
        type: string;
        value: {
          validator: { type: string; value: string };
          "agent-id": { type: string; value: string };
          response: { type: string; value: string };
          "response-hash": { type: string; value: string };
          tag: { type: string; value: string };
          "last-update": { type: string; value: string };
        };
      };

      return c.json({
        requestHash: `0x${cleanHash}`,
        validator: tupleValue.value.validator.value,
        agentId: parseInt(tupleValue.value["agent-id"].value, 10),
        score: parseInt(tupleValue.value.response.value, 10),
        responseHash: tupleValue.value["response-hash"].value,
        tag: tupleValue.value.tag.value,
        lastUpdate: parseInt(tupleValue.value["last-update"].value, 10),
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validation status: ${String(error)}`,
        400
      );
    }
  }
}

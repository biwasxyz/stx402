import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isSome,
  isNone,
  uint,
  principal,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ReputationFeedback extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get specific feedback entry",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["agentId", "client", "index"],
            properties: {
              agentId: {
                type: "number" as const,
                description: "Agent ID",
              },
              client: {
                type: "string" as const,
                description: "Client principal who gave feedback",
              },
              index: {
                type: "number" as const,
                description: "Feedback index (0-based)",
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
        description: "Feedback entry",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                agentId: { type: "number" as const },
                client: { type: "string" as const },
                index: { type: "number" as const },
                score: { type: "number" as const },
                tag1: { type: "string" as const },
                tag2: { type: "string" as const },
                isRevoked: { type: "boolean" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "404": { description: "Feedback not found" },
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

    let body: { agentId?: number; client?: string; index?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId, client, index } = body;
    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }
    if (!client) {
      return this.errorResponse(c, "client principal is required", 400);
    }
    if (index === undefined || index < 0) {
      return this.errorResponse(c, "index is required and must be >= 0", 400);
    }

    try {
      // read-feedback returns (optional tuple)
      const result = await callRegistryFunction(
        network,
        "reputation",
        "read-feedback",
        [uint(agentId), principal(client), uint(index)]
      );
      const json = clarityToJson(result);

      if (isNone(json)) {
        return this.errorResponse(c, "Feedback not found", 404, {
          agentId,
          client,
          index,
        });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract tuple: { type: "tuple", value: { score: {}, tag1: {}, ... } }
      const tupleValue = extractValue(json) as {
        type: string;
        value: {
          score: { type: string; value: string };
          tag1: { type: string; value: string };
          tag2: { type: string; value: string };
          "is-revoked": { type: string; value: boolean };
        };
      };

      return c.json({
        agentId,
        client,
        index,
        score: parseInt(tupleValue.value.score.value, 10),
        tag1: tupleValue.value.tag1.value,
        tag2: tupleValue.value.tag2.value,
        isRevoked: tupleValue.value["is-revoked"].value,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch feedback: ${String(error)}`,
        400
      );
    }
  }
}

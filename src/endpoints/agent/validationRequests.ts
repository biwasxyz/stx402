import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractValue,
  isSome,
  isNone,
  principal,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ValidationRequests extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) List all validation requests assigned to a validator",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["validator"],
            properties: {
              validator: {
                type: "string" as const,
                description: "Validator principal address",
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
                validator: { type: "string" as const },
                requests: {
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

    let body: { validator?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { validator } = body;
    if (!validator) {
      return this.errorResponse(c, "validator principal is required", 400);
    }

    try {
      // get-validator-requests returns (optional (list buffer))
      const result = await callRegistryFunction(
        network,
        "validation",
        "get-validator-requests",
        [principal(validator)]
      );
      const json = clarityToJson(result);

      // none means no requests for this validator
      if (isNone(json)) {
        return c.json({
          validator,
          requests: [],
          count: 0,
          network,
          tokenType,
        });
      }

      if (!isSome(json)) {
        return this.errorResponse(c, "Unexpected response format", 400);
      }

      // Extract list from some
      const listValue = extractValue(json) as {
        type: string;
        value: Array<{ type: string; value: string }>;
      };

      const requests = listValue.value.map((item) => item.value);

      return c.json({
        validator,
        requests,
        count: requests.length,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch validator requests: ${String(error)}`,
        400
      );
    }
  }
}

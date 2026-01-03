import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  callRegistryFunction,
  clarityToJson,
  extractTypedValue,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class AgentVersion extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Get identity registry version",
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
        description: "Registry version",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                version: { type: "string" as const },
                registry: { type: "string" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Failed to fetch version" },
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

    try {
      // get-version returns (string-utf8 5) directly, not wrapped in (ok ...)
      const result = await callRegistryFunction(
        network,
        "identity",
        "get-version",
        []
      );
      const json = clarityToJson(result);

      // Result is { type: "string-utf8", value: "1.0.0" }
      const version = extractTypedValue(json) as string;
      const contracts = ERC8004_CONTRACTS[network]!;

      return c.json({
        version,
        registry: "identity",
        contractId: contracts.identity,
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to fetch version: ${String(error)}`,
        400
      );
    }
  }
}

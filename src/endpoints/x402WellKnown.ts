/**
 * X402 Schema Endpoint
 *
 * Serves /x402.json for StacksX402 scanner discovery.
 * Dynamically generates the schema from OpenAPI spec and pricing tiers.
 */

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";
import {
  generateX402SchemaFromUrl,
  type GeneratorConfig,
} from "../utils/x402-schema";

export class X402WellKnown extends BaseEndpoint {
  schema = {
    tags: ["Discovery"],
    summary: "X402 service discovery schema",
    description:
      "Returns the x402.json schema for StacksX402 scanner discovery. " +
      "Lists all paid endpoints with their pricing and input/output schemas.",
    responses: {
      "200": {
        description: "X402 discovery schema",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                x402Version: {
                  type: "number" as const,
                  description: "X402 schema version",
                },
                name: {
                  type: "string" as const,
                  description: "Service name",
                },
                image: {
                  type: "string" as const,
                  description: "Service logo URL",
                },
                accepts: {
                  type: "array" as const,
                  description: "List of paid endpoints with payment details",
                  items: {
                    type: "object" as const,
                    properties: {
                      scheme: { type: "string" as const },
                      network: { type: "string" as const },
                      asset: { type: "string" as const },
                      payTo: { type: "string" as const },
                      maxAmountRequired: { type: "string" as const },
                      maxTimeoutSeconds: { type: "number" as const },
                      resource: { type: "string" as const },
                      description: { type: "string" as const },
                      mimeType: { type: "string" as const },
                      outputSchema: { type: "object" as const },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "500": {
        description: "Server error",
      },
    },
  };

  async handle(c: AppContext) {
    try {
      // Determine base URL from request or use default
      const url = new URL(c.req.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Canonical URL for production (always https)
      const isLocalhost = url.host.includes("localhost") || url.host.includes("127.0.0.1");
      const canonicalUrl = isLocalhost ? baseUrl : `https://${url.host}`;

      // Get config from environment
      const config: Partial<GeneratorConfig> = {
        network: (c.env.X402_NETWORK as "mainnet" | "testnet") || "mainnet",
        payTo: c.env.X402_SERVER_ADDRESS,
        name: "stx402 Directory",
        image: `${canonicalUrl}/favicon.svg`,
      };

      // Generate schema by fetching our own OpenAPI spec
      const schema = await generateX402SchemaFromUrl(baseUrl, config);

      return c.json(schema);
    } catch (error) {
      c.var.logger.error("Failed to generate x402 schema", {
        error: String(error),
      });
      return c.json(
        { error: "Failed to generate x402 schema" },
        500
      );
    }
  }
}

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilTimestamp extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Get current timestamp in multiple formats",
    parameters: [
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
        description: "Current timestamp",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                unix: { type: "integer" as const, description: "Unix timestamp (seconds)" },
                unixMs: { type: "integer" as const, description: "Unix timestamp (milliseconds)" },
                iso: { type: "string" as const, description: "ISO 8601 format" },
                utc: { type: "string" as const, description: "UTC string" },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const now = new Date();

    return c.json({
      unix: Math.floor(now.getTime() / 1000),
      unixMs: now.getTime(),
      iso: now.toISOString(),
      utc: now.toUTCString(),
      tokenType,
    });
  }
}

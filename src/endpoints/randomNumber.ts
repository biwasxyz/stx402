import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomNumber extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Generate a cryptographically secure random number",
    parameters: [
      {
        name: "min",
        in: "query" as const,
        required: false,
        schema: {
          type: "integer" as const,
          default: 0,
        },
        description: "Minimum value (inclusive)",
      },
      {
        name: "max",
        in: "query" as const,
        required: false,
        schema: {
          type: "integer" as const,
          default: 100,
        },
        description: "Maximum value (inclusive)",
      },
      {
        name: "count",
        in: "query" as const,
        required: false,
        schema: {
          type: "integer" as const,
          default: 1,
          minimum: 1,
          maximum: 100,
        },
        description: "Number of random values to generate (1-100)",
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
        description: "Generated random number(s)",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                numbers: {
                  type: "array" as const,
                  items: { type: "integer" as const },
                },
                min: { type: "integer" as const },
                max: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid parameters",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const min = parseInt(c.req.query("min") || "0", 10);
    const max = parseInt(c.req.query("max") || "100", 10);
    const count = Math.min(100, Math.max(1, parseInt(c.req.query("count") || "1", 10)));

    if (min > max) {
      return this.errorResponse(c, "min must be less than or equal to max", 400);
    }

    const range = max - min + 1;
    const numbers: number[] = [];

    // Use crypto.getRandomValues for secure randomness
    const randomBytes = new Uint32Array(count);
    crypto.getRandomValues(randomBytes);

    for (let i = 0; i < count; i++) {
      // Scale the random value to our range
      numbers.push(min + (randomBytes[i] % range));
    }

    return c.json({ numbers, min, max, tokenType });
  }
}

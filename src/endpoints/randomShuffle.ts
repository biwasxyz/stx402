import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomShuffle extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Randomly shuffle an array",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["items"],
            properties: {
              items: {
                type: "array" as const,
                description: "Array of items to shuffle",
                minItems: 1,
                maxItems: 1000,
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Shuffled array",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                shuffled: { type: "array" as const },
                count: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { items?: unknown[] };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return this.errorResponse(c, "items must be a non-empty array", 400);
    }

    if (items.length > 1000) {
      return this.errorResponse(c, "items array cannot exceed 1000 elements", 400);
    }

    // Fisher-Yates shuffle with crypto random
    const shuffled = [...items];
    const randomBytes = new Uint32Array(shuffled.length);
    crypto.getRandomValues(randomBytes);

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomBytes[i] % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return c.json({
      shuffled,
      count: shuffled.length,
      tokenType,
    });
  }
}

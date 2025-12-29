import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomUuid extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Generate a cryptographically secure UUID v4",
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
        description: "Generated UUID",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                uuid: { type: "string" as const },
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
    const uuid = crypto.randomUUID();
    return c.json({ uuid, tokenType });
  }
}

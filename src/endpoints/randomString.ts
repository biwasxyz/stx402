import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

const CHARSETS = {
  alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  numeric: "0123456789",
  hex: "0123456789abcdef",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  all: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?",
} as const;

type CharsetName = keyof typeof CHARSETS;

export class RandomString extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Generate a cryptographically secure random string",
    parameters: [
      {
        name: "length",
        in: "query" as const,
        required: false,
        schema: {
          type: "integer" as const,
          default: 16,
          minimum: 1,
          maximum: 256,
        },
        description: "Length of the string (1-256)",
      },
      {
        name: "charset",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["alphanumeric", "alpha", "numeric", "hex", "lowercase", "uppercase", "symbols", "all"] as const,
          default: "alphanumeric",
        },
        description: "Character set to use",
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
        description: "Generated random string",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                string: { type: "string" as const },
                length: { type: "integer" as const },
                charset: { type: "string" as const },
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
    const length = Math.min(256, Math.max(1, parseInt(c.req.query("length") || "16", 10)));
    const charsetName = (c.req.query("charset") || "alphanumeric") as CharsetName;

    if (!(charsetName in CHARSETS)) {
      return this.errorResponse(c, `Invalid charset. Valid options: ${Object.keys(CHARSETS).join(", ")}`, 400);
    }

    const charset = CHARSETS[charsetName];

    // Use crypto.getRandomValues for secure randomness
    const randomBytes = new Uint32Array(length);
    crypto.getRandomValues(randomBytes);

    let result = "";
    for (let i = 0; i < length; i++) {
      result += charset[randomBytes[i] % charset.length];
    }

    return c.json({
      string: result,
      length,
      charset: charsetName,
      tokenType,
    });
  }
}

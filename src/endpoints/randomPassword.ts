import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomPassword extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Generate a secure random password",
    parameters: [
      {
        name: "length",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 16, minimum: 4, maximum: 128 },
        description: "Password length",
      },
      {
        name: "uppercase",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: true },
        description: "Include uppercase letters",
      },
      {
        name: "lowercase",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: true },
        description: "Include lowercase letters",
      },
      {
        name: "numbers",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: true },
        description: "Include numbers",
      },
      {
        name: "symbols",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: true },
        description: "Include symbols",
      },
      {
        name: "excludeAmbiguous",
        in: "query" as const,
        required: false,
        schema: { type: "boolean" as const, default: false },
        description: "Exclude ambiguous characters (0, O, l, 1, I)",
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["STX", "sBTC", "USDCx"] as const, default: "STX" },
      },
    ],
    responses: {
      "200": {
        description: "Generated password",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                password: { type: "string" as const },
                length: { type: "integer" as const },
                entropy: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const length = parseInt(c.req.query("length") || "16", 10);
    const uppercase = c.req.query("uppercase") !== "false";
    const lowercase = c.req.query("lowercase") !== "false";
    const numbers = c.req.query("numbers") !== "false";
    const symbols = c.req.query("symbols") !== "false";
    const excludeAmbiguous = c.req.query("excludeAmbiguous") === "true";

    if (length < 4 || length > 128) {
      return this.errorResponse(c, "length must be between 4 and 128", 400);
    }

    if (!uppercase && !lowercase && !numbers && !symbols) {
      return this.errorResponse(c, "At least one character type must be enabled", 400);
    }

    // Build character set
    let charset = "";
    if (uppercase) charset += excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (lowercase) charset += excludeAmbiguous ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
    if (numbers) charset += excludeAmbiguous ? "23456789" : "0123456789";
    if (symbols) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    // Generate password using crypto
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);

    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }

    // Calculate entropy
    const entropy = Math.round(length * Math.log2(charset.length) * 100) / 100;

    return c.json({
      password,
      length,
      entropy,
      charsetSize: charset.length,
      tokenType,
    });
  }
}

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextBase64Encode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Encode text to base64 (UTF-8 safe)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: {
                type: "string" as const,
                description: "Text to encode",
              },
              urlSafe: {
                type: "boolean" as const,
                default: false,
                description: "Use URL-safe base64 (- and _ instead of + and /, no padding)",
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
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "Base64 encoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                encoded: { type: "string" as const },
                urlSafe: { type: "boolean" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string; urlSafe?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, urlSafe = false } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    // Encode to UTF-8 bytes, then to base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    // Convert bytes to base64
    let encoded = btoa(String.fromCharCode(...bytes));

    // Convert to URL-safe if requested
    if (urlSafe) {
      encoded = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    return c.json({
      encoded,
      urlSafe,
      inputLength: text.length,
      outputLength: encoded.length,
      tokenType,
    });
  }
}

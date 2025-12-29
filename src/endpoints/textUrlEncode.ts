import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextUrlEncode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) URL encode text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "Text to URL encode" },
              encodeAll: {
                type: "boolean" as const,
                default: false,
                description: "Encode all characters (not just special ones)",
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
        description: "URL encoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                encoded: { type: "string" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
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

    let body: { text?: string; encodeAll?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, encodeAll = false } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    const encoded = encodeAll
      ? encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
      : encodeURIComponent(text);

    return c.json({
      encoded,
      inputLength: text.length,
      outputLength: encoded.length,
      tokenType,
    });
  }
}

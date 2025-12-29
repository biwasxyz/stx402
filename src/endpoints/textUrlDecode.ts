import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextUrlDecode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) URL decode text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["text"],
            properties: {
              text: { type: "string" as const, description: "URL encoded text to decode" },
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
        description: "Decoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                decoded: { type: "string" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input or malformed encoding" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { text?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    try {
      const decoded = decodeURIComponent(text);
      return c.json({
        decoded,
        inputLength: text.length,
        outputLength: decoded.length,
        tokenType,
      });
    } catch {
      return this.errorResponse(c, "Invalid URL encoding", 400);
    }
  }
}

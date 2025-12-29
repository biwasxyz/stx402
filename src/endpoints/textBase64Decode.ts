import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextBase64Decode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Decode base64 to text (UTF-8 safe)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["encoded"],
            properties: {
              encoded: {
                type: "string" as const,
                description: "Base64 encoded string",
              },
              urlSafe: {
                type: "boolean" as const,
                default: false,
                description: "Input uses URL-safe base64 encoding",
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
        description: "Decoded text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                decoded: { type: "string" as const },
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
        description: "Invalid input or malformed base64",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { encoded?: string; urlSafe?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { encoded, urlSafe = false } = body;

    if (typeof encoded !== "string") {
      return this.errorResponse(c, "encoded field is required and must be a string", 400);
    }

    try {
      // Convert from URL-safe if needed
      let base64 = encoded;
      if (urlSafe) {
        base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if needed
        while (base64.length % 4 !== 0) {
          base64 += "=";
        }
      }

      // Decode base64 to bytes
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode UTF-8 bytes to string
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const decoded = decoder.decode(bytes);

      return c.json({
        decoded,
        urlSafe,
        inputLength: encoded.length,
        outputLength: decoded.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to decode base64: ${error instanceof Error ? error.message : "Invalid encoding"}`,
        400
      );
    }
  }
}

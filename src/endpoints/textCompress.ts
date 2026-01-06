import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextCompress extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Compress text using gzip or deflate",
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
                description: "Text to compress",
              },
              algorithm: {
                type: "string" as const,
                enum: ["gzip", "deflate"] as const,
                default: "gzip",
                description: "Compression algorithm",
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
        description: "Compressed text (base64 encoded)",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                compressed: { type: "string" as const },
                algorithm: { type: "string" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                compressionRatio: { type: "number" as const },
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

    let body: { text?: string; algorithm?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { text, algorithm = "gzip" } = body;

    if (typeof text !== "string") {
      return this.errorResponse(c, "text field is required and must be a string", 400);
    }

    if (algorithm !== "gzip" && algorithm !== "deflate") {
      return this.errorResponse(c, "algorithm must be 'gzip' or 'deflate'", 400);
    }

    try {
      // Encode text to UTF-8 bytes
      const encoder = new TextEncoder();
      const inputBytes = encoder.encode(text);

      // Create readable stream from input
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(inputBytes);
          controller.close();
        },
      });

      // Compress through CompressionStream
      const compressedStream = stream.pipeThrough(
        new CompressionStream(algorithm as CompressionFormat)
      );
      const reader = compressedStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const compressedBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressedBytes.set(chunk, offset);
        offset += chunk.length;
      }

      // Encode to base64
      const compressed = btoa(String.fromCharCode(...compressedBytes));

      const compressionRatio = compressedBytes.length / inputBytes.length;

      return c.json({
        compressed,
        algorithm,
        inputLength: text.length,
        outputLength: compressed.length,
        compressionRatio: Math.round(compressionRatio * 1000) / 1000,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to compress: ${error instanceof Error ? error.message : "Unknown error"}`,
        400
      );
    }
  }
}

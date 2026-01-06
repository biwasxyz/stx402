import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class TextDecompress extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Decompress gzip or deflate data back to text",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["compressed"],
            properties: {
              compressed: {
                type: "string" as const,
                description: "Base64-encoded compressed data",
              },
              algorithm: {
                type: "string" as const,
                enum: ["gzip", "deflate"] as const,
                default: "gzip",
                description: "Compression algorithm used",
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
        description: "Decompressed text",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
                algorithm: { type: "string" as const },
                inputLength: { type: "integer" as const },
                outputLength: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid input or decompression failed",
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { compressed?: string; algorithm?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { compressed, algorithm = "gzip" } = body;

    if (typeof compressed !== "string") {
      return this.errorResponse(c, "compressed field is required and must be a string", 400);
    }

    if (algorithm !== "gzip" && algorithm !== "deflate") {
      return this.errorResponse(c, "algorithm must be 'gzip' or 'deflate'", 400);
    }

    try {
      // Decode base64 to bytes
      const binaryString = atob(compressed);
      const compressedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        compressedBytes[i] = binaryString.charCodeAt(i);
      }

      // Create readable stream from compressed data
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(compressedBytes);
          controller.close();
        },
      });

      // Decompress through DecompressionStream
      const decompressedStream = stream.pipeThrough(
        new DecompressionStream(algorithm as CompressionFormat)
      );
      const reader = decompressedStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const decompressedBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        decompressedBytes.set(chunk, offset);
        offset += chunk.length;
      }

      // Decode UTF-8 to string
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const text = decoder.decode(decompressedBytes);

      return c.json({
        text,
        algorithm,
        inputLength: compressed.length,
        outputLength: text.length,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to decompress: ${error instanceof Error ? error.message : "Invalid compressed data"}`,
        400
      );
    }
  }
}

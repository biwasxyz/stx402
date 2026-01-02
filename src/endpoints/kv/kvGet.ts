import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  buildStorageKey,
  KV_LIMITS,
  type Visibility,
} from "../../utils/namespace";

interface KvMetadata {
  createdAt: string;
  visibility: Visibility;
  bytes: number;
  valueType: "string" | "json";
}

export class KvGet extends BaseEndpoint {
  schema = {
    tags: ["KV Storage"],
    summary: "(paid) Retrieve a stored value by key",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["key"],
            properties: {
              key: {
                type: "string" as const,
                description: `Storage key (max ${KV_LIMITS.USER_KEY_MAX_CHARS} chars)`,
              },
              owner: {
                type: "string" as const,
                description: "Owner address (required for public keys owned by others)",
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
        description: "Value retrieved successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                key: { type: "string" as const },
                value: {},
                visibility: { type: "string" as const },
                createdAt: { type: "string" as const },
                bytes: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": {
        description: "Invalid request",
      },
      "402": {
        description: "Payment required",
      },
      "404": {
        description: "Key not found",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: {
      key: string;
      owner?: string;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { key, owner } = body;

    // Validate key
    if (!key || typeof key !== "string") {
      return this.errorResponse(c, "Key is required and must be a string", 400);
    }

    // Determine the owner address to look up
    const targetOwner = owner || payerAddress;

    // Try to find the key - first check private (if owner is self), then public
    let fullKey: string;
    let result: { value: string | null; metadata: KvMetadata | null };

    if (targetOwner === payerAddress) {
      // Looking up own keys - try private first, then public
      fullKey = buildStorageKey("kv", "private", payerAddress, key);
      result = await c.env.STORAGE.getWithMetadata<KvMetadata>(fullKey);

      if (result.value === null) {
        // Try public
        fullKey = buildStorageKey("kv", "public", payerAddress, key);
        result = await c.env.STORAGE.getWithMetadata<KvMetadata>(fullKey);
      }
    } else {
      // Looking up someone else's key - can only access public keys
      fullKey = buildStorageKey("kv", "public", targetOwner, key);
      result = await c.env.STORAGE.getWithMetadata<KvMetadata>(fullKey);
    }

    if (result.value === null) {
      return this.errorResponse(c, "Key not found", 404, { key });
    }

    // Parse value if it was stored as JSON
    let parsedValue: unknown = result.value;
    if (result.metadata?.valueType === "json") {
      try {
        parsedValue = JSON.parse(result.value);
      } catch {
        // Keep as string if parsing fails
      }
    }

    return c.json({
      key,
      value: parsedValue,
      visibility: result.metadata?.visibility ?? "private",
      createdAt: result.metadata?.createdAt,
      bytes: result.metadata?.bytes,
      tokenType,
    });
  }
}

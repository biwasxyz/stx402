import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import { KV_LIMITS, type Visibility } from "../../utils/namespace";

interface KvMetadata {
  createdAt: string;
  visibility: Visibility;
  bytes: number;
  valueType: "string" | "json";
}

interface KeyInfo {
  key: string;
  visibility: Visibility;
  createdAt?: string;
  bytes?: number;
}

export class KvList extends BaseEndpoint {
  schema = {
    tags: ["KV Storage"],
    summary: "(paid) List stored keys with optional prefix filter",
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              prefix: {
                type: "string" as const,
                description: "Filter keys by prefix",
              },
              visibility: {
                type: "string" as const,
                enum: ["private", "public", "all"],
                default: "all",
                description: "Filter by visibility (default: all)",
              },
              limit: {
                type: "number" as const,
                minimum: 1,
                maximum: KV_LIMITS.LIST_MAX_KEYS,
                default: 100,
                description: `Max keys to return (default 100, max ${KV_LIMITS.LIST_MAX_KEYS})`,
              },
              cursor: {
                type: "string" as const,
                description: "Pagination cursor from previous response",
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
        description: "Keys listed successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                keys: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      key: { type: "string" as const },
                      visibility: { type: "string" as const },
                      createdAt: { type: "string" as const },
                      bytes: { type: "number" as const },
                    },
                  },
                },
                cursor: { type: "string" as const },
                complete: { type: "boolean" as const },
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
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const payerAddress = this.getPayerAddress(c);

    if (!payerAddress) {
      return this.errorResponse(c, "Could not determine payer address", 400);
    }

    let body: {
      prefix?: string;
      visibility?: "private" | "public" | "all";
      limit?: number;
      cursor?: string;
    } = {};

    try {
      const text = await c.req.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { prefix = "", visibility = "all", limit = 100, cursor } = body;

    // Validate limit
    const effectiveLimit = Math.min(
      Math.max(1, limit),
      KV_LIMITS.LIST_MAX_KEYS
    );

    // Collect keys from requested visibility scopes
    const allKeys: KeyInfo[] = [];
    let lastCursor: string | undefined;
    let isComplete = true;

    // Parse cursor to determine where we left off
    let cursorVisibility: Visibility | undefined;
    let cursorKey: string | undefined;
    if (cursor) {
      const [vis, key] = cursor.split(":", 2);
      cursorVisibility = vis as Visibility;
      cursorKey = key;
    }

    // Query based on visibility filter
    const visibilities: Visibility[] =
      visibility === "all"
        ? ["private", "public"]
        : [visibility as Visibility];

    for (const vis of visibilities) {
      // If we have a cursor and haven't reached its visibility yet, skip
      if (cursorVisibility && vis !== cursorVisibility && allKeys.length === 0) {
        continue;
      }

      const kvPrefix = `kv:${vis}:${payerAddress}:${prefix}`;

      const listOptions: KVNamespaceListOptions = {
        prefix: kvPrefix,
        limit: effectiveLimit - allKeys.length,
      };

      // Only use cursor if we're in the right visibility scope
      if (cursorVisibility === vis && cursorKey) {
        listOptions.cursor = cursorKey;
      }

      const result = await c.env.STORAGE.list<KvMetadata>(listOptions);

      for (const key of result.keys) {
        // Extract the user key from the full namespaced key
        const parts = key.name.split(":");
        if (parts.length >= 4) {
          const userKey = parts.slice(3).join(":");
          allKeys.push({
            key: userKey,
            visibility: vis,
            createdAt: key.metadata?.createdAt,
            bytes: key.metadata?.bytes,
          });
        }
      }

      if (!result.list_complete) {
        isComplete = false;
        lastCursor = `${vis}:${result.cursor}`;
        break;
      }

      if (allKeys.length >= effectiveLimit) {
        break;
      }
    }

    return c.json({
      keys: allKeys,
      cursor: lastCursor,
      complete: isComplete && !lastCursor,
      count: allKeys.length,
      tokenType,
    });
  }
}

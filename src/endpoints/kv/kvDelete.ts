import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  buildStorageKey,
  KV_LIMITS,
  type Visibility,
} from "../../utils/namespace";

export class KvDelete extends BaseEndpoint {
  schema = {
    tags: ["KV Storage"],
    summary: "(paid) Delete a stored value by key",
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
              visibility: {
                type: "string" as const,
                enum: ["private", "public"],
                description: "Specify visibility if you know it (otherwise both are tried)",
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
        description: "Value deleted successfully",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                success: { type: "boolean" as const },
                deleted: { type: "string" as const },
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
      visibility?: Visibility;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { key, visibility } = body;

    // Validate key
    if (!key || typeof key !== "string") {
      return this.errorResponse(c, "Key is required and must be a string", 400);
    }

    // Can only delete own keys
    let deleted = false;
    let deletedVisibility: Visibility | null = null;

    if (visibility) {
      // Specific visibility requested
      const fullKey = buildStorageKey("kv", visibility, payerAddress, key);
      const existing = await c.env.STORAGE.get(fullKey);
      if (existing !== null) {
        await c.env.STORAGE.delete(fullKey);
        deleted = true;
        deletedVisibility = visibility;
      }
    } else {
      // Try both private and public
      for (const vis of ["private", "public"] as Visibility[]) {
        const fullKey = buildStorageKey("kv", vis, payerAddress, key);
        const existing = await c.env.STORAGE.get(fullKey);
        if (existing !== null) {
          await c.env.STORAGE.delete(fullKey);
          deleted = true;
          deletedVisibility = vis;
          break;
        }
      }
    }

    if (!deleted) {
      return this.errorResponse(c, "Key not found", 404, { key });
    }

    return c.json({
      success: true,
      deleted: key,
      visibility: deletedVisibility,
      tokenType,
    });
  }
}

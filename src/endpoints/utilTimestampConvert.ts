import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilTimestampConvert extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Convert between timestamp formats",
    parameters: [
      {
        name: "value",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Timestamp value (unix seconds, milliseconds, or ISO string)",
      },
      {
        name: "from",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["seconds", "milliseconds", "iso", "auto"] as const, default: "auto" },
        description: "Input format",
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
        description: "Converted timestamps",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                unix: { type: "integer" as const },
                unixMs: { type: "integer" as const },
                iso: { type: "string" as const },
                utc: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid timestamp" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const value = c.req.query("value");
    const from = c.req.query("from") || "auto";

    if (!value) {
      return this.errorResponse(c, "value parameter is required", 400);
    }

    let date: Date;

    try {
      if (from === "auto") {
        // Try to auto-detect format
        if (/^\d{10}$/.test(value)) {
          // Unix seconds
          date = new Date(parseInt(value, 10) * 1000);
        } else if (/^\d{13}$/.test(value)) {
          // Unix milliseconds
          date = new Date(parseInt(value, 10));
        } else {
          // ISO string or other parseable format
          date = new Date(value);
        }
      } else if (from === "seconds") {
        date = new Date(parseInt(value, 10) * 1000);
      } else if (from === "milliseconds") {
        date = new Date(parseInt(value, 10));
      } else {
        date = new Date(value);
      }

      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      return this.errorResponse(c, "Invalid timestamp value", 400);
    }

    const unix = Math.floor(date.getTime() / 1000);
    const unixMs = date.getTime();

    return c.json({
      unix,
      unixMs,
      iso: date.toISOString(),
      utc: date.toUTCString(),
      local: date.toString(),
      date: {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        dayOfWeek: date.getUTCDay(),
      },
      tokenType,
    });
  }
}

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataJsonToCsv extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Convert JSON array to CSV",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["data"],
            properties: {
              data: {
                type: "array" as const,
                items: { type: "object" as const },
                description: "Array of objects to convert",
              },
              headers: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Custom headers (optional, auto-detected from keys)",
              },
              delimiter: {
                type: "string" as const,
                default: ",",
                description: "Field delimiter",
              },
              includeHeaders: {
                type: "boolean" as const,
                default: true,
                description: "Include header row",
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
        description: "CSV output",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                csv: { type: "string" as const },
                rows: { type: "integer" as const },
                columns: { type: "integer" as const },
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

    let body: {
      data?: unknown[];
      headers?: string[];
      delimiter?: string;
      includeHeaders?: boolean;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { data, headers, delimiter = ",", includeHeaders = true } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return this.errorResponse(c, "data must be a non-empty array", 400);
    }

    // Validate all items are objects
    if (!data.every((item) => typeof item === "object" && item !== null)) {
      return this.errorResponse(c, "All items in data must be objects", 400);
    }

    // Extract headers from first object if not provided
    const columnHeaders = headers || Object.keys(data[0] as Record<string, unknown>);

    // Escape CSV value
    const escapeValue = (val: unknown): string => {
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV
    const rows: string[] = [];

    if (includeHeaders) {
      rows.push(columnHeaders.map(escapeValue).join(delimiter));
    }

    for (const item of data as Record<string, unknown>[]) {
      const row = columnHeaders.map((header) => escapeValue(item[header]));
      rows.push(row.join(delimiter));
    }

    const csv = rows.join("\n");

    return c.json({
      csv,
      rows: data.length,
      columns: columnHeaders.length,
      headers: columnHeaders,
      tokenType,
    });
  }
}

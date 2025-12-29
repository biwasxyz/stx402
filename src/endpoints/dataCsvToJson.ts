import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class DataCsvToJson extends BaseEndpoint {
  schema = {
    tags: ["Data"],
    summary: "(paid) Parse CSV to JSON array",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["csv"],
            properties: {
              csv: {
                type: "string" as const,
                description: "CSV string to parse",
              },
              delimiter: {
                type: "string" as const,
                default: ",",
                description: "Field delimiter",
              },
              hasHeaders: {
                type: "boolean" as const,
                default: true,
                description: "First row contains headers",
              },
              headers: {
                type: "array" as const,
                items: { type: "string" as const },
                description: "Custom headers (if hasHeaders is false)",
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
        description: "JSON array",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                data: { type: "array" as const },
                rows: { type: "integer" as const },
                columns: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid CSV" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      csv?: string;
      delimiter?: string;
      hasHeaders?: boolean;
      headers?: string[];
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { csv, delimiter = ",", hasHeaders = true, headers: customHeaders } = body;

    if (!csv || typeof csv !== "string") {
      return this.errorResponse(c, "csv field is required and must be a string", 400);
    }

    // Parse CSV
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (inQuotes) {
          if (char === '"') {
            if (row[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            current += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === delimiter) {
            result.push(current);
            current = "";
          } else {
            current += char;
          }
        }
      }
      result.push(current);
      return result;
    };

    // Split into lines (handle \r\n and \n)
    const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== "");

    if (lines.length === 0) {
      return this.errorResponse(c, "CSV is empty", 400);
    }

    let headers: string[];
    let dataLines: string[];

    if (hasHeaders) {
      headers = parseRow(lines[0]);
      dataLines = lines.slice(1);
    } else if (customHeaders) {
      headers = customHeaders;
      dataLines = lines;
    } else {
      // Auto-generate headers (col1, col2, etc.)
      const firstRow = parseRow(lines[0]);
      headers = firstRow.map((_, i) => `col${i + 1}`);
      dataLines = lines;
    }

    // Parse data rows
    const data = dataLines.map((line) => {
      const values = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || "";
      });
      return obj;
    });

    return c.json({
      data,
      rows: data.length,
      columns: headers.length,
      headers,
      tokenType,
    });
  }
}

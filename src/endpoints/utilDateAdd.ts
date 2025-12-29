import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilDateAdd extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Add or subtract time from a date",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["date"],
            properties: {
              date: { type: "string" as const, description: "Base date (ISO string or unix timestamp)" },
              years: { type: "integer" as const, default: 0 },
              months: { type: "integer" as const, default: 0 },
              weeks: { type: "integer" as const, default: 0 },
              days: { type: "integer" as const, default: 0 },
              hours: { type: "integer" as const, default: 0 },
              minutes: { type: "integer" as const, default: 0 },
              seconds: { type: "integer" as const, default: 0 },
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
        description: "New date",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                original: { type: "string" as const },
                result: { type: "string" as const },
                unix: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid date" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: {
      date?: string;
      years?: number;
      months?: number;
      weeks?: number;
      days?: number;
      hours?: number;
      minutes?: number;
      seconds?: number;
    };

    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { date: dateStr, years = 0, months = 0, weeks = 0, days = 0, hours = 0, minutes = 0, seconds = 0 } = body;

    if (!dateStr) {
      return this.errorResponse(c, "date field is required", 400);
    }

    let originalDate: Date;

    // Try unix timestamp first
    if (/^\d{10,13}$/.test(dateStr)) {
      const num = parseInt(dateStr, 10);
      originalDate = new Date(dateStr.length === 10 ? num * 1000 : num);
    } else {
      originalDate = new Date(dateStr);
    }

    if (isNaN(originalDate.getTime())) {
      return this.errorResponse(c, "Invalid date format", 400);
    }

    const resultDate = new Date(originalDate);

    // Add years and months (using setMonth/setFullYear to handle overflow correctly)
    if (years !== 0) {
      resultDate.setFullYear(resultDate.getFullYear() + years);
    }
    if (months !== 0) {
      resultDate.setMonth(resultDate.getMonth() + months);
    }

    // Add weeks, days, hours, minutes, seconds (as milliseconds)
    const msToAdd =
      weeks * 7 * 24 * 60 * 60 * 1000 +
      days * 24 * 60 * 60 * 1000 +
      hours * 60 * 60 * 1000 +
      minutes * 60 * 1000 +
      seconds * 1000;

    resultDate.setTime(resultDate.getTime() + msToAdd);

    return c.json({
      original: originalDate.toISOString(),
      result: resultDate.toISOString(),
      unix: Math.floor(resultDate.getTime() / 1000),
      unixMs: resultDate.getTime(),
      utc: resultDate.toUTCString(),
      added: {
        years,
        months,
        weeks,
        days,
        hours,
        minutes,
        seconds,
      },
      tokenType,
    });
  }
}

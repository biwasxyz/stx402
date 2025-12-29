import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilDateDiff extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Calculate difference between two dates",
    parameters: [
      {
        name: "from",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Start date (ISO string or unix timestamp)",
      },
      {
        name: "to",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "End date (ISO string or unix timestamp)",
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
        description: "Date difference",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                totalMs: { type: "integer" as const },
                totalSeconds: { type: "number" as const },
                totalMinutes: { type: "number" as const },
                totalHours: { type: "number" as const },
                totalDays: { type: "number" as const },
                breakdown: { type: "object" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid dates" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const fromStr = c.req.query("from");
    const toStr = c.req.query("to");

    if (!fromStr || !toStr) {
      return this.errorResponse(c, "from and to parameters are required", 400);
    }

    const parseDate = (str: string): Date => {
      // Try unix timestamp first
      if (/^\d{10,13}$/.test(str)) {
        const num = parseInt(str, 10);
        return new Date(str.length === 10 ? num * 1000 : num);
      }
      return new Date(str);
    };

    const fromDate = parseDate(fromStr);
    const toDate = parseDate(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return this.errorResponse(c, "Invalid date format", 400);
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const absDiffMs = Math.abs(diffMs);

    const totalSeconds = diffMs / 1000;
    const totalMinutes = diffMs / (1000 * 60);
    const totalHours = diffMs / (1000 * 60 * 60);
    const totalDays = diffMs / (1000 * 60 * 60 * 24);
    const totalWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);

    // Calculate breakdown
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);
    const ms = absDiffMs % 1000;

    const isPast = diffMs < 0;

    return c.json({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalMs: diffMs,
      totalSeconds: Math.round(totalSeconds * 1000) / 1000,
      totalMinutes: Math.round(totalMinutes * 1000) / 1000,
      totalHours: Math.round(totalHours * 1000) / 1000,
      totalDays: Math.round(totalDays * 1000) / 1000,
      totalWeeks: Math.round(totalWeeks * 1000) / 1000,
      breakdown: {
        days,
        hours,
        minutes,
        seconds,
        milliseconds: ms,
      },
      isPast,
      humanReadable: `${isPast ? "-" : ""}${days}d ${hours}h ${minutes}m ${seconds}s`,
      tokenType,
    });
  }
}

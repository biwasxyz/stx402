import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilCronParse extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Parse cron expression and get next run times",
    parameters: [
      {
        name: "expression",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Cron expression (5 or 6 fields)",
      },
      {
        name: "count",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 5, minimum: 1, maximum: 20 },
        description: "Number of next run times to calculate",
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
        description: "Parsed cron expression",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                expression: { type: "string" as const },
                description: { type: "string" as const },
                nextRuns: { type: "array" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid cron expression" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const expression = c.req.query("expression");
    const count = Math.min(20, Math.max(1, parseInt(c.req.query("count") || "5", 10)));

    if (!expression) {
      return this.errorResponse(c, "expression parameter is required", 400);
    }

    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
      return this.errorResponse(c, "Cron expression must have 5 or 6 fields", 400);
    }

    try {
      const parsed = this.parseCron(parts);
      const description = this.describeCron(parsed);
      const nextRuns = this.getNextRuns(parsed, count);

      return c.json({
        expression,
        fields: {
          minute: parts[0],
          hour: parts[1],
          dayOfMonth: parts[2],
          month: parts[3],
          dayOfWeek: parts[4],
          ...(parts[5] ? { year: parts[5] } : {}),
        },
        description,
        nextRuns: nextRuns.map((d) => ({
          iso: d.toISOString(),
          unix: Math.floor(d.getTime() / 1000),
        })),
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Invalid cron expression: ${String(error)}`, 400);
    }
  }

  private parseCron(parts: string[]) {
    return {
      minute: this.parseField(parts[0], 0, 59),
      hour: this.parseField(parts[1], 0, 23),
      dayOfMonth: this.parseField(parts[2], 1, 31),
      month: this.parseField(parts[3], 1, 12),
      dayOfWeek: this.parseField(parts[4], 0, 6),
    };
  }

  private parseField(field: string, min: number, max: number): number[] {
    if (field === "*") {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    const values = new Set<number>();

    for (const part of field.split(",")) {
      if (part.includes("/")) {
        const [range, step] = part.split("/");
        const stepNum = parseInt(step, 10);
        const rangeValues = range === "*" ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : this.parseRange(range, min, max);
        for (let i = 0; i < rangeValues.length; i += stepNum) {
          values.add(rangeValues[i]);
        }
      } else if (part.includes("-")) {
        for (const v of this.parseRange(part, min, max)) {
          values.add(v);
        }
      } else {
        const num = parseInt(part, 10);
        if (num >= min && num <= max) {
          values.add(num);
        }
      }
    }

    return Array.from(values).sort((a, b) => a - b);
  }

  private parseRange(range: string, min: number, max: number): number[] {
    const [start, end] = range.split("-").map((n) => parseInt(n, 10));
    const result: number[] = [];
    for (let i = Math.max(start, min); i <= Math.min(end, max); i++) {
      result.push(i);
    }
    return result;
  }

  private describeCron(parsed: ReturnType<typeof this.parseCron>): string {
    const parts: string[] = [];

    if (parsed.minute.length === 60) {
      parts.push("Every minute");
    } else if (parsed.minute.length === 1) {
      parts.push(`At minute ${parsed.minute[0]}`);
    } else {
      parts.push(`At minutes ${parsed.minute.join(", ")}`);
    }

    if (parsed.hour.length === 24) {
      parts.push("of every hour");
    } else if (parsed.hour.length === 1) {
      parts.push(`past hour ${parsed.hour[0]}`);
    } else {
      parts.push(`past hours ${parsed.hour.join(", ")}`);
    }

    return parts.join(" ");
  }

  private getNextRuns(parsed: ReturnType<typeof this.parseCron>, count: number): Date[] {
    const runs: Date[] = [];
    const now = new Date();
    const current = new Date(now);
    current.setSeconds(0);
    current.setMilliseconds(0);

    while (runs.length < count && current.getTime() < now.getTime() + 365 * 24 * 60 * 60 * 1000) {
      current.setMinutes(current.getMinutes() + 1);

      if (
        parsed.minute.includes(current.getMinutes()) &&
        parsed.hour.includes(current.getHours()) &&
        parsed.dayOfMonth.includes(current.getDate()) &&
        parsed.month.includes(current.getMonth() + 1) &&
        parsed.dayOfWeek.includes(current.getDay())
      ) {
        runs.push(new Date(current));
      }
    }

    return runs;
  }
}

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathPercentage extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Calculate percentages and percentage changes",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["operation"],
            properties: {
              operation: {
                type: "string" as const,
                enum: ["of", "change", "increase", "decrease", "what_percent"] as const,
                description: "Percentage operation type",
              },
              value: { type: "number" as const, description: "Primary value" },
              percent: { type: "number" as const, description: "Percentage value" },
              from: { type: "number" as const, description: "Starting value (for change)" },
              to: { type: "number" as const, description: "Ending value (for change)" },
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
        description: "Percentage calculation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                operation: { type: "string" as const },
                result: { type: "number" as const },
                explanation: { type: "string" as const },
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

    let body: { operation?: string; value?: number; percent?: number; from?: number; to?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { operation, value, percent, from, to } = body;

    const validOps = ["of", "change", "increase", "decrease", "what_percent"];
    if (!operation || !validOps.includes(operation)) {
      return this.errorResponse(c, `operation must be one of: ${validOps.join(", ")}`, 400);
    }

    let result: number;
    let explanation: string;

    switch (operation) {
      case "of":
        // What is X% of Y?
        if (typeof percent !== "number" || typeof value !== "number") {
          return this.errorResponse(c, "percent and value are required for 'of' operation", 400);
        }
        result = (percent / 100) * value;
        explanation = `${percent}% of ${value} = ${result}`;
        break;

      case "change":
        // Percentage change from X to Y
        if (typeof from !== "number" || typeof to !== "number") {
          return this.errorResponse(c, "from and to are required for 'change' operation", 400);
        }
        if (from === 0) {
          return this.errorResponse(c, "from value cannot be zero", 400);
        }
        result = ((to - from) / Math.abs(from)) * 100;
        explanation = `Change from ${from} to ${to} = ${result.toFixed(2)}%`;
        break;

      case "increase":
        // Increase X by Y%
        if (typeof value !== "number" || typeof percent !== "number") {
          return this.errorResponse(c, "value and percent are required for 'increase' operation", 400);
        }
        result = value * (1 + percent / 100);
        explanation = `${value} increased by ${percent}% = ${result}`;
        break;

      case "decrease":
        // Decrease X by Y%
        if (typeof value !== "number" || typeof percent !== "number") {
          return this.errorResponse(c, "value and percent are required for 'decrease' operation", 400);
        }
        result = value * (1 - percent / 100);
        explanation = `${value} decreased by ${percent}% = ${result}`;
        break;

      case "what_percent":
        // X is what percent of Y?
        if (typeof value !== "number" || typeof from !== "number") {
          return this.errorResponse(c, "value and from are required for 'what_percent' operation", 400);
        }
        if (from === 0) {
          return this.errorResponse(c, "from value cannot be zero", 400);
        }
        result = (value / from) * 100;
        explanation = `${value} is ${result.toFixed(2)}% of ${from}`;
        break;

      default:
        return this.errorResponse(c, "Invalid operation", 400);
    }

    return c.json({
      operation,
      result: Math.round(result * 1000000) / 1000000,
      explanation,
      tokenType,
    });
  }
}

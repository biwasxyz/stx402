import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathCalculate extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Evaluate a mathematical expression",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["expression"],
            properties: {
              expression: {
                type: "string" as const,
                description: "Mathematical expression to evaluate (supports +, -, *, /, ^, %, sqrt, sin, cos, tan, log, ln, pi, e)",
              },
              precision: {
                type: "integer" as const,
                default: 10,
                description: "Decimal precision for result",
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
        description: "Calculation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                expression: { type: "string" as const },
                result: { type: "number" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid expression" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { expression?: string; precision?: number };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { expression, precision = 10 } = body;

    if (typeof expression !== "string" || expression.trim().length === 0) {
      return this.errorResponse(c, "expression field is required", 400);
    }

    try {
      const result = this.evaluate(expression);

      if (!isFinite(result)) {
        return this.errorResponse(c, "Result is not a finite number", 400);
      }

      const rounded = Math.round(result * Math.pow(10, precision)) / Math.pow(10, precision);

      return c.json({
        expression,
        result: rounded,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(c, `Invalid expression: ${String(error)}`, 400);
    }
  }

  private evaluate(expr: string): number {
    // Sanitize and tokenize
    let sanitized = expr.toLowerCase().trim();

    // Replace constants
    sanitized = sanitized.replace(/\bpi\b/g, String(Math.PI));
    sanitized = sanitized.replace(/\be\b/g, String(Math.E));

    // Replace functions
    sanitized = sanitized.replace(/sqrt\(([^)]+)\)/g, (_, arg) => String(Math.sqrt(this.evaluate(arg))));
    sanitized = sanitized.replace(/sin\(([^)]+)\)/g, (_, arg) => String(Math.sin(this.evaluate(arg))));
    sanitized = sanitized.replace(/cos\(([^)]+)\)/g, (_, arg) => String(Math.cos(this.evaluate(arg))));
    sanitized = sanitized.replace(/tan\(([^)]+)\)/g, (_, arg) => String(Math.tan(this.evaluate(arg))));
    sanitized = sanitized.replace(/log\(([^)]+)\)/g, (_, arg) => String(Math.log10(this.evaluate(arg))));
    sanitized = sanitized.replace(/ln\(([^)]+)\)/g, (_, arg) => String(Math.log(this.evaluate(arg))));
    sanitized = sanitized.replace(/abs\(([^)]+)\)/g, (_, arg) => String(Math.abs(this.evaluate(arg))));
    sanitized = sanitized.replace(/floor\(([^)]+)\)/g, (_, arg) => String(Math.floor(this.evaluate(arg))));
    sanitized = sanitized.replace(/ceil\(([^)]+)\)/g, (_, arg) => String(Math.ceil(this.evaluate(arg))));
    sanitized = sanitized.replace(/round\(([^)]+)\)/g, (_, arg) => String(Math.round(this.evaluate(arg))));

    // Handle power operator
    sanitized = sanitized.replace(/\^/g, "**");

    // Validate - only allow numbers, operators, parentheses, spaces, and dots
    if (!/^[\d\s+\-*/%().]+$/.test(sanitized)) {
      throw new Error("Expression contains invalid characters");
    }

    // Use Function constructor for safe evaluation (only math operations)
    const fn = new Function(`return (${sanitized})`);
    return fn();
  }
}

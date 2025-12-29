import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathGcdLcm extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Calculate GCD (Greatest Common Divisor) and LCM (Least Common Multiple)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["numbers"],
            properties: {
              numbers: {
                type: "array" as const,
                items: { type: "integer" as const },
                description: "Array of positive integers (2 or more)",
                minItems: 2,
                maxItems: 100,
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
        description: "GCD and LCM result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                numbers: { type: "array" as const, items: { type: "integer" as const } },
                gcd: { type: "integer" as const },
                lcm: { type: "integer" as const },
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

    let body: { numbers?: number[] };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { numbers } = body;

    if (!Array.isArray(numbers) || numbers.length < 2) {
      return this.errorResponse(c, "numbers must be an array with at least 2 elements", 400);
    }

    if (numbers.length > 100) {
      return this.errorResponse(c, "numbers array cannot exceed 100 elements", 400);
    }

    // Validate all are positive integers
    for (const num of numbers) {
      if (!Number.isInteger(num) || num < 1) {
        return this.errorResponse(c, "All elements must be positive integers", 400);
      }
      if (num > Number.MAX_SAFE_INTEGER) {
        return this.errorResponse(c, "Numbers must not exceed safe integer range", 400);
      }
    }

    // Calculate GCD of all numbers
    const gcd = numbers.reduce((a, b) => this.gcd(a, b));

    // Calculate LCM of all numbers
    const lcm = numbers.reduce((a, b) => this.lcm(a, b));

    // Check for overflow
    if (lcm > Number.MAX_SAFE_INTEGER) {
      return this.errorResponse(c, "LCM exceeds safe integer range", 400);
    }

    return c.json({
      numbers,
      gcd,
      lcm,
      coprime: gcd === 1,
      tokenType,
    });
  }

  private gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  private lcm(a: number, b: number): number {
    return Math.abs(a * b) / this.gcd(a, b);
  }
}

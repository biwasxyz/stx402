import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathFactorial extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Calculate factorial and related functions",
    parameters: [
      {
        name: "n",
        in: "query" as const,
        required: true,
        schema: { type: "integer" as const, minimum: 0, maximum: 170 },
        description: "Number to calculate factorial of (0-170)",
      },
      {
        name: "operation",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["factorial", "double_factorial", "permutation", "combination"] as const,
          default: "factorial",
        },
        description: "Operation type",
      },
      {
        name: "r",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const },
        description: "Second parameter for permutation/combination (nPr or nCr)",
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
        description: "Factorial result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                n: { type: "integer" as const },
                operation: { type: "string" as const },
                result: { type: "number" as const },
                formula: { type: "string" as const },
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

    const nStr = c.req.query("n");
    const operation = c.req.query("operation") || "factorial";
    const rStr = c.req.query("r");

    if (!nStr) {
      return this.errorResponse(c, "n parameter is required", 400);
    }

    const n = parseInt(nStr, 10);
    if (isNaN(n) || n < 0) {
      return this.errorResponse(c, "n must be a non-negative integer", 400);
    }

    if (n > 170) {
      return this.errorResponse(c, "n must be 170 or less (larger values exceed JavaScript number range)", 400);
    }

    const validOps = ["factorial", "double_factorial", "permutation", "combination"];
    if (!validOps.includes(operation)) {
      return this.errorResponse(c, `operation must be one of: ${validOps.join(", ")}`, 400);
    }

    let result: number;
    let formula: string;
    let r: number | undefined;

    switch (operation) {
      case "factorial":
        result = this.factorial(n);
        formula = `${n}! = ${result}`;
        break;

      case "double_factorial":
        result = this.doubleFactorial(n);
        formula = `${n}!! = ${result}`;
        break;

      case "permutation":
        if (!rStr) {
          return this.errorResponse(c, "r parameter is required for permutation", 400);
        }
        r = parseInt(rStr, 10);
        if (isNaN(r) || r < 0 || r > n) {
          return this.errorResponse(c, "r must be a non-negative integer <= n", 400);
        }
        result = this.permutation(n, r);
        formula = `P(${n}, ${r}) = ${n}!/(${n}-${r})! = ${result}`;
        break;

      case "combination":
        if (!rStr) {
          return this.errorResponse(c, "r parameter is required for combination", 400);
        }
        r = parseInt(rStr, 10);
        if (isNaN(r) || r < 0 || r > n) {
          return this.errorResponse(c, "r must be a non-negative integer <= n", 400);
        }
        result = this.combination(n, r);
        formula = `C(${n}, ${r}) = ${n}!/(${r}!(${n}-${r})!) = ${result}`;
        break;

      default:
        return this.errorResponse(c, "Invalid operation", 400);
    }

    const response: Record<string, unknown> = {
      n,
      operation,
      result,
      formula,
      tokenType,
    };

    if (r !== undefined) {
      response.r = r;
    }

    return c.json(response);
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  private doubleFactorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = n; i > 1; i -= 2) {
      result *= i;
    }
    return result;
  }

  private permutation(n: number, r: number): number {
    return this.factorial(n) / this.factorial(n - r);
  }

  private combination(n: number, r: number): number {
    return this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
  }
}

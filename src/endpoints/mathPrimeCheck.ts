import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathPrimeCheck extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Check if a number is prime and find nearby primes",
    parameters: [
      {
        name: "number",
        in: "query" as const,
        required: true,
        schema: { type: "integer" as const },
        description: "Number to check",
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
        description: "Prime check result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                number: { type: "integer" as const },
                isPrime: { type: "boolean" as const },
                factors: { type: "array" as const, items: { type: "integer" as const } },
                nextPrime: { type: "integer" as const },
                previousPrime: { type: "integer" as const, nullable: true },
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

    const numStr = c.req.query("number");
    if (!numStr) {
      return this.errorResponse(c, "number parameter is required", 400);
    }

    const num = parseInt(numStr, 10);
    if (isNaN(num) || num < 1 || num > 1000000000) {
      return this.errorResponse(c, "number must be a positive integer up to 1 billion", 400);
    }

    const isPrime = this.isPrime(num);
    const factors = isPrime ? [1, num] : this.getFactors(num);
    const primeFactors = this.getPrimeFactors(num);

    // Find next prime
    let nextPrime = num + 1;
    while (!this.isPrime(nextPrime) && nextPrime < num + 1000) {
      nextPrime++;
    }

    // Find previous prime
    let previousPrime: number | null = num - 1;
    while (previousPrime > 1 && !this.isPrime(previousPrime)) {
      previousPrime--;
    }
    if (previousPrime <= 1) previousPrime = null;

    return c.json({
      number: num,
      isPrime,
      factors,
      primeFactors,
      nextPrime,
      previousPrime,
      tokenType,
    });
  }

  private isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  private getFactors(n: number): number[] {
    const factors: number[] = [];
    for (let i = 1; i <= Math.sqrt(n); i++) {
      if (n % i === 0) {
        factors.push(i);
        if (i !== n / i) {
          factors.push(n / i);
        }
      }
    }
    return factors.sort((a, b) => a - b);
  }

  private getPrimeFactors(n: number): number[] {
    const factors: number[] = [];
    let divisor = 2;

    while (n >= 2) {
      if (n % divisor === 0) {
        factors.push(divisor);
        n = n / divisor;
      } else {
        divisor++;
      }
    }

    return factors;
  }
}

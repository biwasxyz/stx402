import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class MathStatistics extends BaseEndpoint {
  schema = {
    tags: ["Math"],
    summary: "(paid) Calculate statistics for a dataset",
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
                items: { type: "number" as const },
                description: "Array of numbers to analyze",
                minItems: 1,
                maxItems: 10000,
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
        description: "Statistical analysis",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                count: { type: "integer" as const },
                sum: { type: "number" as const },
                mean: { type: "number" as const },
                median: { type: "number" as const },
                mode: { type: "array" as const },
                min: { type: "number" as const },
                max: { type: "number" as const },
                range: { type: "number" as const },
                variance: { type: "number" as const },
                standardDeviation: { type: "number" as const },
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

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return this.errorResponse(c, "numbers must be a non-empty array", 400);
    }

    if (numbers.length > 10000) {
      return this.errorResponse(c, "numbers array cannot exceed 10000 elements", 400);
    }

    if (!numbers.every((n) => typeof n === "number" && isFinite(n))) {
      return this.errorResponse(c, "All elements must be finite numbers", 400);
    }

    const count = numbers.length;
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / count;

    // Sorted for median and quartiles
    const sorted = [...numbers].sort((a, b) => a - b);

    // Median
    const median = count % 2 === 0 ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : sorted[Math.floor(count / 2)];

    // Mode (most frequent values)
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    for (const num of numbers) {
      frequency[num] = (frequency[num] || 0) + 1;
      if (frequency[num] > maxFreq) maxFreq = frequency[num];
    }
    const mode = Object.entries(frequency)
      .filter(([, freq]) => freq === maxFreq)
      .map(([num]) => parseFloat(num));

    // Min, Max, Range
    const min = sorted[0];
    const max = sorted[count - 1];
    const range = max - min;

    // Variance and Standard Deviation
    const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const standardDeviation = Math.sqrt(variance);

    // Quartiles
    const q1Index = Math.floor(count * 0.25);
    const q3Index = Math.floor(count * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return c.json({
      count,
      sum: Math.round(sum * 1000000) / 1000000,
      mean: Math.round(mean * 1000000) / 1000000,
      median: Math.round(median * 1000000) / 1000000,
      mode: mode.length === count ? null : mode, // null if all values are unique
      min,
      max,
      range,
      variance: Math.round(variance * 1000000) / 1000000,
      standardDeviation: Math.round(standardDeviation * 1000000) / 1000000,
      quartiles: {
        q1,
        q2: median,
        q3,
        iqr,
      },
      tokenType,
    });
  }
}

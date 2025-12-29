import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomDice extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Roll dice with standard or custom notation",
    parameters: [
      {
        name: "notation",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, default: "1d6" },
        description: "Dice notation (e.g., 2d6, 1d20+5, 4d6kh3)",
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
        description: "Dice roll result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                notation: { type: "string" as const },
                rolls: { type: "array" as const, items: { type: "integer" as const } },
                kept: { type: "array" as const, items: { type: "integer" as const } },
                modifier: { type: "integer" as const },
                total: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid dice notation" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const notation = c.req.query("notation") || "1d6";

    // Parse dice notation: NdS[kh/kl X][+/-M]
    // N = number of dice, S = sides, kh/kl = keep highest/lowest, X = how many to keep, M = modifier
    const match = notation.match(/^(\d+)d(\d+)(?:(kh|kl)(\d+))?([+-]\d+)?$/i);

    if (!match) {
      return this.errorResponse(c, "Invalid dice notation. Use format like: 2d6, 1d20+5, 4d6kh3", 400);
    }

    const numDice = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const keepMode = match[3]?.toLowerCase() as "kh" | "kl" | undefined;
    const keepCount = match[4] ? parseInt(match[4], 10) : numDice;
    const modifier = match[5] ? parseInt(match[5], 10) : 0;

    if (numDice < 1 || numDice > 100) {
      return this.errorResponse(c, "Number of dice must be between 1 and 100", 400);
    }

    if (sides < 2 || sides > 1000) {
      return this.errorResponse(c, "Number of sides must be between 2 and 1000", 400);
    }

    if (keepCount > numDice) {
      return this.errorResponse(c, "Keep count cannot exceed number of dice", 400);
    }

    // Roll dice using crypto
    const randomBytes = new Uint32Array(numDice);
    crypto.getRandomValues(randomBytes);

    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push((randomBytes[i] % sides) + 1);
    }

    // Determine which dice to keep
    let kept = [...rolls];
    if (keepMode) {
      const sorted = [...rolls].sort((a, b) => (keepMode === "kh" ? b - a : a - b));
      kept = sorted.slice(0, keepCount);
    }

    const subtotal = kept.reduce((sum, roll) => sum + roll, 0);
    const total = subtotal + modifier;

    return c.json({
      notation,
      rolls,
      kept: keepMode ? kept : rolls,
      modifier,
      subtotal,
      total,
      tokenType,
    });
  }
}

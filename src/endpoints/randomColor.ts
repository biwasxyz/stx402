import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class RandomColor extends BaseEndpoint {
  schema = {
    tags: ["Random"],
    summary: "(paid) Generate a random color in various formats",
    parameters: [
      {
        name: "format",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["hex", "rgb", "hsl", "all"] as const, default: "all" },
        description: "Output format",
      },
      {
        name: "count",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const, default: 1, minimum: 1, maximum: 20 },
        description: "Number of colors to generate",
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
        description: "Generated color(s)",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                colors: { type: "array" as const },
                count: { type: "integer" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid parameters" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const format = c.req.query("format") || "all";
    const count = Math.min(20, Math.max(1, parseInt(c.req.query("count") || "1", 10)));

    const validFormats = ["hex", "rgb", "hsl", "all"];
    if (!validFormats.includes(format)) {
      return this.errorResponse(c, `format must be one of: ${validFormats.join(", ")}`, 400);
    }

    const colors = [];
    const randomBytes = new Uint8Array(count * 3);
    crypto.getRandomValues(randomBytes);

    for (let i = 0; i < count; i++) {
      const r = randomBytes[i * 3];
      const g = randomBytes[i * 3 + 1];
      const b = randomBytes[i * 3 + 2];

      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      const rgb = `rgb(${r}, ${g}, ${b})`;

      // Convert to HSL
      const rNorm = r / 255;
      const gNorm = g / 255;
      const bNorm = b / 255;
      const max = Math.max(rNorm, gNorm, bNorm);
      const min = Math.min(rNorm, gNorm, bNorm);
      const l = (max + min) / 2;
      let h = 0;
      let s = 0;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rNorm:
            h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
            break;
          case gNorm:
            h = ((bNorm - rNorm) / d + 2) / 6;
            break;
          case bNorm:
            h = ((rNorm - gNorm) / d + 4) / 6;
            break;
        }
      }

      const hsl = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;

      if (format === "hex") {
        colors.push({ hex });
      } else if (format === "rgb") {
        colors.push({ rgb, r, g, b });
      } else if (format === "hsl") {
        colors.push({ hsl, h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) });
      } else {
        colors.push({
          hex,
          rgb,
          hsl,
          r,
          g,
          b,
          h: Math.round(h * 360),
          s: Math.round(s * 100),
          l: Math.round(l * 100),
        });
      }
    }

    return c.json({
      colors: count === 1 ? colors[0] : colors,
      count,
      tokenType,
    });
  }
}

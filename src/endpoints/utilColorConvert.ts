import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilColorConvert extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Convert colors between formats (hex, rgb, hsl)",
    parameters: [
      {
        name: "color",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Color value (hex, rgb(), hsl(), or named color)",
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
        description: "Converted color formats",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                hex: { type: "string" as const },
                rgb: { type: "object" as const },
                hsl: { type: "object" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid color" },
      "402": { description: "Payment required" },
    },
  };

  private namedColors: Record<string, string> = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    white: "#ffffff",
    black: "#000000",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    orange: "#ffa500",
    purple: "#800080",
    pink: "#ffc0cb",
    gray: "#808080",
    grey: "#808080",
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const color = c.req.query("color");

    if (!color) {
      return this.errorResponse(c, "color parameter is required", 400);
    }

    let r: number, g: number, b: number;

    const normalized = color.toLowerCase().trim();

    try {
      if (this.namedColors[normalized]) {
        // Named color
        const hex = this.namedColors[normalized];
        [r, g, b] = this.hexToRgb(hex);
      } else if (normalized.startsWith("#")) {
        // Hex color
        [r, g, b] = this.hexToRgb(normalized);
      } else if (normalized.startsWith("rgb")) {
        // RGB color
        const match = normalized.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (!match) throw new Error("Invalid RGB format");
        r = parseInt(match[1], 10);
        g = parseInt(match[2], 10);
        b = parseInt(match[3], 10);
      } else if (normalized.startsWith("hsl")) {
        // HSL color
        const match = normalized.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
        if (!match) throw new Error("Invalid HSL format");
        const h = parseInt(match[1], 10);
        const s = parseInt(match[2], 10);
        const l = parseInt(match[3], 10);
        [r, g, b] = this.hslToRgb(h, s, l);
      } else {
        throw new Error("Unrecognized color format");
      }

      // Validate RGB values
      if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error("RGB values must be 0-255");
      }
    } catch (error) {
      return this.errorResponse(c, `Invalid color: ${String(error)}`, 400);
    }

    // Convert to all formats
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    const [h, s, l] = this.rgbToHsl(r, g, b);

    return c.json({
      input: color,
      hex,
      hexUppercase: hex.toUpperCase(),
      rgb: { r, g, b, string: `rgb(${r}, ${g}, ${b})` },
      hsl: { h, s, l, string: `hsl(${h}, ${s}%, ${l}%)` },
      rgba: `rgba(${r}, ${g}, ${b}, 1)`,
      luminance: Math.round((0.299 * r + 0.587 * g + 0.114 * b) / 255 * 100) / 100,
      isLight: 0.299 * r + 0.587 * g + 0.114 * b > 128,
      tokenType,
    });
  }

  private hexToRgb(hex: string): [number, number, number] {
    let cleaned = hex.replace("#", "");
    if (cleaned.length === 3) {
      cleaned = cleaned.split("").map((c) => c + c).join("");
    }
    if (cleaned.length !== 6) throw new Error("Invalid hex format");
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    s /= 100;
    l /= 100;

    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return [
      Math.round(hue2rgb(p, q, h + 1/3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1/3) * 255),
    ];
  }
}

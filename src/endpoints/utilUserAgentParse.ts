import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilUserAgentParse extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Parse user agent string",
    parameters: [
      {
        name: "ua",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const },
        description: "User agent string (uses request User-Agent if not provided)",
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
        description: "Parsed user agent",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                browser: { type: "object" as const },
                os: { type: "object" as const },
                device: { type: "object" as const },
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

    const ua = c.req.query("ua") || c.req.header("user-agent") || "";

    if (!ua) {
      return this.errorResponse(c, "No user agent provided", 400);
    }

    const result = this.parseUserAgent(ua);

    return c.json({
      userAgent: ua,
      ...result,
      tokenType,
    });
  }

  private parseUserAgent(ua: string) {
    const browser = this.detectBrowser(ua);
    const os = this.detectOS(ua);
    const device = this.detectDevice(ua);

    return {
      browser,
      os,
      device,
      isBot: /bot|crawl|spider|slurp|googlebot|bingbot/i.test(ua),
      isMobile: device.type === "mobile",
      isTablet: device.type === "tablet",
      isDesktop: device.type === "desktop",
    };
  }

  private detectBrowser(ua: string): { name: string; version: string | null } {
    const browsers: Array<{ name: string; regex: RegExp }> = [
      { name: "Edge", regex: /Edg[e]?\/(\d+[\d.]+)/ },
      { name: "Chrome", regex: /Chrome\/(\d+[\d.]+)/ },
      { name: "Firefox", regex: /Firefox\/(\d+[\d.]+)/ },
      { name: "Safari", regex: /Version\/(\d+[\d.]+).*Safari/ },
      { name: "Opera", regex: /Opera\/(\d+[\d.]+)|OPR\/(\d+[\d.]+)/ },
      { name: "IE", regex: /MSIE (\d+[\d.]+)|Trident.*rv:(\d+[\d.]+)/ },
    ];

    for (const { name, regex } of browsers) {
      const match = ua.match(regex);
      if (match) {
        return { name, version: match[1] || match[2] || null };
      }
    }

    return { name: "Unknown", version: null };
  }

  private detectOS(ua: string): { name: string; version: string | null } {
    const systems: Array<{ name: string; regex: RegExp }> = [
      { name: "Windows", regex: /Windows NT (\d+\.\d+)/ },
      { name: "macOS", regex: /Mac OS X (\d+[._]\d+[._]?\d*)/ },
      { name: "iOS", regex: /iPhone OS (\d+[._]\d+)|iPad.*OS (\d+[._]\d+)/ },
      { name: "Android", regex: /Android (\d+\.?\d*)/ },
      { name: "Linux", regex: /Linux/ },
      { name: "Chrome OS", regex: /CrOS/ },
    ];

    for (const { name, regex } of systems) {
      const match = ua.match(regex);
      if (match) {
        let version = match[1] || match[2] || null;
        if (version) {
          version = version.replace(/_/g, ".");
        }
        return { name, version };
      }
    }

    return { name: "Unknown", version: null };
  }

  private detectDevice(ua: string): { type: string; model: string | null } {
    if (/iPad/i.test(ua)) {
      return { type: "tablet", model: "iPad" };
    }
    if (/iPhone/i.test(ua)) {
      return { type: "mobile", model: "iPhone" };
    }
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) {
      return { type: "mobile", model: "Android Phone" };
    }
    if (/Android/i.test(ua)) {
      return { type: "tablet", model: "Android Tablet" };
    }
    if (/Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return { type: "mobile", model: null };
    }

    return { type: "desktop", model: null };
  }
}

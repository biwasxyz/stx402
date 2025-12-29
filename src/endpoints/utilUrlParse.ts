import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilUrlParse extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Parse URL into components",
    parameters: [
      {
        name: "url",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "URL to parse",
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
        description: "Parsed URL",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                protocol: { type: "string" as const },
                host: { type: "string" as const },
                pathname: { type: "string" as const },
                query: { type: "object" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid URL" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const urlStr = c.req.query("url");

    if (!urlStr) {
      return this.errorResponse(c, "url parameter is required", 400);
    }

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return this.errorResponse(c, "Invalid URL format", 400);
    }

    // Parse query parameters
    const queryParams: Record<string, string | string[]> = {};
    for (const [key, value] of parsed.searchParams.entries()) {
      if (queryParams[key]) {
        if (Array.isArray(queryParams[key])) {
          (queryParams[key] as string[]).push(value);
        } else {
          queryParams[key] = [queryParams[key] as string, value];
        }
      } else {
        queryParams[key] = value;
      }
    }

    // Parse path segments
    const pathSegments = parsed.pathname.split("/").filter((s) => s.length > 0);

    return c.json({
      original: urlStr,
      protocol: parsed.protocol.replace(":", ""),
      username: parsed.username || null,
      password: parsed.password || null,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port || null,
      pathname: parsed.pathname,
      pathSegments,
      search: parsed.search || null,
      query: queryParams,
      hash: parsed.hash ? parsed.hash.slice(1) : null,
      origin: parsed.origin,
      isSecure: parsed.protocol === "https:",
      tokenType,
    });
  }
}

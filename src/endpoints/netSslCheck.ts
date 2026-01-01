import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetSslCheck extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) Check SSL/TLS certificate and HTTPS connectivity for a domain",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              domain: {
                type: "string" as const,
                description: "Domain to check (e.g., example.com)",
              },
              port: {
                type: "integer" as const,
                default: 443,
                description: "Port to check (default 443)",
              },
            },
            required: ["domain"],
          },
        },
      },
    },
    parameters: [
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "SSL check results",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                domain: { type: "string" as const },
                valid: { type: "boolean" as const, description: "Whether SSL is valid and working" },
                protocol: { type: "string" as const, description: "TLS protocol version" },
                httpVersion: { type: "string" as const, description: "HTTP version supported" },
                responseTime: { type: "number" as const, description: "Connection time in ms" },
                securityHeaders: {
                  type: "object" as const,
                  description: "Security-related headers present",
                },
                redirectsToHttps: { type: "boolean" as const },
                error: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid domain" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const body = await c.req.json();

    const domain = body.domain?.trim();
    const port = body.port || 443;

    if (!domain) {
      return this.errorResponse(c, "Domain is required", 400);
    }

    // Validate domain format (basic check)
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain)) {
      return this.errorResponse(c, "Invalid domain format", 400);
    }

    const httpsUrl = port === 443 ? `https://${domain}` : `https://${domain}:${port}`;
    const httpUrl = `http://${domain}`;

    const startTime = Date.now();
    let valid = false;
    let protocol: string | null = null;
    let httpVersion: string | null = null;
    let error: string | null = null;
    let securityHeaders: Record<string, string | boolean> = {};
    let redirectsToHttps = false;
    let responseTime: number | null = null;

    // Check HTTPS
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(httpsUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "STX402-SSLCheck/1.0",
        },
      });

      clearTimeout(timeoutId);
      responseTime = Date.now() - startTime;
      valid = true;

      // Extract security headers
      const hsts = response.headers.get("strict-transport-security");
      const csp = response.headers.get("content-security-policy");
      const xfo = response.headers.get("x-frame-options");
      const xcto = response.headers.get("x-content-type-options");
      const xssp = response.headers.get("x-xss-protection");
      const rp = response.headers.get("referrer-policy");
      const pp = response.headers.get("permissions-policy");

      securityHeaders = {
        hasHSTS: !!hsts,
        hstsMaxAge: hsts ? this.parseHstsMaxAge(hsts) : null,
        hstsIncludesSubdomains: hsts?.includes("includeSubDomains") || false,
        hstsPreload: hsts?.includes("preload") || false,
        hasCSP: !!csp,
        hasXFrameOptions: !!xfo,
        xFrameOptions: xfo || null,
        hasXContentTypeOptions: xcto === "nosniff",
        hasXXSSProtection: !!xssp,
        hasReferrerPolicy: !!rp,
        referrerPolicy: rp || null,
        hasPermissionsPolicy: !!pp,
      };

      // Get server info
      const server = response.headers.get("server");
      if (server) {
        securityHeaders.server = server;
      }

    } catch (e: any) {
      responseTime = Date.now() - startTime;
      if (e.name === "AbortError") {
        error = "Connection timed out";
      } else if (e.message?.includes("certificate")) {
        error = `Certificate error: ${e.message}`;
      } else {
        error = e.message || "HTTPS connection failed";
      }
    }

    // Check if HTTP redirects to HTTPS
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const httpResponse = await fetch(httpUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "STX402-SSLCheck/1.0",
        },
      });

      clearTimeout(timeoutId);

      if ([301, 302, 307, 308].includes(httpResponse.status)) {
        const location = httpResponse.headers.get("location");
        if (location?.startsWith("https://")) {
          redirectsToHttps = true;
        }
      }
    } catch {
      // Ignore HTTP check errors
    }

    return c.json({
      domain,
      port,
      valid,
      responseTimeMs: responseTime,
      ...(error && { error }),
      redirectsToHttps,
      securityHeaders: Object.keys(securityHeaders).length > 0 ? securityHeaders : null,
      tokenType,
    });
  }

  private parseHstsMaxAge(hsts: string): number | null {
    const match = hsts.match(/max-age=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}

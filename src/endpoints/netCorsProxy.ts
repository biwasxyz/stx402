import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetCorsProxy extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) Fetch a URL with CORS headers added to response",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              url: {
                type: "string" as const,
                description: "URL to fetch",
              },
              method: {
                type: "string" as const,
                enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] as const,
                default: "GET",
              },
              headers: {
                type: "object" as const,
                description: "Headers to send with request",
              },
              body: {
                type: "string" as const,
                description: "Request body (for POST/PUT/PATCH)",
              },
              timeout: {
                type: "integer" as const,
                default: 10000,
                description: "Timeout in milliseconds (max 30000)",
              },
            },
            required: ["url"],
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
        description: "Proxied response with CORS headers",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                status: { type: "integer" as const },
                statusText: { type: "string" as const },
                headers: { type: "object" as const },
                body: { type: "string" as const, description: "Response body as text" },
                bodyBase64: { type: "string" as const, description: "Response body as base64 (for binary)" },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid request" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const body = await c.req.json();

    const url = body.url;
    const method = body.method || "GET";
    const customHeaders = body.headers || {};
    const requestBody = body.body;
    const timeout = Math.min(body.timeout || 10000, 30000);

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return this.errorResponse(c, "Only HTTP/HTTPS URLs are supported", 400);
      }
    } catch {
      return this.errorResponse(c, "Invalid URL format", 400);
    }

    // Block internal/private IPs to prevent SSRF
    const hostname = parsedUrl.hostname;
    if (this.isPrivateHost(hostname)) {
      return this.errorResponse(c, "Private/internal URLs are not allowed", 400);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
        headers: {
          "User-Agent": "STX402-CorsProxy/1.0",
          ...customHeaders,
        },
      };

      if (requestBody && ["POST", "PUT", "PATCH"].includes(method)) {
        fetchOptions.body = requestBody;
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Extract headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Get response body
      const contentType = response.headers.get("content-type") || "";
      const isBinary = !contentType.includes("text") &&
                       !contentType.includes("json") &&
                       !contentType.includes("xml") &&
                       !contentType.includes("javascript");

      let responseBody: string;
      let bodyBase64: string | null = null;

      if (isBinary) {
        const buffer = await response.arrayBuffer();
        // Convert to base64 for binary content
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        bodyBase64 = btoa(binary);
        responseBody = `[Binary content, ${bytes.length} bytes - see bodyBase64]`;
      } else {
        responseBody = await response.text();
      }

      return c.json({
        status: response.status,
        statusText: response.statusText,
        headers,
        body: responseBody,
        ...(bodyBase64 && { bodyBase64 }),
        tokenType,
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        return this.errorResponse(c, `Request timed out after ${timeout}ms`, 400);
      }
      return this.errorResponse(c, `Proxy request failed: ${error.message}`, 400);
    }
  }

  private isPrivateHost(hostname: string): boolean {
    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    // Block common internal hostnames
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return true;
    }

    // Check for private IP ranges
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }

    return false;
  }
}

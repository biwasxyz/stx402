import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetHttpProbe extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) Probe a URL for status, timing, headers, and redirect chain",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            properties: {
              url: {
                type: "string" as const,
                description: "URL to probe",
              },
              method: {
                type: "string" as const,
                enum: ["GET", "HEAD"] as const,
                default: "HEAD",
                description: "HTTP method (HEAD is faster, GET gets body size)",
              },
              followRedirects: {
                type: "boolean" as const,
                default: true,
                description: "Follow redirects and report chain",
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
        description: "Probe results",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                url: { type: "string" as const },
                finalUrl: { type: "string" as const },
                status: { type: "integer" as const },
                statusText: { type: "string" as const },
                timing: {
                  type: "object" as const,
                  properties: {
                    total: { type: "number" as const, description: "Total time in ms" },
                  },
                },
                headers: { type: "object" as const },
                redirectChain: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      url: { type: "string" as const },
                      status: { type: "integer" as const },
                    },
                  },
                },
                contentLength: { type: "integer" as const },
                contentType: { type: "string" as const },
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
    const body = await c.req.json();

    const url = body.url;
    const method = body.method || "HEAD";
    const followRedirects = body.followRedirects !== false;
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

    const redirectChain: Array<{ url: string; status: number }> = [];
    let currentUrl = url;
    let finalResponse: Response | null = null;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      if (followRedirects) {
        // Manual redirect following to capture chain
        let redirectCount = 0;
        const maxRedirects = 10;

        while (redirectCount < maxRedirects) {
          const response = await fetch(currentUrl, {
            method,
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent": "STX402-HttpProbe/1.0",
            },
          });

          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) break;

            redirectChain.push({ url: currentUrl, status: response.status });

            // Resolve relative URLs
            currentUrl = new URL(location, currentUrl).toString();
            redirectCount++;
          } else {
            finalResponse = response;
            break;
          }
        }
      } else {
        finalResponse = await fetch(currentUrl, {
          method,
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "STX402-HttpProbe/1.0",
          },
        });
      }

      clearTimeout(timeoutId);

      if (!finalResponse) {
        return this.errorResponse(c, "Too many redirects or no response", 400);
      }

      const endTime = Date.now();

      // Extract headers as plain object
      const headers: Record<string, string> = {};
      finalResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return c.json({
        url,
        finalUrl: currentUrl,
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        timing: {
          totalMs: endTime - startTime,
        },
        headers,
        redirectChain: redirectChain.length > 0 ? redirectChain : null,
        contentLength: parseInt(headers["content-length"] || "0") || null,
        contentType: headers["content-type"] || null,
        server: headers["server"] || null,
        tokenType,
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        return this.errorResponse(c, `Request timed out after ${timeout}ms`, 400);
      }
      return this.errorResponse(c, `Probe failed: ${error.message}`, 400);
    }
  }
}

import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class NetRequestFingerprint extends BaseEndpoint {
  schema = {
    tags: ["Network"],
    summary: "(paid) Fingerprint the incoming request (TLS, HTTP, headers, client hints)",
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
        description: "Request fingerprint data",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                ip: { type: "string" as const },
                httpProtocol: { type: "string" as const, description: "HTTP/1.1, HTTP/2, HTTP/3" },
                tlsVersion: { type: "string" as const, description: "TLS version (e.g., TLSv1.3)" },
                tlsCipher: { type: "string" as const, description: "Cipher suite used" },
                tlsClientAuth: { type: "string" as const, description: "Client certificate status" },
                userAgent: { type: "string" as const },
                acceptLanguage: { type: "string" as const },
                acceptEncoding: { type: "string" as const },
                colo: { type: "string" as const, description: "Cloudflare datacenter" },
                clientHints: {
                  type: "object" as const,
                  description: "Client hints if provided",
                },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "402": {
        description: "Payment required",
      },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    // Get CF properties from request
    const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;

    // Get client IP
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    // Extract client hints (modern browsers)
    const clientHints: Record<string, string | null> = {
      platform: c.req.header("sec-ch-ua-platform") || null,
      mobile: c.req.header("sec-ch-ua-mobile") || null,
      brands: c.req.header("sec-ch-ua") || null,
      arch: c.req.header("sec-ch-ua-arch") || null,
      model: c.req.header("sec-ch-ua-model") || null,
      fullVersion: c.req.header("sec-ch-ua-full-version") || null,
    };

    // Filter out null values
    const filteredHints = Object.fromEntries(
      Object.entries(clientHints).filter(([_, v]) => v !== null)
    );

    return c.json({
      ip,
      httpProtocol: cf?.httpProtocol || null,
      tlsVersion: cf?.tlsVersion || null,
      tlsCipher: cf?.tlsCipher || null,
      tlsClientAuth: (cf as any)?.tlsClientAuth?.certPresented ? "presented" : "none",
      userAgent: c.req.header("user-agent") || null,
      acceptLanguage: c.req.header("accept-language") || null,
      acceptEncoding: c.req.header("accept-encoding") || null,
      dnt: c.req.header("dnt") || null,
      colo: cf?.colo || null,
      clientHints: Object.keys(filteredHints).length > 0 ? filteredHints : null,
      tokenType,
    });
  }
}

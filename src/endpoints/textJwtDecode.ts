import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
}

export class TextJwtDecode extends BaseEndpoint {
  schema = {
    tags: ["Text"],
    summary: "(paid) Decode JWT token (without verification)",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["token"],
            properties: {
              token: { type: "string" as const, description: "JWT token to decode" },
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
        description: "Decoded JWT",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                header: { type: "object" as const },
                payload: { type: "object" as const },
                signature: { type: "string" as const },
                isExpired: { type: "boolean" as const },
                expiresAt: { type: "string" as const, nullable: true },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid JWT format" },
      "402": { description: "Payment required" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    let body: { token?: string };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { token } = body;

    if (typeof token !== "string") {
      return this.errorResponse(c, "token field is required and must be a string", 400);
    }

    // Split JWT into parts
    const parts = token.split(".");
    if (parts.length !== 3) {
      return this.errorResponse(c, "Invalid JWT format: must have 3 parts", 400);
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode base64url
    const decodeBase64Url = (str: string): string => {
      // Convert base64url to base64
      const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
      // Add padding if needed
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      return atob(padded);
    };

    let header: JwtHeader;
    let payload: JwtPayload;

    try {
      header = JSON.parse(decodeBase64Url(headerB64));
    } catch {
      return this.errorResponse(c, "Invalid JWT header: not valid base64url JSON", 400);
    }

    try {
      payload = JSON.parse(decodeBase64Url(payloadB64));
    } catch {
      return this.errorResponse(c, "Invalid JWT payload: not valid base64url JSON", 400);
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp ? payload.exp < now : false;
    const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;

    return c.json({
      header,
      payload,
      signature: signatureB64,
      isExpired,
      expiresAt,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      notBefore: payload.nbf ? new Date(payload.nbf * 1000).toISOString() : null,
      tokenType,
    });
  }
}

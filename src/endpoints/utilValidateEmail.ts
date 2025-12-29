import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

export class UtilValidateEmail extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Validate email address format",
    parameters: [
      {
        name: "email",
        in: "query" as const,
        required: true,
        schema: { type: "string" as const },
        description: "Email address to validate",
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
        description: "Validation result",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                email: { type: "string" as const },
                isValid: { type: "boolean" as const },
                localPart: { type: "string" as const },
                domain: { type: "string" as const },
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

    const email = c.req.query("email");

    if (!email) {
      return this.errorResponse(c, "email parameter is required", 400);
    }

    const issues: string[] = [];
    let isValid = true;

    // Basic structure check
    const parts = email.split("@");
    if (parts.length !== 2) {
      isValid = false;
      issues.push("Must contain exactly one @ symbol");
    }

    const [localPart, domain] = parts;

    // Local part validation
    if (localPart) {
      if (localPart.length === 0) {
        isValid = false;
        issues.push("Local part cannot be empty");
      }
      if (localPart.length > 64) {
        isValid = false;
        issues.push("Local part exceeds 64 characters");
      }
      if (localPart.startsWith(".") || localPart.endsWith(".")) {
        isValid = false;
        issues.push("Local part cannot start or end with a dot");
      }
      if (/\.\./.test(localPart)) {
        isValid = false;
        issues.push("Local part cannot contain consecutive dots");
      }
    }

    // Domain validation
    if (domain) {
      if (domain.length === 0) {
        isValid = false;
        issues.push("Domain cannot be empty");
      }
      if (domain.length > 255) {
        isValid = false;
        issues.push("Domain exceeds 255 characters");
      }
      if (!domain.includes(".")) {
        isValid = false;
        issues.push("Domain must contain at least one dot");
      }
      if (domain.startsWith("-") || domain.endsWith("-")) {
        isValid = false;
        issues.push("Domain cannot start or end with a hyphen");
      }
      if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
        isValid = false;
        issues.push("Domain contains invalid characters");
      }

      // TLD validation
      const tld = domain.split(".").pop() || "";
      if (tld.length < 2) {
        isValid = false;
        issues.push("TLD must be at least 2 characters");
      }
      if (/^\d+$/.test(tld)) {
        isValid = false;
        issues.push("TLD cannot be all numbers");
      }
    }

    // RFC 5322 compliant regex for additional validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (isValid && !emailRegex.test(email)) {
      isValid = false;
      issues.push("Does not match RFC 5322 email format");
    }

    // Common disposable email domain check
    const disposableDomains = ["tempmail.com", "throwaway.email", "mailinator.com", "guerrillamail.com"];
    const isDisposable = domain ? disposableDomains.includes(domain.toLowerCase()) : false;

    return c.json({
      email,
      isValid,
      localPart: localPart || null,
      domain: domain || null,
      tld: domain ? domain.split(".").pop() : null,
      issues: issues.length > 0 ? issues : null,
      isDisposable,
      normalized: email.toLowerCase().trim(),
      tokenType,
    });
  }
}

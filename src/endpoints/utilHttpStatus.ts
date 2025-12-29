import { BaseEndpoint } from "./BaseEndpoint";
import type { AppContext } from "../types";

const HTTP_STATUS_CODES: Record<number, { name: string; description: string; category: string }> = {
  // 1xx Informational
  100: { name: "Continue", description: "Request received, continue processing", category: "Informational" },
  101: { name: "Switching Protocols", description: "Switching to new protocol", category: "Informational" },
  102: { name: "Processing", description: "Request is being processed", category: "Informational" },
  103: { name: "Early Hints", description: "Preload hints for resources", category: "Informational" },

  // 2xx Success
  200: { name: "OK", description: "Request succeeded", category: "Success" },
  201: { name: "Created", description: "Resource created successfully", category: "Success" },
  202: { name: "Accepted", description: "Request accepted for processing", category: "Success" },
  203: { name: "Non-Authoritative Information", description: "Modified response from proxy", category: "Success" },
  204: { name: "No Content", description: "Request succeeded, no content returned", category: "Success" },
  205: { name: "Reset Content", description: "Request succeeded, reset document view", category: "Success" },
  206: { name: "Partial Content", description: "Partial resource returned", category: "Success" },
  207: { name: "Multi-Status", description: "Multiple status codes for operations", category: "Success" },
  208: { name: "Already Reported", description: "Members already enumerated", category: "Success" },
  226: { name: "IM Used", description: "Instance manipulation applied", category: "Success" },

  // 3xx Redirection
  300: { name: "Multiple Choices", description: "Multiple options available", category: "Redirection" },
  301: { name: "Moved Permanently", description: "Resource moved permanently", category: "Redirection" },
  302: { name: "Found", description: "Resource temporarily moved", category: "Redirection" },
  303: { name: "See Other", description: "Redirect to different resource", category: "Redirection" },
  304: { name: "Not Modified", description: "Resource not modified since last request", category: "Redirection" },
  305: { name: "Use Proxy", description: "Must use specified proxy", category: "Redirection" },
  307: { name: "Temporary Redirect", description: "Temporary redirect, keep method", category: "Redirection" },
  308: { name: "Permanent Redirect", description: "Permanent redirect, keep method", category: "Redirection" },

  // 4xx Client Errors
  400: { name: "Bad Request", description: "Malformed request syntax", category: "Client Error" },
  401: { name: "Unauthorized", description: "Authentication required", category: "Client Error" },
  402: { name: "Payment Required", description: "Payment required for access", category: "Client Error" },
  403: { name: "Forbidden", description: "Server refuses to authorize request", category: "Client Error" },
  404: { name: "Not Found", description: "Resource not found", category: "Client Error" },
  405: { name: "Method Not Allowed", description: "Method not supported for resource", category: "Client Error" },
  406: { name: "Not Acceptable", description: "Cannot satisfy Accept headers", category: "Client Error" },
  407: { name: "Proxy Authentication Required", description: "Proxy authentication needed", category: "Client Error" },
  408: { name: "Request Timeout", description: "Request took too long", category: "Client Error" },
  409: { name: "Conflict", description: "Conflict with current resource state", category: "Client Error" },
  410: { name: "Gone", description: "Resource permanently removed", category: "Client Error" },
  411: { name: "Length Required", description: "Content-Length header required", category: "Client Error" },
  412: { name: "Precondition Failed", description: "Precondition in headers not met", category: "Client Error" },
  413: { name: "Payload Too Large", description: "Request body too large", category: "Client Error" },
  414: { name: "URI Too Long", description: "Request URI too long", category: "Client Error" },
  415: { name: "Unsupported Media Type", description: "Media type not supported", category: "Client Error" },
  416: { name: "Range Not Satisfiable", description: "Requested range not available", category: "Client Error" },
  417: { name: "Expectation Failed", description: "Expect header cannot be met", category: "Client Error" },
  418: { name: "I'm a teapot", description: "Server is a teapot (RFC 2324)", category: "Client Error" },
  421: { name: "Misdirected Request", description: "Request directed at wrong server", category: "Client Error" },
  422: { name: "Unprocessable Entity", description: "Semantic errors in request", category: "Client Error" },
  423: { name: "Locked", description: "Resource is locked", category: "Client Error" },
  424: { name: "Failed Dependency", description: "Dependency request failed", category: "Client Error" },
  425: { name: "Too Early", description: "Request might be replayed", category: "Client Error" },
  426: { name: "Upgrade Required", description: "Client must upgrade protocol", category: "Client Error" },
  428: { name: "Precondition Required", description: "Request must be conditional", category: "Client Error" },
  429: { name: "Too Many Requests", description: "Rate limit exceeded", category: "Client Error" },
  431: { name: "Request Header Fields Too Large", description: "Headers too large", category: "Client Error" },
  451: { name: "Unavailable For Legal Reasons", description: "Blocked for legal reasons", category: "Client Error" },

  // 5xx Server Errors
  500: { name: "Internal Server Error", description: "Generic server error", category: "Server Error" },
  501: { name: "Not Implemented", description: "Functionality not supported", category: "Server Error" },
  502: { name: "Bad Gateway", description: "Invalid response from upstream", category: "Server Error" },
  503: { name: "Service Unavailable", description: "Server temporarily unavailable", category: "Server Error" },
  504: { name: "Gateway Timeout", description: "Upstream server timeout", category: "Server Error" },
  505: { name: "HTTP Version Not Supported", description: "HTTP version not supported", category: "Server Error" },
  506: { name: "Variant Also Negotiates", description: "Circular reference in negotiation", category: "Server Error" },
  507: { name: "Insufficient Storage", description: "Server storage full", category: "Server Error" },
  508: { name: "Loop Detected", description: "Infinite loop in request", category: "Server Error" },
  510: { name: "Not Extended", description: "Further extensions required", category: "Server Error" },
  511: { name: "Network Authentication Required", description: "Network authentication needed", category: "Server Error" },
};

export class UtilHttpStatus extends BaseEndpoint {
  schema = {
    tags: ["Utility"],
    summary: "(paid) Get HTTP status code information",
    parameters: [
      {
        name: "code",
        in: "query" as const,
        required: false,
        schema: { type: "integer" as const },
        description: "Specific status code to lookup (omit for all codes)",
      },
      {
        name: "category",
        in: "query" as const,
        required: false,
        schema: { type: "string" as const, enum: ["1xx", "2xx", "3xx", "4xx", "5xx"] as const },
        description: "Filter by category",
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
        description: "HTTP status information",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                code: { type: "integer" as const },
                name: { type: "string" as const },
                description: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid code" },
      "402": { description: "Payment required" },
      "404": { description: "Status code not found" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);

    const codeStr = c.req.query("code");
    const category = c.req.query("category");

    if (codeStr) {
      const code = parseInt(codeStr, 10);
      if (isNaN(code)) {
        return this.errorResponse(c, "Invalid status code", 400);
      }

      const info = HTTP_STATUS_CODES[code];
      if (!info) {
        return this.errorResponse(c, `Unknown status code: ${code}`, 404);
      }

      return c.json({
        code,
        ...info,
        tokenType,
      });
    }

    // Return filtered or all codes
    let codes = Object.entries(HTTP_STATUS_CODES);

    if (category) {
      const prefix = parseInt(category.charAt(0), 10);
      codes = codes.filter(([code]) => Math.floor(parseInt(code, 10) / 100) === prefix);
    }

    const result = codes.map(([code, info]) => ({
      code: parseInt(code, 10),
      ...info,
    }));

    return c.json({
      count: result.length,
      codes: result,
      tokenType,
    });
  }
}

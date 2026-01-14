/**
 * X402 Schema Generator
 *
 * Transforms OpenAPI spec + pricing tiers into x402.json format
 * for StacksX402 scanner discovery.
 */

import {
  ENDPOINT_TIERS,
  TIER_AMOUNTS,
  type PricingTier,
  type TokenType,
} from "./pricing";

// =============================================================================
// Types
// =============================================================================

export interface X402Entry {
  scheme: "exact";
  network: "stacks";
  asset: TokenType;
  payTo: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
  resource: string;
  description: string;
  mimeType: "application/json";
  outputSchema: {
    input: X402InputSchema;
    output: Record<string, string>;
  };
}

export interface X402InputSchema {
  type: "http";
  method: "GET" | "POST";
  bodyType?: "json";
  bodyFields?: Record<string, X402FieldSchema>;
}

export interface X402FieldSchema {
  type: string;
  required: boolean;
  description?: string;
}

export interface X402Schema {
  x402Version: number;
  name: string;
  image: string;
  accepts: X402Entry[];
}

export interface OpenAPISpec {
  paths: Record<string, Record<string, OpenAPIOperation>>;
  info?: { title?: string; version?: string };
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  requestBody?: {
    content?: {
      "application/json"?: {
        schema?: OpenAPISchema;
      };
    };
  };
  responses?: {
    "200"?: {
      content?: {
        "application/json"?: {
          schema?: OpenAPISchema;
        };
      };
    };
  };
}

export interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  description?: string;
  additionalProperties?: OpenAPISchema | boolean;
}

// =============================================================================
// Conversion Helpers
// =============================================================================

const TOKENS: TokenType[] = ["STX", "sBTC", "USDCx"];

/**
 * Convert human-readable amount to smallest unit
 */
function toSmallestUnit(amountStr: string, token: TokenType): string {
  const amount = parseFloat(amountStr);
  switch (token) {
    case "STX":
      return String(Math.round(amount * 1_000_000)); // microSTX
    case "sBTC":
      return String(Math.round(amount * 100_000_000)); // sats
    case "USDCx":
      return String(Math.round(amount * 1_000_000)); // microUSDCx
    default:
      return String(Math.round(amount * 1_000_000));
  }
}

/**
 * Get timeout based on tier complexity
 */
function getTimeoutForTier(tier: PricingTier): number {
  switch (tier) {
    case "heavy_ai":
    case "storage_ai":
      return 120;
    case "ai":
      return 90;
    default:
      return 60;
  }
}

/**
 * Simplify OpenAPI type to x402 type string
 */
function simplifyType(schema: OpenAPISchema | undefined): string {
  if (!schema || !schema.type) return "object";

  switch (schema.type) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
    case "integer":
      return "number";
    case "array":
      return "array";
    case "object":
    default:
      return "object";
  }
}

/**
 * Convert OpenAPI request body schema to x402 bodyFields
 */
function extractBodyFields(
  requestBody: OpenAPIOperation["requestBody"]
): Record<string, X402FieldSchema> | undefined {
  const schema = requestBody?.content?.["application/json"]?.schema;
  if (!schema?.properties) return undefined;

  const requiredFields = schema.required || [];
  const fields: Record<string, X402FieldSchema> = {};

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    fields[name] = {
      type: simplifyType(propSchema),
      required: requiredFields.includes(name),
      description: propSchema.description,
    };
  }

  return Object.keys(fields).length > 0 ? fields : undefined;
}

/**
 * Convert OpenAPI response schema to x402 output format
 */
function extractOutputSchema(
  responses: OpenAPIOperation["responses"]
): Record<string, string> {
  const schema = responses?.["200"]?.content?.["application/json"]?.schema;
  if (!schema?.properties) return {};

  const output: Record<string, string> = {};

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    output[name] = simplifyType(propSchema);
  }

  return output;
}

/**
 * Clean description - remove "(paid)" prefix and trim
 */
function cleanDescription(summary?: string): string {
  if (!summary) return "";
  return summary.replace(/^\(paid\)\s*/i, "").trim();
}

// =============================================================================
// Main Generator
// =============================================================================

export interface GeneratorConfig {
  network: "mainnet" | "testnet";
  payTo: string;
  name?: string;
  image?: string;
}

/**
 * Generate x402.json schema from OpenAPI spec
 */
export function generateX402Schema(
  openapi: OpenAPISpec,
  config: GeneratorConfig
): X402Schema {
  const accepts: X402Entry[] = [];

  // Process each path in OpenAPI spec
  for (const [path, methods] of Object.entries(openapi.paths)) {
    // Check if this is a paid endpoint
    const tier = ENDPOINT_TIERS[path];
    if (!tier) continue; // Skip free endpoints

    for (const [method, operation] of Object.entries(methods)) {
      if (method === "options" || method === "head") continue;

      const httpMethod = method.toUpperCase() as "GET" | "POST";
      const description = cleanDescription(operation.summary);
      const timeout = getTimeoutForTier(tier);

      // Build input schema
      const bodyFields = extractBodyFields(operation.requestBody);
      const input: X402InputSchema = {
        type: "http",
        method: httpMethod,
      };
      if (httpMethod === "POST" && bodyFields) {
        input.bodyType = "json";
        input.bodyFields = bodyFields;
      }

      // Build output schema
      const output = extractOutputSchema(operation.responses);

      // Create entry for each supported token
      for (const token of TOKENS) {
        const tierAmounts = TIER_AMOUNTS[tier];
        const amount = toSmallestUnit(tierAmounts[token], token);

        accepts.push({
          scheme: "exact",
          network: "stacks",
          asset: token,
          payTo: config.payTo,
          maxAmountRequired: amount,
          maxTimeoutSeconds: timeout,
          resource: path,
          description,
          mimeType: "application/json",
          outputSchema: { input, output },
        });
      }
    }
  }

  return {
    x402Version: 1,
    name: config.name || "stx402 Directory",
    image: config.image || "https://stx402.com/favicon.svg",
    accepts,
  };
}

/**
 * Generate x402.json from env bindings (for runtime endpoint)
 */
export async function generateX402SchemaFromUrl(
  baseUrl: string,
  config: Partial<GeneratorConfig>
): Promise<X402Schema> {
  // Fetch OpenAPI spec from the server
  const response = await fetch(`${baseUrl}/openapi.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
  }

  const openapi = (await response.json()) as OpenAPISpec;

  // Use defaults for missing config
  const fullConfig: GeneratorConfig = {
    network: config.network || "mainnet",
    payTo: config.payTo || "",
    name: config.name,
    image: config.image,
  };

  if (!fullConfig.payTo) {
    throw new Error("payTo address is required");
  }

  return generateX402Schema(openapi, fullConfig);
}

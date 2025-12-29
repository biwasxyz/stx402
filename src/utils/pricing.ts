import { BTCtoSats, STXtoMicroSTX, USDCxToMicroUSDCx } from "x402-stacks";

export type TokenType = "STX" | "sBTC" | "USDCx";

// Pricing tiers for different endpoint categories
export type PricingTier = "simple" | "ai" | "heavy_ai";

// Amount per tier per token type
export const TIER_AMOUNTS: Record<PricingTier, Record<TokenType, string>> = {
  simple: {
    STX: "0.001",
    sBTC: "0.000001",
    USDCx: "0.001",
  },
  ai: {
    STX: "0.003",
    sBTC: "0.000003",
    USDCx: "0.003",
  },
  heavy_ai: {
    STX: "0.01",
    sBTC: "0.00001",
    USDCx: "0.01",
  },
};

// Endpoint path to pricing tier mapping
export const ENDPOINT_TIERS: Record<string, PricingTier> = {
  // Stacks endpoints (simple tier)
  "/api/stacks/get-bns-name": "simple",
  "/api/stacks/validate-address": "simple",
  "/api/stacks/convert-address": "simple",
  "/api/stacks/decode-clarity-hex": "simple",

  // AI endpoints
  "/api/ai/dad-joke": "ai",
  "/api/ai/summarize": "ai",
  "/api/ai/image-describe": "heavy_ai",
  "/api/ai/tts": "heavy_ai",
  "/api/ai/generate-image": "heavy_ai",

  // Text endpoints (simple tier)
  "/api/text/base64-encode": "simple",
  "/api/text/base64-decode": "simple",
  "/api/text/url-encode": "simple",
  "/api/text/url-decode": "simple",
  "/api/text/html-encode": "simple",
  "/api/text/html-decode": "simple",
  "/api/text/md5": "simple",
  "/api/text/sha256": "simple",
  "/api/text/sha512": "simple",
  "/api/text/hex-encode": "simple",
  "/api/text/hex-decode": "simple",
  "/api/text/jwt-decode": "simple",
  "/api/text/case-convert": "simple",
  "/api/text/slug": "simple",
  "/api/text/word-count": "simple",
  "/api/text/truncate": "simple",
  "/api/text/reverse": "simple",
  "/api/text/rot13": "simple",
  "/api/text/lorem-ipsum": "simple",
  "/api/text/regex-test": "simple",
  "/api/text/regex-extract": "simple",
  "/api/text/diff": "simple",
  "/api/text/validate-email": "simple",
  "/api/text/validate-url": "simple",
  "/api/text/unicode-info": "simple",

  // Data/Math endpoints (simple tier)
  "/api/data/json-format": "simple",
  "/api/data/json-minify": "simple",
  "/api/data/json-validate": "simple",
  "/api/data/json-path": "simple",
  "/api/data/csv-to-json": "simple",
  "/api/data/json-to-csv": "simple",
  "/api/data/xml-to-json": "simple",
  "/api/data/yaml-to-json": "simple",
  "/api/data/json-to-yaml": "simple",
  "/api/math/calculate": "simple",
  "/api/math/unit-convert": "simple",
  "/api/math/currency-convert": "simple",
  "/api/math/percentage": "simple",
  "/api/math/statistics": "simple",
  "/api/math/prime-check": "simple",
  "/api/math/factorial": "simple",
  "/api/math/fibonacci": "simple",
  "/api/math/gcd-lcm": "simple",
  "/api/random/number": "simple",
  "/api/random/string": "simple",
  "/api/random/uuid": "simple",
  "/api/random/password": "simple",
  "/api/random/color": "simple",
  "/api/random/dice": "simple",
  "/api/random/shuffle": "simple",

  // Utility endpoints (simple tier)
  "/api/util/timestamp": "simple",
  "/api/util/timestamp-convert": "simple",
  "/api/util/date-diff": "simple",
  "/api/util/date-add": "simple",
  "/api/util/timezone-convert": "simple",
  "/api/util/cron-parse": "simple",
  "/api/util/cron-next": "simple",
  "/api/util/ip-info": "simple",
  "/api/util/ip-lookup": "simple",
  "/api/util/dns-lookup": "simple",
  "/api/util/whois": "simple",
  "/api/util/http-headers": "simple",
  "/api/util/user-agent-parse": "simple",
  "/api/util/qr-generate": "simple",
  "/api/util/barcode-generate": "simple",
  "/api/util/color-convert": "simple",
  "/api/util/image-placeholder": "simple",
  "/api/util/markdown-to-html": "simple",
  "/api/util/html-to-text": "simple",
  "/api/util/url-parse": "simple",
  "/api/util/url-build": "simple",
  "/api/util/robots-txt-parse": "simple",
  "/api/util/sitemap-parse": "simple",
  "/api/util/ssl-check": "simple",
  "/api/util/http-status": "simple",

  // New AI endpoints (ai tier)
  "/api/ai/sentiment": "ai",
  "/api/ai/keywords": "ai",
  "/api/ai/entities": "ai",
  "/api/ai/language-detect": "ai",
  "/api/ai/translate": "ai",
  "/api/ai/paraphrase": "ai",
  "/api/ai/grammar-check": "ai",
  "/api/ai/code-explain": "ai",
  "/api/ai/code-generate": "ai",
  "/api/ai/classify": "ai",
  "/api/ai/question-answer": "ai",
  "/api/ai/creative-write": "ai",

  // New AI endpoints (heavy_ai tier)
  "/api/ai/image-caption": "heavy_ai",
  "/api/ai/image-ocr": "heavy_ai",
  "/api/ai/tts-long": "heavy_ai",

  // Crypto endpoints (simple tier)
  "/api/crypto/btc-validate": "simple",
  "/api/crypto/btc-balance": "simple",
  "/api/crypto/stx-balance": "simple",
  "/api/crypto/stx-txs": "simple",
  "/api/crypto/stx-nft": "simple",
  "/api/crypto/stx-ft": "simple",
  "/api/crypto/verify-message": "simple",
  "/api/crypto/hash-message": "simple",
  "/api/crypto/contract-source": "simple",
  "/api/crypto/block-height": "simple",
};

// Get pricing tier for an endpoint path (strips path params like :address)
export function getEndpointTier(path: string): PricingTier {
  // Normalize path by removing path parameters
  const normalizedPath = path.replace(/\/:[^/]+/g, "").replace(/\/[^/]+$/, (match) => {
    // Keep the last segment if it's not a dynamic param indicator
    return match.startsWith("/:") ? "" : match;
  });

  // Try exact match first
  if (ENDPOINT_TIERS[path]) {
    return ENDPOINT_TIERS[path];
  }

  // Try normalized path
  if (ENDPOINT_TIERS[normalizedPath]) {
    return ENDPOINT_TIERS[normalizedPath];
  }

  // Try matching by prefix (for paths with params like /api/util/ip-lookup/:ip)
  for (const [endpoint, tier] of Object.entries(ENDPOINT_TIERS)) {
    if (path.startsWith(endpoint)) {
      return tier;
    }
  }

  // Default to simple tier
  return "simple";
}

// Get payment amount for a specific endpoint path
export function getPaymentAmountForPath(
  path: string,
  tokenType: TokenType
): bigint {
  const tier = getEndpointTier(path);
  const amountStr = TIER_AMOUNTS[tier][tokenType];
  return convertToSmallestUnit(amountStr, tokenType);
}

// Convert amount string to smallest unit (microSTX, sats, microUSDCx)
function convertToSmallestUnit(amountStr: string, tokenType: TokenType): bigint {
  const amountNum = parseFloat(amountStr);
  switch (tokenType) {
    case "STX":
      return STXtoMicroSTX(amountStr);
    case "sBTC":
      return BTCtoSats(amountNum);
    case "USDCx":
      return USDCxToMicroUSDCx(amountStr);
    default:
      throw new Error(`Unknown tokenType: ${tokenType}`);
  }
}

// Legacy: Keep DEFAULT_AMOUNTS for backwards compatibility
export const DEFAULT_AMOUNTS: Record<TokenType, string> = TIER_AMOUNTS.simple;

export function validateTokenType(tokenTypeStr: string): TokenType {
  const upper = tokenTypeStr.toUpperCase();
  const validMap: Record<string, TokenType> = {
    STX: "STX",
    SBTC: "sBTC",
    USDCX: "USDCx",
  };
  const validTokens: TokenType[] = ["STX", "sBTC", "USDCx"];
  if (validMap[upper]) {
    return validMap[upper];
  }
  throw new Error(
    `Invalid tokenType: ${tokenTypeStr}. Supported: ${validTokens.join(", ")}`
  );
}

export function getPaymentAmount(tokenType: TokenType): bigint {
  const amountStr = DEFAULT_AMOUNTS[tokenType];
  const amountNum = parseFloat(amountStr);
  switch (tokenType) {
    case "STX":
      return STXtoMicroSTX(amountStr);
    case "sBTC":
      return BTCtoSats(amountNum);
    case "USDCx":
      return USDCxToMicroUSDCx(amountStr);
    default:
      throw new Error(`Unknown tokenType: ${tokenType}`);
  }
}

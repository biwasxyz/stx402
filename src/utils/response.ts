import type { AppContext } from "../types";
import type { TokenType } from "./pricing";

/**
 * Standard chainable response format for all endpoints.
 * The `result` field contains the primary output that can be used
 * as input to other endpoints (UNIX philosophy).
 */
export interface ChainableResponse<T> {
  /** Primary output - usable as input to other endpoints */
  result: T;
  /** Optional metadata about the processing */
  metadata?: {
    processingTimeMs?: number;
    inputLength?: number;
    outputLength?: number;
    model?: string;
    tier?: string;
    [key: string]: unknown;
  };
  /** Token type used for payment */
  tokenType: TokenType;
}

/**
 * Create a standardized chainable response.
 * Use this for all new endpoints to ensure consistent output format.
 *
 * @param c - Hono context
 * @param result - Primary result value (will be in `result` field)
 * @param tokenType - Token type used for payment
 * @param metadata - Optional metadata about processing
 * @returns JSON response with chainable format
 *
 * @example
 * // Simple string result
 * return chainableResponse(c, "SGVsbG8gV29ybGQ=", tokenType);
 *
 * @example
 * // With metadata
 * return chainableResponse(c, encodedString, tokenType, {
 *   inputLength: input.length,
 *   outputLength: encodedString.length,
 *   processingTimeMs: Date.now() - start,
 * });
 */
export function chainableResponse<T>(
  c: AppContext,
  result: T,
  tokenType: TokenType,
  metadata?: ChainableResponse<T>["metadata"]
): Response {
  const response: ChainableResponse<T> = {
    result,
    tokenType,
  };

  if (metadata && Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }

  return c.json(response);
}

/**
 * Create a chainable response with timing metadata automatically calculated.
 *
 * @param c - Hono context
 * @param result - Primary result value
 * @param tokenType - Token type used for payment
 * @param startTime - Start time from Date.now()
 * @param extraMetadata - Additional metadata to include
 * @returns JSON response with chainable format and timing
 */
export function chainableResponseWithTiming<T>(
  c: AppContext,
  result: T,
  tokenType: TokenType,
  startTime: number,
  extraMetadata?: Omit<ChainableResponse<T>["metadata"], "processingTimeMs">
): Response {
  const processingTimeMs = Date.now() - startTime;
  return chainableResponse(c, result, tokenType, {
    processingTimeMs,
    ...extraMetadata,
  });
}

/**
 * Type guard to check if a response follows the chainable format.
 */
export function isChainableResponse<T>(
  obj: unknown
): obj is ChainableResponse<T> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "result" in obj &&
    "tokenType" in obj
  );
}

/**
 * Extract the result from a chainable response.
 * Useful when chaining endpoint outputs.
 */
export function extractResult<T>(response: ChainableResponse<T>): T {
  return response.result;
}

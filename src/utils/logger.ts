/**
 * Structured Logger for Cloudflare Workers
 *
 * Provides consistent structured logging across the application.
 * Designed for Cloudflare Workers environment:
 * - JSON output for log aggregation (Cloudflare dashboard, Logpush)
 * - Request context tracking (request ID, path, payer)
 * - Log levels with filtering
 * - No buffer (Workers are stateless)
 *
 * Usage:
 *   import { createLogger, log } from "../utils/logger";
 *
 *   // Simple logging
 *   log.info("Server started");
 *   log.error("Payment failed", { reason: "insufficient funds" });
 *
 *   // With request context
 *   const logger = createLogger({ requestId: "abc123", path: "/api/stacks/..." });
 *   logger.info("Processing request");
 *   logger.warn("Rate limit approaching", { remaining: 5 });
 */

// =============================================================================
// Types
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  path?: string;
  payer?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  data?: unknown;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
  child(additionalContext: LogContext): Logger;
}

// =============================================================================
// Configuration
// =============================================================================

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level (can be configured via env)
let minLevel: LogLevel = "info";

/**
 * Set minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/**
 * Check if a level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format a log entry as JSON for structured logging
 */
function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Format a log entry for console (development)
 * Includes ANSI colors for readability
 */
function formatConsole(entry: LogEntry): string {
  const colors: Record<LogLevel, string> = {
    debug: "\x1b[90m", // gray
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
  };
  const reset = "\x1b[0m";

  const color = colors[entry.level];
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const timestamp = entry.timestamp.split("T")[1].split(".")[0]; // HH:MM:SS

  let output = `${color}[${timestamp}] ${levelStr}${reset} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${color}ctx=${reset}${JSON.stringify(entry.context)}`;
  }

  if (entry.data !== undefined) {
    output += ` ${color}data=${reset}${JSON.stringify(entry.data)}`;
  }

  return output;
}

// =============================================================================
// Core Logging
// =============================================================================

/**
 * Write a log entry
 * Uses console methods that map to Cloudflare's log levels
 */
function writeLog(entry: LogEntry): void {
  // In production (Workers), use JSON format
  // In development, use colored console format
  const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
  const formatted = isDev ? formatConsole(entry) : formatJson(entry);

  // Map to appropriate console method
  // Cloudflare Workers captures these at different severity levels
  switch (entry.level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/**
 * Create a log entry and write it
 */
function logWithContext(
  level: LogLevel,
  message: string,
  context?: LogContext,
  data?: unknown
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (data !== undefined) {
    entry.data = data;
  }

  writeLog(entry);
}

// =============================================================================
// Logger Factory
// =============================================================================

/**
 * Create a logger with optional context
 * Context is included in all log entries from this logger
 */
export function createLogger(context?: LogContext): Logger {
  return {
    debug: (message: string, data?: unknown) =>
      logWithContext("debug", message, context, data),
    info: (message: string, data?: unknown) =>
      logWithContext("info", message, context, data),
    warn: (message: string, data?: unknown) =>
      logWithContext("warn", message, context, data),
    error: (message: string, data?: unknown) =>
      logWithContext("error", message, context, data),
    child: (additionalContext: LogContext) =>
      createLogger({ ...context, ...additionalContext }),
  };
}

// =============================================================================
// Default Logger
// =============================================================================

/**
 * Default logger without context
 * Use for application-level logging that doesn't need request context
 */
export const log = createLogger();

// =============================================================================
// Request Logger Helper
// =============================================================================

/**
 * Create a logger for a specific request
 * Extracts common context from the request
 */
export function createRequestLogger(
  requestId: string,
  path: string,
  payer?: string
): Logger {
  return createLogger({
    requestId,
    path,
    ...(payer && { payer }),
  });
}

/**
 * Generate a short request ID
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}

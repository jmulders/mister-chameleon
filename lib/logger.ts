/**
 * Logger utility
 *
 * A lightweight, structured logging wrapper for use across the platform.
 * In production, this can be swapped for a proper provider (Axiom, Datadog, etc.)
 * by replacing the transport layer without changing call sites.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Decision resolved", { experienceKey: "summer-promo" });
 *   logger.error("CMS fetch failed", { error });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

type LogMeta = Record<string, unknown>;

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_TEST = process.env.NODE_ENV === "test";

function formatEntry(level: LogLevel, message: string, context?: LogMeta): LogEntry {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };
}

function emit(entry: LogEntry): void {
  // Suppress all output during tests unless explicitly overridden
  if (IS_TEST) return;

  if (IS_PRODUCTION) {
    // In production, emit structured JSON for log aggregation services
    process.stdout.write(JSON.stringify(entry) + "\n");
    return;
  }

  // Development: pretty-print with colour coding
  const levelLabels: Record<LogLevel, string> = {
    debug: "\x1b[36m[DEBUG]\x1b[0m",
    info: "\x1b[32m[INFO]\x1b[0m ",
    warn: "\x1b[33m[WARN]\x1b[0m ",
    error: "\x1b[31m[ERROR]\x1b[0m",
  };

  const prefix = `${entry.timestamp} ${levelLabels[entry.level]}`;
  const parts = [prefix, entry.message];

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context, null, 2));
  }

  const output = parts.join(" ");

  if (entry.level === "error") {
    console.error(output);
  } else if (entry.level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug(message: string, context?: LogMeta): void {
    if (IS_PRODUCTION) return; // suppress debug in prod
    emit(formatEntry("debug", message, context));
  },

  info(message: string, context?: LogMeta): void {
    emit(formatEntry("info", message, context));
  },

  warn(message: string, context?: LogMeta): void {
    emit(formatEntry("warn", message, context));
  },

  error(message: string, context?: LogMeta): void {
    emit(formatEntry("error", message, context));
  },
};

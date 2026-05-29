/**
 * scripts/lib/logger.ts
 *
 * Minimal structured logger for backup/restore/bootstrap scripts.
 * Writes colour-coded lines to stdout/stderr with a timestamp prefix.
 */

export type LogLevel = "info" | "success" | "warn" | "error" | "step" | "debug";

const COLOURS: Record<LogLevel, string> = {
  info:    "\x1b[36m",   // cyan
  success: "\x1b[32m",   // green
  warn:    "\x1b[33m",   // yellow
  error:   "\x1b[31m",   // red
  step:    "\x1b[35m",   // magenta
  debug:   "\x1b[90m",   // grey
};

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function write(level: LogLevel, message: string, data?: unknown): void {
  const colour  = COLOURS[level];
  const prefix  = level === "error" ? "✗" : level === "success" ? "✓" : level === "step" ? "▶" : level === "warn" ? "⚠" : "·";
  const stream  = level === "error" ? process.stderr : process.stdout;
  const dataStr = data !== undefined ? `  ${JSON.stringify(data)}` : "";
  stream.write(`${colour}${BOLD}${prefix}${RESET}  ${COLOURS.debug}${ts()}${RESET}  ${colour}${message}${RESET}${dataStr}\n`);
}

export const log = {
  info:    (msg: string, data?: unknown) => write("info",    msg, data),
  success: (msg: string, data?: unknown) => write("success", msg, data),
  warn:    (msg: string, data?: unknown) => write("warn",    msg, data),
  error:   (msg: string, data?: unknown) => write("error",   msg, data),
  step:    (msg: string, data?: unknown) => write("step",    msg, data),
  debug:   (msg: string, data?: unknown) => write("debug",   msg, data),

  /** Print a section divider. */
  section(title: string): void {
    const line = "─".repeat(60);
    process.stdout.write(`\n${BOLD}${line}\n  ${title}\n${line}${RESET}\n\n`);
  },
};

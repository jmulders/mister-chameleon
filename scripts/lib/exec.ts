/**
 * scripts/lib/exec.ts
 *
 * Thin wrappers around child_process for running CLI tools inside scripts.
 * Every command is logged before execution so dry-runs and failures are clear.
 */

import { execSync, type ExecSyncOptions } from "node:child_process";
import { log }                            from "./logger.ts";

export interface RunOptions {
  /** Print the command before running it. Default: true. */
  verbose?: boolean;
  /** Working directory. Default: cwd of the calling process. */
  cwd?: string;
  /** Extra environment variables merged into process.env. */
  env?: Record<string, string>;
  /** When true, suppress stdout (return it instead of printing). */
  capture?: boolean;
  /** When true, do NOT throw on non-zero exit. */
  ignoreErrors?: boolean;
}

/**
 * Run a shell command synchronously.
 * Returns captured stdout when `capture: true`, otherwise returns "".
 * Throws on non-zero exit unless `ignoreErrors: true`.
 */
export function run(command: string, opts: RunOptions = {}): string {
  const { verbose = true, cwd, env, capture = false, ignoreErrors = false } = opts;

  if (verbose) log.debug(`$ ${command}`, cwd ? { cwd } : undefined);

  const execOpts: ExecSyncOptions = {
    stdio:  capture ? "pipe" : "inherit",
    cwd:    cwd ?? process.cwd(),
    env:    { ...process.env, ...(env ?? {}) },
    encoding: "utf8",
  };

  try {
    const out = execSync(command, execOpts);
    return capture ? (out as string | null ?? "").trim() : "";
  } catch (err: unknown) {
    if (ignoreErrors) return "";
    const e = err as { status?: number; message?: string };
    throw new Error(`Command failed (exit ${e.status ?? "?"}): ${command}\n${e.message ?? ""}`);
  }
}

/**
 * Check whether a CLI tool is available on PATH.
 */
export function commandExists(tool: string): boolean {
  try {
    run(`which ${tool}`, { capture: true, ignoreErrors: true, verbose: false });
    return true;
  } catch {
    return false;
  }
}

/** Convenience: run a command and return its trimmed stdout. */
export function capture(command: string, opts: Omit<RunOptions, "capture"> = {}): string {
  return run(command, { ...opts, capture: true });
}

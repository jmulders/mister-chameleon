/**
 * scripts/lib/fs-utils.ts
 *
 * File-system helpers for backup/restore scripts.
 */

import fs   from "node:fs";
import path from "node:path";

/**
 * Create a directory and all parents if they do not exist.
 */
export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write JSON to a file, creating parent directories as needed.
 */
export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Read and parse a JSON file.
 */
export function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/**
 * Copy a file if it exists (skip silently if not).
 */
export function copyIfExists(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

/**
 * Copy an entire directory recursively.
 */
export function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * List files in a directory (non-recursive).
 * Returns full paths sorted alphabetically.
 */
export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(dir, e.name))
    .sort();
}

/**
 * Format bytes as a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Return file size in bytes, or 0 if the file does not exist.
 */
export function fileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/**
 * Sanitise a string for use as a directory name (removes unsafe characters).
 */
export function safeDirName(s: string): string {
  return s.replace(/[/:*?"<>|\\]/g, "-");
}

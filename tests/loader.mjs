/**
 * Custom Node.js ESM loader for the test suite.
 *
 * Handles two concerns that the standard Node resolver cannot:
 *
 *  1. @/ path aliases  — resolves "@/foo/bar" to the project root equivalent,
 *     mirroring the tsconfig.json "paths" configuration used by the app bundler.
 *
 *  2. server-only mock  — the "server-only" npm package throws at import time
 *     outside the Next.js bundler environment. This loader intercepts the
 *     import and returns an empty module, allowing server-side modules that
 *     import "server-only" to load correctly in the test environment.
 *
 * Usage:
 *   node --experimental-transform-types --loader ./tests/loader.mjs --test ...
 */

import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { statSync } from 'fs';

// Resolve the project root relative to this loader file (tests/loader.mjs → ..)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const EXTENSIONS = [
  '.ts', '.tsx',
  '/index.ts', '/index.tsx',
  '.js', '.mjs',
  '/index.js', '/index.mjs',
];

/**
 * Tries each extension in order until a file is found.
 * Returns the file:// URL string, or null if nothing matches.
 */
function resolveWithExtensions(base) {
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    try {
      if (statSync(candidate).isFile()) return pathToFileURL(candidate).href;
    } catch {
      // file doesn't exist — try next extension
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // ── 1. Mock "server-only" ────────────────────────────────────────────────
  // Outside the Next.js bundler, server-only throws unconditionally.
  // Return an empty module so modules guarded by it can load in tests.
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,', shortCircuit: true };
  }

  // ── 2. Resolve @/ aliases ────────────────────────────────────────────────
  if (specifier.startsWith('@/')) {
    const abs = path.join(PROJECT_ROOT, specifier.slice(2));
    // An explicit-extension target (e.g. "@/data/foo.json") already points at a
    // real file — resolve it directly before trying the extension candidates.
    // Raw Node ESM needs an explicit "type: json" import attribute for JSON (the
    // Next.js/tsc bundler infers it from resolveJsonModule), so inject it here to
    // keep the app source free of bundler-specific `with { type: "json" }`.
    try {
      if (statSync(abs).isFile()) {
        const url = pathToFileURL(abs).href;
        const extra = abs.endsWith('.json') ? { importAttributes: { type: 'json' } } : {};
        return { url, shortCircuit: true, ...extra };
      }
    } catch {
      // not a direct file — fall through to extension resolution
    }
    const resolved = resolveWithExtensions(abs);
    if (resolved) return { url: resolved, shortCircuit: true };
  }

  // ── 3. Resolve extensionless relative directory imports ──────────────────
  // e.g. import from '../queries/sanity'  →  ../queries/sanity/index.ts
  // Intercept when the specifier does not already end in a real module
  // extension. path.extname() alone is not enough: a specifier like
  // './theme-families.config' has extname '.config' yet still needs .ts appended.
  const MODULE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    !MODULE_EXTS.some((e) => specifier.endsWith(e))
  ) {
    const parent = fileURLToPath(context.parentURL);
    const base = path.resolve(path.dirname(parent), specifier);
    const resolved = resolveWithExtensions(base);
    if (resolved) return { url: resolved, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

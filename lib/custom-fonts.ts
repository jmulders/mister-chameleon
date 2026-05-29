/**
 * Custom Font CSS Generator — server-only
 *
 * Generates `@font-face` CSS declarations from platform-level custom font
 * configurations stored in the tenant's design settings.
 *
 * ─── Why this file exists ────────────────────────────────────────────────────
 *
 *   Google Fonts are handled by next/font/google (lib/fonts.ts) and resolved
 *   via CSS variable injection in Layer C of app/layout.tsx.
 *
 *   Custom fonts — uploaded woff2/woff files stored in Supabase Storage —
 *   cannot use next/font (which only works with statically-known build-time
 *   sources).  Instead, this module generates @font-face CSS at request time
 *   from the stored file URLs and font metadata, injected as Layer D in
 *   app/layout.tsx.
 *
 * ─── Custom font flow ────────────────────────────────────────────────────────
 *
 *   1. Operator uploads a woff2/woff file via the typography editor.
 *   2. File is stored in the `tenant-fonts` Supabase Storage bucket.
 *   3. Public URL and font name are saved to `design.customFonts.{role}` in
 *      tenant settings.
 *   4. The font stack token (`--font-sans`, `--font-serif`, `--font-mono`)
 *      references the custom font name: `'Brandica', system-ui, sans-serif`.
 *   5. At request time, `generateCustomFontCss()` builds the @font-face CSS.
 *   6. app/layout.tsx injects it as Layer D — the browser can now resolve the
 *      custom font name to the uploaded file.
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   If `regularUrl` is absent or the custom font config is missing, no
 *   @font-face is generated for that role.  The font-family stack in the token
 *   value (Layer B) still names the custom font first, so the browser falls
 *   through to the next entry in the stack (system-ui, serif, monospace, etc.).
 *   Rendering remains stable — no broken layout or invisible text.
 *
 * ─── This module is server-only ──────────────────────────────────────────────
 *
 *   Import only from server components, server actions, or app/layout.tsx.
 *   Do not import into client ("use client") files.
 */

import "server-only";
import type { TenantCustomFonts, CustomFontFace } from "@/tenant/types";

// ── Format detection ──────────────────────────────────────────────────────────

/**
 * Infer the MIME type / CSS `format()` hint from a font file URL or path.
 * Falls back to "woff2" when the extension is not recognised.
 */
function fontFormat(url: string): "woff2" | "woff" {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".woff")) return "woff";
  return "woff2";
}

// ── @font-face generator ──────────────────────────────────────────────────────

/**
 * Build one or more `@font-face` rules for a single custom font configuration.
 *
 * Rules generated:
 *   - Regular (weight 400, style normal) — always, from `regularUrl`.
 *   - Medium  (weight 500, style normal) — when `mediumUrl` is present.
 *   - Bold    (weight 700, style normal) — when `boldUrl` is present.
 *   - Italic  (weight 400, style italic) — when `italicUrl` is present.
 *
 * Returns an empty string when `regularUrl` is absent (safe no-op).
 */
function buildFontFaceRules(config: CustomFontFace): string {
  if (!config.regularUrl?.trim()) return "";

  const { name } = config;
  const quotedName = name.includes(" ") ? `'${name}'` : name;

  const rules: string[] = [];

  function rule(url: string, weight: string, style: string): string {
    const fmt = fontFormat(url);
    return (
      `@font-face{` +
      `font-family:${quotedName};` +
      `src:url('${url}') format('${fmt}');` +
      `font-weight:${weight};` +
      `font-style:${style};` +
      `font-display:swap` +
      `}`
    );
  }

  rules.push(rule(config.regularUrl, "400", "normal"));
  if (config.mediumUrl?.trim())  rules.push(rule(config.mediumUrl,  "500", "normal"));
  if (config.boldUrl?.trim())    rules.push(rule(config.boldUrl,    "700", "normal"));
  if (config.italicUrl?.trim())  rules.push(rule(config.italicUrl,  "400", "italic"));

  return rules.join("");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate all @font-face CSS declarations from the tenant's custom font
 * configuration.
 *
 * Returns an empty string when no custom fonts are configured — safe to inject
 * unconditionally without emitting an empty `<style>` tag.
 *
 * @param customFonts  The `design.customFonts` value from TenantSettings,
 *                     or undefined/null when not configured.
 * @returns            A concatenated CSS string of @font-face rules.
 *
 * @example
 * const css = generateCustomFontCss(settings?.design?.customFonts);
 * // → "@font-face{font-family:'Brandica';src:url('https://…')...}..."
 * //   or "" when no custom fonts are configured
 */
export function generateCustomFontCss(
  customFonts: TenantCustomFonts | null | undefined,
): string {
  if (!customFonts) return "";

  const parts: string[] = [];
  if (customFonts.sans)  parts.push(buildFontFaceRules(customFonts.sans));
  if (customFonts.serif) parts.push(buildFontFaceRules(customFonts.serif));
  if (customFonts.mono)  parts.push(buildFontFaceRules(customFonts.mono));

  return parts.join("");
}

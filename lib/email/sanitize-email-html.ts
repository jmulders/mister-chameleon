/**
 * Minimal HTML sanitizer for operator-authored email HTML blocks.
 *
 * Not a full sanitizer — it strips the high-risk vectors (scripts, event
 * handlers, dangerous URL schemes, embedded frames/objects). The admin preview
 * additionally renders in a sandboxed iframe with scripts disabled, and email
 * clients strip active content aggressively, so this is defence-in-depth for an
 * admin-only feature rather than a browser-grade sanitizer.
 */

const DANGEROUS_TAGS = "script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|noscript|svg";

export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  let out = html;

  // Remove dangerous elements, including their content.
  out = out.replace(
    new RegExp(`<\\s*(${DANGEROUS_TAGS})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, "gi"),
    "",
  );
  // Remove the same as self-closing / unpaired tags.
  out = out.replace(new RegExp(`<\\s*/?\\s*(${DANGEROUS_TAGS})\\b[^>]*>`, "gi"), "");

  // Strip inline event handlers (on*="...").
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Neutralise javascript:/vbscript: and non-image data: URLs in href/src.
  out = out.replace(/(href|src)\s*=\s*("|')\s*(?:javascript|vbscript):[^"']*\2/gi, '$1=$2#$2');
  out = out.replace(/(href|src)\s*=\s*("|')\s*data:(?!image\/)[^"']*\2/gi, '$1=$2#$2');

  return out;
}

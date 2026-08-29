/**
 * demo/site-mirror.ts
 *
 * Fetches a prospect's homepage and returns a "clean" snapshot:
 *   • All relative URLs resolved to absolute (so images/CSS load from origin)
 *   • <script> tags removed (prevents JS conflicts and XSS)
 *   • A canonical <base> tag injected as the first <head> child
 *   • Viewport meta tag ensured
 *   • External stylesheet links preserved (load from prospect's CDN)
 *
 * Server-only. No DOM parser — uses regex + string operations.
 * Intentionally lightweight: the goal is a "good enough" visual facsimile
 * for a sales demo, not a perfect browser-accurate render.
 */

import { getImagePool } from "./image-provider";
import type { SiteCategory } from "./types";
import { renderHtmlViaService, renderOutcomeFromError, type RenderConfig, type RenderOutcome } from "./site-render";

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES   = 800_000; // 800 KB ceiling

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MirroredSite {
  html:          string;
  baseUrl:       string; // The final URL after redirects, used as the base
  fetchSucceeded: boolean;
  title:         string;
  faviconUrl:    string | null;
  logoUrl:       string | null;
  /** Outcome of the JS-render attempt (why a renderEnabled mirror is still plain-fetch). */
  render:        RenderOutcome;
}

// ── Public entry ──────────────────────────────────────────────────────────────

export async function mirrorSite(rawUrl: string, render?: RenderConfig): Promise<MirroredSite> {
  const url = normalizeUrl(rawUrl);

  let html           = "";
  let finalUrl       = url;
  let fetchSucceeded = false;
  let renderOutcome: RenderOutcome = {
    service: render?.service ?? "none", rendered: false, status: "error", reason: "capture failed", ms: 0,
  };

  try {
    const result   = await captureHtml(url, render);
    html           = result.html;
    finalUrl       = result.finalUrl;
    renderOutcome  = result.render;
    fetchSucceeded = true;
  } catch (err) {
    console.warn("[demo/site-mirror] capture failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return a minimal stub so the rest of the pipeline can continue
    return {
      html:           buildStubHtml(url),
      baseUrl:        url,
      fetchSucceeded: false,
      title:          extractDomainName(url),
      faviconUrl:     null,
      logoUrl:        null,
      render:         renderOutcome,
    };
  }

  const cleaned    = cleanHtml(html, finalUrl);
  const title      = extractTitle(html) || extractDomainName(finalUrl);
  const faviconUrl = extractFavicon(html, finalUrl);
  const logoUrl    = extractLogo(html, finalUrl);

  return {
    html:           cleaned,
    baseUrl:        finalUrl,
    fetchSucceeded,
    title,
    faviconUrl,
    logoUrl,
    render:         renderOutcome,
  };
}

// ── URL normalisation ─────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractDomainName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── HTML capture (render-service first, plain fetch fallback) ─────────────────

/**
 * Capture the page HTML. When a JS-render service is configured, render the page
 * with JavaScript (faithful for client-rendered sites) and fall back to a plain
 * fetch if the service errors, times out, or returns unusable HTML — so demo
 * generation never hard-fails on a render outage. With no service configured,
 * this is exactly the previous plain-fetch behaviour.
 */
async function captureHtml(
  url: string,
  render?: RenderConfig,
): Promise<{ html: string; finalUrl: string; render: RenderOutcome }> {
  const service = render?.service ?? "none";
  if (render && render.service !== "none") {
    const started = Date.now();
    try {
      const rendered = await renderHtmlViaService(url, render);
      const html = rendered.html.length > MAX_HTML_BYTES
        ? rendered.html.slice(0, MAX_HTML_BYTES)
        : rendered.html;
      return {
        html, finalUrl: rendered.finalUrl,
        render: { service, rendered: true, status: "ok", reason: "ok", ms: Date.now() - started },
      };
    } catch (err) {
      // The render outcome carries the FAILED PHASE (launch vs navigate/empty/timeout)
      // so a prod mirror that is byte-identical to plain fetch is no longer a mystery.
      const outcome = renderOutcomeFromError(err, Date.now() - started, service);
      console.warn("[demo/site-mirror] render service failed, falling back to plain fetch", {
        url, service, status: outcome.status, reason: outcome.reason, ms: outcome.ms,
      });
      const fetched = await fetchHtml(url);
      return { ...fetched, render: outcome };
    }
  }
  const fetched = await fetchHtml(url);
  return { ...fetched, render: { service: "none", rendered: false, status: "disabled", reason: "render disabled", ms: 0 } };
}

// ── HTML fetcher ──────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal:  controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MrChameleonBot/1.0; +https://misterchameleon.com/bot)",
        "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/xhtml")) {
      throw new Error(`Non-HTML content-type: ${contentType}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      // Truncate to the ceiling — we only need the first ~800 KB
      const slice = buffer.slice(0, MAX_HTML_BYTES);
      return {
        html:     new TextDecoder().decode(slice),
        finalUrl: response.url || url,
      };
    }

    return {
      html:     new TextDecoder().decode(buffer),
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── HTML cleaning ─────────────────────────────────────────────────────────────

function cleanHtml(html: string, baseUrl: string): string {
  let out = html;

  // 1. Ensure <html lang> doesn't override our page
  // (leave it — it's fine for the demo)

  // 2. Resolve relative URLs → absolute
  //    This covers href/src/action and common data-* lazy-load attributes.
  out = resolveRelativeUrls(out, baseUrl);

  // 2.5 Promote lazy-loaded images to eager loading.
  //    Many sites hide the real image URL in data-src / data-lazy-src / etc.
  //    and rely on JS to copy it to src.  Since we strip all scripts, those
  //    images never load.  We do the promotion here so the browser renders them.
  out = promoteLazyImages(out);

  // 3. Remove all <script> tags (including inline + external)
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*\/>/gi, "");

  // 4. Unwrap <noscript> — keep the inner content, strip just the tag.
  //    Many lazy-loaders put the real <img src="..."> inside <noscript> as a
  //    no-JS fallback while the outer <img> only has data-src / a placeholder.
  //    Since we strip all scripts, the noscript content IS what the page should
  //    show.  Removing the outer tags reveals the real images automatically.
  out = out.replace(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi, "$1");

  // 5. Remove iframes (ads, embeds, chat widgets)
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<iframe\b[^>]*\/>/gi, "");

  // 5b. Strip video sources so we get a static poster image in the demo.
  //   Videos almost never load in mirrored demos (CORS, autoplay policy,
  //   large file sizes).  Stripping the src + <source> children causes the
  //   browser to show the poster attribute as a static image — which is a
  //   perfectly readable visual for a sales demo.
  //   We keep the <video> element itself (and its poster/width/height attrs)
  //   so the layout is preserved; we just remove the media source data.
  out = out.replace(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi, (_m, attrs, inner) => {
    // Strip src from the opening tag
    const cleanAttrs = attrs
      .replace(/\bsrc=(['"])[^'"]*\1/gi, "")
      .replace(/\bautoplay\b/gi, "")
      .replace(/\bloop\b/gi, "")
      .replace(/\bmuted\b/gi, "");
    // Strip all <source> elements from inner content
    const cleanInner = inner.replace(/<source\b[^>]*\/?>/gi, "");
    return `<video${cleanAttrs}>${cleanInner}</video>`;
  });

  // 6. Always inject our own <base> tag as the very first <head> child.
  //    Remove any existing <base> tag first — the prospect's may point to
  //    a different path or be relative, which would break asset resolution.
  out = out.replace(/<base\b[^>]*\/?>/gi, "");
  const baseTag = `<base href="${escapeAttr(baseUrl)}">`;
  out = out.replace(/(<head\b[^>]*>)/i, `$1\n  ${baseTag}`);
  if (!out.includes("<base ")) {
    // No <head> found — prepend to the document
    out = `${baseTag}\n` + out;
  }

  // 7. Ensure viewport meta (so the page renders well in our container)
  if (!/name=["']viewport["']/i.test(out)) {
    out = out.replace(
      /(<head\b[^>]*>)/i,
      `$1\n  <meta name="viewport" content="width=device-width, initial-scale=1">`,
    );
  }

  // 8. Strip CSP meta tags (they would block our injected snippet)
  out = out.replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    "",
  );

  return out;
}

// ── Lazy-image promotion ──────────────────────────────────────────────────────
//
// Many sites put the real image URL in a data-* attribute and rely on
// IntersectionObserver / scroll-event JS to copy it into src.  Since we strip
// all scripts, those images would stay blank.  We detect the most common
// lazy-load patterns and copy the real URL into src so the browser loads them
// immediately.
//
// Runs AFTER resolveRelativeUrls so the URL is already absolute.

function promoteLazyImages(html: string): string {
  // 1) <picture><source data-srcset="REAL"> — copy a real (non-data:) lazy
  //    srcset into the active srcset so the browser picks it without JS.
  html = html.replace(/<source\b([^>]*)>/gi, (sourceTag, attrs) => {
    const lazy = attrs.match(/\bdata-srcset=(['"])([^'"]+)\1/i);
    if (!lazy) return sourceTag;
    const lazyVal = lazy[2];
    if (!lazyVal || /^\s*data:/i.test(lazyVal)) return sourceTag; // placeholder only
    const existing = attrs.match(/\bsrcset=(['"])([^'"]*)\1/i);
    const isPlaceholder =
      !existing || existing[2].trim() === "" || /^\s*data:/i.test(existing[2]);
    if (!isPlaceholder) return sourceTag;
    const newAttrs = existing
      ? attrs.replace(/\bsrcset=(['"])[^'"]*\1/i, `srcset="${lazyVal}"`)
      : ` srcset="${lazyVal}"` + attrs;
    return `<source${newAttrs}>`;
  });

  // 2) <img ...> — promote data-src / data-srcset / etc. to a real src.
  return html.replace(/<img\b([^>]*)>/gi, (imgTag, attrs) => {
    // Look for common lazy-load data attributes, in priority order
    const lazyMatch = attrs.match(
      /\bdata-(?:src|lazy-src|lazy|original|full-src|big)=(['"])([^'"]+)\1/i,
    );
    if (!lazyMatch) return imgTag;

    const lazyUrl = lazyMatch[2];
    if (!lazyUrl || lazyUrl.startsWith("data:")) return imgTag;

    // Match ONLY a real `src=` — not `data-src=` (the hyphen would otherwise be
    // a word boundary, causing us to think a real src already exists).
    const existingSrc = attrs.match(/(?<![-\w])src=(['"])([^'"]*)\1/i);

    // Decide whether the existing src looks like a placeholder
    const isPlaceholder =
      !existingSrc ||
      existingSrc[2] === "" ||
      existingSrc[2] === "#" ||
      /placeholder|loading|spinner|blank|1x1|transparent|pixel|grey|gray/i.test(existingSrc[2]) ||
      existingSrc[2].startsWith("data:image/gif") || // common 1×1 GIF placeholder
      existingSrc[2].startsWith("data:image/png");   // common 1×1 PNG placeholder

    if (!isPlaceholder) return imgTag; // already has a real src

    let newAttrs: string;
    if (existingSrc) {
      // Replace the placeholder src with the lazy URL
      newAttrs = attrs.replace(
        /(?<![-\w])src=(['"])[^'"]*\1/i,
        `src="${lazyUrl}"`,
      );
    } else {
      // Prepend a src attribute
      newAttrs = ` src="${lazyUrl}"` + attrs;
    }

    return `<img${newAttrs}>`;
  });
}

// ── URL resolution ────────────────────────────────────────────────────────────

function resolveRelativeUrls(html: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return html;
  }

  // Resolve href="..." and src="..." attributes
  const resolveAttr = (match: string, attrName: string, quote: string, value: string): string => {
    const trimmed = value.trim();
    // Skip: data URIs, anchors, mailto, tel, javascript, absolute URLs, empty
    if (
      !trimmed ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("mailto:") ||
      trimmed.startsWith("tel:") ||
      trimmed.startsWith("javascript:") ||
      /^https?:\/\//i.test(trimmed)
    ) {
      return match;
    }
    try {
      const resolved = new URL(trimmed, base).href;
      return `${attrName}=${quote}${resolved}${quote}`;
    } catch {
      return match;
    }
  };

  // href and src attributes — includes common lazy-load data-* variants
  html = html.replace(
    /\b(href|src|action|poster|data-src|data-href|data-lazy-src|data-lazy|data-original|data-full-src|data-big|data-bg)=(['"])(.*?)\2/gi,
    (m, attr, q, val) => resolveAttr(m, attr, q, val),
  );

  // srcset attributes (comma-separated list of "url [descriptor]")
  // NOTE: this also matches data-srcset. Leave any srcset that contains a data:
  // URI fully untouched — base64 payloads contain commas that break naive
  // candidate splitting (turning the base64 tail into a bogus relative URL).
  html = html.replace(
    /\bsrcset=(['"])(.*?)\1/gi,
    (_m, q, srcset) => {
      if (/data:/i.test(srcset)) return `srcset=${q}${srcset}${q}`;
      const resolved = srcset.split(",").map((part: string) => {
        const [urlPart, ...rest] = part.trim().split(/\s+/);
        if (!urlPart) return part;
        const trimmed = urlPart.trim();
        if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
          return part;
        }
        try {
          const abs = new URL(trimmed, base).href;
          return [abs, ...rest].join(" ");
        } catch {
          return part;
        }
      }).join(", ");
      return `srcset=${q}${resolved}${q}`;
    },
  );

  // url(...) in inline styles and style blocks
  html = html.replace(
    /url\(['"]?([^'")\s]+)['"]?\)/g,
    (_m, val) => {
      const trimmed = val.trim();
      if (
        !trimmed ||
        trimmed.startsWith("data:") ||
        /^https?:\/\//i.test(trimmed)
      ) {
        return _m;
      }
      try {
        const resolved = new URL(trimmed, base).href;
        return `url('${resolved}')`;
      } catch {
        return _m;
      }
    },
  );

  // Protocol-relative URLs (//cdn.example.com/...)
  html = html.replace(
    /(['"])(\/\/[^'">\s]+)(['"])/g,
    (_m, q1, url, q2) => `${q1}https:${url}${q2}`,
  );

  return html;
}

// ── Metadata extraction ───────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m =
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
    html.match(/<meta[^>]+(?:og:title|twitter:title)[^>]+content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["'][^>]+(?:og:title|twitter:title)/i);
  if (!m) return "";
  return m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const m = html.match(
    /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i,
  ) ?? html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i,
  );
  if (!m) {
    try {
      return new URL("/favicon.ico", baseUrl).href;
    } catch {
      return null;
    }
  }
  try {
    return new URL(m[1], baseUrl).href;
  } catch {
    return m[1];
  }
}

function extractLogo(html: string, baseUrl: string): string | null {
  // Look for common logo patterns
  const patterns = [
    /<img[^>]+class=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*logo[^"']*["']/i,
    /<img[^>]+id=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+alt=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*logo[^"']*["']/i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      try {
        return new URL(m[1], baseUrl).href;
      } catch {
        return m[1];
      }
    }
  }
  return null;
}

// ── Stub HTML (fallback when fetch fails) ─────────────────────────────────────

function buildStubHtml(url: string): string {
  const domain = extractDomainName(url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${domain}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 80vh; margin: 0; color: #374151; }
    .stub { text-align: center; max-width: 480px; padding: 2rem; }
    h1 { font-size: 1.5rem; color: #111827; margin-bottom: .5rem; }
    p  { color: #6b7280; }
  </style>
</head>
<body>
  <div class="stub">
    <h1>${domain}</h1>
    <p>The site could not be fetched at this time.<br>
       The scenario panel is still active — switch scenarios to preview the personalisation effects.</p>
  </div>
</body>
</html>`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ── Image proxy rewriting (for Live Mirror cross-origin images) ─────────────────

/**
 * Rewrite image URLs in mirrored HTML to route through /api/demo/asset, so the
 * prospect's images load SAME-ORIGIN — defeating hotlink/Referer/CORP blocking
 * on the source site (which is why mirrored pages otherwise show no images).
 *
 * Scope — every absolute http(s) image source is routed through the proxy:
 *   • <img>/<source> — src, srcset (each candidate), and common JS-lazy attrs
 *     (data-src, data-srcset, data-original, data-lazy, data-lazy-src, data-bg…).
 *     srcset uses per-URL token replacement, so a mixed `data:…, https://real 2x`
 *     no longer has to be skipped wholesale (the old base64-comma problem that
 *     left responsive/lazy images cross-origin and blank).
 *   • <video> — poster + src.
 *   • <link rel=preload/prefetch as=image> — href + imagesrcset (the LCP image).
 *   • CSS url(...) in inline style="…" attributes AND inside <style> blocks —
 *     the `background` shorthand, `background-image`, `mask-image`, etc.
 * Only absolute http(s) URLs are proxied; data: and relative URLs are left as-is,
 * and an already-proxied URL is never proxied again.
 *
 * Known limit: url() references inside EXTERNAL linked stylesheets (the
 * prospect's `<link rel=stylesheet>`, kept for fidelity) are fetched
 * cross-origin by the browser and cannot be rewritten by string replacement, so
 * those specific background images may still fail; <img> assets that 404 fall
 * back to a pooled image via fillMissingImages.
 *
 * @param html      The (already URL-resolved) mirrored HTML.
 * @param demoBase  Absolute base URL of the demo host — used to build absolute
 *                  proxy URLs that ignore the injected <base> tag.
 */
export function proxifyAssets(html: string, demoBase: string): string {
  const base = demoBase.replace(/\/+$/, "");

  // Proxy one absolute http(s) URL. Leaves data:/relative untouched and never
  // double-proxies a URL we already rewrote.
  const prox = (raw: string): string => {
    const u = raw.trim();
    if (!u || !/^https?:\/\//i.test(u)) return raw;
    if (u.includes("/api/demo/asset?u=")) return raw;
    return `${base}/api/demo/asset?u=${encodeURIComponent(u)}`;
  };

  // Proxy EVERY absolute http(s) URL token inside a value. Used for srcset-style
  // attributes (multiple `url 1x, url 2x` candidates) and CSS. Because it matches
  // only `https?://…` tokens, data:-URI placeholders and relative URLs are left
  // intact — so a mixed `srcset="data:…, https://real 2x"` no longer has to be
  // skipped wholesale (the old base64-comma problem).
  const proxTokens = (value: string): string =>
    value.replace(/https?:\/\/[^\s"'()<>,]+/gi, (u) => prox(u));

  // Rewrite single-URL attributes (attr="https://…") on a tag. Anchored with a
  // negative lookbehind so `src` does not also match `data-src` (each lazy attr
  // is listed explicitly instead).
  const rewriteSingle = (tag: string, attrs: readonly string[]): string => {
    for (const a of attrs) {
      const re = new RegExp(`(?<![-\\w])${a}=(['"])(https?:\\/\\/[^'"]+)\\1`, "gi");
      tag = tag.replace(re, (_m, q, u) => `${a}=${q}${prox(u)}${q}`);
    }
    return tag;
  };
  // Rewrite srcset-style attributes (attr="url1 1x, url2 2x") on a tag.
  const rewriteSrcset = (tag: string, attrs: readonly string[]): string => {
    for (const a of attrs) {
      const re = new RegExp(`(?<![-\\w])${a}=(['"])([^'"]*)\\1`, "gi");
      tag = tag.replace(re, (_m, q, ss) => `${a}=${q}${proxTokens(ss)}${q}`);
    }
    return tag;
  };

  // Image URL-bearing attributes on <img>/<source>. Covers the eager src plus the
  // common JS-lazy-load attributes (in case cleanHtml's lazy promotion didn't
  // reach a given variant) so every candidate image routes through the proxy.
  const IMG_SINGLE = [
    "src", "poster",
    "data-src", "data-original", "data-lazy", "data-lazy-src",
    "data-fallback-src", "data-bg", "data-image",
  ];
  const IMG_SRCSET = ["srcset", "data-srcset", "data-lazy-srcset"];

  const proxyCssUrls = (css: string): string =>
    css.replace(/url\(\s*(['"]?)(https?:\/\/[^'")]+?)\1\s*\)/gi,
      (_m, q, u) => `url(${q}${prox(u)}${q})`);

  let out = html;
  // <img> / <source> (picture + responsive): src + srcset + lazy attributes.
  out = out.replace(/<(?:img|source)\b[^>]*>/gi,
    (tag) => rewriteSrcset(rewriteSingle(tag, IMG_SINGLE), IMG_SRCSET));
  // <video>: poster + src.
  out = out.replace(/<video\b[^>]*>/gi, (tag) => rewriteSingle(tag, ["poster", "src"]));
  // <link rel=preload/prefetch as=image>: the LCP image is often preloaded here.
  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\bas=(['"]?)image\1/i.test(tag)) return tag; // only image preloads
    return rewriteSrcset(rewriteSingle(tag, ["href"]), ["imagesrcset"]);
  });
  // CSS url() in inline style="…" attributes. The value may contain the OTHER
  // quote char (a double-quoted attribute whose url() uses single quotes), so
  // match up to the matching closing quote.
  out = out.replace(/\bstyle=(['"])((?:(?!\1)[\s\S])*)\1/gi,
    (_m, q, css) => `style=${q}${proxyCssUrls(css)}${q}`);
  // CSS url() inside <style> blocks.
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_m, open, css, close) => `${open}${proxyCssUrls(css)}${close}`);

  return out;
}

// ── Fill missing images with Unsplash (for JS-lazy-loaded mirrors) ──────────────

/**
 * Many sites inject their real image URLs via JavaScript at runtime, so a static
 * mirror is left with only base64 placeholders (blank/grey boxes). This pass
 * fills those slots with category-matched Unsplash photos so the mirror looks
 * complete and attractive — while leaving any real (already-resolved) images
 * untouched.
 *
 * @param html      Near-final mirrored HTML (after proxifyAssets).
 * @param category  Site category, used to pick on-topic imagery.
 */
export function fillMissingImages(html: string, category: SiteCategory): string {
  const pool = getImagePool(category);
  if (pool.length === 0) return html;
  let i = 0;
  const nextUrl = () => pool[i++ % pool.length];

  const isPlaceholder = (src: string): boolean =>
    !src.trim() ||
    /^\s*data:/i.test(src) ||
    /placeholder|blank|spinner|loading|1x1|pixel|transparent|spacer|empty\.(?:gif|png)/i.test(src);

  // 1) Drop <source> elements whose (data:) srcset is a placeholder, so the
  //    <img> fallback inside <picture> is what renders.
  html = html.replace(/<source\b[^>]*>/gi, (tag) => {
    const ss = tag.match(/\bsrcset=(['"])([^'"]*)\1/i);
    if (ss && isPlaceholder(ss[2])) return "";
    return tag;
  });

  // 2) Replace placeholder <img src> with a pooled Unsplash image; strip lazy
  //    srcset/sizes so our src is the one the browser uses. Every <img> also
  //    gets an inline onerror fallback so any real image that 404s (broken
  //    proxied asset) swaps to a pooled photo instead of a broken-image icon.
  //    NB: `src=` detection uses a negative lookbehind so it never matches
  //    `data-src=` (the real URL of lazy-loaded images).
  html = html.replace(/<img\b([^>]*?)\s*\/?>/gi, (tag: string, attrs: string) => {
    const srcM = attrs.match(/(?<![-\w])src=(['"])([^'"]*)\1/i);
    const src  = srcM?.[2] ?? "";
    const fallback = nextUrl();
    const onerr = `this.onerror=null;this.src='${fallback}'`;

    let a = attrs;
    if (!src || isPlaceholder(src)) {
      // No usable src — inject a pooled image and drop lazy srcset/sizes.
      a = a
        .replace(/\bsrcset=(['"])[^'"]*\1/gi, "")
        .replace(/\bsizes=(['"])[^'"]*\1/gi, "")
        .replace(/\bloading=(['"])[^'"]*\1/gi, "");
      a = srcM
        ? a.replace(/(?<![-\w])src=(['"])[^'"]*\1/i, `src="${fallback}"`)
        : ` src="${fallback}"` + a;
    }
    // Add an onerror fallback if none present.
    if (!/\bonerror=/i.test(a)) a = ` onerror="${onerr}"` + a;
    return `<img${a}>`;
  });

  return html;
}

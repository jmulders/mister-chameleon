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
}

// ── Public entry ──────────────────────────────────────────────────────────────

export async function mirrorSite(rawUrl: string): Promise<MirroredSite> {
  const url = normalizeUrl(rawUrl);

  let html           = "";
  let finalUrl       = url;
  let fetchSucceeded = false;

  try {
    const result   = await fetchHtml(url);
    html           = result.html;
    finalUrl       = result.finalUrl;
    fetchSucceeded = true;
  } catch (err) {
    console.warn("[demo/site-mirror] fetch failed", {
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

    const existingSrc = attrs.match(/\bsrc=(['"])([^'"]*)\1/i);

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
        /\bsrc=(['"])[^'"]*\1/i,
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
 * Scoped to <img>/<source> (src + srcset), <video> (poster), and inline
 * background-image url(). Only absolute http(s) URLs are proxied.
 *
 * @param html      The (already URL-resolved) mirrored HTML.
 * @param demoBase  Absolute base URL of the demo host — used to build absolute
 *                  proxy URLs that ignore the injected <base> tag.
 */
export function proxifyAssets(html: string, demoBase: string): string {
  const base   = demoBase.replace(/\/+$/, "");
  const isHttp = (u: string) => /^https?:\/\//i.test(u.trim());
  const prox   = (abs: string) => `${base}/api/demo/asset?u=${encodeURIComponent(abs.trim())}`;

  const rewriteSrc = (tag: string): string =>
    tag.replace(/\bsrc=(['"])(https?:\/\/[^'"]+)\1/gi, (_m, q, u) => `src=${q}${prox(u)}${q}`)
       .replace(/\bsrcset=(['"])([^'"]+)\1/gi, (_m, q, ss) => {
         // Leave data:-URI srcsets untouched (base64 commas break splitting).
         if (/data:/i.test(ss)) return `srcset=${q}${ss}${q}`;
         const rewritten = ss.split(",").map((part: string) => {
           const seg = part.trim();
           if (!seg) return part;
           const sp = seg.split(/\s+/);
           if (isHttp(sp[0])) sp[0] = prox(sp[0]);
           return sp.join(" ");
         }).join(", ");
         return `srcset=${q}${rewritten}${q}`;
       });

  let out = html;
  out = out.replace(/<(?:img|source)\b[^>]*>/gi, (tag) => rewriteSrc(tag));
  out = out.replace(/<video\b[^>]*>/gi, (tag) =>
    tag.replace(/\bposter=(['"])(https?:\/\/[^'"]+)\1/gi, (_m, q, u) => `poster=${q}${prox(u)}${q}`),
  );
  out = out.replace(/background-image\s*:\s*url\((['"]?)(https?:\/\/[^'")]+)\1\)/gi,
    (_m, q, u) => `background-image:url(${q}${prox(u)}${q})`);

  return out;
}

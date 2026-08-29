/**
 * demo/analyzer.ts
 *
 * Prospect site analyzer — fetches a URL and extracts brand signals.
 * Server only. No external SDK — lightweight regex parsing only.
 *
 * v2 additions:
 *   • BrandSignals extraction (fonts, nav links, page structure)
 *   • Language detection (NL vs EN)
 *   • CSS color variable extraction
 *   • Google Fonts URL detection
 */

import type { SiteAnalysis, SiteCategory, BrandSignals, DemoLanguage } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS  = 8_000;
const MAX_HTML_BYTES    = 512_000;
const DEFAULT_PRIMARY   = "#3b82f6";
const DEFAULT_SECONDARY = "#1e3a8a";

// ── Public entry point ────────────────────────────────────────────────────────

export async function analyzeSite(
  rawUrl: string,
  /**
   * Optional already-captured HTML (e.g. mirrored.html from the render service).
   * When provided, the analyzer reads brand tokens/colours/category from THIS
   * HTML — the same JS-rendered DOM that slot detection uses — instead of doing
   * its own second plain fetch. Omit it to fetch a fresh copy (unchanged path).
   */
  prefetched?: { html: string; finalUrl?: string; fetchSucceeded?: boolean },
): Promise<SiteAnalysis> {
  const url = normalizeUrl(rawUrl);

  // Reuse the pre-captured (rendered) HTML when handed in and non-empty.
  if (prefetched && prefetched.html) {
    return extractSignals(
      prefetched.html,
      prefetched.finalUrl ?? url,
      prefetched.fetchSucceeded ?? true,
    );
  }

  let html           = "";
  let fetchedUrl     = url;
  let fetchSucceeded = false;

  try {
    const result   = await fetchHtml(url);
    html           = result.html;
    fetchedUrl     = result.finalUrl;
    fetchSucceeded = true;
  } catch (err) {
    console.warn("[demo/analyzer] fetch failed — using defaults", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return extractSignals(html, fetchedUrl, fetchSucceeded);
}

// ── URL normalisation ─────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// ── HTML fetcher ──────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal:  controller.signal,
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; MrChameleonBot/1.0; +https://misterchameleon.com/bot)",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "nl,en;q=0.9",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`Non-HTML content-type: ${contentType}`);
  }

  const reader  = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;
      if (totalBytes >= MAX_HTML_BYTES) break;
    }
    reader.cancel();
  }

  const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }

  return { html: new TextDecoder().decode(merged), finalUrl: response.url };
}

// ── Signal extraction ─────────────────────────────────────────────────────────

function extractSignals(
  html:           string,
  fetchedUrl:     string,
  fetchSucceeded: boolean,
): SiteAnalysis {
  const domain = extractDomain(fetchedUrl);

  const title           = extractTitle(html, domain);
  const description     = extractDescription(html);
  const primaryColor    = extractThemeColor(html) ?? extractCssColor(html) ?? DEFAULT_PRIMARY;
  const secondaryColor  = darkenColor(primaryColor);
  const logoUrl         = extractLogoUrl(html, fetchedUrl);
  const faviconUrl      = extractFaviconUrl(html, fetchedUrl);
  const firstH1         = extractFirstH1(html);
  const keywords        = extractKeywords(html);
  const category        = detectCategory(html, title, description, domain);
  const detectedLanguage = detectLanguage(html, title, description);
  const brandSignals    = buildBrandSignals(html, fetchedUrl, primaryColor, secondaryColor);

  return {
    fetchedUrl,
    title,
    description,
    category,
    primaryColor,
    secondaryColor,
    logoUrl,
    faviconUrl,
    firstH1,
    keywords,
    fetchSucceeded,
    brandSignals,
    detectedLanguage,
  };
}

// ── Title / description ───────────────────────────────────────────────────────

function extractTitle(html: string, fallback: string): string {
  const og    = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
             ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]) return cleanText(og[1]);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return cleanText(title[1]);
  return fallback;
}

function extractDescription(html: string): string {
  const og   = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,}?)["']/i)
             ?? html.match(/<meta[^>]+content=["']([^"']{10,}?)["'][^>]+property=["']og:description["']/i);
  if (og?.[1]) return cleanText(og[1]);
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,}?)["']/i)
             ?? html.match(/<meta[^>]+content=["']([^"']{10,}?)["'][^>]+name=["']description["']/i);
  if (meta?.[1]) return cleanText(meta[1]);
  return "";
}

// ── Color extraction ──────────────────────────────────────────────────────────

function extractThemeColor(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i)
         ?? html.match(/<meta[^>]+content=["'](#[0-9a-fA-F]{3,8})["'][^>]+name=["']theme-color["']/i);
  return m?.[1] ?? null;
}

/** Look for CSS custom properties like --primary-color, --color-primary, --brand-color. */
function extractCssColor(html: string): string | null {
  // Extract all <style> blocks
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? "");
  const combined    = styleBlocks.join(" ") + " " + html.slice(0, 50_000);

  const patterns = [
    /--(?:primary|brand|accent|main)(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/i,
    /--color-(?:primary|brand|accent|main):\s*(#[0-9a-fA-F]{3,8})/i,
  ];
  for (const pattern of patterns) {
    const m = combined.match(pattern);
    if (m?.[1]) return m[1];
  }
  return null;
}

// ── Logo / favicon ────────────────────────────────────────────────────────────

function extractLogoUrl(html: string, baseUrl: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (og?.[1]) return resolveUrl(og[1], baseUrl);
  return undefined;
}

function extractFaviconUrl(html: string, baseUrl: string): string | undefined {
  const m = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
           ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (m?.[1]) return resolveUrl(m[1], baseUrl);
  try { return `${new URL(baseUrl).origin}/favicon.ico`; } catch { return undefined; }
}

// ── H1 / keywords ─────────────────────────────────────────────────────────────

function extractFirstH1(html: string): string | undefined {
  const m = html.match(/<h1[^>]*>([^<]{5,200})<\/h1>/i);
  return m?.[1] ? cleanText(m[1]) : undefined;
}

function extractKeywords(html: string): string[] {
  const m = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i)
           ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i);
  if (!m?.[1]) return [];
  return m[1].split(",").map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 15);
}

// ── Language detection ────────────────────────────────────────────────────────

const NL_WORDS = new Set([
  "wij", "onze", "uw", "heeft", "zijn", "worden", "naar", "meer",
  "alle", "deze", "maar", "niet", "zoals", "omdat", "wanneer", "voor",
  "met", "ook", "dus", "dan", "bij", "over", "geen", "veel", "andere",
  "kunnen", "maken", "werken", "bedrijf", "klanten", "oplossing",
  "service", "diensten", "resultaten", "contact", "over ons",
]);

function detectLanguage(html: string, title: string, description: string): DemoLanguage {
  // Check <html lang=...> attribute first
  const langAttr = html.match(/<html[^>]+lang=["']([a-z]{2})/i);
  if (langAttr?.[1]) {
    const lang = langAttr[1].toLowerCase();
    if (lang === "nl") return "nl";
    if (lang === "en") return "en";
  }

  // Score NL words in title + description + first 5KB of body text
  const sample = (title + " " + description + " " + html.slice(0, 5_000))
    .toLowerCase()
    .replace(/<[^>]+>/g, " ");
  const words  = sample.split(/\s+/);
  const nlScore = words.filter((w) => NL_WORDS.has(w)).length;

  return nlScore >= 3 ? "nl" : "en";
}

// ── Nav link extraction ───────────────────────────────────────────────────────

function extractNavLinks(html: string): string[] {
  // Look for <nav> elements and extract link text
  const navMatch = html.match(/<nav[^>]*>([\s\S]{0,3000}?)<\/nav>/i);
  const navHtml  = navMatch?.[1] ?? html.slice(0, 20_000);

  const links: string[] = [];
  const linkRegex = /<a[^>]+href=["'][^"']*["'][^>]*>\s*([^<]{2,40}?)\s*<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(navHtml)) !== null) {
    const text = cleanText(m[1]);
    if (text && text.length > 1 && text.length < 40 && !text.includes("\n")) {
      links.push(text);
    }
    if (links.length >= 8) break;
  }
  return [...new Set(links)];
}

// ── Google Fonts detection ────────────────────────────────────────────────────

function extractGoogleFontsUrl(html: string): string | null {
  const m = html.match(/<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com[^"']+)["'][^>]*>/i);
  return m?.[1] ?? null;
}

function extractFontFamilyFromUrl(url: string | null): { heading: string | null; body: string | null } {
  if (!url) return { heading: null, body: null };
  // Parse families from e.g. "family=Inter:wght@400;600|Playfair+Display:ital,wght@0,700"
  const families: string[] = [];
  const regex = /family=([^&"'\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(url)) !== null) {
    const name = m[1].split(":")[0]!.replace(/\+/g, " ").replace(/\|.*/,"");
    families.push(name);
  }
  return {
    heading: families[0] ?? null,
    body:    families[1] ?? families[0] ?? null,
  };
}

// ── Page structure hints ──────────────────────────────────────────────────────

function detectHasPricingPage(html: string): boolean {
  return /(href=["'][^"']*pric[^"']*["']|>Pric(?:ing|es|zen|sstelling))/i.test(html.slice(0, 30_000));
}

function detectHasCareersPage(html: string): boolean {
  return /(href=["'][^"']*(?:careers?|jobs?|vacatures?|werken-bij)[^"']*["']|>(?:Careers?|Jobs?|Vacatures?|Werken bij))/i.test(html.slice(0, 30_000));
}

function detectHasCasesPage(html: string): boolean {
  return /(href=["'][^"']*(?:cases?|portfolio|work|klanten|referenties)[^"']*["']|>(?:Cases?|Portfolio|Work|Klanten))/i.test(html.slice(0, 30_000));
}

function detectHasBlogPage(html: string): boolean {
  return /(href=["'][^"']*(?:blog|news|insights?|artikel)[^"']*["']|>(?:Blog|News|Insights?))/i.test(html.slice(0, 30_000));
}

/** Estimate visual density from CSS/class hints */
function detectBorderRadius(html: string): BrandSignals["borderRadius"] {
  const css = html.slice(0, 50_000);
  if (/border-radius:\s*(?:0|0px|0rem)/i.test(css)) return "none";
  if (/border-radius:\s*(?:20|24|28|32|9999)px|rounded-full|pill/i.test(css)) return "full";
  if (/border-radius:\s*(?:12|14|16)px|rounded-xl|rounded-2xl/i.test(css)) return "lg";
  if (/border-radius:\s*(?:6|8|10)px|rounded-lg/i.test(css)) return "md";
  return "sm";
}

// ── BrandSignals builder ──────────────────────────────────────────────────────

function buildBrandSignals(
  html:           string,
  fetchedUrl:     string,
  primaryColor:   string,
  secondaryColor: string,
): BrandSignals {
  const googleFontsUrl = extractGoogleFontsUrl(html);
  const { heading: headingFont, body: bodyFont } = extractFontFamilyFromUrl(googleFontsUrl);
  const navLinks       = extractNavLinks(html);
  const hasPricingPage = detectHasPricingPage(html);
  const hasCareersPage = detectHasCareersPage(html);
  const hasCasesPage   = detectHasCasesPage(html);
  const hasBlogPage    = detectHasBlogPage(html);
  const borderRadius   = detectBorderRadius(html);

  // Derive text/surface colors from primary (simple contrast heuristic)
  const [r, g, b]   = hexToRgb(primaryColor);
  const luminance   = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor   = luminance > 0.5 ? "#1a1a2e" : "#ffffff";
  const surfaceColor = luminance > 0.5 ? primaryColor : "#ffffff";

  const confidence: BrandSignals["confidence"] =
    googleFontsUrl && navLinks.length > 2 ? "high"
    : navLinks.length > 0                 ? "medium"
    : "low";

  return {
    primaryColor,
    secondaryColor,
    textColor:    "#1a1a2e",
    surfaceColor: "#ffffff",
    headingFont,
    bodyFont,
    googleFontsUrl,
    borderRadius,
    hasPricingPage,
    hasCareersPage,
    hasCasesPage,
    hasBlogPage,
    navLinks,
    confidence,
  };
}

// ── Category detection ────────────────────────────────────────────────────────

const CATEGORY_SIGNALS: Record<Exclude<SiteCategory, "general">, string[]> = {
  b2b_saas: [
    "saas", "software", "platform", "api", "integration", "dashboard",
    "analytics", "automation", "workflow", "enterprise", "crm", "b2b",
    "subscription", "cloud", "devops", "productivity",
  ],
  agency: [
    "agency", "studio", "creative", "design", "branding", "marketing",
    "digital", "web development", "seo", "content", "campaign",
    "advertising", "strategy", "portfolio", "case study",
  ],
  ecommerce: [
    "shop", "store", "buy", "cart", "checkout", "product", "shipping",
    "order", "discount", "sale", "price", "collection", "catalogue",
    "ecommerce", "e-commerce", "retail",
  ],
  recruitment: [
    "jobs", "careers", "hiring", "talent", "candidate", "recruiter",
    "staffing", "vacancy", "apply", "cv", "resume", "employer",
    "placement", "hr", "workforce",
  ],
};

function detectCategory(html: string, title: string, description: string, domain: string): SiteCategory {
  const haystack = [title, description, domain, html.slice(0, 10_000)].join(" ").toLowerCase();
  const scores   = Object.entries(CATEGORY_SIGNALS).map(([cat, signals]) => ({
    cat:   cat as SiteCategory,
    score: signals.reduce((sum, kw) => sum + (haystack.includes(kw) ? 1 : 0), 0),
  }));
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  return best.score > 0 ? best.cat : "general";
}

// ── Color utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{3,8}$/.test(clean)) return [59, 130, 246];
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function darkenColor(hex: string): string {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{3,6}$/.test(clean)) return DEFAULT_SECONDARY;
  const full  = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r     = Math.max(0, parseInt(full.slice(0, 2), 16) - 60);
  const g     = Math.max(0, parseInt(full.slice(2, 4), 16) - 60);
  const b     = Math.max(0, parseInt(full.slice(4, 6), 16) - 60);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function cleanText(raw: string): string {
  return raw
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function resolveUrl(href: string, base: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  try { return new URL(href, base).href; } catch { return href; }
}

/**
 * demo/ai-slot-analyzer.ts
 *
 * AI-powered slot detection for Mirror Demos.
 *
 * Replaces (and extends) the handful of regex heuristics in slot-injector.ts
 * with a Claude-driven analysis that:
 *
 *   1. Extracts an "element map" — the 20-25 most significant text-bearing
 *      elements from the mirrored HTML (headings, paragraphs, CTAs).
 *
 *   2. Sends the element map + site context to Claude and asks it to identify
 *      8-12 personalizable slots and generate 6 unique content variants per
 *      slot — one for each Mister Chameleon blueprint scenario.
 *
 *   3. Returns an array of AiSlotDefinition objects that slot-injector.ts
 *      uses to tag the live HTML before storing the demo instance.
 *
 * ─── Failure contract ─────────────────────────────────────────────────────────
 *
 *   Always returns an array (never throws).  Returns [] when:
 *   • No Anthropic API key is configured
 *   • The API call fails or times out
 *   • The response cannot be parsed as valid slot JSON
 *
 *   slot-injector.ts falls back to its regex heuristics in that case, so the
 *   demo still works — just with fewer slots.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Imports @anthropic-ai/sdk dynamically so this module is never bundled
 *   for the browser.
 */

import type { SiteCategory } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiSlotDefinition {
  /**
   * Kebab-case slot identifier — e.g. "hero-title", "proof-heading",
   * "feature-2-title", "nav-cta".
   * Used as the value of data-mc-slot="…" on the tagged element.
   */
  slotKey:   string;
  /**
   * Plain-text content of the element as it appears in the HTML.
   * Used to locate the element via text-content matching during injection.
   * Must be ≥ 5 characters.
   */
  matchText: string;
  /** HTML tag name (lower-case) — h1, h2, h3, h4, p, button, a, span, li */
  tag:       string;
  /**
   * Personalized content for each of the 6 blueprint scenarios.
   * All 6 keys are always present.
   */
  scenarios: Record<BlueprintKey, string>;
}

type BlueprintKey =
  | "awareness"
  | "consideration"
  | "high_intent"
  | "form_dropout"
  | "customer"
  | "expansion";

// ── Internal types ─────────────────────────────────────────────────────────────

interface ElementEntry {
  tag:   string;
  text:  string;
  index: number;
}

interface ClaudeSlotResponse {
  slots: Array<{
    slotKey:   string;
    matchText: string;
    tag:       string;
    scenarios: Record<string, string>;
  }>;
  /**
   * Optional: per-scenario Unsplash search keywords for the hero image.
   * When present, hero-image slot URLs are built from these and added to
   * the scenario_slots map.  Shape: { awareness: "saas team office", ... }
   */
  imageKeywords?: Record<string, string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AI_MODEL       = "claude-sonnet-4-6";
const AI_TIMEOUT_MS  = 40_000;
const MAX_TOKENS     = 4_000;

// CTA keywords for link extraction (English + Dutch + German)
const CTA_RE = /\b(start|get|try|request|book|sign|demo|contact|discover|learn|see|schedule|begin|join|register|apply|explore|download|watch|buy|subscribe|free|trial|quote|talk|chat|call|meet|consult|aanvragen|probeer|ontdek|bekijk|starten|aanmelden|registreer|reserveer|boeken|kopen|downloaden|gratis|offerte|gesprek|afspraak|Mehr erfahren|Jetzt|Kostenlos|Ausprobieren)\b/i;

// ── Element map extraction ─────────────────────────────────────────────────────

/**
 * Visual slot descriptor — carries the type of the hero visual element
 * so the slot key and injection attribute are chosen correctly.
 */
export interface HeroVisualInfo {
  /** The src/URL of the visual element */
  src:  string;
  /**
   * "img"   → <img> element, tagged with data-mc-slot-src
   * "video" → <video> element, tagged with data-mc-slot-src + data-mc-slot-poster
   * "bg"    → CSS background-image div/section, tagged with data-mc-slot-bg
   */
  type: "img" | "video" | "bg";
}

/**
 * Tries to detect the dominant hero visual (image, video, or background-image)
 * outside nav/header elements.  Returns null when nothing is found.
 *
 * Detection priority: video > background-image > img
 * (video backgrounds are the most distinctive and worth replacing; bg-images
 *  are next; plain <img> is the fallback.)
 */
export function extractHeroVisual(html: string): HeroVisualInfo | null {
  // Strip nav/header so we don't pick up logos or decorative elements
  const stripped = html
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // ── 1. <video> ────────────────────────────────────────────────────────────
  const videoRe = /<video\b([^>]*?)(?:\/?>)/gi;
  let m: RegExpExecArray | null;
  while ((m = videoRe.exec(stripped)) !== null) {
    const attrs = m[1];
    if (/^data:/i.test(attrs)) continue;
    // Skip tiny declared widths (icons)
    const wMatch = attrs.match(/\bwidth=["']?(\d+)/i);
    if (wMatch && parseInt(wMatch[1]) < 200) continue;
    // Try to find a <source src> right after
    const rest    = stripped.slice(m.index + m[0].length, m.index + m[0].length + 500);
    const srcRe   = /\bsrc=["']([^"']+)["']/i;
    const srcInTag = attrs.match(srcRe);
    const srcInSrc = rest.match(/<source\b[^>]*\bsrc=["']([^"']+)["']/i);
    const src      = srcInTag?.[1] ?? srcInSrc?.[1] ?? null;
    if (src && !/^data:/i.test(src)) return { src, type: "video" };
    // Video without explicit src is still taggable (poster-only)
    return { src: attrs.match(/\bposter=["']([^"']+)["']/i)?.[1] ?? "", type: "video" };
  }

  // ── 2. CSS background-image (inline style) ─────────────────────────────────
  const bgRe = /style=["'][^"']*background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRe.exec(stripped)) !== null) {
    const src = m[1].trim();
    if (!src || /^data:/i.test(src) || /\.(svg|gif)/i.test(src)) continue;
    return { src, type: "bg" };
  }

  // ── 3. <img> ──────────────────────────────────────────────────────────────
  const imgRe = /<img\b([^>]*?)(?:\/?>)/gi;
  while ((m = imgRe.exec(stripped)) !== null) {
    const attrs = m[1];
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    if (/^data:/i.test(src) || /\.(svg|gif)/i.test(src)) continue;
    const wMatch = attrs.match(/\bwidth=["']?(\d+)/i);
    if (wMatch && parseInt(wMatch[1]) < 100) continue;
    const hMatch = attrs.match(/\bheight=["']?(\d+)/i);
    if (hMatch && parseInt(hMatch[1]) < 80) continue;
    return { src, type: "img" };
  }

  return null;
}

/**
 * @deprecated Use extractHeroVisual() instead.
 * Kept for backwards compatibility — returns just the src string.
 */
export function extractHeroImageSrc(html: string): string | null {
  return extractHeroVisual(html)?.src ?? null;
}

/**
 * Walks the HTML string and returns the 20-25 most significant
 * text-bearing elements in document order.
 */
function extractElementMap(html: string): ElementEntry[] {
  // Strip non-content regions so we don't extract JS strings, CSS, or
  // navigation links (nav links would pollute the slot map with items that
  // are inappropriate as personalisation targets).
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")        // skip navigation menus
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")  // skip footers
    .replace(/<!--[\s\S]*?-->/g, " ");

  const elements: ElementEntry[] = [];
  const seen      = new Set<string>();
  let   pCount    = 0;
  let   ctaCount  = 0;
  let   spanCount = 0;

  const add = (tag: string, rawContent: string, index: number) => {
    const text = rawContent
      .replace(/<[^>]+>/g, "")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 5)   return;
    if (text.length > 300) return;
    const key = `${tag}:${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    elements.push({ tag, text: text.slice(0, 200), index });
  };

  // ── Headings h1–h4 ────────────────────────────────────────────────────────
  const headingRe = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(stripped)) !== null) {
    add(m[1].toLowerCase(), m[2], m.index);
  }

  // ── Paragraphs (first 8) ──────────────────────────────────────────────────
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(stripped)) !== null && pCount < 8) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 20 && text.length <= 300) {
      add("p", m[1], m.index);
      pCount++;
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  const btnRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  while ((m = btnRe.exec(stripped)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 2 && text.length <= 80) {
      add("button", m[1], m.index);
    }
  }

  // ── CTA links (first 5 that look action-oriented) ─────────────────────────
  const aRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = aRe.exec(stripped)) !== null && ctaCount < 5) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 3 && text.length <= 60 && CTA_RE.test(text)) {
      add("a", m[1], m.index);
      ctaCount++;
    }
  }

  // ── Short spans (hero eyebrow text, badges, sub-labels) — first 4 ─────────
  const spanRe = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;
  while ((m = spanRe.exec(stripped)) !== null && spanCount < 4) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length >= 8 && text.length <= 80 && !/\n/.test(text)) {
      add("span", m[1], m.index);
      spanCount++;
    }
  }

  // Sort by document order, cap at 25
  elements.sort((a, b) => a.index - b.index);
  return elements.slice(0, 25);
}

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(
  elements:       ElementEntry[],
  siteContext:    { url: string; title: string; category: SiteCategory | string; description: string },
  hasHeroImage:   boolean,
): string {
  const elementList = elements
    .map((e) => `[${e.tag}] ${e.text}`)
    .join("\n");

  const imageNote = hasHeroImage
    ? `\nThis page has a prominent hero visual (image, video, or background). Include an "imageKeywords" field in your response (see format below).`
    : "";

  return (
    `Site: ${siteContext.title}\n` +
    `URL: ${siteContext.url}\n` +
    `Category: ${siteContext.category}\n` +
    `Description: ${siteContext.description || "(none)"}\n` +
    imageNote +
    `\nElement map (in document order):\n` +
    elementList
  );
}

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert B2B website personalisation consultant working with Mister Chameleon — a platform that adapts website copy and visuals in real time based on visitor intent and funnel stage.

Your task: Given a list of key elements from a B2B prospect's website, identify 8–12 elements that benefit most from personalisation and generate 6 unique content variants for each — one per visitor scenario.

The 6 visitor scenarios are:
• awareness     — First visit, curious about the category, no prior engagement
• consideration — Returning visitor, actively comparing solutions
• high_intent   — Has seen pricing or requested info, close to a decision
• form_dropout  — Started a signup/contact form but left before submitting
• customer      — Existing paying customer visiting the site again
• expansion     — Current customer revisiting pricing or features to expand

Return ONLY a JSON object in this exact format — no prose, no markdown fences:
{
  "slots": [
    {
      "slotKey": "hero-title",
      "matchText": "exact plain-text content of the element as shown in the element map",
      "tag": "h1",
      "scenarios": {
        "awareness":    "...",
        "consideration":"...",
        "high_intent":  "...",
        "form_dropout": "...",
        "customer":     "...",
        "expansion":    "..."
      }
    }
  ]
}

Rules:
1. Identify 8–12 slots — prioritise hero heading, hero subtitle, primary CTA label, proof/results heading, secondary CTAs, section headings, and closing CTA.
2. matchText CRITICAL: copy the text EXACTLY as it appears in the element map — same language, same characters, no translation, no paraphrase. If the element map shows Dutch ("Ideeën waar je mee kunt beginnen"), matchText must be exactly "Ideeën waar je mee kunt beginnen" — never the English translation.
3. slotKey MUST use these exact canonical names where applicable — these match the decide endpoint:
   • hero-title, hero-subtitle, hero-tag
   • hero-cta-label, hero-cta-href
   • proof-title, proof-item-0-text, proof-item-1-text
   • cta-title, cta-text, cta-cta-label, cta-cta-href
   • feature-title, feature-subtitle, feature-item-0-title, feature-item-0-body
   • conversion-title, conversion-text, conversion-cta-label
   For elements that don't match a canonical name, invent a unique kebab-case key (e.g. "section-2-heading", "nav-cta").
4. Each of the 6 scenario variants must be meaningfully different — not just minor word tweaks. Tie them clearly to the visitor's state of mind.
5. Write scenario variants in the SAME language as the original element text. If the site is in Dutch, write Dutch variants. If English, write English variants.
6. Keep variant length within ±40% of the original text length.
7. For CTA labels: keep them short (2–6 words), action-oriented, imperative.
8. Use the site's industry and category to make content feel native to the brand.
9. Do not invent slot keys that duplicate the element map — only use elements that are actually present.
10. When the prompt notes that the page has a hero visual (image, video, or background), add an "imageKeywords" field to your response alongside "slots":
    - For each of the 6 scenarios, provide 2–4 English keywords that would find a relevant stock photo on Unsplash.
    - Keywords should reflect the site's industry AND the visitor's emotional state/intent.
    - Example: { "awareness": "business team office collaboration", "high_intent": "success growth achievement digital", ... }
    - Keep keywords concise, concrete, and Unsplash-friendly (no abstract concepts like "trust").`;

const UNSPLASH_ACCESS_KEY_ENV = "UNSPLASH_ACCESS_KEY";

// ── Unsplash image resolution ─────────────────────────────────────────────────
//
// Given a set of scenario→keywords pairs, resolves one image URL per scenario.
//
// Resolution order:
//   1. Unsplash API (if UNSPLASH_ACCESS_KEY is configured) — returns a proper
//      CDN URL with fixed dimensions so different scenarios genuinely differ.
//   2. Unsplash source redirect (deprecated but still operational for demos) —
//      `https://source.unsplash.com/1600x900/?{keywords}`
//      These redirect URLs are stable enough for demo previews.
//
// Returns null per scenario when both approaches fail so the caller can omit
// the image slot gracefully rather than showing a broken image.

async function resolveImageUrls(
  keywordMap: Record<string, string>,
): Promise<Record<string, string>> {
  const accessKey = process.env[UNSPLASH_ACCESS_KEY_ENV] ?? null;
  const result: Record<string, string> = {};

  for (const [scenario, keywords] of Object.entries(keywordMap)) {
    const query = encodeURIComponent(keywords.trim());
    if (!query) continue;

    if (accessKey) {
      // ── Unsplash API ────────────────────────────────────────────────────────
      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape`,
          {
            headers: {
              Authorization: `Client-ID ${accessKey}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(5000),
          },
        );
        if (res.ok) {
          const json = await res.json() as { urls?: { regular?: string } };
          const url  = json.urls?.regular;
          if (url) { result[scenario] = url; continue; }
        }
      } catch {
        // Fall through to source URL
      }
    }

    // ── Unsplash source redirect (no API key needed) ─────────────────────────
    // These are redirect URLs — the client browser follows them.  We store the
    // redirect URL; the browser fetches the actual CDN image when the slot is
    // applied.  This avoids us making a synchronous redirect-follow on the server.
    result[scenario] = `https://source.unsplash.com/1600x900/?${query}`;
  }

  return result;
}

// ── Claude caller ─────────────────────────────────────────────────────────────

async function resolveAnthropicKey(): Promise<string | null> {
  try {
    const { getPlatformAiSettings } = await import("@/platform/platform-store");
    const result = await getPlatformAiSettings();
    if (result.ok && result.data.anthropicKey) return result.data.anthropicKey;
  } catch {
    // DB unavailable — fall through to env var
  }
  return process.env["ANTHROPIC_API_KEY"] ?? null;
}

async function callClaudeForSlots(userPrompt: string): Promise<ClaudeSlotResponse | null> {
  const apiKey = await resolveAnthropicKey();
  if (!apiKey) return null;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client    = new Anthropic({ apiKey });

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const message = await client.messages.create(
        {
          model:      AI_MODEL,
          max_tokens: MAX_TOKENS,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: "user", content: userPrompt }],
        },
        { signal: controller.signal },
      );

      clearTimeout(timer);

      const raw = message.content[0]?.type === "text" ? message.content[0].text : "";
      if (!raw) return null;

      // Strip any accidental markdown fences Claude might include
      const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      return JSON.parse(json) as ClaudeSlotResponse;

    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.warn(
      "[demo/ai-slot-analyzer] Claude call failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────

const REQUIRED_BLUEPRINT_KEYS: BlueprintKey[] = [
  "awareness", "consideration", "high_intent", "form_dropout", "customer", "expansion",
];

function isValidSlot(s: unknown): s is AiSlotDefinition {
  if (!s || typeof s !== "object") return false;
  const slot = s as Record<string, unknown>;
  if (typeof slot.slotKey   !== "string" || slot.slotKey.length < 2)   return false;
  if (typeof slot.matchText !== "string" || slot.matchText.length < 5)  return false;
  if (typeof slot.tag       !== "string" || slot.tag.length < 1)        return false;
  if (!slot.scenarios || typeof slot.scenarios !== "object")             return false;
  const sc = slot.scenarios as Record<string, unknown>;
  return REQUIRED_BLUEPRINT_KEYS.every((k) => typeof sc[k] === "string" && (sc[k] as string).length > 0);
}

// ── Public entry ──────────────────────────────────────────────────────────────

/**
 * Analyses the mirrored HTML and generates AI-driven slot definitions.
 *
 * Returns [] (never throws) when the key is missing, the API call fails,
 * or the response cannot be parsed.  Callers should fall back to the regex
 * heuristics in slot-injector.ts.
 */
export async function analyzeAndGenerateSlots(
  html:        string,
  siteContext: {
    url:         string;
    title:       string;
    category:    SiteCategory | string;
    description: string;
  },
): Promise<AiSlotDefinition[]> {
  try {
    // 1. Extract element map + hero visual presence
    const elements    = extractElementMap(html);
    if (elements.length === 0) return [];
    const heroVisual  = extractHeroVisual(html);

    // 2. Build prompt
    const userPrompt = buildPrompt(elements, siteContext, !!heroVisual);

    // 3. Call Claude
    const response = await callClaudeForSlots(userPrompt);
    if (!response?.slots?.length) return [];

    // 4. Validate and filter text slots
    const valid = response.slots.filter(isValidSlot) as AiSlotDefinition[];

    // 5. Resolve hero visual URL variants (if the page has a hero image/video/bg
    //    and Claude returned imageKeywords)
    if (heroVisual && response.imageKeywords && Object.keys(response.imageKeywords).length > 0) {
      try {
        const imageUrls = await resolveImageUrls(response.imageKeywords);
        const hasUrls   = Object.keys(imageUrls).length > 0;

        if (hasUrls) {
          // Choose slot key and tag name based on visual type:
          //   img   → slotKey "hero-image", tag "img"   → applySlots uses data-mc-slot-src
          //   video → slotKey "hero-video", tag "video" → applySlots uses data-mc-slot-src on <video>
          //   bg    → slotKey "hero-bg",    tag "div"   → applySlots uses data-mc-slot-bg
          const slotKey = heroVisual.type === "video" ? "hero-video"
                        : heroVisual.type === "bg"    ? "hero-bg"
                        :                               "hero-image";
          const tag     = heroVisual.type === "video" ? "video"
                        : heroVisual.type === "bg"    ? "div"
                        :                               "img";
          const fallback = heroVisual.src;

          const visualDef: AiSlotDefinition = {
            slotKey,
            matchText: "", // not used for visual slots
            tag,
            scenarios: {
              awareness:     imageUrls["awareness"]     ?? fallback,
              consideration: imageUrls["consideration"] ?? fallback,
              high_intent:   imageUrls["high_intent"]   ?? fallback,
              form_dropout:  imageUrls["form_dropout"]  ?? fallback,
              customer:      imageUrls["customer"]      ?? fallback,
              expansion:     imageUrls["expansion"]     ?? fallback,
            },
          };
          valid.push(visualDef);
          console.info(
            `[demo/ai-slot-analyzer] added ${slotKey} slot (type=${heroVisual.type}) with ${Object.keys(imageUrls).length} scenario variants`,
          );
        }
      } catch (imgErr) {
        console.warn("[demo/ai-slot-analyzer] visual resolution failed (non-fatal):",
          imgErr instanceof Error ? imgErr.message : String(imgErr));
      }
    }

    const visualCount = valid.filter(s => ["img", "video", "div"].includes(s.tag)).length;
    console.info(
      `[demo/ai-slot-analyzer] generated ${valid.length} slots (${visualCount} visual, ${valid.length - visualCount} text)` +
      ` for "${siteContext.title}"`,
    );

    return valid;
  } catch (err) {
    console.warn(
      "[demo/ai-slot-analyzer] analyzeAndGenerateSlots failed:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

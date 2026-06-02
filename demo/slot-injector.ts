/**
 * demo/slot-injector.ts
 *
 * Takes cleaned prospect HTML (from site-mirror.ts) and:
 *
 *   1. Heuristically identifies key page elements and injects
 *      data-mc-slot / data-mc-slot-href attributes so the snippet
 *      can swap them with personalised content.
 *
 *   2. Injects the Mister Chameleon snippet JS.
 *
 *   3. Injects a floating "Scenario Control" panel (HTML/CSS/JS) that
 *      shows the 6 blueprint visitor scenarios. Clicking a scenario
 *      re-fires the decide call with a forced scenario override and
 *      applies the returned slot values to the tagged elements —
 *      demonstrating real-time personalisation on the prospect's own site.
 *
 * ─── Slot naming ──────────────────────────────────────────────────────────────
 *
 *   hero-title         → first <h1>
 *   hero-subtitle      → first <p> following the <h1>
 *   hero-cta-label     → primary CTA button/link near the hero
 *   hero-cta-href      → href of the primary CTA (data-mc-slot-href)
 *   proof-title        → heading of the social-proof / results section
 *   cta-title          → heading of the bottom CTA / conversion section
 *
 * ─── Heuristics ──────────────────────────────────────────────────────────────
 *
 *   All heuristics are regex-based (no DOM parser).  They are deliberately
 *   conservative: they only tag elements they are confident about and skip
 *   when the pattern is ambiguous.  The demo is still compelling even if 2–3
 *   slots are matched out of 6.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Server-only module.  The injected snippet runs on the served demo page and
 *   calls /api/snippet/decide.  The _demoScenario field is recognised by the
 *   decide endpoint as a safe, read-only override of the rule-engine output.
 */

import type { AiSlotDefinition } from "./ai-slot-analyzer";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InjectOptions {
  /**
   * Public snippet site key (the MC demo tenant's site key).
   * The snippet will send this to /api/snippet/decide.
   */
  siteKey:    string;
  /**
   * Base URL of the MC platform (e.g. "https://misterchameleon.com" or
   * "http://localhost:3000" in dev).  Used to construct the decide URL.
   */
  decideBase: string;
  /** Prospect site name — shown in the scenario panel header */
  siteName:   string;
  /** Prospect favicon URL — shown in the scenario panel header */
  faviconUrl?: string | null;
  /**
   * AI-generated slot definitions from demo/ai-slot-analyzer.ts.
   * When present, these are injected BEFORE the regex heuristics.
   * Any element already tagged by AI is skipped by the regex taggers.
   */
  aiSlots?: AiSlotDefinition[];
  /**
   * Pre-computed per-scenario slot content (from ai-slot-analyzer + legacy scenarios).
   * Embedded as an inline JSON blob so the panel can apply content immediately
   * WITHOUT a decide API call — making the demo self-contained and reliable even
   * before the scenario_slots DB migration is applied.
   *
   * Shape: { [scenarioKey]: { [slotKey]: content } }
   */
  scenarioSlots?: Record<string, Record<string, string>> | null;
}

// ── Blueprint scenarios (Mister Chameleon canonical 6) ────────────────────────

const BLUEPRINT_SCENARIOS = [
  {
    key:         "awareness",
    label:       "Nieuw bezoek",
    labelEn:     "New visitor",
    icon:        "👋",
    description: "Bewustzijnsfase — eerste keer op de site",
    color:       "#6366f1",
  },
  {
    key:         "consideration",
    label:       "Overweging",
    labelEn:     "Considering",
    icon:        "🔍",
    description: "Evalueert opties, heeft cases bekeken",
    color:       "#8b5cf6",
  },
  {
    key:         "high_intent",
    label:       "Hoge intentie",
    labelEn:     "High intent",
    icon:        "🎯",
    description: "Klaar om te kopen, pricing bekeken",
    color:       "#0ea5e9",
  },
  {
    key:         "form_dropout",
    label:       "Formulier dropout",
    labelEn:     "Form drop-off",
    icon:        "↩️",
    description: "Startte formulier maar haakte af",
    color:       "#f59e0b",
  },
  {
    key:         "customer",
    label:       "Post-conversie",
    labelEn:     "Post-conversion",
    icon:        "✅",
    description: "Bestaande klant — onboarding fase",
    color:       "#10b981",
  },
  {
    key:         "expansion",
    label:       "Klantuitbreiding",
    labelEn:     "Expansion",
    icon:        "🚀",
    description: "Klant die terugkeert naar pricing",
    color:       "#ec4899",
  },
] as const;

// ── Safe JSON serialiser ──────────────────────────────────────────────────────
//
// JSON.stringify does not escape `</` sequences.  If embedded directly in a
// <script> tag, a site name or generated content containing `</script>` will
// cause the browser's HTML parser to terminate the script early — the whole
// IIFE silently never runs.
//
// Replacing `</` → `<\/` is always valid JSON (the forward-slash character
// MAY be escaped with a backslash per the JSON spec) and prevents the HTML
// parser from seeing `</script>` inside an inline script block.
//
// We also escape `<!--` and `-->` which can similarly confuse HTML parsers
// operating in "script data" state.

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\//g,  "<\\/")
    .replace(/<!--/g, "<\\!--")
    .replace(/-->/g,  "--\\>");
}

// ── Public entry ──────────────────────────────────────────────────────────────

/**
 * Instruments the cleaned HTML with slot attributes, the snippet, and
 * the scenario control panel.  Returns the fully instrumented HTML string.
 */
export function instrumentHtml(html: string, options: InjectOptions): string {
  let out = html;

  // ── 1a. Inject AI-detected slots (if provided) ────────────────────────────
  //   These are injected first.  The regex heuristics below will skip any
  //   element that already carries a data-mc-slot attribute, so there is no
  //   double-tagging.
  if (options.aiSlots?.length) {
    out = injectAiSlots(out, options.aiSlots);
  }

  // ── 1b. Tag key elements with regex heuristics ────────────────────────────
  //   Each tagger skips elements already carrying a data-mc-slot attribute,
  //   so AI-injected slots above are never overwritten.
  //   Current coverage:
  //     hero-title       → first prominent h1/h2 (not brand name, not in nav)
  //     hero-subtitle    → first paragraph after hero-title
  //     hero-cta-label   → first CTA button/link after hero-title
  //     proof-title      → social-proof / results section heading
  //     proof-body       → first paragraph after proof-title (NEW)
  //     cta-title        → conversion section heading (bottom of page)
  //     cta-body         → first paragraph after cta-title (NEW)
  //     cta-cta          → first CTA button/link after cta-title (NEW)
  out = tagHeroTitle(out);
  out = tagHeroImage(out);
  out = tagHeroVideo(out);
  out = tagHeroBg(out);
  out = tagHeroSubtitle(out);
  out = tagHeroCta(out);
  out = tagProofTitle(out);
  out = tagProofBody(out);
  out = tagCtaTitle(out);
  out = tagCtaBody(out);
  out = tagCtaCta(out);

  // ── 2. Build the injected block (snippet + scenario panel) ────────────────
  const injection = buildInjection(options);

  // ── 3. Insert before </body> (or at end if no </body>) ────────────────────
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${injection}\n</body>`);
  } else {
    out = out + "\n" + injection;
  }

  return out;
}

// ── AI slot injector ──────────────────────────────────────────────────────────

/**
 * Injects data-mc-slot attributes using AI-generated slot definitions.
 *
 * For each definition:
 *   • Searches for a <tag> element whose plain-text content contains matchText
 *     (case-insensitive, whitespace-normalised).
 *   • Adds data-mc-slot="<slotKey>" to the opening tag.
 *   • For <a> elements also adds data-mc-slot-href="<slotKey>-href" to the href.
 *   • Skips elements that are already tagged (prevents double-tagging).
 *   • At most one element is tagged per slot definition.
 *
 * The regex heuristics that follow (tagHeroTitle etc.) respect existing
 * data-mc-slot attributes and will not overwrite anything tagged here.
 */
// Void HTML elements that are self-closing — they have no closing tag,
// so the regex pattern used in injectAiSlots never matches them.  We skip
// them explicitly to avoid any edge-case behaviour.
const VOID_TAGS = new Set(["img", "input", "br", "hr", "meta", "link", "source", "track", "wbr"]);

function injectAiSlots(html: string, aiSlots: AiSlotDefinition[]): string {
  let out = html;

  for (const slot of aiSlots) {
    // Skip void / self-closing elements — they use data-mc-slot-src (images)
    // or data-mc-slot-href (links), not data-mc-slot, and are tagged by the
    // dedicated heuristic taggers (tagHeroImage etc.) not this function.
    if (VOID_TAGS.has(slot.tag.toLowerCase())) continue;

    // Skip if matchText too short (e.g. empty — defensive guard)
    if (!slot.matchText || slot.matchText.trim().length < 5) continue;

    // Skip if this slotKey is already present (e.g. from a previous pass)
    if (out.includes(`data-mc-slot="${slot.slotKey}"`)) continue;

    const tag     = slot.tag.toLowerCase();
    const pattern = new RegExp(
      `(<${tag}\\b)([^>]*>)([\\s\\S]*?)<\\/${tag}>`,
      "gi",
    );

    let found = false;
    out = out.replace(pattern, (full, openTag, attrs, content) => {
      if (found) return full;
      // Skip already-tagged elements
      if (attrs.includes("data-mc-slot")) return full;

      // Normalise the element's text content and compare
      const textContent = content
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z#0-9]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      const needle = slot.matchText
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (!textContent.toLowerCase().includes(needle)) return full;

      found = true;

      // For <a>: also wire up the href slot
      if (tag === "a") {
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          const hrefSlotKey = `${slot.slotKey}-href`;
          const newAttrs = attrs.replace(
            /href=["'][^"']*["']/i,
            `href="${hrefMatch[1]}" data-mc-slot-href="${hrefSlotKey}"`,
          );
          return `${openTag} data-mc-slot="${slot.slotKey}"${newAttrs}${content}</${tag}>`;
        }
      }

      return `${openTag} data-mc-slot="${slot.slotKey}"${attrs}${content}</${tag}>`;
    });
  }

  return out;
}

// ── Slot taggers ──────────────────────────────────────────────────────────────

/**
 * Returns true when the 500 characters preceding a heading indicate it lives
 * inside a <nav> or <header> element (i.e. more opens than closes so far).
 * Used to skip brand-name headings in the site header.
 */
function isInsideNavOrHeader(preceding500: string): boolean {
  const navO  = (preceding500.match(/<nav\b/gi)     ?? []).length;
  const navC  = (preceding500.match(/<\/nav>/gi)    ?? []).length;
  const hdO   = (preceding500.match(/<header\b/gi)  ?? []).length;
  const hdC   = (preceding500.match(/<\/header>/gi) ?? []).length;
  return (navO > navC) || (hdO > hdC);
}

/**
 * Returns the string position immediately after the hero-title element's
 * closing tag.  Used by tagHeroSubtitle and tagHeroCta so they anchor their
 * search on the SAME heading that was actually tagged — not just the first h1.
 */
function findHeroEnd(html: string): number | null {
  const slotMatch = /data-mc-slot="hero-title"/.exec(html);
  if (!slotMatch) return null;
  const afterSlot = html.slice(slotMatch.index);
  const closeMatch = /<\/h[1-4]>/i.exec(afterSlot);
  if (!closeMatch) return null;
  return slotMatch.index + closeMatch.index + closeMatch[0].length;
}

/**
 * Tag the first prominent heading (h1, then h2 fallback) as hero-title.
 *
 * Skips headings that are likely brand/logo headings:
 *   • Contains only a single word (no spaces) with ≤ 30 characters
 *   • Contains an <img> (logo wrapper)
 *   • Lives inside a <nav> or <header> element
 *
 * Falls back to the first h2 with ≥ 15 characters and at least one space
 * (i.e. multiple words), also skipping nav/header-scoped h2s.
 */
function tagHeroTitle(html: string): string {
  let tagged = false;
  const out = html.replace(
    /(<h1\b)([^>]*>)([\s\S]*?)<\/h1>/gi,
    (full, tag, rest, content, offset) => {
      if (tagged) return full;
      if (rest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      // Skip empty or image-only headings
      if (text.length < 3 || /<img\b/i.test(content)) return full;
      // Skip single-word headings — almost always a brand/site name
      if (!text.includes(" ") && text.length <= 30) return full;
      // Skip if this h1 is inside a <nav> or <header>
      const preceding = html.slice(Math.max(0, (offset as number) - 500), offset as number);
      if (isInsideNavOrHeader(preceding)) return full;
      tagged = true;
      return `${tag} data-mc-slot="hero-title"${rest}${content}</h1>`;
    },
  );

  if (tagged) return out;

  // Fallback: first multi-word h2 not inside nav/header
  let h2Tagged = false;
  return html.replace(
    /(<h2\b)([^>]*>)([\s\S]*?)<\/h2>/gi,
    (full, htag, hrest, content, offset) => {
      if (h2Tagged) return full;
      if (hrest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      // Require multiple words and meaningful length to avoid short labels
      if (text.length < 15 || !text.includes(" ")) return full;
      const preceding = html.slice(Math.max(0, (offset as number) - 500), offset as number);
      if (isInsideNavOrHeader(preceding)) return full;
      h2Tagged = true;
      return `${htag} data-mc-slot="hero-title"${hrest}${content}</h2>`;
    },
  );
}

/**
 * Tag the first <p> within 3 000 characters after the hero-title element
 * that contains ≥ 20 characters.
 *
 * Anchors on the tagged data-mc-slot="hero-title" position so it always
 * looks after the correct heading — not just after the first h1 in the DOM
 * (which may be a brand/logo heading inside <header>).
 */
function tagHeroSubtitle(html: string): string {
  // Prefer the already-tagged hero-title position as anchor
  const searchStart = findHeroEnd(html) ?? (() => {
    const m = html.match(/<h1\b[^>]*>/i) ?? html.match(/<h2\b[^>]*>/i);
    return m ? (m.index ?? 0) + m[0].length : null;
  })();
  if (searchStart === null) return html;

  const h1End = searchStart;
  const window = html.slice(h1End, h1End + 3000);

  let replaced = false;
  const patched = window.replace(
    /(<p\b)([^>]*>)([\s\S]*?)<\/p>/i,
    (full, ptag, prest, content) => {
      if (replaced) return full;
      if (prest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      if (text.length < 20) return full;
      replaced = true;
      return `${ptag} data-mc-slot="hero-subtitle"${prest}${content}</p>`;
    },
  );

  if (!replaced) return html;
  return html.slice(0, h1End) + patched + html.slice(h1End + 3000);
}

/**
 * Tag the first <a> or <button> after the hero-title element that looks like
 * a primary CTA.
 *
 * Anchors on the tagged data-mc-slot="hero-title" position so it always
 * searches inside the hero section — not the site navigation.
 * Window is 3 000 characters — wide enough for sites with a large hero block.
 */
function tagHeroCta(html: string): string {
  const searchStart = findHeroEnd(html) ?? (() => {
    const m = html.match(/<h1\b[^>]*>/i) ?? html.match(/<h2\b[^>]*>/i);
    return m ? (m.index ?? 0) + m[0].length : null;
  })();
  if (searchStart === null) return html;

  const h1End  = searchStart;
  // 8 000-char window so we reach the hero section even when a large nav or
  // header precedes the main content.
  const window = html.slice(h1End, h1End + 8000);

  // English + Dutch + German CTA action words
  const CTA_RE = /\b(start|get|try|request|book|sign|demo|contact|discover|learn|see|schedule|begin|join|claim|access|register|apply|explore|download|watch|buy|order|subscribe|free|now|today|plan|quote|trial|talk|chat|call|meet|consult|aanvragen|probeer|ontdek|bekijk|starten|beginnen|aanmelden|registreer|reserveer|boeken|kopen|bestellen|downloaden|gratis|nu|vandaag|offerte|gesprek|afspraak|lees meer|meer info|leer meer|Mehr erfahren|Jetzt|Kostenlos|Ausprobieren)\b/i;

  let replaced = false;

  // Helper: tag a CTA element
  const tagCta = (full: string, etag: string, erest: string, content: string, closeTag: string): string => {
    if (replaced) return full;
    if (erest.includes("data-mc-slot")) return full;
    const text = content.replace(/<[^>]+>/g, "").trim();
    // Accept if it matches a CTA keyword OR is short and not a navigation link
    if (!CTA_RE.test(text) && text.length < 3) return full;
    if (text.length > 80) return full; // probably a nav item or paragraph, not a button
    replaced = true;

    let newErest = erest;
    // For <a> tags: also tag the href for the href slot
    if (closeTag === "</a>") {
      const hrefMatch = erest.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        newErest = newErest.replace(
          /href=["'][^"']*["']/i,
          `href="${hrefMatch[1]}" data-mc-slot-href="hero-cta-href"`,
        );
      }
    }
    return `${etag} data-mc-slot="hero-cta-label"${newErest}${content}${closeTag}`;
  };

  // Try <a> first
  let patched = window.replace(
    /(<a\b)([^>]*>)([\s\S]*?)<\/a>/gi,
    (full, atag, arest, content) => tagCta(full, atag, arest, content, "</a>"),
  );

  if (!replaced) {
    // Try <button>
    patched = patched.replace(
      /(<button\b)([^>]*>)([\s\S]*?)<\/button>/gi,
      (full, btag, brest, content) => tagCta(full, btag, brest, content, "</button>"),
    );
  }

  if (!replaced) return html;
  return html.slice(0, h1End) + patched + html.slice(h1End + 8000);
}

/**
 * Tag a proof/results/trust section heading.
 * Looks for an h2/h3 containing proof-related keywords (English + Dutch + German).
 * Falls back to the second <h2> in the document.
 */
function tagProofTitle(html: string): string {
  const PROOF_KW = /\b(customer|trusted|trust|result|team|client|partner|review|testimonial|success|case|proof|social|stat|number|award|certif|klant|vertrouw|resultaat|bewijs|succesverhaal|ervar|getuig|referentie|cijfer|award|certificaat|Kunden|Vertrauen|Ergebnis|Beweis|Erfolg)\b/i;

  let found = false;
  let out = html.replace(
    /(<h[23]\b)([^>]*>)([\s\S]*?)<\/h[23]>/gi,
    (full, htag, hrest, content) => {
      if (found) return full;
      if (hrest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      if (!PROOF_KW.test(text)) return full;
      found = true;
      return `${htag} data-mc-slot="proof-title"${hrest}${content}</${htag.slice(1, 3)}>`;
    },
  );

  if (!found) {
    // Fallback: tag the second <h2>
    let h2Count = 0;
    out = out.replace(
      /(<h2\b)([^>]*>)/gi,
      (m, htag, hrest) => {
        h2Count++;
        if (h2Count !== 2 || hrest.includes("data-mc-slot")) return m;
        return `${htag} data-mc-slot="proof-title"${hrest}`;
      },
    );
  }

  return out;
}

/**
 * Tag a CTA / conversion section heading — typically the last prominent h2.
 * Looks for action/conversion keywords in English and Dutch.
 * Falls back to the second-to-last <h2>.
 */
function tagCtaTitle(html: string): string {
  const CTA_HEADING_KW = /\b(ready|start|get started|join|try|book|contact|let'?s|begin|sign up|discover|request|talk|free|today|demo|now|trial|klaar|begin|starten|aanmelden|probeer|boek|neem contact|ontdek|gratis|vandaag|aanvragen|registreer|gesprek|afspraak|Jetzt|Starten|Kontakt|Kostenlos)\b/i;

  let lastMatch: { index: number; full: string; htag: string; hrest: string } | null = null;

  // Scan all h2/h3 for CTA-like headings
  const re = /(<h[23]\b)([^>]*>)([\s\S]*?)<\/h[23]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [full, htag, hrest, content] = m as unknown as [string, string, string, string];
    if (hrest.includes("data-mc-slot") || hrest.includes("proof-title")) continue;
    const text = content.replace(/<[^>]+>/g, "").trim();
    if (CTA_HEADING_KW.test(text)) {
      lastMatch = { index: m.index, full, htag, hrest };
    }
  }

  if (lastMatch) {
    const { index, full, htag, hrest } = lastMatch;
    const tagged = full.replace(htag + hrest, `${htag} data-mc-slot="cta-title"${hrest}`);
    return html.slice(0, index) + tagged + html.slice(index + full.length);
  }

  // Fallback: tag the last <h2> that isn't already tagged
  let lastH2: { index: number; full: string; htag: string; hrest: string } | null = null;
  const re2 = /(<h2\b)([^>]*>)/gi;
  let m2: RegExpExecArray | null;
  while ((m2 = re2.exec(html)) !== null) {
    const [full, htag, hrest] = m2 as unknown as [string, string, string];
    if (!hrest.includes("data-mc-slot")) {
      lastH2 = { index: m2.index, full, htag, hrest };
    }
  }

  if (lastH2) {
    const { index, full, htag, hrest } = lastH2;
    const tagged = `${htag} data-mc-slot="cta-title"${hrest}`;
    return html.slice(0, index) + tagged + html.slice(index + full.length);
  }

  return html;
}

/**
 * Returns the string position immediately after the closing tag of the element
 * that carries data-mc-slot="<slotKey>".
 * Used to anchor subsequent "body" and "CTA" taggers on the section that was
 * already tagged — making tagProofBody, tagCtaBody, etc. work correctly
 * even when sections appear in unexpected order.
 */
function findSlotEnd(html: string, slotKey: string): number | null {
  const slotMatch = new RegExp(`data-mc-slot="${slotKey}"`).exec(html);
  if (!slotMatch) return null;
  const afterSlot = html.slice(slotMatch.index);
  const closeMatch = /<\/h[1-6]>|<\/p>|<\/div>|<\/section>/i.exec(afterSlot);
  if (!closeMatch) return null;
  return slotMatch.index + closeMatch.index + closeMatch[0].length;
}

/**
 * Tag the first substantial paragraph (≥ 30 chars) after the proof-title
 * element as "proof-item-0-text" (matches the decide endpoint slot key).
 */
function tagProofBody(html: string): string {
  const searchStart = findSlotEnd(html, "proof-title");
  if (searchStart === null) return html;

  const window = html.slice(searchStart, searchStart + 4000);
  let replaced = false;
  const patched = window.replace(
    /(<p\b)([^>]*>)([\s\S]*?)<\/p>/i,
    (full, ptag, prest, content) => {
      if (replaced) return full;
      if (prest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      if (text.length < 30) return full;
      replaced = true;
      return `${ptag} data-mc-slot="proof-item-0-text"${prest}${content}</p>`;
    },
  );

  if (!replaced) return html;
  return html.slice(0, searchStart) + patched + html.slice(searchStart + 4000);
}

/**
 * Tag the first substantial paragraph (≥ 30 chars) after the cta-title
 * element as "cta-text" (matches the decide endpoint slot key).
 */
function tagCtaBody(html: string): string {
  const searchStart = findSlotEnd(html, "cta-title");
  if (searchStart === null) return html;

  const window = html.slice(searchStart, searchStart + 4000);
  let replaced = false;
  const patched = window.replace(
    /(<p\b)([^>]*>)([\s\S]*?)<\/p>/i,
    (full, ptag, prest, content) => {
      if (replaced) return full;
      if (prest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      if (text.length < 30) return full;
      replaced = true;
      return `${ptag} data-mc-slot="cta-text"${prest}${content}</p>`;
    },
  );

  if (!replaced) return html;
  return html.slice(0, searchStart) + patched + html.slice(searchStart + 4000);
}

/**
 * Tag the first <a> or <button> after the cta-title element as "cta-cta-label"
 * (matches the decide endpoint slot key).
 */
function tagCtaCta(html: string): string {
  const searchStart = findSlotEnd(html, "cta-title");
  if (searchStart === null) return html;

  const CTA_RE = /\b(start|get|try|request|book|sign|demo|contact|discover|learn|see|schedule|begin|join|apply|free|now|today|talk|call|meet|aanvragen|probeer|ontdek|bekijk|starten|aanmelden|registreer|reserveer|boeken|gratis|gesprek|afspraak)\b/i;

  const window = html.slice(searchStart, searchStart + 4000);
  let replaced = false;

  const tryTag = (w: string, tagName: string, closeTag: string) =>
    w.replace(
      new RegExp(`(<${tagName}\\b)([^>]*>)([\\s\\S]*?)${closeTag}`, "i"),
      (full, etag, erest, content) => {
        if (replaced) return full;
        if (erest.includes("data-mc-slot")) return full;
        const text = content.replace(/<[^>]+>/g, "").trim();
        if (text.length > 80 || text.length < 2) return full;
        if (!CTA_RE.test(text) && text.length < 3) return full;
        replaced = true;
        return `${etag} data-mc-slot="cta-cta-label"${erest}${content}${closeTag}`;
      },
    );

  let patched = tryTag(window, "a", "</a>");
  if (!replaced) patched = tryTag(patched, "button", "</button>");
  if (!replaced) return html;
  return html.slice(0, searchStart) + patched + html.slice(searchStart + 4000);
}

/**
 * Tag <video> elements near the hero section with data-mc-slot-src="hero-video".
 *
 * Also tags the poster attribute via data-mc-slot-poster="hero-video" so both
 * the video source AND the fallback thumbnail/poster image are swappable.
 *
 * Searches 2 000 chars before and 8 000 chars after the hero-title so it
 * catches videos that are siblings of or wrappers around the hero heading.
 *
 * Skips:
 *   • Videos inside <nav> or <header> (decorative/logo uses)
 *   • Videos that are already tagged
 *   • Videos < 200px wide (declared width attribute)
 */
function tagHeroVideo(html: string): string {
  const heroMatch =
    /data-mc-slot="hero-title"/.exec(html) ??
    html.match(/<h1\b[^>]*>/i) ??
    html.match(/<h2\b[^>]*>/i);
  if (!heroMatch) return html;

  const heroPos    = heroMatch.index ?? 0;
  const searchFrom = Math.max(0, heroPos - 2000);
  const searchTo   = Math.min(html.length, heroPos + 8000);
  const windowHtml = html.slice(searchFrom, searchTo);

  let replaced = false;

  const patched = windowHtml.replace(
    /(<video\b)([^>]*?)(\/?>)/gi,
    (full, videoTag, attrs, close, offsetInWindow) => {
      if (replaced) return full;
      if (attrs.includes("data-mc-slot")) return full;

      // Skip small declared widths (decorative)
      const wMatch = attrs.match(/\bwidth=["']?(\d+)/i);
      if (wMatch && parseInt(wMatch[1]) < 200) return full;

      // Skip if inside nav/header
      const absOffset = searchFrom + (offsetInWindow as number);
      const preceding = html.slice(Math.max(0, absOffset - 600), absOffset);
      if (isInsideNavOrHeader(preceding)) return full;

      replaced = true;

      // Add data-mc-slot-src AND data-mc-slot-poster so both video src and
      // poster/thumbnail are driven by the same slot key.
      let newAttrs = attrs;
      if (!newAttrs.includes("data-mc-slot-poster")) {
        newAttrs = newAttrs + ' data-mc-slot-poster="hero-video"';
      }
      return `${videoTag} data-mc-slot-src="hero-video"${newAttrs}${close}`;
    },
  );

  if (!replaced) return html;
  return html.slice(0, searchFrom) + patched + html.slice(searchTo);
}

/**
 * Tag elements that use CSS background-image for large visual areas (hero
 * background, section backgrounds) with data-mc-slot-bg="hero-bg".
 *
 * Detects:
 *   • Inline style="background-image: url(...)"
 *   • Inline style="background: url(...)"
 *   • Tailwind arbitrary background-image utility classes or data-bg="..."
 *
 * Searches the same 2 000 + 8 000 char window around the hero heading.
 * Only tags the first qualifying element to avoid false positives.
 */
function tagHeroBg(html: string): string {
  const heroMatch =
    /data-mc-slot="hero-title"/.exec(html) ??
    html.match(/<h1\b[^>]*>/i) ??
    html.match(/<h2\b[^>]*>/i);
  if (!heroMatch) return html;

  const heroPos    = heroMatch.index ?? 0;
  const searchFrom = Math.max(0, heroPos - 2000);
  const searchTo   = Math.min(html.length, heroPos + 8000);
  const windowHtml = html.slice(searchFrom, searchTo);

  // Pattern: opening tag of a div/section/header that has a background-image style
  const bgRe = /(<(?:div|section|header)\b)([^>]*?style=["'][^"']*background(?:-image)?:\s*url\([^)]+\)[^"']*["'][^>]*?)(\/?>)/gi;

  let replaced = false;
  const patched = windowHtml.replace(bgRe, (full, openTag, attrs, close, offsetInWindow) => {
    if (replaced) return full;
    if (attrs.includes("data-mc-slot")) return full;

    const absOffset = searchFrom + (offsetInWindow as number);
    const preceding = html.slice(Math.max(0, absOffset - 600), absOffset);
    if (isInsideNavOrHeader(preceding)) return full;

    replaced = true;
    return `${openTag} data-mc-slot-bg="hero-bg"${attrs}${close}`;
  });

  // Also try data-bg="..." attribute pattern (used by some lazy-loaders)
  if (!replaced) {
    const dataBgRe = /(<(?:div|section|header)\b)([^>]*?data-bg=["'][^"']+["'][^>]*?)(\/?>)/gi;
    const patched2 = windowHtml.replace(dataBgRe, (full, openTag, attrs, close, offsetInWindow) => {
      if (replaced) return full;
      if (attrs.includes("data-mc-slot")) return full;
      const absOffset = searchFrom + (offsetInWindow as number);
      const preceding = html.slice(Math.max(0, absOffset - 600), absOffset);
      if (isInsideNavOrHeader(preceding)) return full;
      replaced = true;
      return `${openTag} data-mc-slot-bg="hero-bg"${attrs}${close}`;
    });
    if (replaced) return html.slice(0, searchFrom) + patched2 + html.slice(searchTo);
  }

  if (!replaced) return html;
  return html.slice(0, searchFrom) + patched + html.slice(searchTo);
}

/**
 * Tag the first prominent <img> near the hero section as "hero-image".
 *
 * Searches 2 000 chars BEFORE the hero-title up to 6 000 chars AFTER it,
 * so hero images that appear above the heading in the DOM are also caught.
 * Skips images that are:
 *   • Inside <nav> or <header> (logo images)
 *   • < 100px wide (declared width attribute only)
 *   • SVG or GIF files
 *   • Data URIs
 *   • Already tagged
 *
 * Uses data-mc-slot-src instead of data-mc-slot so the client-side
 * applySlots handler swaps the src attribute rather than inner text.
 */
function tagHeroImage(html: string): string {
  // Anchor on the tagged hero-title, or fall back to the first h1/h2
  const heroMatch =
    /data-mc-slot="hero-title"/.exec(html) ??
    html.match(/<h1\b[^>]*>/i) ??
    html.match(/<h2\b[^>]*>/i);
  if (!heroMatch) return html;

  const heroPos    = heroMatch.index ?? 0;
  const searchFrom = Math.max(0, heroPos - 2000);
  const searchTo   = heroPos + 6000;
  const windowHtml = html.slice(searchFrom, searchTo);

  let replaced = false;

  const patched = windowHtml.replace(
    /(<img\b)([^>]*?)(\/?>)/gi,
    (full, imgTag, attrs, close, offsetInWindow) => {
      if (replaced) return full;
      if (attrs.includes("data-mc-slot")) return full;

      // Skip SVG/GIF/data-URI sources
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      if (!srcMatch) return full;
      const src = srcMatch[1];
      if (/^data:/i.test(src) || /\.(svg|gif)/i.test(src)) return full;

      // Skip images with a small declared width (icons, logos)
      const wMatch = attrs.match(/width=["']?(\d+)/i);
      if (wMatch && parseInt(wMatch[1]) < 100) return full;

      // Skip images inside <nav> or <header> (logo, favicons)
      const absOffset  = searchFrom + (offsetInWindow as number);
      const preceding  = html.slice(Math.max(0, absOffset - 600), absOffset);
      if (isInsideNavOrHeader(preceding)) return full;

      replaced = true;
      return `${imgTag} data-mc-slot-src="hero-image"${attrs}${close}`;
    },
  );

  if (!replaced) return html;
  return html.slice(0, searchFrom) + patched + html.slice(searchTo);
}

// ── Injection builder ─────────────────────────────────────────────────────────

function buildInjection({ siteKey, decideBase, siteName, faviconUrl, scenarioSlots }: InjectOptions): string {
  const decideUrl = `${decideBase}/api/snippet/decide`;

  // ── Scenario buttons — generated as STATIC HTML (server-side TypeScript) ────
  //
  // Pre-rendering the button markup guarantees the panel is always visible
  // regardless of JS execution.  The injected JS only attaches click listeners.
  const scenarioButtonsHtml = BLUEPRINT_SCENARIOS.map((s) =>
    `<button class="mc-scenario-btn" data-key="${s.key}" type="button">` +
    `<span class="mc-scenario-icon">${s.icon}</span>` +
    `<span class="mc-scenario-text">` +
      `<span class="mc-scenario-name">` +
        `<span class="mc-scenario-dot" style="background:${s.color}"></span>` +
        s.labelEn +
      `</span>` +
      `<span class="mc-scenario-desc">${s.description}</span>` +
    `</span>` +
    `</button>`,
  ).join("\n    ");

  // ── Site info header — also static HTML ─────────────────────────────────────
  const faviconHtml = faviconUrl
    ? `<img class="mc-site-favicon" src="${faviconUrl}" alt="" onerror="this.style.display='none'">`
    : "";
  const safeHtmlText = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const siteNameHtml = safeHtmlText(siteName ?? "");

  // ── Script-embedded values ───────────────────────────────────────────────────
  // safeJson escapes `</` → `<\/` so `</script>` inside JSON never terminates
  // the script tag early.
  const siteKeyJs    = safeJson(siteKey);
  const decideUrlJs  = safeJson(decideUrl);
  const scenarioLabelsJs = safeJson(
    Object.fromEntries(BLUEPRINT_SCENARIOS.map((s) => [s.key, s.labelEn])),
  );
  // Snippet tag shown to prospects as the one-line integration
  const snippetTagJs = safeJson(
    `<script src="${decideBase}/api/snippet.js" data-site-key="${siteKey}" async><\/script>`,
  );

  // Embedded scenario slots — the entire per-scenario content map serialised
  // into the HTML so the panel applies changes WITHOUT a network round-trip.
  // The decide call still runs as a secondary pass for real CMS overrides.
  const embeddedSlotsJs = safeJson(scenarioSlots ?? {});

  return `
<!-- ── Mister Chameleon Mirror Demo ──────────────────────────────────────────
     Injected by the Mister Chameleon Demo Importer.
     This block is only present in demo previews, never in production.

     To add personalisation to your own site, install the snippet:
     <script src="${decideBase}/api/snippet.js" data-site-key="${siteKey}" async></script>
──────────────────────────────────────────────────────────────────────────── -->
<style id="mc-mirror-styles">
  /* ── Debug slot outlines ────────────────────────────────────────────── */
  [data-mc-slot], [data-mc-slot-href], [data-mc-slot-src] {
    outline: 1.5px dashed rgba(99,102,241,.4) !important;
    outline-offset: 3px !important;
    border-radius: 3px !important;
    position: relative !important;
  }
  /* ── Hero image visual transitions ─────────────────────────────────── */
  [data-mc-slot-src] {
    transition: filter 0.5s ease, opacity 0.4s ease !important;
  }

  /* ── Scenario panel ─────────────────────────────────────────────────── */
  #mc-scenario-panel {
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    z-index: 999999;
    width: 260px;
    background: #0f172a;
    border-radius: 16px 0 0 16px;
    border: 1px solid rgba(99,102,241,.3);
    border-right: none;
    box-shadow: -8px 0 40px rgba(0,0,0,.35);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    color: #e2e8f0;
    overflow: hidden;
    transition: transform .3s ease;
  }
  #mc-scenario-panel.mc-collapsed {
    transform: translateY(-50%) translateX(244px);
  }
  /* Show a prominent "MC" pill tab when collapsed so it's always clickable */
  #mc-scenario-panel.mc-collapsed .mc-panel-collapse::before {
    content: 'MC';
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .04em;
    color: #a5b4fc;
    margin-right: 4px;
  }
  .mc-panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px 10px;
    background: #1e1b4b;
    border-bottom: 1px solid rgba(99,102,241,.25);
    cursor: pointer;
    user-select: none;
  }
  .mc-panel-header-logo {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: #6366f1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mc-panel-header-logo svg { width: 13px; height: 13px; fill: white; }
  .mc-panel-title { flex: 1; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .06em; color: #a5b4fc; }
  .mc-panel-collapse { font-size: 16px; color: rgba(255,255,255,.4);
    line-height: 1; padding: 0 2px; }
  .mc-panel-collapse:hover { color: white; }

  .mc-panel-site {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .mc-site-favicon { width: 14px; height: 14px; object-fit: contain; border-radius: 2px; }
  .mc-site-name { font-size: 11px; color: #64748b; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }

  .mc-panel-body { padding: 8px 0 4px; max-height: calc(100vh - 240px); overflow-y: auto; }
  .mc-panel-label { padding: 4px 14px 2px; font-size: 9px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: #475569; }

  .mc-scenario-btn {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    width: 100%;
    text-align: left;
    padding: 8px 14px;
    background: none;
    border: none;
    cursor: pointer;
    transition: background .12s;
    color: #cbd5e1;
  }
  .mc-scenario-btn:hover { background: rgba(255,255,255,.05); }
  .mc-scenario-btn.mc-active { background: rgba(99,102,241,.15); }
  .mc-scenario-icon { font-size: 14px; flex-shrink: 0; line-height: 1.4; }
  .mc-scenario-text { min-width: 0; }
  .mc-scenario-name { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 5px; }
  .mc-scenario-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .mc-scenario-desc { font-size: 10px; color: #64748b; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .mc-panel-status {
    padding: 6px 14px 8px;
    font-size: 10px;
    color: #475569;
    border-top: 1px solid rgba(255,255,255,.06);
    min-height: 28px;
  }
  .mc-status-ok   { color: #4ade80; }
  .mc-status-err  { color: #f87171; }
  .mc-status-spin { animation: mc-spin .7s linear infinite; display: inline-block; }
  @keyframes mc-spin { to { transform: rotate(360deg); } }

  /* ── Install snippet footer ──────────────────────────────────────────── */
  .mc-panel-snippet {
    padding: 8px 14px 10px;
    border-top: 1px solid rgba(255,255,255,.06);
  }
  .mc-panel-snippet-label {
    font-size: 9px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: #475569; margin-bottom: 5px;
  }
  .mc-snippet-code {
    background: #0a0f1e;
    border: 1px solid rgba(99,102,241,.2);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 9px;
    font-family: "SF Mono", "Fira Code", Menlo, monospace;
    color: #a5b4fc;
    word-break: break-all;
    cursor: pointer;
    position: relative;
    transition: border-color .15s;
  }
  .mc-snippet-code:hover { border-color: rgba(99,102,241,.5); }
  .mc-snippet-copy-tip {
    font-size: 8px; color: #334155; margin-top: 3px; text-align: right;
  }

  .mc-panel-footer {
    padding: 5px 14px 8px;
    font-size: 9px;
    color: #334155;
    border-top: 1px solid rgba(255,255,255,.04);
  }
  .mc-panel-footer a { color: #4f46e5; text-decoration: none; }
  .mc-panel-footer a:hover { text-decoration: underline; }

  /* ── Slot-changed flash animation ───────────────────────────────────── */
  @keyframes mc-slot-flash {
    0%   { background-color: rgba(99,102,241,.25); }
    100% { background-color: transparent; }
  }
  .mc-slot-changed {
    animation: mc-slot-flash .8s ease-out forwards !important;
    border-radius: 3px !important;
  }

  /* ── Override prospect-page styles that might hide our injected elements ── */
  #mc-scenario-panel,
  #mc-scenario-panel * { box-sizing: border-box !important; }
  #mc-scenario-panel .mc-scenario-btn {
    display: flex !important; visibility: visible !important;
    opacity: 1 !important; pointer-events: auto !important;
  }
  #mc-scenario-panel .mc-panel-body {
    display: block !important; visibility: visible !important;
    overflow-y: auto !important;
  }
  #mc-scenarios-list { display: block !important; }
</style>

<div id="mc-scenario-panel">
  <div class="mc-panel-header" id="mc-panel-toggle">
    <div class="mc-panel-header-logo">
      <svg viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path fill="none" stroke="white" stroke-width="2" d="M8 12a4 4 0 0 1 8 0"/><line x1="12" y1="8" x2="12" y2="9" stroke="white" stroke-width="2"/></svg>
    </div>
    <span class="mc-panel-title">Scenario control</span>
    <span class="mc-panel-collapse" id="mc-collapse-btn">◀</span>
  </div>
  <div class="mc-panel-site" id="mc-panel-site">${faviconHtml}<span class="mc-site-name">${siteNameHtml}</span></div>
  <div class="mc-panel-body">
    <div class="mc-panel-label">Visitor scenario</div>
    <div id="mc-scenarios-list">
    ${scenarioButtonsHtml}
    </div>
  </div>
  <div class="mc-panel-status" id="mc-panel-status">
    Select a scenario to preview personalisation →
  </div>
  <div class="mc-panel-snippet">
    <div class="mc-panel-snippet-label">Install on your site</div>
    <div class="mc-snippet-code" id="mc-snippet-tag" title="Click to copy"></div>
    <div class="mc-snippet-copy-tip" id="mc-copy-tip">click to copy</div>
  </div>
  <div class="mc-panel-footer">
    Powered by <a href="https://misterchameleon.com" target="_blank">Mister Chameleon</a>
  </div>
</div>

<script>
// ── Mister Chameleon scenario panel ────────────────────────────────────────
// Buttons are pre-rendered as static HTML above (not created by this script).
//
// Slot content resolution order (first non-empty result wins):
//   1. EMBEDDED_SLOTS — JSON blob baked into this HTML at generation time.
//      Works immediately, no network needed, no DB dependency.
//   2. /api/snippet/decide — called with _demoId so the decide endpoint can
//      serve content from the DB once the scenario_slots migration is applied.
//      Also handles real CMS rule overrides for non-demo traffic.
(function() {
  var SITE_KEY        = ${siteKeyJs};
  var DECIDE_URL      = ${decideUrlJs};
  var SCENARIO_LABELS = ${scenarioLabelsJs};
  var SNIPPET_TAG     = ${snippetTagJs};
  var EMBEDDED_SLOTS  = ${embeddedSlotsJs};
  var TIMEOUT_MS      = 5000;

  // Extract demo ID from URL: /demo/<id>/live
  var demoId = (window.location.pathname.match(/\\/demo\\/([^\\/]+)\\/live/) || [])[1] || null;

  // ── Visual treatment per scenario ────────────────────────────────────────────
  var SCENARIO_FILTERS = {
    awareness:     'brightness(1.0) saturate(1.0)',
    consideration: 'brightness(1.03) saturate(0.88) hue-rotate(10deg)',
    high_intent:   'brightness(1.1)  saturate(1.3)  contrast(1.08)',
    form_dropout:  'brightness(0.88) saturate(0.6)',
    customer:      'brightness(1.07) saturate(1.2)  hue-rotate(-10deg)',
    expansion:     'brightness(1.06) saturate(1.25) hue-rotate(25deg)',
  };
  var SCENARIO_TINTS = {
    awareness:     'rgba(99,102,241,0.07)',
    consideration: 'rgba(139,92,246,0.07)',
    high_intent:   'rgba(14,165,233,0.09)',
    form_dropout:  'rgba(245,158,11,0.09)',
    customer:      'rgba(16,185,129,0.08)',
    expansion:     'rgba(236,72,153,0.07)',
  };

  var panel       = document.getElementById('mc-scenario-panel');
  var statusEl    = document.getElementById('mc-panel-status');
  var listEl      = document.getElementById('mc-scenarios-list');
  var toggleEl    = document.getElementById('mc-panel-toggle');
  var collapseBtn = document.getElementById('mc-collapse-btn');
  var snippetEl   = document.getElementById('mc-snippet-tag');
  var copyTipEl   = document.getElementById('mc-copy-tip');
  var collapsed   = true;
  var activeKey   = null;
  var autoFired   = false; // tracks whether auto-fire already ran

  // Apply initial collapsed state immediately (before paint)
  if (panel) panel.classList.add('mc-collapsed');
  if (collapseBtn) collapseBtn.textContent = '▶';

  // ── Startup diagnostics ──────────────────────────────────────────────────────
  // Run after DOM is settled so slot counts are accurate.
  setTimeout(function() {
    var slotCount    = document.querySelectorAll('[data-mc-slot]').length;
    var srcCount     = document.querySelectorAll('[data-mc-slot-src]').length;
    var bgCount      = document.querySelectorAll('[data-mc-slot-bg]').length;
    var totalSlots   = slotCount + srcCount + bgCount;
    var scenarioKeys = EMBEDDED_SLOTS ? Object.keys(EMBEDDED_SLOTS) : [];
    var hasEmbedded  = scenarioKeys.length > 0;

    if (statusEl && !autoFired) {
      if (totalSlots === 0) {
        setStatus('<span class="mc-status-err">⚠</span> No tagged slots found on page — regenerate demo');
      } else if (!hasEmbedded) {
        setStatus('<span class="mc-status-err">⚠</span> ' + totalSlots + ' slots tagged, but no content generated — check API key');
      } else {
        setStatus(totalSlots + ' slots ready · ' + scenarioKeys.length + ' scenarios → click to preview');
      }
    }
  }, 800);

  // Populate snippet tag display
  if (snippetEl && SNIPPET_TAG) {
    snippetEl.textContent = SNIPPET_TAG;
    snippetEl.addEventListener('click', function() {
      try {
        navigator.clipboard.writeText(SNIPPET_TAG).then(function() {
          if (copyTipEl) { copyTipEl.textContent = '✓ copied!'; setTimeout(function() { copyTipEl.textContent = 'click to copy'; }, 2000); }
        });
      } catch(e) { /* clipboard not available */ }
    });
  }

  // ── Collapse toggle ─────────────────────────────────────────────────────────
  if (toggleEl && panel) {
    toggleEl.addEventListener('click', function() {
      collapsed = !collapsed;
      panel.classList.toggle('mc-collapsed', collapsed);
      if (collapseBtn) collapseBtn.textContent = collapsed ? '▶' : '◀';
    });
  }

  // ── Wire click handlers onto the pre-rendered buttons ───────────────────────
  var buttons = listEl
    ? listEl.querySelectorAll('.mc-scenario-btn')
    : document.querySelectorAll('#mc-scenarios-list .mc-scenario-btn');

  for (var i = 0; i < buttons.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        // Explicit user click always applies — reset activeKey so same scenario
        // can be re-applied (e.g. after auto-fire already ran awareness).
        var key = btn.getAttribute('data-key');
        if (activeKey === key) activeKey = null;
        applyScenario(key);
      });
    })(buttons[i]);
  }

  // ── Scenario application ─────────────────────────────────────────────────────

  function applyScenario(key) {
    if (!key || activeKey === key) return;
    activeKey = key;

    // Highlight active button
    for (var j = 0; j < buttons.length; j++) {
      var b = buttons[j];
      b.classList.toggle('mc-active', b.getAttribute('data-key') === key);
    }

    var labelEn = (SCENARIO_LABELS && SCENARIO_LABELS[key]) ? SCENARIO_LABELS[key] : key;

    // ── Step 1: Apply visual treatment immediately (no network needed) ──────────
    applyScenarioVisuals(key);

    // ── Step 2: Apply embedded slots instantly (no decide round-trip needed) ────
    //   EMBEDDED_SLOTS is the full scenario→slot map baked into this HTML at
    //   generation time.  If it has content for this scenario we apply it right
    //   away so the demo responds instantly even when offline.
    var embeddedForKey = (EMBEDDED_SLOTS && EMBEDDED_SLOTS[key]) ? EMBEDDED_SLOTS[key] : null;
    var embeddedCount  = embeddedForKey ? applySlots(embeddedForKey) : 0;

    if (embeddedCount > 0) {
      setStatus('<span class="mc-status-ok">&#10003;</span> ' + embeddedCount + ' slot' +
        (embeddedCount === 1 ? '' : 's') + ' personalised for <strong>' + labelEn + '</strong>');
    } else {
      setStatus('<span class="mc-status-spin">&#8987;</span> Loading ' + labelEn + '…');
    }

    // ── Step 3: Also call decide for CMS overrides / DB-stored variants ─────────
    //   This runs in the background.  If decide returns additional or different
    //   slots they are applied on top of the embedded content — allowing the
    //   prospect to see real rule-engine personalisation once they install the
    //   snippet on their actual site.
    try {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var tid = setTimeout(function() {
        if (controller) controller.abort();
        // If decide timed out but we already applied embedded slots, keep the
        // success status rather than showing an error.
        if (embeddedCount === 0) {
          setStatus('<span class="mc-status-err">&#10007;</span> API timed out — showing preview');
        }
      }, TIMEOUT_MS);

      var ctx = { path: window.location.pathname, _demoScenario: key, _demoMode: 'mirror' };
      if (demoId) ctx._demoId = demoId;

      fetch(DECIDE_URL, {
        method: 'POST',
        signal: controller ? controller.signal : undefined,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey: SITE_KEY, context: ctx }),
      }).then(function(res) {
        clearTimeout(tid);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function(data) {
        if (data && data.slots && Object.keys(data.slots).length > 0) {
          var n = applySlots(data.slots);
          if (n > 0) {
            setStatus('<span class="mc-status-ok">&#10003;</span> ' + n + ' slot' +
              (n === 1 ? '' : 's') + ' personalised for <strong>' + labelEn + '</strong>');
          } else if (embeddedCount === 0) {
            // Decide returned slots but none matched tagged elements
            setStatus('<span class="mc-status-err">⚠</span> Slots returned but no tagged elements matched — regenerate demo');
          }
        } else if (embeddedCount === 0) {
          // Nothing from embedded OR decide
          setStatus('<span class="mc-status-err">⚠</span> No content for <strong>' + labelEn + '</strong> — check API key or regenerate');
        }
      }).catch(function(err) {
        clearTimeout(tid);
        if (embeddedCount === 0) {
          setStatus('<span class="mc-status-err">&#10007;</span> ' +
            (err.name === 'AbortError' ? 'Timed out' : err.message));
        }
      });
    } catch(e) {
      if (embeddedCount === 0) {
        setStatus('<span class="mc-status-err">&#10007;</span> fetch unavailable');
      }
    }
  }

  function applySlots(slots) {
    var count = 0;
    if (!slots) return count;
    var keys = Object.keys(slots);
    for (var k = 0; k < keys.length; k++) {
      var slotKey = keys[k];
      var value   = slots[slotKey];
      if (value == null) continue;

      // ── Text / HTML slots ─────────────────────────────────────────────────────
      var elems = document.querySelectorAll('[data-mc-slot="' + slotKey + '"]');
      for (var e = 0; e < elems.length; e++) {
        var el = elems[e];
        if (el.getAttribute('data-mc-html') === 'true') { el.innerHTML = value; }
        else { el.textContent = value; }
        flashEl(el);
        count++;
      }

      // ── href slots (CTA links) ────────────────────────────────────────────────
      var hElems = document.querySelectorAll('[data-mc-slot-href="' + slotKey + '"]');
      for (var h = 0; h < hElems.length; h++) {
        hElems[h].setAttribute('href', value);
        count++;
      }

      // ── Image / video src slots ───────────────────────────────────────────────
      var srcElems = document.querySelectorAll('[data-mc-slot-src="' + slotKey + '"]');
      for (var s = 0; s < srcElems.length; s++) {
        var mediaEl = srcElems[s];
        var tagName = mediaEl.tagName.toLowerCase();

        if (tagName === 'video') {
          // ── <video> swap ────────────────────────────────────────────────────
          // Replace every <source> child then reload.
          // If the new value looks like an image URL, show it as the poster
          // and hide the video itself (graceful degradation for image slots).
          var isImage = /[.](jpg|jpeg|png|gif|webp|avif|svg)([?]|$)/i.test(value);
          if (isImage) {
            mediaEl.setAttribute('poster', value);
            // Optionally fade to a static display using the poster
            mediaEl.style.transition = 'opacity 0.4s ease';
          } else {
            // Swap sources and reload
            var sources = mediaEl.querySelectorAll('source');
            if (sources.length > 0) {
              for (var sv = 0; sv < sources.length; sv++) {
                sources[sv].setAttribute('src', value);
              }
            } else {
              mediaEl.setAttribute('src', value);
            }
            mediaEl.style.opacity = '0';
            mediaEl.style.transition = 'opacity 0.4s ease';
            try { mediaEl.load(); } catch(e) {}
            setTimeout((function(el) { return function() { el.style.opacity = '1'; }; })(mediaEl), 400);
          }
          flashEl(mediaEl);
          count++;

        } else {
          // ── <img> swap ──────────────────────────────────────────────────────
          mediaEl.style.opacity = '0';
          mediaEl.setAttribute('src', value);
          if (mediaEl.hasAttribute('srcset')) mediaEl.setAttribute('srcset', '');
          if (mediaEl.hasAttribute('data-src')) mediaEl.setAttribute('data-src', value);
          mediaEl.onload = (function(el) { return function() {
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '1';
          }; })(mediaEl);
          setTimeout((function(el) { return function() {
            el.style.transition = 'opacity 0.4s ease';
            el.style.opacity = '1';
          }; })(mediaEl), 300);
          flashEl(mediaEl);
          count++;
        }
      }

      // ── Video poster slots (data-mc-slot-poster) ──────────────────────────────
      var posterElems = document.querySelectorAll('[data-mc-slot-poster="' + slotKey + '"]');
      for (var p = 0; p < posterElems.length; p++) {
        posterElems[p].setAttribute('poster', value);
        count++;
      }

      // ── CSS background-image slots (data-mc-slot-bg) ─────────────────────────
      var bgElems = document.querySelectorAll('[data-mc-slot-bg="' + slotKey + '"]');
      for (var bg = 0; bg < bgElems.length; bg++) {
        var bgEl = bgElems[bg];
        bgEl.style.transition = 'opacity 0.4s ease';
        bgEl.style.opacity = '0';
        bgEl.style.backgroundImage = 'url("' + value.replace(/"/g, '%22') + '")';
        setTimeout((function(el) { return function() { el.style.opacity = '1'; }; })(bgEl), 200);
        // Also update data-bg for lazy-loaders that re-read it
        if (bgEl.hasAttribute('data-bg')) bgEl.setAttribute('data-bg', value);
        flashEl(bgEl);
        count++;
      }
    }
    return count;
  }

  // ── Visual effects ───────────────────────────────────────────────────────────

  function applyScenarioVisuals(key) {
    try {
      var heroEl = document.querySelector('[data-mc-slot="hero-title"]');
      if (!heroEl) return;

      var heroSection = heroEl.parentElement;
      var levels = 0;
      while (heroSection && levels < 6) {
        var tn = heroSection.tagName.toLowerCase();
        if (tn === 'section' || tn === 'header' || tn === 'main') break;
        if (tn === 'div' && heroSection.getBoundingClientRect().height > 220) break;
        heroSection = heroSection.parentElement;
        levels++;
      }
      if (!heroSection) heroSection = heroEl.parentElement;

      var filt = SCENARIO_FILTERS[key] || 'none';
      var imgs = heroSection.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.width > 0 && img.width < 80) continue;
        img.style.transition = 'filter 0.5s ease';
        img.style.filter = filt;
      }
      var bgImgs = document.querySelectorAll('[data-mc-slot-src]');
      for (var b = 0; b < bgImgs.length; b++) {
        bgImgs[b].style.transition = 'filter 0.5s ease';
        bgImgs[b].style.filter = filt;
      }

      var tint = SCENARIO_TINTS[key] || 'transparent';
      var overlay = document.getElementById('mc-hero-tint-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mc-hero-tint-overlay';
        overlay.style.cssText = [
          'position:absolute', 'inset:0', 'pointer-events:none', 'z-index:2',
          'transition:background-color 0.5s ease', 'border-radius:inherit',
          'mix-blend-mode:multiply',
        ].join(';') + ';';
        var pos = window.getComputedStyle(heroSection).position;
        if (pos === 'static') heroSection.style.position = 'relative';
        heroSection.appendChild(overlay);
      }
      overlay.style.backgroundColor = tint;
    } catch(e) { /* never break the demo over visual effects */ }
  }

  function flashEl(el) {
    el.classList.remove('mc-slot-changed');
    void el.offsetWidth;
    el.classList.add('mc-slot-changed');
  }

  function setStatus(html) {
    if (statusEl) statusEl.innerHTML = html;
  }

  // ── Auto-fire awareness scenario after page settles ─────────────────────────
  setTimeout(function() {
    if (buttons && buttons.length > 0) {
      autoFired = true;
      applyScenario(buttons[0].getAttribute('data-key'));
    }
  }, 600);

})();
</script>
`;
}

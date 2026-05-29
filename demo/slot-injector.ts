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
   * Pre-computed slot values keyed by blueprint scenario key.
   * Shape: { awareness: { "hero-title": "...", ... }, consideration: {...}, ... }
   *
   * When present these are applied immediately on scenario click (synchronous,
   * no network required), giving an instant visual before the decide API
   * responds (or as a complete fallback when the API is unconfigured).
   */
  scenarioSlots?: Record<string, Record<string, string>>;
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

  // ── 1. Tag key elements ───────────────────────────────────────────────────
  out = tagHeroTitle(out);
  out = tagHeroSubtitle(out);
  out = tagHeroCta(out);
  out = tagProofTitle(out);
  out = tagCtaTitle(out);

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

// ── Slot taggers ──────────────────────────────────────────────────────────────

/**
 * Tag the first prominent heading (h1, then h2 fallback) as hero-title.
 * Many CMS sub-pages use h2 as the page title with h1 reserved for the
 * site logo / brand name.  We skip h1 tags that look like site-name headings
 * (very short text ≤ 30 chars or containing a logo img) and fall back to h2.
 */
function tagHeroTitle(html: string): string {
  // First try: h1 that looks like a page title (not a brand/logo wrapper)
  let tagged = false;
  const out = html.replace(
    /(<h1\b)([^>]*>)([\s\S]*?)<\/h1>/gi,
    (full, tag, rest, content) => {
      if (tagged) return full;
      if (rest.includes("data-mc-slot")) return full;
      const text = content.replace(/<[^>]+>/g, "").trim();
      // Skip if it looks like a brand name (very short, or contains an img)
      if (text.length < 3 || /<img\b/i.test(content)) return full;
      tagged = true;
      return `${tag} data-mc-slot="hero-title"${rest}${content}</h1>`;
    },
  );

  if (tagged) return out;

  // Fallback: first h2 (common on sub-pages where h1 = site name)
  let h2Tagged = false;
  return html.replace(
    /(<h2\b)([^>]*>)/gi,
    (m, tag, rest) => {
      if (h2Tagged) return m;
      if (rest.includes("data-mc-slot")) return m;
      h2Tagged = true;
      return `${tag} data-mc-slot="hero-title"${rest}`;
    },
  );
}

/**
 * Tag the first <p> within 3 000 characters after the hero heading
 * (h1 if present, otherwise the first h2) that contains ≥ 20 characters.
 */
function tagHeroSubtitle(html: string): string {
  const h1Match = html.match(/<h1\b[^>]*>/i) ?? html.match(/<h2\b[^>]*>/i);
  if (!h1Match) return html;

  const h1End = (h1Match.index ?? 0) + h1Match[0].length;
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
 * Tag the first <a> or <button> after the <h1> that looks like a primary CTA.
 *
 * Matches English and Dutch action words, plus common short-label patterns.
 * Window is 3 000 characters — wide enough for sites with a large hero block.
 */
function tagHeroCta(html: string): string {
  const h1Match = html.match(/<h1\b[^>]*>/i) ?? html.match(/<h2\b[^>]*>/i);
  if (!h1Match) return html;

  const h1End  = (h1Match.index ?? 0) + h1Match[0].length;
  const window = html.slice(h1End, h1End + 3000);

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
  return html.slice(0, h1End) + patched + html.slice(h1End + 3000);
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

// ── Injection builder ─────────────────────────────────────────────────────────

function buildInjection({ siteKey, decideBase, siteName, faviconUrl, scenarioSlots }: InjectOptions): string {
  const decideUrl      = `${decideBase}/api/snippet/decide`;

  // ── Scenario buttons — generated as STATIC HTML (server-side TypeScript) ────
  //
  // Previously the buttons were created dynamically by the injected JS, which
  // meant any script parse error or DOM timing issue would silently leave the
  // panel empty.  By building the button markup here in TypeScript we guarantee
  // the buttons are ALWAYS present in the HTML regardless of JS execution.
  // The injected JS only needs to attach click listeners to existing elements.
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
  // Escape the site name for safe embedding in HTML attribute/text context
  const safeHtmlText = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const siteNameHtml = safeHtmlText(siteName ?? "");

  // ── Values that go inside the <script> tag ───────────────────────────────────
  // safeJson escapes `</` → `<\/` so `</script>` inside JSON never terminates
  // the script tag early.
  const scenarioSlotsJs = safeJson(scenarioSlots ?? {});
  const siteKeyJs       = safeJson(siteKey);
  const decideUrlJs     = safeJson(decideUrl);

  // Scenario keys needed by the click handler — derived from the same constant.
  const scenarioKeysJs  = safeJson(BLUEPRINT_SCENARIOS.map((s) => s.key));
  // labelEn per key for the status message
  const scenarioLabelsJs = safeJson(
    Object.fromEntries(BLUEPRINT_SCENARIOS.map((s) => [s.key, s.labelEn])),
  );

  return `
<!-- ── Mister Chameleon Mirror Demo ──────────────────────────────────────────
     Injected by the Mister Chameleon Demo Importer.
     This block is only present in demo previews, never in production.
──────────────────────────────────────────────────────────────────────────── -->
<style id="mc-mirror-styles">
  /* ── Debug slot outlines ────────────────────────────────────────────── */
  [data-mc-slot], [data-mc-slot-href] {
    outline: 1.5px dashed rgba(99,102,241,.4) !important;
    outline-offset: 3px !important;
    border-radius: 3px !important;
    position: relative !important;
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
    transform: translateY(-50%) translateX(222px);
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

  .mc-panel-body { padding: 8px 0 4px; max-height: calc(100vh - 200px); overflow-y: auto; }
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

  .mc-panel-footer {
    padding: 6px 14px 10px;
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
  /* Prospects may have broad resets (button{display:none} etc.) that clash.  */
  /* Using #mc-scenario-panel as the root specificity anchor ensures our CSS  */
  /* wins even against !important resets, because ID selectors are stronger.  */
  #mc-scenario-panel,
  #mc-scenario-panel * {
    box-sizing: border-box !important;
  }
  #mc-scenario-panel .mc-scenario-btn {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }
  #mc-scenario-panel .mc-panel-body {
    display: block !important;
    visibility: visible !important;
    overflow-y: auto !important;
  }
  #mc-scenarios-list {
    display: block !important;
  }
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
  <div class="mc-panel-footer">
    Powered by <a href="https://misterchameleon.com" target="_blank">Mister Chameleon</a>
  </div>
</div>

<script>
// ── Mister Chameleon scenario panel — click handler wiring ─────────────────
// Buttons are pre-rendered as static HTML above (not created by this script).
// This script only attaches click listeners and handles slot application.
// If this script fails entirely, the buttons are still visible and labelled.
(function() {
  var SITE_KEY       = ${siteKeyJs};
  var DECIDE_URL     = ${decideUrlJs};
  var SCENARIO_SLOTS = ${scenarioSlotsJs};
  var SCENARIO_KEYS  = ${scenarioKeysJs};
  var SCENARIO_LABELS = ${scenarioLabelsJs};
  var TIMEOUT_MS     = 4000;

  var panel       = document.getElementById('mc-scenario-panel');
  var statusEl    = document.getElementById('mc-panel-status');
  var listEl      = document.getElementById('mc-scenarios-list');
  var toggleEl    = document.getElementById('mc-panel-toggle');
  var collapseBtn = document.getElementById('mc-collapse-btn');
  var collapsed   = false;
  var activeKey   = null;

  // ── Collapse toggle ─────────────────────────────────────────────────────────
  if (toggleEl && panel) {
    toggleEl.addEventListener('click', function() {
      collapsed = !collapsed;
      panel.classList.toggle('mc-collapsed', collapsed);
      if (collapseBtn) collapseBtn.textContent = collapsed ? '▶' : '◀';
    });
  }

  // ── Wire click handlers onto the pre-rendered buttons ───────────────────────
  // querySelectorAll returns an empty NodeList (never throws) if listEl is null.
  var buttons = listEl
    ? listEl.querySelectorAll('.mc-scenario-btn')
    : document.querySelectorAll('#mc-scenarios-list .mc-scenario-btn');

  for (var i = 0; i < buttons.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        applyScenario(btn.getAttribute('data-key'));
      });
    })(buttons[i]);
  }

  // ── Slot application ────────────────────────────────────────────────────────

  function applyScenario(key) {
    if (!key || activeKey === key) return;
    activeKey = key;

    // Highlight active button
    for (var j = 0; j < buttons.length; j++) {
      var b = buttons[j];
      if (b.getAttribute('data-key') === key) {
        b.classList.add('mc-active');
      } else {
        b.classList.remove('mc-active');
      }
    }

    // 1. Apply pre-computed local slots instantly (no network)
    var localSlots = (SCENARIO_SLOTS && SCENARIO_SLOTS[key]) ? SCENARIO_SLOTS[key] : {};
    var localCount = applySlots(localSlots);
    var labelEn    = (SCENARIO_LABELS && SCENARIO_LABELS[key]) ? SCENARIO_LABELS[key] : key;

    if (localCount > 0) {
      setStatus('<span class="mc-status-ok">&#10003;</span> ' + localCount + ' slot' +
        (localCount === 1 ? '' : 's') + ' personalised for <strong>' + labelEn + '</strong>');
    } else {
      setStatus('<span class="mc-status-spin">&#8987;</span> Loading personalisation…');
    }

    // 2. Call decide API for CMS-driven enhancement (best effort)
    try {
      var controller = new AbortController();
      var tid = setTimeout(function() { controller.abort(); }, TIMEOUT_MS);
      fetch(DECIDE_URL, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteKey: SITE_KEY, context: {
          path: window.location.pathname, _demoScenario: key, _demoMode: 'mirror'
        }}),
      }).then(function(res) {
        clearTimeout(tid);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function(data) {
        if (data && data.slots && Object.keys(data.slots).length > 0) {
          var n = applySlots(data.slots);
          if (n > 0) setStatus('<span class="mc-status-ok">&#10003;</span> ' + n + ' slot' +
            (n === 1 ? '' : 's') + ' personalised for <strong>' + labelEn + '</strong>');
        }
      }).catch(function(err) {
        clearTimeout(tid);
        if (localCount === 0) {
          setStatus('<span class="mc-status-err">&#10007;</span> ' +
            (err.name === 'AbortError' ? 'Timed out' : err.message));
        }
      });
    } catch(e) { /* fetch not available or blocked — local slots still applied */ }
  }

  function applySlots(slots) {
    var count = 0;
    if (!slots) return count;
    var keys = Object.keys(slots);
    for (var k = 0; k < keys.length; k++) {
      var slotKey = keys[k];
      var value   = slots[slotKey];
      if (value == null) continue;
      var elems = document.querySelectorAll('[data-mc-slot="' + slotKey + '"]');
      for (var e = 0; e < elems.length; e++) {
        var el = elems[e];
        if (el.getAttribute('data-mc-html') === 'true') { el.innerHTML = value; }
        else { el.textContent = value; }
        flashEl(el);
        count++;
      }
      var hElems = document.querySelectorAll('[data-mc-slot-href="' + slotKey + '"]');
      for (var h = 0; h < hElems.length; h++) {
        hElems[h].setAttribute('href', value);
        count++;
      }
    }
    return count;
  }

  function flashEl(el) {
    el.classList.remove('mc-slot-changed');
    void el.offsetWidth;
    el.classList.add('mc-slot-changed');
  }

  function setStatus(html) {
    if (statusEl) statusEl.innerHTML = html;
  }

  // ── Auto-fire first scenario after page settles ─────────────────────────────
  setTimeout(function() {
    if (buttons && buttons.length > 0) {
      applyScenario(buttons[0].getAttribute('data-key'));
    }
  }, 600);

})();
</script>
`;
}

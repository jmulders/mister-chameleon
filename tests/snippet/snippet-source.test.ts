/**
 * Snippet source — the JS that runs on customers' own websites.
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   Deze snippet wordt letterlijk uitgevoerd in de browser van bezoekers op sites
 *   van klanten. Een syntaxfout of een verkeerde swap breekt daar een pagina die
 *   niet van ons is. Daarom draaien we de gegenereerde code hier echt uit tegen
 *   een nep-DOM met een gemockte fetch, en controleren we alle drie de wegen:
 *   content-swap, selector-swap (voor CMSes zonder data-attributen), en block-mode
 *   met design tokens. Zie docs/design/snippet-*.md.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { buildSnippetSource } from "@/lib/snippet/snippet-source";

// ── Minimale nep-DOM ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeEl(attrs: Record<string, string> = {}): any {
  const el = {
    _attrs: { ...attrs } as Record<string, string>,
    textContent: "",
    innerHTML:   "",
    style: {
      _props: {} as Record<string, string>,
      opacity: "",
      setProperty(k: string, v: string) { this._props[k] = v; },
    },
    getAttribute(k: string) { return k in el._attrs ? el._attrs[k] : null; },
    setAttribute(k: string, v: string) { el._attrs[k] = v; },
  };
  return el;
}

const flush = () => new Promise((r) => setTimeout(r, 5));

async function run(payload: unknown) {
  const scriptEl = fakeEl({ "data-site-key": "sk_test_123" });
  const heroTitle = fakeEl({ "data-mc-slot": "hero-title" });
  const ctaBySel  = fakeEl();                       // no data-mc-slot — reached via selector
  const block     = fakeEl({ "data-mc-block": "hero-block" });
  const docEl     = fakeEl();

  const registry: Record<string, unknown[]> = {
    'script[data-site-key]':            [scriptEl],
    '[data-mc-slot="hero-title"]':      [heroTitle],
    '[data-mc-slot="cta"]':             [],
    '.custom-cta':                      [ctaBySel],
    '[data-mc-block="hero-block"]':     [block],
  };

  const document = {
    documentElement: docEl,
    cookie:   "",
    referrer: "",
    querySelector: () => null,                       // meta[name=keywords] → none
    querySelectorAll: (sel: string) => registry[sel] ?? [],
  };
  const window = { location: { pathname: "/", search: "" }, crypto: { randomUUID: () => "id-1" } };

  let decideBody: unknown = null;
  const fetchMock = (_url: string, opts: { body: string }) => {
    decideBody = JSON.parse(opts.body);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  };

  const source = buildSnippetSource("https://app.example.com/api/snippet/decide");
  // Run the IIFE with mocked globals in scope (params shadow the real globals).
  const fn = new Function("window", "document", "fetch", "setTimeout", "clearTimeout", source);
  fn(window, document, fetchMock, () => 0, () => {});
  await flush();

  return { heroTitle, ctaBySel, block, docEl, decideBody };
}

describe("snippet-source — generated JS", () => {
  it("is syntactically valid JavaScript", () => {
    const source = buildSnippetSource("https://x/decide");
    // Construction compiles the body; a syntax error would throw here.
    assert.doesNotThrow(() => new Function(source));
  });

  it("posts the site key and context to the decide endpoint", async () => {
    const { decideBody } = await run({ slots: {} });
    assert.equal((decideBody as { siteKey: string }).siteKey, "sk_test_123");
    assert.ok((decideBody as { context: unknown }).context);
  });
});

describe("snippet-source — content mode (backward compatible)", () => {
  it("swaps textContent on a data-mc-slot element", async () => {
    const { heroTitle } = await run({ slots: { "hero-title": "New headline" } });
    assert.equal(heroTitle.textContent, "New headline");
  });
});

describe("snippet-source — selector-based slots (D2)", () => {
  it("swaps textContent on a CSS-selector match (no data-mc-slot needed)", async () => {
    const { ctaBySel } = await run({
      slots:     { "cta": "Click me" },
      selectors: { "cta": ".custom-cta" },
    });
    assert.equal(ctaBySel.textContent, "Click me");
  });

  it("ignores an invalid selector without throwing", async () => {
    // A broken selector must not break the page.
    const { heroTitle } = await run({
      slots:     { "hero-title": "Still works", "cta": "x" },
      selectors: { "cta": ")))not a selector(((" },
    });
    assert.equal(heroTitle.textContent, "Still works");
  });
});

describe("snippet-source — block mode + tokens (D3)", () => {
  it("injects HTML and applies design tokens as CSS custom properties", async () => {
    const { block } = await run({
      slots: {
        "hero-block": {
          mode:   "block",
          html:   "<b>Personalised hero</b>",
          tokens: { "--mc-color-primary": "#0B5", "--mc-font-heading": "Inter" },
        },
      },
    });
    assert.equal(block.innerHTML, "<b>Personalised hero</b>");
    assert.equal(block.style._props["--mc-color-primary"], "#0B5");
    assert.equal(block.style._props["--mc-font-heading"], "Inter");
  });

  it("a string value never triggers block mode", async () => {
    const { heroTitle } = await run({ slots: { "hero-title": "just text" } });
    assert.equal(heroTitle.textContent, "just text");
    assert.equal(heroTitle.innerHTML, ""); // untouched
  });
});

/**
 * Mister Chameleon Snippet Source
 *
 * Returns the JavaScript source code for the async personalisation snippet.
 * This source is served verbatim by `/api/snippet.js/route.ts`.
 *
 * ─── What the snippet does ───────────────────────────────────────────────────
 *
 *   1. Reads the site key from its own `<script data-site-key="...">` attribute.
 *   2. Hides the page (opacity: 0) to prevent a flash of original content (FOOC).
 *   3. Collects lightweight visitor signals (referrer, UTM params, session cookie).
 *   4. POSTs to `/api/snippet/decide` with the site key + visitor context.
 *   5. The server runs the lightweight decision pipeline and returns a content map:
 *      `{ "hero-title": "New headline", "hero-subtitle": "New sub", ... }`.
 *   6. For each returned slot, the snippet finds all elements marked
 *      `data-mc-slot="<key>"` and swaps their text/innerHTML.
 *   7. Reveals the page (opacity: 1) — with or without successful personalisation.
 *
 * ─── Markup convention ───────────────────────────────────────────────────────
 *
 *   Operators mark elements that the engine may personalise:
 *
 *     <h1 data-mc-slot="hero-title">Default headline</h1>
 *     <p  data-mc-slot="hero-subtitle">Default subtitle</p>
 *     <a  data-mc-slot="hero-cta-label" href="/signup">Sign up</a>
 *
 *   Any element may carry a `data-mc-slot` attribute.  The snippet swaps the
 *   element's `textContent` by default.  For elements where HTML is needed
 *   (e.g. rich text, links), add `data-mc-html="true"` and the snippet uses
 *   `innerHTML` instead.
 *
 *   Additionally, `<a>` elements with `data-mc-slot-href="<slot-key>"` have
 *   their `href` attribute swapped when the content map includes that key.
 *
 * ─── Two response shapes per slot (render modes) ─────────────────────────────
 *
 *   A slot value is either a STRING (content mode — the swap above) or an OBJECT
 *   { mode: "block", html, tokens } (block mode). In block mode the snippet finds
 *   `data-mc-block="<key>"` containers, replaces their innerHTML with `html`, and
 *   applies `tokens` as scoped CSS custom properties on the container so the block
 *   adopts the tenant's design tokens without importing a clashing stylesheet.
 *   Strings keep the original, fully backward-compatible behaviour.
 *   See docs/design/snippet-render-modes.md.
 *
 * ─── Selector-based slots (for CMSes where markup can't be edited) ────────────
 *
 *   The response may include a `selectors` map { "<key>": "<css-selector>" }. For
 *   each such key the snippet also swaps the textContent of every element matching
 *   the selector — so a slot works without a data-mc-slot attribute (e.g. inside a
 *   WordPress page builder). Selectors come from the tenant's config, never from
 *   visitor input. See docs/design/snippet-wordpress-plugin.md.
 *
 * ─── Timeout & fail-safe ─────────────────────────────────────────────────────
 *
 *   If the decide endpoint does not respond within 1500 ms, the snippet
 *   reveals the page with the original CMS content — no user-visible delay.
 *
 * ─── Session identity ────────────────────────────────────────────────────────
 *
 *   The snippet reads the `mc_sid` first-party cookie (written by the
 *   server-side session resolver) and includes it in the decide request
 *   so that personalisation is consistent with server-rendered pages.
 *
 * ─── CORS ─────────────────────────────────────────────────────────────────────
 *
 *   The decide endpoint responds with `Access-Control-Allow-Origin: *` so the
 *   snippet works from any domain the tenant's site is hosted on.
 */

/**
 * Returns the minified-ish JavaScript source for the snippet.
 *
 * @param decideUrl  Full URL to the decide endpoint, e.g.
 *                   `https://app.misterchameleon.com/api/snippet/decide`
 *                   Used to allow cross-origin deploys (operator's site ≠ MC platform).
 *
 * The siteKey is NOT baked in here — operators insert it as a data attribute:
 *   `<script src="https://app.misterchameleon.com/api/snippet.js"
 *           data-site-key="sk_live_abc123" async></script>`
 */
export function buildSnippetSource(decideUrl: string): string {
  return `
(function() {
  'use strict';

  // ── 1. Read site key from own script tag ─────────────────────────────────────
  var scripts = document.querySelectorAll('script[data-site-key]');
  var siteKey = null;
  for (var i = 0; i < scripts.length; i++) {
    siteKey = scripts[i].getAttribute('data-site-key');
    if (siteKey) break;
  }
  if (!siteKey) return; // no site key — bail silently

  // ── 2. FOOC prevention — hide page until swap is done ────────────────────────
  var TIMEOUT_MS = 1500;
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    document.documentElement.style.opacity = '';
  }
  document.documentElement.style.opacity = '0';
  var timer = setTimeout(reveal, TIMEOUT_MS);

  // ── 3. Collect visitor signals ───────────────────────────────────────────────
  function getCookie(name) {
    var match = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return match ? decodeURIComponent(match[1]) : null;
  }
  function getParam(key) {
    try {
      return new URLSearchParams(window.location.search).get(key) || undefined;
    } catch(e) { return undefined; }
  }

  var context = {
    path:     window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source:   getParam('utm_source'),
    utm_medium:   getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    sessionId:    getCookie('mc_sid') || undefined,
    locale:       getCookie('mc_locale') || undefined,
  };
  // Strip undefined keys
  Object.keys(context).forEach(function(k) {
    if (context[k] === undefined) delete context[k];
  });

  // ── 3b. Interest keywords from the page <head> (CMS-authored SEO keywords) ────
  // Sent to the decide endpoint so interest-profile scoring can build a keyword
  // cloud for this visitor. Merged server-side with the built-in URL keyword map.
  try {
    var kwEl  = document.querySelector('meta[name="keywords"]');
    var kwStr = kwEl ? (kwEl.getAttribute('content') || '') : '';
    var kws   = kwStr.split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean);
    if (kws.length) context.keywords = kws;
  } catch(e) {}

  // Stable per-pageview id so repeated decide calls don't double-record.
  try {
    context.eventId = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : ('mc_' + Date.now() + '_' + Math.random().toString(36).slice(2));
  } catch(e) {}

  // Collect the whole-block containers present on the page (data-mc-block="…"),
  // so the endpoint renders each requested variant as a self-contained block
  // instead of the per-element content slots.
  var blockKeys = [];
  try {
    var blockEls = document.querySelectorAll('[data-mc-block]');
    var seenBlock = {};
    for (var b = 0; b < blockEls.length; b++) {
      var bk = blockEls[b].getAttribute('data-mc-block');
      if (bk && !seenBlock[bk]) { seenBlock[bk] = 1; blockKeys.push(bk); }
    }
  } catch(e) {}

  // ── 4. Call decide endpoint ──────────────────────────────────────────────────
  fetch(${JSON.stringify(decideUrl)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteKey: siteKey, context: context, blocks: blockKeys }),
  })
  .then(function(res) {
    if (!res.ok) return null;
    return res.json();
  })
  .then(function(data) {
    // ── 5 & 6. Apply the response ────────────────────────────────────────────────
    if (!data || !data.slots) return;
    var slots     = data.slots;
    var selectors = data.selectors || {};

    // Content mode: swap text / innerHTML / href on marked (or selector-matched)
    // elements. The value is a string.
    function applyContent(slotKey, value) {
      var elems = document.querySelectorAll('[data-mc-slot="' + slotKey + '"]');
      for (var j = 0; j < elems.length; j++) {
        var el = elems[j];
        if (el.getAttribute('data-mc-html') === 'true') {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
      }

      // Selector-based swap (tenant config) — textContent only, for safety.
      var sel = selectors[slotKey];
      if (sel) {
        try {
          var selElems = document.querySelectorAll(sel);
          for (var s = 0; s < selElems.length; s++) {
            selElems[s].textContent = value;
          }
        } catch (e) { /* invalid selector — skip */ }
      }

      // href swap
      var hrefElems = document.querySelectorAll('[data-mc-slot-href="' + slotKey + '"]');
      for (var k = 0; k < hrefElems.length; k++) {
        hrefElems[k].setAttribute('href', value);
      }
    }

    // Block mode: replace a container's innerHTML and apply design tokens as
    // scoped CSS custom properties so the block adopts the tenant's house style.
    function applyBlock(slotKey, block) {
      var containers = document.querySelectorAll('[data-mc-block="' + slotKey + '"]');
      for (var b = 0; b < containers.length; b++) {
        var c = containers[b];
        if (block.tokens) {
          for (var tokenName in block.tokens) {
            if (Object.prototype.hasOwnProperty.call(block.tokens, tokenName)) {
              try { c.style.setProperty(tokenName, String(block.tokens[tokenName])); }
              catch (e) { /* ignore a bad token */ }
            }
          }
        }
        if (typeof block.html === 'string') {
          c.innerHTML = block.html;
        }
      }
    }

    Object.keys(slots).forEach(function(slotKey) {
      var value = slots[slotKey];
      if (value == null) return;
      if (typeof value === 'object' && value.mode === 'block') {
        applyBlock(slotKey, value);
      } else {
        applyContent(slotKey, value);
      }
    });
  })
  .catch(function() {
    // Silent fail — reveal page with original content
  })
  .finally(function() {
    clearTimeout(timer);
    reveal();
  });
})();
`.trim();
}

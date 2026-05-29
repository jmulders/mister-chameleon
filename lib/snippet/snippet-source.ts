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

  // ── 4. Call decide endpoint ──────────────────────────────────────────────────
  fetch(${JSON.stringify(decideUrl)}, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteKey: siteKey, context: context }),
  })
  .then(function(res) {
    if (!res.ok) return null;
    return res.json();
  })
  .then(function(data) {
    // ── 5 & 6. Swap content ─────────────────────────────────────────────────────
    if (data && data.slots) {
      var slots = data.slots;
      Object.keys(slots).forEach(function(slotKey) {
        var value = slots[slotKey];
        if (value == null) return;

        // Text / innerHTML swap
        var elems = document.querySelectorAll('[data-mc-slot="' + slotKey + '"]');
        for (var j = 0; j < elems.length; j++) {
          var el = elems[j];
          if (el.getAttribute('data-mc-html') === 'true') {
            el.innerHTML = value;
          } else {
            el.textContent = value;
          }
        }

        // href swap
        var hrefElems = document.querySelectorAll('[data-mc-slot-href="' + slotKey + '"]');
        for (var k = 0; k < hrefElems.length; k++) {
          hrefElems[k].setAttribute('href', value);
        }
      });
    }
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

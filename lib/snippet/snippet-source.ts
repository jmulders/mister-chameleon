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
 *   If the decision has not arrived within 700 ms the snippet reveals the page
 *   with the original CMS content, and a later decision is dropped so there is
 *   never a jump. The request itself is aborted after 1500 ms as a hard cap.
 *
 * ─── Session identity ────────────────────────────────────────────────────────
 *
 *   The snippet mints a stable first-party visitor id (localStorage `mc_vid`,
 *   with a 1-year first-party cookie fallback) and sends it as sessionId +
 *   visitorId on every pageview. This is what lets the platform key a visitor's
 *   behavioural history to one id and build context across the visit — without
 *   it every pageview looked like a new visitor and only the default variant
 *   was ever served. On same-origin platform pages an existing `mc_sid` cookie
 *   is preferred so identity stays consistent with server-rendered pages. The id
 *   lives entirely inside the snippet, which the WordPress plugin only loads
 *   after consent (mcc_should_enqueue), so it is consent-gated by design.
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
  // Platform origin (e.g. https://app.misterchameleon.com) derived from the
  // decide URL, so injected form blocks can submit cross-origin to /api/forms.
  const platformOrigin = decideUrl.replace(/\/api\/snippet\/decide.*$/, "");
  return `
(function() {
  'use strict';

  // ── 1. Read site key from own script tag ─────────────────────────────────────
  var scripts = document.querySelectorAll('script[data-site-key]');
  var siteKey = null, selfScript = null;
  for (var i = 0; i < scripts.length; i++) {
    siteKey = scripts[i].getAttribute('data-site-key');
    if (siteKey) { selfScript = scripts[i]; break; }
  }
  if (!siteKey) return; // no site key — bail silently

  // ── 1b. Consent ──────────────────────────────────────────────────────────────
  // Personalisation profiling and firmographic enrichment only run WITH consent.
  // Resolution order: explicit publisher signal (data-mc-consent="granted|denied"
  // on the script tag, or window.mcConsent = true/false) → Global Privacy Control
  // / Do-Not-Track force denied → default granted (the host is expected to load
  // the snippet only after its own consent gate; this keeps existing embeds working).
  // Without consent we still serve ads/variants, but geo-only: no id is stored and
  // the server skips behavioural, firmographic and GA4.
  function resolveConsent() {
    try {
      var attr = selfScript ? selfScript.getAttribute('data-mc-consent') : null;
      if (attr === 'denied' || window.mcConsent === false) return false;
      if (attr === 'granted' || window.mcConsent === true) return true;
      if (navigator.globalPrivacyControl === true) return false;
      var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes' || dnt === true) return false;
    } catch(e) {}
    return true;
  }
  var consent = resolveConsent();

  // Platform origin for cross-origin form-block submits.
  var mcFormsBase = ${JSON.stringify(platformOrigin)};
  var mcDecideUrl = ${JSON.stringify(decideUrl)};

  // ── Form blocks: wire submit on an injected <form data-mc-form="key"> ────────
  // The form markup is rendered server-side (with the tenant theme + contextual
  // copy/fields); here we intercept submit, POST cross-origin to the platform
  // with the siteKey, and render success / 422 field errors / thank-you redirect.
  function mcWireForms(root) {
    var forms = (root || document).querySelectorAll('form[data-mc-form]');
    for (var i = 0; i < forms.length; i++) mcWireForm(forms[i]);
  }
  function mcWireForm(form) {
    if (form.getAttribute('data-mc-wired')) return;
    form.setAttribute('data-mc-wired', '1');
    var key = form.getAttribute('data-mc-form');
    var statusEl = form.querySelector('[data-mc-form-status]');
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      var errEls = form.querySelectorAll('[data-mc-error]');
      for (var e = 0; e < errEls.length; e++) { errEls[e].style.display = 'none'; errEls[e].textContent = ''; }
      if (statusEl) { statusEl.style.color = ''; statusEl.textContent = ''; }
      var payload = {};
      var fields = form.querySelectorAll('input[name], textarea[name], select[name]');
      for (var f = 0; f < fields.length; f++) {
        var el = fields[f];
        var name = el.getAttribute('name');
        if (!name) continue;
        payload[name] = (el.type === 'checkbox') ? (el.checked ? 'true' : 'false') : el.value;
      }
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      fetch(mcFormsBase + '/api/forms/' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mc-site-key': siteKey },
        body: JSON.stringify(payload)
      }).then(function(res) {
        return res.json().then(function(d) { return { status: res.status, data: d }; })
                         .catch(function() { return { status: res.status, data: null }; });
      }).then(function(r) {
        if (btn) btn.disabled = false;
        var data = r.data || {};
        if (r.status === 200 && data.ok) {
          var redirect = form.getAttribute('data-mc-redirect');
          if (redirect && redirect.charAt(0) === '/') { window.location.assign(redirect); return; }
          while (form.firstChild) form.removeChild(form.firstChild);
          var ok = document.createElement('div');
          ok.setAttribute('role', 'status');
          ok.style.cssText = 'padding:20px 4px;text-align:center;font-size:15px;line-height:1.5;color:var(--text,#0f172a);';
          ok.textContent = data.message || 'Thank you — your submission has been received.';
          form.appendChild(ok);
        } else if (r.status === 422 && data && data.errors) {
          for (var fk in data.errors) {
            if (!Object.prototype.hasOwnProperty.call(data.errors, fk)) continue;
            var slot = form.querySelector('[data-mc-error="' + fk + '"]');
            if (slot) { slot.textContent = data.errors[fk]; slot.style.display = 'block'; }
          }
          if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = 'Please fix the highlighted fields.'; }
        } else {
          if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = (data && data.error) || 'Something went wrong. Please try again.'; }
        }
      }).catch(function() {
        if (btn) btn.disabled = false;
        if (statusEl) { statusEl.style.color = '#dc2626'; statusEl.textContent = 'Network error. Please try again.'; }
      });
    });
  }

  // Render Cloudflare Turnstile widgets inside a freshly-injected container.
  // The Turnstile API script cannot come from innerHTML (script tags don't run),
  // so load it once with an explicit onload callback and render each widget
  // manually. The rendered widget injects a hidden <input name="cf-turnstile-response">
  // which the submit handler above already collects with the other fields.
  function mcRenderTurnstile(container) {
    var widgets = container.querySelectorAll('.cf-turnstile');
    if (!widgets.length) return;
    function renderAll() {
      if (!window.turnstile || !window.turnstile.render) return;
      for (var i = 0; i < widgets.length; i++) {
        var w = widgets[i];
        if (w.getAttribute('data-mc-rendered')) continue;
        try {
          window.turnstile.render(w, { sitekey: w.getAttribute('data-sitekey') });
          w.setAttribute('data-mc-rendered', '1');
        } catch (e) { /* ignore a bad widget */ }
      }
    }
    if (window.turnstile && window.turnstile.render) { renderAll(); return; }
    window.__mcTsQueue = window.__mcTsQueue || [];
    window.__mcTsQueue.push(renderAll);
    if (!window.__mcTsLoading) {
      window.__mcTsLoading = true;
      window.__mcTsOnload = function () {
        var q = window.__mcTsQueue || [];
        window.__mcTsQueue = [];
        for (var k = 0; k < q.length; k++) { try { q[k](); } catch (e) {} }
      };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__mcTsOnload&render=explicit';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
  }

  // ── 2. FOOC prevention — hide page briefly, then apply when ready ────────────
  // REVEAL_MS: how long the page stays hidden waiting for the decision. When the
  // decision arrives within this window, the swap happens before the reveal so
  // there is no flash. When it arrives LATER (cold serverless start, slow first
  // connection on a low-traffic site), the page is revealed with the default and
  // the personalisation is applied as soon as it lands — a late swap is better
  // than never personalising. CALL_MS is the hard upper bound on the request
  // itself so a genuinely hung endpoint cannot keep the fetch alive forever; it
  // must be generous enough to survive a cold start + slow TLS handshake.
  // Per-embed override via script-tag attributes, e.g.
  //   <script ... data-site-key="…" data-mc-reveal-ms="1200" data-mc-call-ms="6000">
  // Falls back to the defaults; clamped to sane bounds. Lets a slow-backend or
  // low-traffic tenant give the cold-start decide more room without a code change.
  function mcTiming(attr, def, max) {
    var v = selfScript ? parseInt(selfScript.getAttribute(attr) || '', 10) : NaN;
    if (!(v === v) || v < 0) return def; // NaN or negative → default
    return v > max ? max : v;
  }
  var REVEAL_MS = mcTiming('data-mc-reveal-ms', 700, 5000);
  var CALL_MS   = mcTiming('data-mc-call-ms', 4000, 15000);
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    document.documentElement.style.opacity = '';
  }
  document.documentElement.style.opacity = '0';
  var timer = setTimeout(reveal, REVEAL_MS);
  var mcAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var callTimer = mcAbort ? setTimeout(function () { try { mcAbort.abort(); } catch (e) {} }, CALL_MS) : null;

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

  // ── Stable first-party visitor id ────────────────────────────────────────────
  // Without a persistent id every pageview looks like a new visitor to the
  // platform, so behavioural context (returning, interest, journey) never
  // accumulates and only the default variant is ever served. We mint one id and
  // keep it: localStorage first (survives across sessions), a 1-year first-party
  // cookie as fallback when storage is blocked. Same-origin platform sites may
  // already carry an mc_sid cookie — prefer that so identity stays consistent.
  // This id lives entirely inside the snippet, which the WordPress plugin only
  // loads after consent (mcc_should_enqueue), so it is consent-gated by design.
  function newId() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch(e) {}
    return 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  function getOrCreateVisitorId(persist) {
    var existing = getCookie('mc_sid');
    if (existing) return existing;
    // Cookieless mode (no consent): mint an ephemeral, per-pageview id — never
    // stored — so ads still serve/dedupe but no cross-session profile forms.
    if (!persist) return newId();
    try {
      var stored = window.localStorage.getItem('mc_vid');
      if (stored) return stored;
      var fresh = newId();
      window.localStorage.setItem('mc_vid', fresh);
      return fresh;
    } catch(e) {
      var fromCookie = getCookie('mc_vid');
      if (fromCookie) return fromCookie;
      var id = newId();
      try {
        document.cookie = 'mc_vid=' + encodeURIComponent(id) +
          '; max-age=31536000; path=/; SameSite=Lax' +
          (window.location.protocol === 'https:' ? '; Secure' : '');
      } catch(e2) {}
      return id;
    }
  }
  var visitorId = getOrCreateVisitorId(consent);

  var context = {
    path:     window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source:   getParam('utm_source'),
    utm_medium:   getParam('utm_medium'),
    utm_campaign: getParam('utm_campaign'),
    sessionId:    visitorId,
    visitorId:    visitorId,
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

  // ── 4. Apply a decide response (content + block slots) ───────────────────────

  // Content mode: swap text / innerHTML / href on marked (or selector-matched)
  // elements. The value is a string.
  function applyContent(slotKey, value, selectors) {
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
        // Reserve the block's current footprint before swapping so a different
        // variant height cannot collapse it and shift the content below (CLS).
        try { c.style.minHeight = c.offsetHeight + 'px'; } catch (e) {}
        c.innerHTML = block.html;
        // Wire any form injected by this block (submit → cross-origin POST).
        try { mcWireForms(c); } catch (e) { /* forms optional */ }
        // Render any Cloudflare Turnstile widget the form HTML contains. A
        // <script> inside innerHTML never runs, so load the Turnstile API
        // ourselves and render explicitly.
        try { mcRenderTurnstile(c); } catch (e) { /* captcha optional */ }
      }
    }
  }

  function mcApplyResponse(data) {
    if (!data || !data.slots) return;
    var slots     = data.slots;
    var selectors = data.selectors || {};
    Object.keys(slots).forEach(function(slotKey) {
      var value = slots[slotKey];
      if (value == null) return;
      if (typeof value === 'object' && value.mode === 'block') {
        applyBlock(slotKey, value);
      } else {
        applyContent(slotKey, value, selectors);
      }
    });
  }

  // ── 4b. Demo mode — live scenario switcher on the tenant's own site ──────────
  // Enabled with ?mc_demo (=1 for the tenant's default context, or =<scenarioKey>
  // for a specific one). Sends _demoMode=mirror to the decide endpoint, which
  // bypasses the rule engine and returns the chosen context's slots plus the
  // tenant's context list, from which we render a small floating switcher.
  var mcDemoParam = getParam('mc_demo');
  var mcDemo = (mcDemoParam !== undefined && mcDemoParam !== '0' && mcDemoParam !== 'off');
  var mcActiveScenario =
    (mcDemo && mcDemoParam && mcDemoParam !== '1' && mcDemoParam !== 'true' && mcDemoParam !== 'on')
      ? mcDemoParam : null;

  function mcDemoHighlight(active) {
    var btns = document.querySelectorAll('#mc-demo-panel [data-mc-demo-key]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-mc-demo-key') === active;
      btns[i].style.borderColor = on ? '#6366f1' : '#e5e7eb';
      btns[i].style.background   = on ? '#eef2ff' : '#fff';
    }
  }

  function mcBuildDemoPanel(contexts, active) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { mcBuildDemoPanel(contexts, active); });
      return;
    }
    if (document.getElementById('mc-demo-panel')) { mcDemoHighlight(active); return; }
    var panel = document.createElement('div');
    panel.id = 'mc-demo-panel';
    panel.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:236px;' +
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#fff;' +
      'border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px;';
    var h = document.createElement('div');
    h.textContent = 'Demo \\u2014 visitor context';
    h.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;';
    panel.appendChild(h);
    for (var i = 0; i < contexts.length; i++) {
      (function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-mc-demo-key', c.key);
        btn.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;text-align:left;' +
          'padding:8px 9px;margin-bottom:6px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;';
        var ic = document.createElement('span'); ic.textContent = c.icon || '\\u2022'; ic.style.cssText = 'font-size:15px;flex:0 0 auto;';
        var tx = document.createElement('span');
        var l = document.createElement('span'); l.textContent = c.label; l.style.cssText = 'display:block;font-size:12px;font-weight:700;color:#111827;line-height:1.2;';
        var s = document.createElement('span'); s.textContent = c.sub || ''; s.style.cssText = 'display:block;font-size:10px;color:#6b7280;line-height:1.2;';
        tx.appendChild(l); tx.appendChild(s);
        btn.appendChild(ic); btn.appendChild(tx);
        btn.addEventListener('click', function () { mcSelectDemo(c.key); });
        panel.appendChild(btn);
      })(contexts[i]);
    }
    var foot = document.createElement('div');
    foot.textContent = 'Live demo \\u00b7 session-scoped';
    foot.style.cssText = 'font-size:9px;color:#9ca3af;margin-top:2px;';
    panel.appendChild(foot);
    document.body.appendChild(panel);
    mcDemoHighlight(active);
  }

  function mcSelectDemo(key) {
    mcActiveScenario = key;
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('mc_demo', key);
      window.history.replaceState(null, '', u.toString());
    } catch (e) { /* history not available — non-fatal */ }
    mcRunDecide(false);
  }

  // ── 5. Call decide (initial reveal-bound call, and demo re-runs) ─────────────
  function mcRunDecide(isFirst) {
    var ctx = {};
    for (var ck in context) {
      if (Object.prototype.hasOwnProperty.call(context, ck)) ctx[ck] = context[ck];
    }
    if (mcDemo) {
      ctx._demoMode = 'mirror';
      if (mcActiveScenario) ctx._demoScenario = mcActiveScenario;
    }
    var p = fetch(mcDecideUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteKey: siteKey, context: ctx, blocks: blockKeys, consent: consent }),
      signal: (isFirst && mcAbort) ? mcAbort.signal : undefined,
    })
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(data) {
      // Apply whenever the decision arrives. If it came in before REVEAL_MS the
      // swap happens while the page is still hidden (no flash); a later swap is
      // still better than never personalising.
      mcApplyResponse(data);
      if (mcDemo && data && data._demoContexts) {
        if (data._scenario) mcActiveScenario = data._scenario;
        mcBuildDemoPanel(data._demoContexts, mcActiveScenario);
      }
    })
    .catch(function() { /* silent fail — reveal page with original content */ });

    if (isFirst) {
      p.finally(function() {
        clearTimeout(timer);
        if (callTimer) clearTimeout(callTimer);
        reveal();
      });
    }
    return p;
  }

  mcRunDecide(true);
})();
`.trim();
}

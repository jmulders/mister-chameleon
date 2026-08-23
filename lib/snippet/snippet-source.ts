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
import { NOTIF_KEY_PREFIX } from "@/lib/notifications/frequency-cap";

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

  // ── 1b. Consent (host CMP alignment) ─────────────────────────────────────────
  // We forward the visitor's consent as three categories {analytics,
  // personalization, enrichment}, read from the host page in priority order:
  //   1. Publisher signal: data-mc-consent="granted|denied" on the script tag, or
  //      window.mcConsent as a boolean, a {analytics,personalization,enrichment}
  //      object, or a function/Promise returning either (async CMPs).
  //   2. IAB TCF v2 (window.__tcfapi) purpose consents.
  //   3. Google Consent Mode signals pushed to window.dataLayer.
  //   4. Global Privacy Control / Do-Not-Track -> denied.
  // No signal -> null; the server applies the tenant's default (deny for "auto",
  // grant for "always") plus the tenant privacy ceiling. Resolution is bounded by
  // the call budget so it never delays the first decide. Without granted consent we
  // still serve geo-only variants/ads; the server skips behavioural, firmographic
  // and GA4 per category.
  var MC_FULL = { analytics: true,  personalization: true,  enrichment: true,  hasResponded: true };
  var MC_DENY = { analytics: false, personalization: false, enrichment: false, hasResponded: true };
  function mcNormConsent(v) {
    if (v === true) return MC_FULL;
    if (v === false) return MC_DENY;
    if (v && typeof v === 'object') return {
      analytics: !!v.analytics, personalization: !!v.personalization,
      enrichment: !!v.enrichment, hasResponded: true,
    };
    return null;
  }
  function mcGpcDnt() {
    try {
      if (navigator.globalPrivacyControl === true) return true;
      var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (dnt === '1' || dnt === 'yes' || dnt === true) return true;
    } catch(e) {}
    return false;
  }
  function mcReadPublisher(cb) {
    try {
      var attr = selfScript ? selfScript.getAttribute('data-mc-consent') : null;
      if (attr === 'granted') { cb(MC_FULL); return; }
      if (attr === 'denied')  { cb(MC_DENY); return; }
      var w = window.mcConsent;
      if (typeof w === 'function') {
        var r = w();
        if (r && typeof r.then === 'function') { r.then(function(x){ cb(mcNormConsent(x)); }, function(){ cb(null); }); return; }
        cb(mcNormConsent(r)); return;
      }
      if (w !== undefined) { cb(mcNormConsent(w)); return; }
    } catch(e) {}
    cb(null);
  }
  function mcReadTcf(cb) {
    try {
      if (typeof window.__tcfapi !== 'function') { cb(null); return; }
      var settled = false;
      window.__tcfapi('getTCData', 2, function(data, ok) {
        if (settled) return; settled = true;
        if (!ok || !data) { cb(null); return; }
        if (data.gdprApplies === false) { cb(MC_FULL); return; }
        var p = (data.purpose && data.purpose.consents) || {};
        // Purpose -> category mapping (platform default; see the consent design doc):
        //   7/8/9/10 measurement -> analytics; 3/4/5/6 personalisation ->
        //   personalization; 1/2 storage + basic ads -> enrichment.
        cb({
          analytics:       !!(p[7] || p[8] || p[9] || p[10]),
          personalization: !!(p[3] || p[4] || p[5] || p[6]),
          enrichment:      !!(p[1] || p[2]),
          hasResponded:    true,
        });
      });
    } catch(e) { cb(null); }
  }
  function mcReadGcm() {
    try {
      var dl = window.dataLayer;
      if (!dl || !dl.length) return null;
      var state = null;
      for (var i = 0; i < dl.length; i++) {
        var e = dl[i];
        // gtag('consent','default'|'update',{...}) is pushed arguments-like: [0,1,2].
        if (e && e[0] === 'consent' && e[2] && typeof e[2] === 'object') {
          state = state || {};
          for (var k in e[2]) state[k] = e[2][k];
        }
      }
      if (!state) return null;
      var g = function(x) { return x === 'granted'; };
      // Consent Mode -> category: analytics_storage -> analytics; ad_personalization
      // -> personalization; ad_storage/ad_user_data -> enrichment.
      return {
        analytics:       g(state.analytics_storage),
        personalization: g(state.ad_personalization),
        enrichment:      g(state.ad_storage) || g(state.ad_user_data),
        hasResponded:    true,
      };
    } catch(e) { return null; }
  }
  function mcResolveConsent(cb) {
    var done = false;
    function finish(c) { if (done) return; done = true; cb(c); }
    // Never delay the first decide beyond the call budget.
    var cap = 1500; try { cap = Math.min(CALL_MS || 1500, 1500); } catch(e) {}
    setTimeout(function() { finish(mcGpcDnt() ? MC_DENY : null); }, cap);
    mcReadPublisher(function(pub) {
      if (pub) { finish(pub); return; }
      mcReadTcf(function(tcf) {
        if (tcf) { finish(tcf); return; }
        var gcm = mcReadGcm();
        if (gcm) { finish(gcm); return; }
        finish(mcGpcDnt() ? MC_DENY : null);
      });
    });
  }
  var consent = null; // resolved asynchronously before the first decide

  // Platform origin for cross-origin form-block submits.
  var mcFormsBase = ${JSON.stringify(platformOrigin)};
  var mcDecideUrl = ${JSON.stringify(decideUrl)};

  // ── Video facades: privacy-first click-to-load for CTA media blocks ──────────
  // A CTA media variant injects a <button data-mc-video-facade data-mc-embed-src
  // data-mc-allow> that shows ONLY the poster. No YouTube/Vimeo iframe or request
  // fires until the visitor clicks — mirroring the platform BlockMediaView facade.
  // On click we swap the facade for the embed iframe (the src is already the
  // nocookie / dnt privacy URL built server-side).
  function mcWireVideoFacades(root) {
    var facades = (root || document).querySelectorAll('[data-mc-video-facade]');
    for (var i = 0; i < facades.length; i++) {
      (function (btn) {
        if (btn.getAttribute('data-mc-wired')) return;
        btn.setAttribute('data-mc-wired', '1');
        btn.addEventListener('click', function () {
          var src = btn.getAttribute('data-mc-embed-src');
          // Only ever load a plain https embed URL (built by our own helpers).
          if (!src || !/^https:\\/\\//i.test(src)) return;
          var iframe = document.createElement('iframe');
          iframe.setAttribute('src', src);
          iframe.setAttribute('title', 'Video');
          iframe.setAttribute('allow', btn.getAttribute('data-mc-allow') || '');
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('loading', 'lazy');
          iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
          var parent = btn.parentNode;
          if (parent) { parent.replaceChild(iframe, btn); }
        });
      })(facades[i]);
    }
  }

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

  // ── Visitor id, split on the anonymity boundary ──────────────────────────────
  // The anonymous decision runs with an EPHEMERAL, per-pageview id that is never
  // stored and reads no persistent identifier. A persistent, cross-session id
  // (localStorage mc_vid, or a 1-year first-party cookie fallback, or a same-origin
  // platform mc_sid) is only read/written once personalization consent is
  // granted (see the resolve step below), so no persistent id exists without it.
  function newId() {
    try {
      if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    } catch(e) {}
    return 'mc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  function getOrCreateVisitorId(persist) {
    // Anonymous: ephemeral per-pageview id — never stored, reads nothing persistent.
    if (!persist) return newId();
    // Persistent (personalization consent granted): reuse a same-origin platform
    // session cookie if present, else localStorage, else a 1-year cookie fallback.
    var existing = getCookie('mc_sid');
    if (existing) return existing;
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
  // Start anonymous: ephemeral id for the first (anonymous) decision. Upgraded to
  // the persistent id in the consent-resolve callback when personalization is granted.
  var visitorId = getOrCreateVisitorId(false);

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

  // ── Custom attributes ────────────────────────────────────────────────────────
  // Per-request domain attributes the tenant declares on the page, from two
  // sources merged (window.mcAttributes first, then data-mc-attr-<name> in the
  // DOM which wins). Sanitised here (name charset, count + value-length caps) and
  // again server-side, where only tenant-declared names survive. For content
  // variation only — the server treats these as untrusted.
  try {
    var mcAttrs = {};
    var mcAttrCount = 0;
    var MC_ATTR_MAX = 24;
    function mcAddAttr(rawName, rawValue) {
      if (mcAttrCount >= MC_ATTR_MAX) return;
      if (typeof rawName !== 'string') return;
      var name = rawName.trim().toLowerCase();
      if (!/^[a-z0-9_-]{1,40}$/.test(name)) return;
      var v = rawValue;
      if (typeof v === 'string') { v = v.slice(0, 128); }
      else if (typeof v === 'number' || typeof v === 'boolean') { /* keep */ }
      else if (v == null) { return; }
      else { return; }
      if (!Object.prototype.hasOwnProperty.call(mcAttrs, name)) mcAttrCount++;
      mcAttrs[name] = v;
    }
    // Source 1: window.mcAttributes (a flat object).
    if (window.mcAttributes && typeof window.mcAttributes === 'object') {
      for (var an in window.mcAttributes) {
        if (Object.prototype.hasOwnProperty.call(window.mcAttributes, an)) mcAddAttr(an, window.mcAttributes[an]);
      }
    }
    // Source 2: data-mc-attr-<name>="<value>" anywhere in the DOM (later wins).
    // CSS cannot wildcard an attribute NAME, so scan elements once, stopping
    // early once the cap is reached.
    var allEls = document.getElementsByTagName('*');
    for (var e = 0; e < allEls.length && mcAttrCount < MC_ATTR_MAX; e++) {
      var attrs = allEls[e].attributes;
      if (!attrs) continue;
      for (var a = 0; a < attrs.length; a++) {
        var an2 = attrs[a].name;
        if (an2.indexOf('data-mc-attr-') === 0) {
          mcAddAttr(an2.slice('data-mc-attr-'.length), attrs[a].value);
        }
      }
    }
    if (mcAttrCount > 0) context.customAttributes = mcAttrs;
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
        // Wire any CTA video facade (click-to-load, privacy-first).
        try { mcWireVideoFacades(c); } catch (e) { /* media optional */ }
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
    try { mcApplyNotificationCapping(slots); } catch (e) { /* capping is best-effort */ }
    try { mcApplyNotificationMedia(slots); } catch (e) { /* media is best-effort */ }
  }

  // ── Notification media (image / video facade) ────────────────────────────────
  // The decide response carries the notification image as pre-rendered HTML
  // (notification-media-html, built server-side by ctaMediaInner, same as the
  // block-HTML path). Inject it into the [data-mc-notification] host inside a sized
  // box, placed left (default) or right per notification-media-side, then wire any
  // video facade. Idempotent: re-runs (demo) do not duplicate the media.
  function mcApplyNotificationMedia(slots) {
    var html = slots['notification-media-html'];
    if (!html) return;
    var host = document.querySelector('[data-mc-notification]');
    if (!host) return;
    if (host.querySelector('[data-mc-notification-media]')) return;
    var side = slots['notification-media-side'] === 'right' ? 'right' : 'left';
    var box = document.createElement('div');
    box.setAttribute('data-mc-notification-media', '');
    box.style.cssText =
      'flex:0 0 auto;order:' + (side === 'right' ? '1' : '-1') + ';' +
      'position:relative;width:72px;aspect-ratio:16/9;overflow:hidden;border-radius:8px;background:#000;';
    box.innerHTML = html;
    if (side === 'right') host.appendChild(box); else host.insertBefore(box, host.firstChild);
    try { mcWireVideoFacades(box); } catch (e) {}
  }

  // ── Notification frequency capping (same key scheme as the platform block) ────
  // The tenant marks their notification container with data-mc-notification and
  // (optionally) a dismiss control inside it with data-mc-notification-dismiss.
  // On load we hide the container when the notification is still capped; otherwise
  // we wire the dismiss control to record the dismissal (functional storage, no
  // tracking). No host element → no-op. Key: mc_notif_v1:<id>[:<campaign>].
  function mcApplyNotificationCapping(slots) {
    var id = slots['notification-id'];
    if (!id) return;
    var host = document.querySelector('[data-mc-notification]');
    if (!host) return;

    var frequency = slots['notification-frequency'] || 'always';
    var campaign  = slots['notification-campaign'] || '';
    var ttlMs     = parseInt(slots['notification-ttl-ms'] || '0', 10) || 0;
    var key       = ${JSON.stringify(NOTIF_KEY_PREFIX)} + id + (campaign ? ':' + campaign : '');

    // always / once_per_session use sessionStorage; once_per_period uses localStorage.
    function store() { return frequency === 'once_per_period' ? window.localStorage : window.sessionStorage; }
    function suppressed() {
      try {
        var raw = store().getItem(key);
        // "always" is suppressed only after a manual dismissal in this session;
        // with no marker it shows on every pageview, same as before.
        if (frequency === 'always' || frequency === 'once_per_session') return raw !== null;
        if (raw === null) return false;
        var ts = Number(raw);
        return (ts === ts) && (Date.now() - ts) < ttlMs; // ts===ts guards NaN
      } catch (e) { return false; }
    }

    if (suppressed()) { host.style.display = 'none'; return; }

    function doDismiss() {
      // Write a marker for every frequency (including "always") so a manual
      // dismissal suppresses the notification for the rest of the session.
      try { store().setItem(key, String(Date.now())); } catch (e) {}
      host.style.display = 'none';
    }
    var dismissers = host.querySelectorAll('[data-mc-notification-dismiss]');
    for (var i = 0; i < dismissers.length; i++) {
      dismissers[i].addEventListener('click', function (e) { e.preventDefault(); doDismiss(); });
    }
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
  var mcActiveNotif = null;

  function mcHighlight(attr, active) {
    var btns = document.querySelectorAll('#mc-demo-panel [' + attr + ']');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute(attr) === active;
      btns[i].style.borderColor = on ? '#6366f1' : '#e5e7eb';
      btns[i].style.background   = on ? '#eef2ff' : '#fff';
      btns[i].style.color        = on ? '#4338ca' : '#111827';
    }
  }

  function mcSubLabel(text) {
    var el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#9ca3af;margin:2px 0 8px;';
    return el;
  }

  function mcBuildDemoPanel(contexts, active, notifs, activeNotif) {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { mcBuildDemoPanel(contexts, active, notifs, activeNotif); });
      return;
    }
    if (document.getElementById('mc-demo-panel')) {
      mcHighlight('data-mc-demo-key', active);
      mcHighlight('data-mc-demo-notif-key', activeNotif);
      return;
    }
    var panel = document.createElement('div');
    panel.id = 'mc-demo-panel';
    panel.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:236px;' +
      'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#fff;' +
      'border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.18);padding:12px;';
    panel.appendChild(mcSubLabel('Demo \\u2014 visitor context'));
    for (var i = 0; i < contexts.length; i++) {
      (function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-mc-demo-key', c.key);
        btn.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;text-align:left;' +
          'padding:8px 9px;margin-bottom:6px;border-radius:9px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;';
        var ic = document.createElement('span'); ic.textContent = c.icon || '\\u2022'; ic.style.cssText = 'font-size:15px;flex:0 0 auto;';
        var tx = document.createElement('span');
        var l = document.createElement('span'); l.textContent = c.label; l.style.cssText = 'display:block;font-size:12px;font-weight:700;color:inherit;line-height:1.2;';
        var s = document.createElement('span'); s.textContent = c.sub || ''; s.style.cssText = 'display:block;font-size:10px;color:#6b7280;line-height:1.2;';
        tx.appendChild(l); tx.appendChild(s);
        btn.appendChild(ic); btn.appendChild(tx);
        btn.addEventListener('click', function () { mcSelectDemo(c.key); });
        panel.appendChild(btn);
      })(contexts[i]);
    }

    // Optional second axis: a time-driven notification toggle (Open / Closed).
    if (notifs && notifs.length) {
      panel.appendChild(mcSubLabel('Notification'));
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;';
      for (var n = 0; n < notifs.length; n++) {
        (function (nt) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('data-mc-demo-notif-key', nt.key);
          b.title = nt.sub || '';
          b.textContent = nt.label;
          b.style.cssText = 'flex:1;padding:7px 4px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;' +
            'font-size:11px;font-weight:700;color:#111827;cursor:pointer;';
          b.addEventListener('click', function () { mcSelectNotif(nt.key); });
          row.appendChild(b);
        })(notifs[n]);
      }
      panel.appendChild(row);
    }

    var foot = document.createElement('div');
    foot.textContent = 'Live demo \\u00b7 session-scoped';
    foot.style.cssText = 'font-size:9px;color:#9ca3af;margin-top:8px;';
    panel.appendChild(foot);
    document.body.appendChild(panel);
    mcHighlight('data-mc-demo-key', active);
    mcHighlight('data-mc-demo-notif-key', activeNotif);
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

  function mcSelectNotif(key) {
    mcActiveNotif = key;
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
      if (mcActiveNotif) ctx._demoNotif = mcActiveNotif;
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
        if (data._demoNotif) mcActiveNotif = data._demoNotif;
        mcBuildDemoPanel(data._demoContexts, mcActiveScenario, data._demoNotifs, mcActiveNotif);
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

  // Resolve host consent (bounded by the call budget), then run the first decide.
  // Only on granted personalization do we upgrade to (and persist) the stable id;
  // otherwise the decision stays on the ephemeral anonymous id and nothing is stored.
  mcResolveConsent(function(c) {
    consent = c;
    if (c && c.personalization) {
      var persistentId = getOrCreateVisitorId(true);
      visitorId = persistentId;
      context.sessionId = persistentId;
      context.visitorId = persistentId;
    }
    mcRunDecide(true);
  });
})();
`.trim();
}

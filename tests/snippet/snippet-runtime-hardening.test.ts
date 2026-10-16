/**
 * Snippet runtime hardening — runs the generated snippet JS against a fake DOM
 * with a controllable clock, so timing-dependent behaviour can be asserted:
 *
 *   - DOM-ready gate: attributes + block keys are gathered, and the first decide
 *     is sent, only once the document is no longer "loading".
 *   - Double-include guard + document.currentScript preference.
 *   - Block min-height reservation only when the page is visible, then released.
 *   - window.mcConsent as a Promise (thenable) is honoured, not read as DENY.
 *   - A malformed cookie does not stop the snippet.
 *   - The CALL_MS abort timer starts when the first decide is actually sent.
 *   - Forms: Turnstile reset after a failed submit, and the page path in the body.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { buildSnippetSource } from "@/lib/snippet/snippet-source";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SOURCE = buildSnippetSource("https://app.example.com/api/snippet/decide");

const tick = () => new Promise((r) => setImmediate(r));

function makeClock() {
  let now = 0;
  let seq = 0;
  const timers: { id: number; at: number; fn: () => void }[] = [];
  return {
    get now() { return now; },
    setTimeout(fn: () => void, ms?: number) {
      const id = ++seq;
      timers.push({ id, at: now + (ms || 0), fn });
      return id;
    },
    clearTimeout(id: number) {
      const i = timers.findIndex((t) => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
    async advance(ms: number) {
      const end = now + ms;
      for (;;) {
        await tick();
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift();
        now = t.at;
        t.fn();
      }
      now = end;
      await tick();
    },
  };
}

function fakeEl(attrs: Record<string, string> = {}, qsa: Record<string, any[]> = {}): any {
  const listeners: Record<string, ((ev: any) => void)[]> = {};
  const el: any = {
    _attrs: { ...attrs } as Record<string, string>,
    _qsa: qsa,
    _listeners: listeners,
    textContent: "",
    innerHTML:   "",
    className:   "",
    offsetHeight: 120,
    style: {
      _props: {} as Record<string, string>,
      opacity: "",
      minHeight: "",
      setProperty(k: string, v: string) { this._props[k] = v; },
    },
    get attributes() {
      return Object.keys(el._attrs).map((name) => ({ name, value: el._attrs[name] }));
    },
    getAttribute(k: string) { return k in el._attrs ? el._attrs[k] : null; },
    setAttribute(k: string, v: string) { el._attrs[k] = v; },
    querySelectorAll(sel: string) { return el._qsa[sel] ?? []; },
    querySelector(sel: string) { return (el._qsa[sel] ?? [])[0] ?? null; },
    addEventListener(type: string, fn: (ev: any) => void) { (listeners[type] ||= []).push(fn); },
  };
  return el;
}

interface EnvOpts {
  readyState?:  string;
  scriptAttrs?: Record<string, string>;
  /** Other script[data-site-key] tags listed BEFORE the snippet's own tag. */
  otherScripts?: any[];
  /** Expose the snippet's own tag as document.currentScript. */
  currentScript?: boolean;
  cookie?: string;
  windowExtra?: Record<string, unknown>;
  fetchImpl?: (url: string, opts: any) => Promise<any>;
  payload?: unknown;
}

function createEnv(o: EnvOpts = {}) {
  const clock    = makeClock();
  const scriptEl = fakeEl({ "data-site-key": "sk_self", ...(o.scriptAttrs ?? {}) });
  const docEl    = fakeEl();
  const registry: Record<string, any[]> = {
    "script[data-site-key]": [...(o.otherScripts ?? []), scriptEl],
  };
  const allEls: any[] = [docEl, scriptEl];
  const docListeners: Record<string, (() => void)[]> = {};

  const document: any = {
    documentElement: docEl,
    head:            fakeEl(),
    cookie:          o.cookie ?? "",
    referrer:        "",
    readyState:      o.readyState ?? "complete",
    currentScript:   o.currentScript ? scriptEl : null,
    querySelector:   (sel: string) => (registry[sel] ?? [])[0] ?? null,
    querySelectorAll: (sel: string) => registry[sel] ?? [],
    getElementsByTagName: (t: string) => (t === "*" ? allEls : []),
    getElementById:  () => null,
    createElement:   () => fakeEl(),
    addEventListener(type: string, fn: () => void) { (docListeners[type] ||= []).push(fn); },
  };
  const window: any = {
    location: { pathname: "/pricing", search: "?utm_source=x", protocol: "https:", href: "https://site.example/pricing?utm_source=x" },
    crypto:   { randomUUID: () => "id-1" },
    ...(o.windowExtra ?? {}),
  };

  const fetchCalls: { url: string; opts: any; body: any }[] = [];
  const env = {
    clock, document, window, registry, allEls, scriptEl, docEl, fetchCalls,
    payload: o.payload ?? { slots: {} },
    decideCalls() { return fetchCalls.filter((c) => c.url.indexOf("/api/snippet/decide") >= 0); },
    fireDomReady() {
      document.readyState = "interactive";
      for (const fn of docListeners.DOMContentLoaded ?? []) fn();
    },
    boot() {
      const fetchMock = (url: string, opts: any) => {
        fetchCalls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null });
        if (o.fetchImpl) return o.fetchImpl(url, opts);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(env.payload) });
      };
      const fn = new Function(
        "window", "document", "fetch", "setTimeout", "clearTimeout", "navigator", SOURCE,
      );
      fn(window, document, fetchMock, clock.setTimeout, clock.clearTimeout, {});
    },
  };
  return env;
}

// ── 1. DOM-ready gate ────────────────────────────────────────────────────────

describe("snippet runtime — DOM-ready gate", () => {
  it("waits for DOMContentLoaded and then sends blocks + attributes found in the body", async () => {
    const env = createEnv({ readyState: "loading" });
    env.boot();
    await env.clock.advance(0);
    // Hidden immediately, but no decide yet: the body is not parsed.
    assert.equal(env.docEl.style.opacity, "0");
    assert.equal(env.decideCalls().length, 0, "no decide while the document is loading");

    // The body parses: a block container and a custom attribute appear.
    const block = fakeEl({ "data-mc-block": "hero-block" });
    env.registry["[data-mc-block]"] = [block];
    env.allEls.push(fakeEl({ "data-mc-attr-plan": "pro" }));
    env.fireDomReady();
    await env.clock.advance(0);

    const calls = env.decideCalls();
    assert.equal(calls.length, 1, "exactly one first decide");
    assert.deepEqual(calls[0].body.blocks, ["hero-block"]);
    assert.deepEqual(calls[0].body.context.customAttributes, { plan: "pro" });
  });

  it("sends immediately when the document is already parsed", async () => {
    const env = createEnv({ readyState: "interactive" });
    env.registry["[data-mc-block]"] = [fakeEl({ "data-mc-block": "proof" })];
    env.boot();
    await env.clock.advance(0);
    const calls = env.decideCalls();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.blocks, ["proof"]);
  });
});

// ── 2. Double execution ──────────────────────────────────────────────────────

describe("snippet runtime — double include", () => {
  it("runs only once when the snippet is included twice", async () => {
    const env = createEnv();
    env.boot();
    env.boot();
    await env.clock.advance(0);
    assert.equal(env.decideCalls().length, 1);
  });

  it("prefers document.currentScript over the first script[data-site-key]", async () => {
    const other = fakeEl({ "data-site-key": "sk_other" });
    const env = createEnv({ otherScripts: [other], currentScript: true });
    env.boot();
    await env.clock.advance(0);
    assert.equal(env.decideCalls()[0].body.siteKey, "sk_self");
  });
});

// ── 3. Block min-height reservation ──────────────────────────────────────────

function deferredFetchEnv(payload: unknown) {
  let resolveDecide: (() => void) | null = null;
  const env = createEnv({
    fetchImpl: () => new Promise((r) => {
      resolveDecide = () => r({ ok: true, status: 200, json: () => Promise.resolve(payload) });
    }),
  });
  return { env, respond: () => resolveDecide && resolveDecide() };
}

const BLOCK_PAYLOAD = { slots: { "hero-block": { mode: "block", html: "<b>v2</b>" } } };

describe("snippet runtime — block min-height", () => {
  it("does not reserve a min-height while the page is still hidden", async () => {
    const { env, respond } = deferredFetchEnv(BLOCK_PAYLOAD);
    const block = fakeEl({ "data-mc-block": "hero-block" });
    env.registry['[data-mc-block="hero-block"]'] = [block];
    env.boot();
    await env.clock.advance(0);
    respond();
    await env.clock.advance(0);
    assert.equal(block.innerHTML, "<b>v2</b>");
    assert.equal(block.style.minHeight, "");
  });

  it("reserves the footprint for a late swap and releases it again", async () => {
    const { env, respond } = deferredFetchEnv(BLOCK_PAYLOAD);
    const block = fakeEl({ "data-mc-block": "hero-block" });
    env.registry['[data-mc-block="hero-block"]'] = [block];
    env.boot();
    await env.clock.advance(800); // past the 700 ms reveal: page is visible
    assert.equal(env.docEl.style.opacity, "");
    respond();
    await env.clock.advance(0);
    assert.equal(block.innerHTML, "<b>v2</b>");
    assert.equal(block.style.minHeight, "120px", "footprint reserved during the swap");
    await env.clock.advance(5000);
    assert.equal(block.style.minHeight, "", "reservation released afterwards");
  });
});

// ── 4. window.mcConsent as a Promise ─────────────────────────────────────────

describe("snippet runtime — consent", () => {
  it("honours window.mcConsent assigned to a Promise", async () => {
    const env = createEnv({ windowExtra: { mcConsent: Promise.resolve(true) } });
    env.boot();
    await env.clock.advance(0);
    const c = env.decideCalls()[0].body.consent;
    assert.equal(c.personalization, true);
    assert.equal(c.analytics, true);
  });
});

// ── 5. Malformed cookie ──────────────────────────────────────────────────────

describe("snippet runtime — cookies", () => {
  it("survives a malformed percent-encoded cookie", async () => {
    const env = createEnv({ cookie: "mc_locale=%E0%A4%A" });
    assert.doesNotThrow(() => env.boot());
    await env.clock.advance(0);
    assert.equal(env.decideCalls().length, 1);
  });
});

// ── 6. Abort timer starts at send ────────────────────────────────────────────

describe("snippet runtime — call budget", () => {
  it("starts the CALL_MS abort timer when the first decide is sent", async () => {
    let fireConsent: (() => void) | null = null;
    const env = createEnv({
      scriptAttrs: { "data-mc-call-ms": "100" },
      fetchImpl:   () => new Promise(() => { /* hangs */ }),
    });
    // An async CMP that answers after 40 ms (within the consent cap).
    env.window.mcConsent = () => new Promise((r) => { fireConsent = () => r(true); });
    env.boot();
    env.clock.setTimeout(() => fireConsent && fireConsent(), 40);
    await env.clock.advance(40);
    const calls = env.decideCalls();
    assert.equal(calls.length, 1);
    const signal: AbortSignal = calls[0].opts.signal;
    assert.ok(signal, "first decide carries an abort signal");
    await env.clock.advance(60); // t=100: 100 ms after load, 60 ms after send
    assert.equal(signal.aborted, false, "not aborted before CALL_MS has passed since send");
    await env.clock.advance(50); // t=150: 110 ms after send
    assert.equal(signal.aborted, true, "aborted once CALL_MS has passed since send");
  });
});

// ── 7. Forms ─────────────────────────────────────────────────────────────────

function formEnv(formStatus: number, formData: unknown) {
  const resets: unknown[] = [];
  const widget = fakeEl({ "data-sitekey": "0x4AAA" });
  widget.className = "cf-turnstile";
  const input  = fakeEl({ name: "email" });
  input.value = "a@b.nl";
  const status = fakeEl();
  const form   = fakeEl({ "data-mc-form": "contact" }, {
    "[data-mc-form-status]": [status],
    "input[name], textarea[name], select[name]": [input],
    ".cf-turnstile": [widget],
  });
  const block  = fakeEl({ "data-mc-block": "form-block" }, {
    "form[data-mc-form]": [form],
    ".cf-turnstile":      [widget],
  });
  const env = createEnv({
    payload: { slots: { "form-block": { mode: "block", html: "<form></form>" } } },
    windowExtra: {
      turnstile: {
        render: () => "wid-1",
        reset:  (w: unknown) => { resets.push(w); },
      },
    },
    fetchImpl: (url) => {
      if (url.indexOf("/api/forms/") >= 0) {
        return Promise.resolve({ ok: formStatus === 200, status: formStatus, json: () => Promise.resolve(formData) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(env.payload) });
    },
  });
  env.registry['[data-mc-block="form-block"]'] = [block];
  return { env, form, resets };
}

async function submit(env: ReturnType<typeof createEnv>, form: any) {
  const ev = { preventDefault() {} };
  for (const fn of form._listeners.submit ?? []) fn(ev);
  await env.clock.advance(0);
}

describe("snippet runtime — forms", () => {
  it("resets the Turnstile widget after a failed submit (token is spent)", async () => {
    const { env, form, resets } = formEnv(403, { ok: false, error: "Captcha verification failed." });
    env.boot();
    await env.clock.advance(0);
    await submit(env, form);
    assert.deepEqual(resets, ["wid-1"], "turnstile.reset called once, with the rendered widget id");
  });

  it("resets the Turnstile widget after a 422 validation response", async () => {
    const { env, form, resets } = formEnv(422, { ok: false, errors: { email: "Required" } });
    env.boot();
    await env.clock.advance(0);
    await submit(env, form);
    assert.equal(resets.length, 1);
  });

  it("does not reset the widget after a successful submit", async () => {
    const { env, form, resets } = formEnv(200, { ok: true, message: "Dank" });
    form.removeChild = () => {};
    form.appendChild = () => {};
    env.boot();
    await env.clock.advance(0);
    await submit(env, form);
    assert.equal(resets.length, 0);
  });

  it("sends the page path + query as _mc_page", async () => {
    const { env, form } = formEnv(422, { ok: false, errors: {} });
    env.boot();
    await env.clock.advance(0);
    await submit(env, form);
    const call = env.fetchCalls.find((c) => c.url.indexOf("/api/forms/") >= 0);
    assert.ok(call);
    assert.equal(call!.body._mc_page, "/pricing?utm_source=x");
    assert.equal(call!.body.email, "a@b.nl");
  });
});

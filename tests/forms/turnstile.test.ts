/**
 * Cloudflare Turnstile — server verification + snippet widget rendering.
 *
 * Pure + fetch-stubbed; no infra. Safe for the fast suite.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstile } from "../../forms/spam.ts";
import { renderForm }      from "../../lib/snippet/render-block-html.ts";
import type { ResolvedForm } from "../../forms/context/types.ts";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: RequestInit) => { ok: boolean; json: () => Promise<unknown> }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = (async (url: any, init: any) => handler(String(url), init ?? {})) as unknown as typeof fetch;
}

describe("verifyTurnstile", () => {
  afterEach(() => { globalThis.fetch = realFetch; });

  it("returns false without calling the network when token or secret is empty", async () => {
    let called = false;
    stubFetch(() => { called = true; return { ok: true, json: async () => ({ success: true }) }; });

    assert.equal(await verifyTurnstile("", "secret"), false);
    assert.equal(await verifyTurnstile("token", ""), false);
    assert.equal(called, false, "must short-circuit before fetch");
  });

  it("returns true and posts secret + response when Cloudflare confirms success", async () => {
    let sentBody = "";
    stubFetch((url, init) => {
      assert.match(url, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
      sentBody = String(init.body);
      return { ok: true, json: async () => ({ success: true }) };
    });

    assert.equal(await verifyTurnstile("tok123", "sec456", "1.2.3.4"), true);
    assert.match(sentBody, /secret=sec456/);
    assert.match(sentBody, /response=tok123/);
    assert.match(sentBody, /remoteip=1.2.3.4/);
  });

  it("returns false when Cloudflare rejects the token", async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) }));
    assert.equal(await verifyTurnstile("bad", "sec"), false);
  });

  it("returns false (fail-closed) on a network/HTTP error", async () => {
    stubFetch(() => ({ ok: false, json: async () => ({}) }));
    assert.equal(await verifyTurnstile("tok", "sec"), false);
  });
});

describe("renderForm — Turnstile widget", () => {
  const base: ResolvedForm = { segment: null, fields: [] };

  it("injects the cf-turnstile widget with the site key when turnstile is set", () => {
    const html = renderForm({ ...base, turnstile: { siteKey: "0xSITEKEY" } }, "contact");
    assert.match(html, /class="cf-turnstile"/);
    assert.match(html, /data-sitekey="0xSITEKEY"/);
  });

  it("omits the widget when turnstile is absent", () => {
    const html = renderForm(base, "contact");
    assert.doesNotMatch(html, /cf-turnstile/);
  });
});

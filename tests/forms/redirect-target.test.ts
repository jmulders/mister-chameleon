/**
 * safeRedirectTarget: the open-redirect guard for the CMS-authored Form Section
 * post-submit target. Unlike safeRelativePath it also admits absolute http(s)
 * URLs (an external thank-you page), so the hostile shapes matter more here.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  safeRedirectTarget, safeRelativePath,
  resolveRedirectTarget, resolvePostSubmitAction,
} from "../../forms/context/resolve.ts";

describe("safeRedirectTarget", () => {
  it("keeps an internal root-relative path", () => {
    assert.equal(safeRedirectTarget("/bedankt"), "/bedankt");
    assert.equal(safeRedirectTarget("/bedankt?ref=form#top"), "/bedankt?ref=form#top");
    assert.equal(safeRedirectTarget("  /bedankt  "), "/bedankt");
  });

  it("keeps an absolute http(s) URL", () => {
    assert.equal(safeRedirectTarget("https://x.nl/dank"), "https://x.nl/dank");
    assert.equal(safeRedirectTarget("http://x.nl/dank"),  "http://x.nl/dank");
  });

  it("rejects a protocol-relative URL (open redirect to another host)", () => {
    assert.equal(safeRedirectTarget("//evil.example"),      undefined);
    assert.equal(safeRedirectTarget("//evil.example/dank"), undefined);
  });

  it("rejects non-http(s) schemes", () => {
    assert.equal(safeRedirectTarget("javascript:alert(1)"),        undefined);
    assert.equal(safeRedirectTarget("data:text/html,<h1>hi</h1>"), undefined);
    assert.equal(safeRedirectTarget("mailto:a@b.nl"),              undefined);
    assert.equal(safeRedirectTarget("ftp://x.nl/dank"),            undefined);
  });

  it("rejects empty / absent / unparseable input", () => {
    assert.equal(safeRedirectTarget(undefined),  undefined);
    assert.equal(safeRedirectTarget(""),         undefined);
    assert.equal(safeRedirectTarget("   "),      undefined);
    assert.equal(safeRedirectTarget("bedankt"),  undefined); // bare relative — not a valid URL
  });

  it("safeRelativePath stays path-only — external URLs are still rejected there", () => {
    assert.equal(safeRelativePath("https://x.nl/dank"), undefined);
    assert.equal(safeRelativePath("/bedankt"),          "/bedankt");
  });
});

describe("resolveRedirectTarget", () => {
  it("postSubmit \"redirect\" → the block target wins", () => {
    assert.equal(
      resolveRedirectTarget({
        postSubmit: "redirect", blockRedirectUrl: "/bedankt",
        overlayRedirectPath: "/overlay", definitionRedirectPath: "/definition",
      }),
      "/bedankt",
    );
  });

  it("postSubmit \"redirect\" with no block target falls back to overlay, then definition", () => {
    assert.equal(
      resolveRedirectTarget({ postSubmit: "redirect", overlayRedirectPath: "/overlay", definitionRedirectPath: "/definition" }),
      "/overlay",
    );
    assert.equal(
      resolveRedirectTarget({ postSubmit: "redirect", definitionRedirectPath: "/definition" }),
      "/definition",
    );
    assert.equal(resolveRedirectTarget({ postSubmit: "redirect" }), undefined);
  });

  it("postSubmit \"message\" / absent ignores the block target — existing behaviour is untouched", () => {
    assert.equal(
      resolveRedirectTarget({ postSubmit: "message", blockRedirectUrl: "/bedankt", overlayRedirectPath: "/overlay" }),
      "/overlay",
    );
    assert.equal(
      resolveRedirectTarget({ blockRedirectUrl: "/bedankt", definitionRedirectPath: "/definition" }),
      "/definition",
    );
    assert.equal(resolveRedirectTarget({ blockRedirectUrl: "/bedankt" }), undefined);
  });
});

describe("resolvePostSubmitAction", () => {
  const msgs = { fallbackMessage: "Bedankt." };

  it("internal path → client-side push", () => {
    assert.deepEqual(resolvePostSubmitAction("/bedankt", msgs), { kind: "push", path: "/bedankt" });
  });

  it("external https URL → full-page assign", () => {
    assert.deepEqual(resolvePostSubmitAction("https://x.nl/dank", msgs), { kind: "assign", url: "https://x.nl/dank" });
  });

  it("no target → the message, with the block copy beating the API's own", () => {
    assert.deepEqual(
      resolvePostSubmitAction(undefined, { blockSuccessMessage: "Bedankt voor je aanvraag.", responseMessage: "OK", fallbackMessage: "Bedankt." }),
      { kind: "message", message: "Bedankt voor je aanvraag." },
    );
  });

  it("the contextual overlay beats the block copy", () => {
    assert.deepEqual(
      resolvePostSubmitAction(undefined, { overlaySuccessMessage: "Tot snel!", blockSuccessMessage: "Bedankt voor je aanvraag.", fallbackMessage: "Bedankt." }),
      { kind: "message", message: "Tot snel!" },
    );
  });

  it("without authored copy the API message wins, then the fallback", () => {
    assert.deepEqual(
      resolvePostSubmitAction(undefined, { responseMessage: "Ontvangen.", fallbackMessage: "Bedankt." }),
      { kind: "message", message: "Ontvangen." },
    );
    assert.deepEqual(resolvePostSubmitAction(undefined, msgs), { kind: "message", message: "Bedankt." });
  });

  it("an unsafe target never navigates — it degrades to the message", () => {
    assert.deepEqual(resolvePostSubmitAction("javascript:alert(1)", msgs), { kind: "message", message: "Bedankt." });
    assert.deepEqual(resolvePostSubmitAction("//evil.example",      msgs), { kind: "message", message: "Bedankt." });
  });
});

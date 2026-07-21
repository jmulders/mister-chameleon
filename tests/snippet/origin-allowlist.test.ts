/**
 * Unit tests for the snippet origin allowlist helpers.
 *
 * Pure functions, no infra — safe to run in the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  normalizeOriginHost,
  sanitizeAllowedOrigins,
  isSnippetOriginAllowed,
} from "../../lib/snippet/origin-allowlist.ts";

describe("normalizeOriginHost", () => {
  it("strips scheme, port, path, userinfo and leading www", () => {
    assert.equal(normalizeOriginHost("https://WWW.Nascita.nl:443/foo"), "nascita.nl");
    assert.equal(normalizeOriginHost("http://nascita.nl"),              "nascita.nl");
    assert.equal(normalizeOriginHost("nascita.nl/"),                    "nascita.nl");
    assert.equal(normalizeOriginHost("user@staging.nascita.nl"),        "staging.nascita.nl");
  });
  it("returns empty for junk / null-ish input", () => {
    for (const v of ["", "   ", "null", null, undefined]) {
      assert.equal(normalizeOriginHost(v as string), "");
    }
  });
});

describe("sanitizeAllowedOrigins", () => {
  it("normalises and de-duplicates, preserving order", () => {
    assert.deepEqual(
      sanitizeAllowedOrigins(["https://nascita.nl", "www.nascita.nl", "  ", "app.nascita.nl"]),
      ["nascita.nl", "app.nascita.nl"],
    );
  });
  it("returns [] for non-arrays", () => {
    assert.deepEqual(sanitizeAllowedOrigins("nascita.nl"), []);
    assert.deepEqual(sanitizeAllowedOrigins(undefined), []);
  });
});

describe("isSnippetOriginAllowed", () => {
  it("opt-in: empty allowlist allows everything (even no origin)", () => {
    assert.equal(isSnippetOriginAllowed(null, null, []), true);
    assert.equal(isSnippetOriginAllowed("https://evil.com", null, undefined), true);
  });

  it("allows a matching Origin host (www-insensitive)", () => {
    assert.equal(isSnippetOriginAllowed("https://nascita.nl", null, ["nascita.nl"]), true);
    assert.equal(isSnippetOriginAllowed("https://www.nascita.nl", null, ["nascita.nl"]), true);
    assert.equal(isSnippetOriginAllowed("https://nascita.nl", null, ["www.nascita.nl"]), true);
  });

  it("rejects a non-matching Origin when the allowlist is set", () => {
    assert.equal(isSnippetOriginAllowed("https://evil.com", null, ["nascita.nl"]), false);
    // Other subdomains are NOT implicitly allowed.
    assert.equal(isSnippetOriginAllowed("https://staging.nascita.nl", null, ["nascita.nl"]), false);
  });

  it("falls back to Referer only when Origin is absent", () => {
    assert.equal(isSnippetOriginAllowed(null, "https://nascita.nl/pricing", ["nascita.nl"]), true);
    // A present-but-wrong Origin is authoritative; Referer is not consulted.
    assert.equal(isSnippetOriginAllowed("https://evil.com", "https://nascita.nl/x", ["nascita.nl"]), false);
  });

  it("rejects when the allowlist is set but no host can be determined", () => {
    assert.equal(isSnippetOriginAllowed(null, null, ["nascita.nl"]), false);
  });
});

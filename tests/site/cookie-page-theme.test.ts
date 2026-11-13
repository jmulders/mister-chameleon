/**
 * The cookie page, the cookie declaration and the cookie-settings window take
 * their colours from the tenant theme.
 *
 * The declaration is shown in two places: on the cookie page, which sits on
 * the page background, and inside the settings window. Both have to use the
 * same source of colour, or the declaration is unreadable in one of them.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

describe("cookie page and declaration", () => {
  it("have no fixed neutral, grey or white classes", () => {
    for (const file of ["app/(site)/cookies/page.tsx", "components/tracking/CookieDeclaration.tsx"]) {
      const hits = read(file).match(/\b(?:bg|text|border|divide|ring)-(?:white|black|(?:neutral|slate|gray|zinc|stone)-\d{2,3})\b/g) ?? [];
      assert.deepEqual(hits, [], `${file} uses fixed colours: ${[...new Set(hits)].join(", ")}`);
    }
  });
});

describe("cookie-settings window", () => {
  const source = read("components/tracking/CookiePreferences.tsx");

  it("uses the theme's card surface and text colour, with a fallback", () => {
    assert.match(source, /backgroundColor: "var\(--card-bg, #ffffff\)"/);
    assert.match(source, /color: "var\(--text, #111827\)"/);
  });

  it("no longer has a fixed white panel", () => {
    assert.doesNotMatch(source, /backgroundColor: "#ffffff", borderRadius/);
  });
});

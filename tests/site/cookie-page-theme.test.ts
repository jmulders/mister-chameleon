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

// The pages around a signup stand on the site's own background, which is dark
// in the evening and night themes. Seen live on 28 Nov 2026: "Je proefperiode
// is begonnen" in fixed dark text on a dark page, not readable.
describe("signup pages on the site's background", () => {
  it("the confirmation page takes its colours from the theme", () => {
    const source = read("app/(site)/checkout/confirm/page.tsx");
    assert.match(source, /color: "var\(--text, #111827\)"/);
    assert.match(source, /background: "var\(--primary, #111827\)", color: "var\(--primary-text, #ffffff\)"/);
    assert.doesNotMatch(source, /color: "#[0-9a-fA-F]{6}"/);
  });

  it("the titles and the plain states of checkout and cart do too", () => {
    for (const file of ["app/(site)/checkout/_components/CheckoutPageClient.tsx", "app/(site)/cart/_components/CartPageClient.tsx"]) {
      const source = read(file);
      const titles = source.match(/<h1[\s\S]*?>/g) ?? [];
      assert.ok(titles.length >= 2, `${file} has its titles`);
      for (const title of titles) assert.match(title, /color: "var\(--text, #111827\)"/, `${file}: a page title with a fixed colour`);
      // The button of the empty state, which stands on the page background too.
      // A button inside a white card keeps its fixed colours.
      assert.match(source, /background: "var\(--primary, #111827\)",\s+color: "var\(--primary-text, #ffffff\)"/);
    }
  });
});

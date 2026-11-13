/**
 * The demo page and the contact fallback take their surfaces and text colours
 * from the tenant theme.
 *
 * Until 13 Nov 2026 they used fixed grey and white, so they stayed white, or
 * turned dark text on a dark page, when the contextual theme was dark.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = [
  "app/(site)/book-demo/_components/BookDemoClient.tsx",
  "app/(site)/book-demo/_components/BookDemoShell.tsx",
  "app/(site)/contact/page.tsx",
  "components/contact/ContactForm.tsx",
];

describe("demo and contact colours", () => {
  it("have no fixed grey, neutral, white or black classes", () => {
    // Colour families that carry a meaning of their own (red for errors,
    // emerald for done) are allowed; so is white text on the emerald step dot.
    const fixed = /(?:^|[\s"'`:])((?:bg|text|border|ring|placeholder|from|to|divide)-(?:black|(?:neutral|slate|gray|zinc|stone)-\d{2,3})(?:\/\d+)?)\b/g;
    for (const file of FILES) {
      const source = readFileSync(file, "utf8");
      const hits   = [...source.matchAll(fixed)].map((m) => m[1]);
      assert.deepEqual(hits, [], `${file} uses fixed colours: ${[...new Set(hits)].join(", ")}`);
      assert.doesNotMatch(source, /\bbg-white\b(?!\/)/, `${file} has a fixed white surface`);
    }
  });

  it("give every form field a surface of its own", () => {
    // A browser paints a field white by default. With the theme's text colour
    // that is light text on white in a dark theme.
    const demo    = readFileSync(FILES[0]!, "utf8");
    const contact = readFileSync(FILES[3]!, "utf8");
    assert.match(demo,    /const inputClass =\s*\n\s*"[^"]*bg-\[var\(--card-bg\)\][^"]*text-\[color:var\(--text\)\]/);
    const fields = contact.match(/className="w-full rounded-xl border [^"]*"/g) ?? [];
    assert.equal(fields.length, 4);
    for (const field of fields) {
      assert.match(field, /bg-\[var\(--card-bg\)\]/);
      assert.match(field, /text-\[color:var\(--text\)\]/);
    }
  });

  it("keep error text readable on the page itself in every theme", () => {
    // Red mixed with the theme's text colour: dark red on light, light red on dark.
    for (const file of [FILES[0]!, FILES[3]!]) {
      assert.match(readFileSync(file, "utf8"), /color-mix\(in_srgb,#dc2626_50%,var\(--text\)\)/);
    }
  });
});

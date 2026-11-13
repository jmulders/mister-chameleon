/**
 * The pricing page takes its colours from the tenant theme.
 *
 * Until 13 Nov 2026 it used fixed white and near-black, so it stayed white
 * under a dark header when the contextual theme was dark.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = [
  "app/(site)/prijzen/page.tsx",
  "app/(site)/prijzen/_components/CartButtons.tsx",
];

describe("pricing page colours", () => {
  it("has no fixed palette classes", () => {
    const fixed = /\b(?:bg|text|border|ring)-(?:white|black|(?:neutral|slate|gray|zinc|stone|emerald|amber|red|green|blue)-\d{2,3})(?:\/\d+)?\b/g;
    for (const file of FILES) {
      const hits = readFileSync(file, "utf8").match(fixed) ?? [];
      assert.deepEqual(hits, [], `${file} uses fixed colours: ${[...new Set(hits)].join(", ")}`);
    }
  });

  it("has no hex or rgb colours of its own", () => {
    for (const file of FILES) {
      const source = readFileSync(file, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, `${file} has a hex colour`);
      assert.doesNotMatch(source, /rgba?\(/, `${file} has an rgb colour`);
    }
  });

  it("draws its surfaces from the theme", () => {
    const page = readFileSync(FILES[0]!, "utf8");
    for (const token of ["var(--bg)", "var(--text)", "var(--text-muted)", "var(--card-bg)", "var(--card-border)", "var(--bg-inverse)", "var(--text-inverse)", "var(--section-subtle-bg)"]) {
      assert.ok(page.includes(token), `page does not use ${token}`);
    }
  });

  it("keeps button text on the inverse pair, which holds its contrast in every theme", () => {
    const buttons = readFileSync(FILES[1]!, "utf8");
    assert.match(buttons, /bg-\[var\(--bg-inverse\)\] text-\[color:var\(--text-inverse\)\]/);
    assert.match(buttons, /bg-\[var\(--text-inverse\)\] text-\[color:var\(--bg-inverse\)\]/);
  });
});

/**
 * Only the shell fonts (Geist, Geist Mono) may be preloaded.
 *
 * next/font preloads every instance by default. With the 28 tenant palette
 * fonts registered in the root layout, that put 28 <link rel="preload"> tags
 * on every page and made a visitor download about 930 KB of fonts for the two
 * or three families a tenant uses. A palette font must set `preload: false`.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

const SOURCE = fs.readFileSync("lib/fonts.ts", "utf8");
const PRELOADED = new Set(["Geist", "Geist_Mono"]);

/** Every `Name({ ... })` call of a font imported from next/font/google. */
function fontInstances(): { name: string; options: string }[] {
  const importBlock = /import\s*\{([^}]+)\}\s*from\s*"next\/font\/google"/.exec(SOURCE);
  assert.ok(importBlock, "lib/fonts.ts imports from next/font/google");
  const names = importBlock[1]
    .replace(/\/\/.*$/gm, "") // the import list carries a comment per group
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const found: { name: string; options: string }[] = [];
  for (const name of names) {
    const call = new RegExp(`=\\s*${name}\\(\\{([^}]*)\\}\\)`, "g");
    for (const m of SOURCE.matchAll(call)) found.push({ name, options: m[1] });
  }
  return found;
}

describe("font preloading", () => {
  it("finds the font instances", () => {
    assert.ok(fontInstances().length >= 20, "expected the palette fonts to be found");
  });

  it("is switched off for every tenant palette font", () => {
    const preloading = fontInstances()
      .filter((f) => !PRELOADED.has(f.name))
      .filter((f) => !/preload:\s*false/.test(f.options))
      .map((f) => f.name);
    assert.deepEqual(preloading, []);
  });

  it("stays on for the shell fonts", () => {
    const shell = fontInstances().filter((f) => PRELOADED.has(f.name));
    assert.equal(shell.length, 2);
    for (const f of shell) assert.doesNotMatch(f.options, /preload:\s*false/);
  });
});

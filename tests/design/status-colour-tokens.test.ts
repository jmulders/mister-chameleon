/**
 * Every status colour the code uses must exist in the theme.
 *
 * Tailwind generates no class for a shade the theme does not define, and says
 * nothing about it: text-error-600 simply renders in the inherited colour. The
 * theme once only had 50, 500 and 700, so error texts were not red and status
 * borders were missing across the admin.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";

const ROOTS = ["app", "components", "lib"];
const CLASS = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|accent|decoration)-(success|warning|error)-(\d{2,3})\b/g;

function* tsxFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* tsxFiles(p);
    else if (e.name.endsWith(".tsx")) yield p;
  }
}

describe("status colour tokens", () => {
  const theme = fs.readFileSync("design-system/theme/theme.css", "utf8");

  it("every shade used in the code is defined in theme.css", () => {
    const missing = new Set<string>();
    for (const root of ROOTS) {
      for (const file of tsxFiles(root)) {
        for (const m of fs.readFileSync(file, "utf8").matchAll(CLASS)) {
          if (!theme.includes(`--color-${m[1]}-${m[2]}:`)) missing.add(`${m[0]} (${file})`);
        }
      }
    }
    assert.deepEqual([...missing], []);
  });
});

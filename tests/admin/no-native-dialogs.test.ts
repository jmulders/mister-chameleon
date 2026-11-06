/**
 * Admin and dashboard use their own dialogs (components/admin/DialogHost), not
 * the browser's window.confirm and alert.
 *
 * The two rich text editors keep window.prompt for a link URL: a modal would take
 * the focus and lose the text selection the link has to land on.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";

const ROOTS = ["app/admin", "app/dashboard", "components/admin"];
const ALLOWED = new Set(["RichCopyEditor.tsx"]);
const NATIVE = /(?<![\w.])(?:window\.)?(?:confirm|alert)\(/;

function* tsxFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* tsxFiles(p);
    else if (e.name.endsWith(".tsx")) yield p;
  }
}

describe("native browser dialogs", () => {
  it("are not used in the admin", () => {
    const found: string[] = [];
    for (const root of ROOTS) {
      for (const file of tsxFiles(root)) {
        if (ALLOWED.has(path.basename(file))) continue;
        fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          const code = line.trim();
          if (code.startsWith("//") || code.startsWith("*")) return;
          // A local helper named confirm is not the browser's.
          if (/function confirm\(/.test(code)) return;
          if (NATIVE.test(line)) found.push(`${file}:${i + 1}`);
        });
      }
    }
    assert.deepEqual(found, []);
  });
});

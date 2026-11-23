/**
 * The Scenario Control panel says in words that a value is not known.
 *
 * Its readouts once showed a dash for a signal without a value. A sweep that
 * took the dashes out of the copy (#343) turned those into a lone ", " and
 * ": ", and the public demo then read "Role ," and "Interest :". The panel is
 * a client component that cannot be rendered here, so this reads the source.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir   = join(import.meta.dirname, "../../components/scenario");
const files = ["DemoStageSection.tsx", "ScenarioControlPanel.tsx"];

/** A string literal that is nothing but punctuation and spaces, used as a value. */
const LONE_PUNCTUATION = /(\?\?|\?|:|return|useState\(|setRefreshLabel\()\s*"[\s,:;.–—-]+"/g;

describe("empty values in the Scenario Control panel", () => {
  for (const file of files) {
    it(`${file} never shows a lone punctuation mark for a missing value`, () => {
      const source = readFileSync(join(dir, file), "utf8")
        // {" "} between two JSX expressions is spacing, not a value.
        .replace(/\{" "\}/g, "");
      const found = [...source.matchAll(LONE_PUNCTUATION)].map((m) => m[0]);
      assert.deepEqual(found, []);
    });
  }

  it("has one word for a signal the site has no value for", async () => {
    const source = readFileSync(join(dir, "DemoStageSection.tsx"), "utf8");
    const value  = /export const NOT_KNOWN = "([^"]+)"/.exec(source)?.[1] ?? "";
    assert.match(value, /^[a-z ]+$/i);
    for (const name of ["roleText", "interestText", "stageText", "intentText"]) {
      const line = source.split("\n").findIndex((l) => l.includes(`const ${name}`));
      assert.ok(line >= 0, `${name} is gone`);
      assert.ok(source.split("\n").slice(line, line + 4).join("\n").includes("NOT_KNOWN"), `${name} must fall back to NOT_KNOWN`);
    }
  });
});

/**
 * Values inside a PostgREST or(...) string are quoted, so they stay values.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";
import { orValue, orLikeValue } from "../../data/postgrest-filter.ts";

describe("orValue", () => {
  it("quotes a plain value", () => {
    assert.equal(orValue("abc"), '"abc"');
    assert.equal(orValue(7), '"7"');
  });

  it("keeps a comma, a dot and parentheses inside the value", () => {
    assert.equal(orValue("x,status.eq.active"), '"x,status.eq.active"');
    assert.equal(orValue("a),or(b"), '"a),or(b"');
  });

  it("escapes quotes and backslashes", () => {
    assert.equal(orValue('a"b'), '"a\\"b"');
    assert.equal(orValue("a\\b"), '"a\\\\b"');
    assert.equal(orValue('x",id.gt."0'), '"x\\",id.gt.\\"0"');
  });
});

describe("orLikeValue", () => {
  it("wraps the term in wildcards", () => {
    assert.equal(orLikeValue("acme"), '"%acme%"');
  });

  it("makes wildcards in the term literal", () => {
    assert.equal(orLikeValue("100%"), '"%100\\\\%%"');
    assert.equal(orLikeValue("a_b"), '"%a\\\\_b%"');
  });
});

describe("or(...) filters in the code", () => {
  const ROOTS = ["app", "lib", "data", "tenant", "billing", "cms", "context", "decision", "forms", "experiments", "search"];

  function* files(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) yield* files(p);
      else if (/\.tsx?$/.test(e.name)) yield p;
    }
  }

  it("never paste a raw value into the filter string", () => {
    const raw: string[] = [];
    for (const root of ROOTS.filter((r) => fs.existsSync(r))) {
      for (const file of files(root)) {
        const src = fs.readFileSync(file, "utf8");
        for (const m of src.matchAll(/\.or\(\s*`([^`]*)`/g)) {
          // every ${...} in the template has to be an orValue / orLikeValue call
          for (const hole of m[1].matchAll(/\$\{([^}]*)\}/g)) {
            if (!/^\s*or(Like)?Value\(/.test(hole[1])) {
              raw.push(`${file}: \${${hole[1]}}`);
            }
          }
        }
      }
    }
    assert.deepEqual(raw, []);
  });
});

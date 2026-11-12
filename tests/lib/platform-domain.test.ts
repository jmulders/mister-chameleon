/**
 * The code only points at the domain Mister Chameleon owns.
 *
 * Welcome mails linked to mister-chameleon.com, the snippet tag a customer
 * copies fell back to app.misterchameleon.com, and the contact page showed an
 * address at mister-chameleon.io. None of those domains is ours, so each of
 * them sent a customer, or a customer's website, to a stranger. The only domain
 * in use is misterchameleon.nl.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";

const FOREIGN = /mister-?chameleon\.(com|io)\b/i;

const SKIP_DIRS = new Set(["node_modules", "tests", "docs", "public", "supabase", "scripts", "apps", "storybook"]);

/**
 * Files that still name the old domains, each with the reason.
 * The three tenant files hold host-to-tenant mappings: a host listed there
 * resolves to the built-in tenant, so swapping in the .nl host would change
 * which tenant production serves. They need their own, careful change.
 */
const ALLOWED: Record<string, string> = {
  "lib/platform-contact.ts":                             "the comment that explains which domains were wrong",
  "tenant/resolve-tenant.ts":                            "static host map, see above",
  "tenant/mister-chameleon-config.ts":                   "canonical host fallback of the built-in tenant, see above",
  "tenant/templates/mister-chameleon-site-template.ts":  "provisioning template of the built-in tenant, see above",
};

function* sourceFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* sourceFiles(p);
    else if (/\.(ts|tsx|mjs)$/.test(e.name) && !/\.stories\.tsx?$/.test(e.name)) yield p;
  }
}

describe("domains in the code", () => {
  it("no file points at a domain that is not ours", () => {
    const found: string[] = [];
    for (const file of sourceFiles(".")) {
      if (ALLOWED[file]) continue;
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => { if (FOREIGN.test(line)) found.push(`${file}:${i + 1}`); });
    }
    assert.deepEqual(found, []);
  });

  it("the allow list has no stale entries", () => {
    for (const file of Object.keys(ALLOWED)) {
      assert.ok(fs.existsSync(file), `${file} exists`);
      assert.match(fs.readFileSync(file, "utf8"), FOREIGN, `${file} still needs its entry`);
    }
  });
});

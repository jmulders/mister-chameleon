/**
 * Everyone who needs a tenant's site settings asks the tenant's own CMS.
 *
 * Found on 22 Nov 2026 on a live site: a menu label changed in the CMS never
 * reached the site. The remembered site settings are shared per tenant and
 * language by the root layout, the theme decision, the header and the footer.
 * The layout and the theme decision asked the platform's default CMS, the
 * header and footer the tenant's. The layout runs first, so its provider was
 * the one sent to refresh a stale answer, and the header's refresh was skipped
 * as double work. A CMS that is not the tenant's has no menu for the tenant,
 * so that refresh is dropped and the stale answer stays.
 *
 * The refresh itself runs inside Next's data cache and cannot be replayed
 * here, so this guards the cause: one read, used by all four.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Code only: comments may name the old call when they explain it. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) sources(rel, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

describe("site settings come from the tenant's CMS", () => {
  const askers = [
    "app/layout.tsx",
    "lib/theme/request-theme.ts",
    "components/layout/Header.tsx",
    "components/layout/Footer.tsx",
  ];

  for (const file of askers) {
    it(`${file} uses the shared read`, () => {
      const source = code(read(file));
      assert.match(source, /getTenantSiteSettings\(/);
      assert.doesNotMatch(source, /createCMSProvider\(/);
    });
  }

  it("the shared read hands the tenant's CMS setting to the provider", () => {
    const source = code(read("cms/providers/tenant-site-settings.ts"));
    assert.match(source, /normalizeTenant\(tenant\)\.cms/);
    assert.match(source, /createCMSProvider\(tenantCms, tenantId\)\.getSiteSettings\(locale\)/);
  });

  it("nothing on the site reads site settings from a provider made without the tenant's CMS", () => {
    const offenders: string[] = [];
    for (const file of [...sources("app"), ...sources("components"), ...sources("lib"), ...sources("context")]) {
      if (file.startsWith("app/admin/")) continue; // the admin reads a CMS it names itself
      const source = code(read(file));
      if (/createCMSProvider\(\s*(undefined\b[^)]*)?\)\s*\.getSiteSettings\(/.test(source)) offenders.push(file);
    }
    assert.deepEqual(offenders, []);
  });
});

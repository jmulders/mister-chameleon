/**
 * Every route handler under /api/admin and /api/billing checks the session.
 *
 * A route handler is a public URL. The proxy only rate-limits /api, and no
 * layout runs for it, so a handler without its own check is open to anyone:
 * that is how the wallet settings, cancel-subscription and workflow-dispatch
 * routes were reachable without a login. This test reads the sources and fails
 * when a route in these two folders has no guard call.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";

const ROOTS = ["app/api/admin", "app/api/billing"];

const GUARD =
  /\b(guardSessionRoute|guardSuperAdminRoute|guardTenantRoute|getRequiredAdminSession|requireSuperAdmin)\s*\(/;

/** Routes that are public on purpose, each with the reason. */
const PUBLIC: Record<string, string> = {
  "app/api/billing/create-checkout-session/route.ts": "deprecated stub, answers 410 and does nothing",
  "app/api/billing/create-credit-session/route.ts":   "deprecated stub, answers 410 and does nothing",
};

function* routeFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* routeFiles(p);
    else if (e.name === "route.ts") yield p;
  }
}

describe("admin and billing route handlers", () => {
  const files = ROOTS.flatMap((root) => [...routeFiles(root)]);

  it("are found", () => {
    assert.ok(files.length >= 15, `expected the routes to be found, got ${files.length}`);
  });

  it("each check the session", () => {
    const open = files.filter((f) => !PUBLIC[f] && !GUARD.test(fs.readFileSync(f, "utf8")));
    assert.deepEqual(open, []);
  });

  it("the public list has no stale entries", () => {
    for (const f of Object.keys(PUBLIC)) {
      assert.ok(fs.existsSync(f), `${f} is listed as public but does not exist`);
      const imports = fs.readFileSync(f, "utf8").match(/^import .*$/gm) ?? [];
      assert.deepEqual(imports, ['import { NextResponse } from "next/server";'], `${f} is listed as a stub but imports more than a response`);
    }
  });
});

describe("the dashboard", () => {
  it("requires a superadmin in its layout", () => {
    assert.match(fs.readFileSync("app/dashboard/layout.tsx", "utf8"), /await requireSuperAdmin\(\)/);
  });

  it("is behind the admin guard in the proxy, dotted paths included", () => {
    const proxy = fs.readFileSync("proxy.ts", "utf8");
    assert.match(proxy, /pathname\.startsWith\(DASHBOARD_PREFIX \+ "\/"\)/);
    assert.match(proxy, /"\/admin\/:path\*"/);
    assert.match(proxy, /"\/dashboard\/:path\*"/);
  });
});

describe("superadmin sections of the admin", () => {
  const SECTIONS = ["platform", "users", "context", "interest-profiles", "ai-logs", "pages", "demo", "onboarding"];

  it("each have a layout that requires a superadmin", () => {
    for (const section of SECTIONS) {
      const file = `app/admin/${section}/layout.tsx`;
      assert.ok(fs.existsSync(file), `${file} exists`);
      assert.match(fs.readFileSync(file, "utf8"), /await requireSuperAdmin\(\)/, `${file} checks the role`);
    }
  });
});

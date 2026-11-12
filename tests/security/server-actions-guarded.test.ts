/**
 * Every server action checks the session itself.
 *
 * An exported function in a "use server" file is a public POST endpoint. It
 * can be called from any page with its action id, the proxy lets action
 * requests through, and no layout runs for it. About 200 actions had no check
 * of their own, among them saving the platform's mail settings and exporting a
 * tenant's visitor profiles.
 *
 * This test reads the sources: each exported function of a "use server" file
 * must call one of the guards, directly or through a helper in the same file.
 * The login, 2FA and password-reset actions are the only ones that are public.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";
import ts               from "typescript";

const ROOTS = ["app", "lib", "components", "billing", "tenant", "forms"];

const GUARD =
  /\b(requireAdminAction|requireSuperAdminAction|requireTenantAction|requireTenantOrPlatformAction|getRequiredAdminSession|requireSuperAdmin)\s*\(/;

/** Files whose actions run before there is a session. */
const PUBLIC_FILES = new Set([
  "app/admin/login/actions.ts",
  "app/admin/login/2fa/actions.ts",
  "app/admin/forgot-password/actions.ts",
  "app/admin/reset-password/actions.ts",
]);

function* sourceFiles(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* sourceFiles(p);
    else if (/\.tsx?$/.test(e.name)) yield p;
  }
}

function isUseServer(sf: ts.SourceFile): boolean {
  const first = sf.statements[0];
  return !!first && ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) && first.expression.text === "use server";
}

type Fn = { name: string; body: string };

/** Exported functions, and the bodies of the file's own helpers. */
function readFile(file: string): { exported: Fn[]; helpers: Map<string, string> } | null {
  const src = fs.readFileSync(file, "utf8");
  if (!src.includes('"use server"')) return null;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (!isUseServer(sf)) return null;

  const exported: Fn[] = [];
  const helpers = new Map<string, string>();
  for (const st of sf.statements) {
    const isExported = ts.canHaveModifiers(st) &&
      (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (ts.isFunctionDeclaration(st) && st.body && st.name) {
      if (isExported) exported.push({ name: st.name.text, body: st.body.getText(sf) });
      else helpers.set(st.name.text, st.body.getText(sf));
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer;
        if (!init || !(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue;
        const name = d.name.getText(sf);
        const body = init.body.getText(sf);
        if (isExported) exported.push({ name, body });
        else helpers.set(name, body);
      }
    }
  }
  return { exported, helpers };
}

function isGuarded(fn: Fn, helpers: Map<string, string>): boolean {
  if (GUARD.test(fn.body)) return true;
  for (const [name, body] of helpers) {
    if (GUARD.test(body) && new RegExp(`\\b${name}\\s*\\(`).test(fn.body)) return true;
  }
  return false;
}

describe("server actions", () => {
  const files = ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => [...sourceFiles(r)]);
  const actionFiles = files
    .map((file) => ({ file, parsed: readFile(file) }))
    .filter((f): f is { file: string; parsed: NonNullable<ReturnType<typeof readFile>> } => f.parsed !== null);

  it("are found", () => {
    const count = actionFiles.reduce((n, f) => n + f.parsed.exported.length, 0);
    assert.ok(actionFiles.length >= 60, `expected the action files to be found, got ${actionFiles.length}`);
    assert.ok(count >= 300, `expected the actions to be found, got ${count}`);
  });

  it("each check the session", () => {
    const open: string[] = [];
    for (const { file, parsed } of actionFiles) {
      if (PUBLIC_FILES.has(file)) continue;
      for (const fn of parsed.exported) {
        if (!isGuarded(fn, parsed.helpers)) open.push(`${file} :: ${fn.name}`);
      }
    }
    assert.deepEqual(open, []);
  });

  it("the public list has no stale entries", () => {
    for (const file of PUBLIC_FILES) assert.ok(fs.existsSync(file), `${file} is listed as public but does not exist`);
  });

  it("every action under a tenant checks access to a tenant or is superadmin only", () => {
    const TENANT = /\b(requireTenantAction|requireTenantOrPlatformAction|assertTenantAccess|canAccessTenant|requireSuperAdminAction|requireSuperAdmin)\s*\(/;
    /** A login is enough for these: they read shared platform data, nothing of one tenant. */
    const LOGIN_IS_ENOUGH = new Set([
      "app/admin/tenants/[tenantId]/audience/scoring/actions.ts :: getDecayProfilesAction",
    ]);
    const loginOnly: string[] = [];
    for (const { file, parsed } of actionFiles) {
      if (!file.includes("tenants/[tenantId]")) continue;
      for (const fn of parsed.exported) {
        const id = `${file} :: ${fn.name}`;
        if (LOGIN_IS_ENOUGH.has(id)) continue;
        const viaHelper = [...parsed.helpers].some(
          ([name, body]) => TENANT.test(body) && new RegExp(`\\b${name}\\s*\\(`).test(fn.body),
        );
        if (!TENANT.test(fn.body) && !viaHelper) loginOnly.push(id);
      }
    }
    assert.deepEqual(loginOnly, []);
  });
});

/**
 * design-token-sets-store tests.
 *
 * Uses a small stateful fake Supabase client (injected via the store's optional
 * db parameter) that keeps rows in memory, so upsert / list / delete and the
 * platform-vs-tenant scoping can be asserted without a real database.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  listDesignTokenSets,
  getDesignTokenSetById,
  upsertDesignTokenSet,
  deleteDesignTokenSet,
} from "../../lib/design-token-sets/design-token-sets-store.ts";

interface Row {
  id: string;
  tenant_id: string | null;
  name: string;
  tokens: Record<string, unknown>;
  base_theme: string | null;
  typography_override: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** A stateful fake of the subset of the supabase-js builder the store uses. */
function fakeDb() {
  const rows: Row[] = [];
  let idSeq = 0;

  function builder(_table: string) {
    const state: {
      op: "select" | "upsert" | "update" | "delete" | null;
      payload?: Record<string, unknown>;
      filters: Array<{ kind: string; a?: string; b?: unknown }>;
    } = { op: null, filters: [] };

    function matches(r: Row): boolean {
      return state.filters.every((f) => {
        if (f.kind === "eq") return (r as unknown as Record<string, unknown>)[f.a!] === f.b;
        if (f.kind === "is") return (r as unknown as Record<string, unknown>)[f.a!] === null && f.b === null;
        if (f.kind === "or") {
          // Only the two shapes the store emits: "tenant_id.eq.X,tenant_id.is.null"
          return String(f.b).split(",").some((clause) => {
            const [col, opn, ...rest] = clause.split(".");
            const val = rest.join(".");
            const cur = (r as unknown as Record<string, unknown>)[col];
            if (opn === "eq") return cur === val;
            if (opn === "is") return cur === null && val === "null";
            return false;
          });
        }
        return true;
      });
    }

    function resolve(): { data: unknown; error: null } {
      if (state.op === "select") {
        return { data: rows.filter(matches), error: null };
      }
      if (state.op === "delete") {
        const del = rows.filter(matches);
        for (const r of del) rows.splice(rows.indexOf(r), 1);
        return { data: del.map((r) => ({ id: r.id })), error: null };
      }
      if (state.op === "upsert") {
        const p = state.payload as Partial<Row>;
        const existing = rows.find((r) => r.tenant_id === (p.tenant_id ?? null) && r.name === p.name);
        if (existing) {
          Object.assign(existing, p, { updated_at: "t1" });
          return { data: [{ id: existing.id }], error: null };
        }
        const row: Row = {
          id: p.id ?? `id_${++idSeq}`,
          tenant_id: p.tenant_id ?? null,
          name: p.name!,
          tokens: p.tokens ?? {},
          base_theme: p.base_theme ?? null,
          typography_override: p.typography_override ?? null,
          created_at: "t0",
          updated_at: "t0",
        };
        rows.push(row);
        return { data: [{ id: row.id }], error: null };
      }
      if (state.op === "update") {
        const upd = rows.filter(matches);
        for (const r of upd) Object.assign(r, state.payload, { updated_at: "t1" });
        return { data: upd.map((r) => ({ id: r.id })), error: null };
      }
      return { data: null, error: null };
    }

    const b: Record<string, unknown> = {};
    b.select = () => { if (!state.op) state.op = "select"; return b; };
    b.order  = () => b;
    b.eq     = (a: string, val: unknown) => { state.filters.push({ kind: "eq", a, b: val }); return b; };
    b.is     = (a: string, val: unknown) => { state.filters.push({ kind: "is", a, b: val }); return b; };
    b.or     = (expr: string) => { state.filters.push({ kind: "or", b: expr }); return b; };
    b.upsert = (row: Record<string, unknown>) => { state.op = "upsert"; state.payload = row; return b; };
    b.update = (row: Record<string, unknown>) => { state.op = "update"; state.payload = row; return b; };
    b.delete = () => { state.op = "delete"; return b; };
    b.single      = () => ({ then: (res: (v: unknown) => unknown) => { const r = resolve(); const arr = r.data as unknown[]; return res({ data: arr?.[0] ?? null, error: null }); } });
    b.maybeSingle = () => ({ then: (res: (v: unknown) => unknown) => { const r = resolve(); const arr = r.data as unknown[]; return res({ data: arr?.[0] ?? null, error: null }); } });
    // Awaiting the builder directly (select/delete list forms).
    b.then = (res: (v: unknown) => unknown) => { if (!state.op) state.op = "select"; return res(resolve()); };
    return b;
  }

  return { client: { from: (t: string) => builder(t) }, rows };
}

describe("design-token-sets-store", () => {
  let db: ReturnType<typeof fakeDb>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;
  beforeEach(() => { db = fakeDb(); client = db.client; });

  it("upsert inserts a tenant set and getById returns it", async () => {
    const res = await upsertDesignTokenSet({ tenantId: "acme", name: "Brand", tokens: { color: { primary: "#fff" } } }, client);
    assert.equal(res.ok, true);
    const id = (res as { ok: true; id: string }).id;
    const got = await getDesignTokenSetById(id, client);
    assert.equal(got?.name, "Brand");
    assert.equal(got?.tenantId, "acme");
    assert.deepEqual(got?.tokens, { color: { primary: "#fff" } });
  });

  it("upsert on the same (tenant, name) overwrites instead of duplicating", async () => {
    await upsertDesignTokenSet({ tenantId: "acme", name: "Brand", tokens: { a: 1 } }, client);
    await upsertDesignTokenSet({ tenantId: "acme", name: "Brand", tokens: { a: 2 } }, client);
    const list = await listDesignTokenSets("acme", false, client);
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].tokens, { a: 2 });
  });

  it("list scoping: platform + tenant sets, includePlatform toggles platform rows", async () => {
    await upsertDesignTokenSet({ tenantId: null,    name: "Platform Set", tokens: {} }, client);
    await upsertDesignTokenSet({ tenantId: "acme",  name: "Acme Set",     tokens: {} }, client);
    await upsertDesignTokenSet({ tenantId: "other", name: "Other Set",    tokens: {} }, client);

    const withPlatform = await listDesignTokenSets("acme", true, client);
    assert.deepEqual(withPlatform.map((s) => s.name).sort(), ["Acme Set", "Platform Set"]);

    const tenantOnly = await listDesignTokenSets("acme", false, client);
    assert.deepEqual(tenantOnly.map((s) => s.name), ["Acme Set"]);

    const platformOnly = await listDesignTokenSets(null, true, client);
    assert.deepEqual(platformOnly.map((s) => s.name), ["Platform Set"]);
  });

  it("delete removes a set; deleting a missing id reports failure", async () => {
    const res = await upsertDesignTokenSet({ tenantId: "acme", name: "Brand", tokens: {} }, client);
    const id = (res as { ok: true; id: string }).id;

    const del = await deleteDesignTokenSet(id, client);
    assert.equal(del.ok, true);
    assert.equal((await listDesignTokenSets("acme", false, client)).length, 0);

    const missing = await deleteDesignTokenSet("does-not-exist", client);
    assert.equal(missing.ok, false);
  });
});

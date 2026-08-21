/**
 * saveTokenSet tests: the validate-then-store core behind the save/update
 * design-token-set actions. Invalid token payloads are rejected (nothing
 * written); valid payloads are stored. The validator is injected (the real
 * validateDesignTokenUpload runs in the action; a stub proves the save wiring
 * here without pulling in the validator's heavy import chain). Uses the same
 * in-memory fake client the store tests use, injected via the db parameter.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { saveTokenSet, tokenSetToUploadPayload } from "../../lib/design-token-sets/save-token-set.ts";
import type { TokenValidator } from "../../lib/design-token-sets/save-token-set.ts";
import { listDesignTokenSets } from "../../lib/design-token-sets/design-token-sets-store.ts";
import type { DesignTokenSet } from "../../lib/design-token-sets/design-token-sets-store.ts";

/** Stub validator: rejects anything with a `bad` key, echoes tokens otherwise. */
const stubValidate: TokenValidator = (raw) => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  if ("bad" in obj) return { ok: false, errors: ["Invalid token payload."] };
  return { ok: true, tokens: obj };
};

/** Minimal in-memory fake of the supabase builder subset saveTokenSet needs. */
function fakeDb() {
  const rows: Array<Record<string, unknown>> = [];
  let idSeq = 0;
  function builder() {
    const state: { op: string | null; payload?: Record<string, unknown>; filters: Array<{ a: string; b: unknown }> } = { op: null, filters: [] };
    function resolve() {
      if (state.op === "upsert") {
        const p = state.payload!;
        const existing = rows.find((r) => r.tenant_id === (p.tenant_id ?? null) && r.name === p.name);
        if (existing) { Object.assign(existing, p); return { data: [{ id: existing.id }], error: null }; }
        const row = { id: `id_${++idSeq}`, ...p };
        rows.push(row);
        return { data: [{ id: row.id }], error: null };
      }
      if (state.op === "select") {
        const out = rows.filter((r) => state.filters.every((f) => r[f.a] === f.b));
        return { data: out, error: null };
      }
      return { data: null, error: null };
    }
    const b: Record<string, unknown> = {};
    b.select = () => { if (!state.op) state.op = "select"; return b; };
    b.order  = () => b;
    b.eq     = (a: string, v: unknown) => { state.filters.push({ a, b: v }); return b; };
    b.is     = (a: string, v: unknown) => { state.filters.push({ a, b: v }); return b; };
    b.or     = () => b;
    b.upsert = (row: Record<string, unknown>) => { state.op = "upsert"; state.payload = row; return b; };
    b.update = (row: Record<string, unknown>) => { state.op = "update"; state.payload = row; return b; };
    b.single = () => ({ then: (res: (v: unknown) => unknown) => { const r = resolve(); const arr = r.data as unknown[]; return res({ data: arr?.[0] ?? null, error: null }); } });
    b.then   = (res: (v: unknown) => unknown) => { if (!state.op) state.op = "select"; return res(resolve()); };
    return b;
  }
  return { client: { from: () => builder() }, rows };
}

describe("saveTokenSet validation", () => {
  it("rejects an invalid token payload and writes nothing", async () => {
    const { client, rows } = fakeDb();
    const res = await saveTokenSet(
      { tenantId: "acme", name: "Bad", tokens: { bad: 1 } },
      stubValidate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );
    assert.equal(res.ok, false);
    assert.ok(!res.ok && res.errors.length > 0);
    assert.equal(rows.length, 0);
  });

  it("rejects an empty name", async () => {
    const { client } = fakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await saveTokenSet({ tenantId: "acme", name: "   ", tokens: { color: { primary: "#fff" } } }, stubValidate, client as any);
    assert.equal(res.ok, false);
  });

  it("accepts a valid grouped token payload and stores the normalized tokens", async () => {
    const { client } = fakeDb();
    const res = await saveTokenSet(
      { tenantId: "acme", name: "Brand", tokens: { color: { primary: "#112233" } } },
      stubValidate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
    );
    assert.equal(res.ok, true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await listDesignTokenSets("acme", false, client as any);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Brand");
    assert.deepEqual((list[0].tokens as { color?: Record<string, string> }).color, { primary: "#112233" });
  });
});

describe("tokenSetToUploadPayload", () => {
  it("folds base_theme and typography_override into the upload payload", () => {
    const set: DesignTokenSet = {
      id: "1", tenantId: "acme", name: "S",
      tokens: { color: { primary: "#fff" } },
      baseTheme: "aurora-purple-gold",
      typographyOverride: { headingFont: "Inter" },
      createdAt: "t0", updatedAt: "t0",
    };
    const payload = tokenSetToUploadPayload(set);
    assert.equal(payload.theme, "aurora-purple-gold");
    assert.deepEqual(payload.typography, { headingFont: "Inter" });
    assert.deepEqual(payload.color, { primary: "#fff" });
  });

  it("does not overwrite a theme the tokens already carry", () => {
    const set: DesignTokenSet = {
      id: "1", tenantId: null, name: "S",
      tokens: { theme: "existing" },
      baseTheme: "aurora-purple-gold",
      typographyOverride: null,
      createdAt: "t0", updatedAt: "t0",
    };
    assert.equal(tokenSetToUploadPayload(set).theme, "existing");
  });
});

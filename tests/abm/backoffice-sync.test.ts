/**
 * Back-office lead sync (POST /api/abm/leads) — unit tests for the pure core:
 * constant-time key verify, strict body validation, and the handleAbmSync
 * orchestration (auth fail-closed, idempotent upsert, visitor-profile link).
 *
 * The DB is never touched: the store's (tenant_id, external_id) reuse logic is
 * exercised through upsertAbmLeadByExternalId with an in-memory fake injected via
 * its deps, and the route handler runs over injected deps.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  verifyTenantApiKey, parseAbmSyncBody, handleAbmSync, type AbmSyncDeps,
} from "../../lib/abm/backoffice-sync.ts";
import {
  upsertAbmLeadByExternalId,
  type AbmLead, type AbmLeadInput, type AbmExternalUpsertInput,
} from "../../lib/abm/abm-store.ts";
import { encryptSecret } from "../../lib/email-crypto.ts";

// ── In-memory fake store (mirrors the real upsert's column behavior) ──────────

function makeFakeStore() {
  const byExternal = new Map<string, AbmLead>();
  const byId       = new Map<string, AbmLead>();
  let seq = 0;

  async function getByExternalId(tenantId: string, externalId: string): Promise<AbmLead | null> {
    return byExternal.get(`${tenantId}|${externalId}`) ?? null;
  }
  async function upsert(input: AbmLeadInput): Promise<AbmLead> {
    const prev = input.id ? byId.get(input.id) : undefined;
    const lead: AbmLead = {
      id:           input.id ?? `lead_${++seq}`,
      tenantId:     input.tenantId,
      identifier:   input.identifier,
      vanityPath:   input.vanityPath ?? prev?.vanityPath ?? null,
      targetPath:   input.targetPath || "/",
      profile:      input.profile ?? {},
      segmentHint:  input.segmentHint ?? null,
      status:       input.status ?? "active",
      expiresAt:    input.expiresAt ?? null,
      firstSeenAt:  prev?.firstSeenAt ?? null,
      lastSeenAt:   prev?.lastSeenAt ?? null,
      visitCount:   prev?.visitCount ?? 0,
      externalId:   input.externalId ?? prev?.externalId ?? null,
      contactName:  input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
    };
    byId.set(lead.id, lead);
    if (lead.externalId) byExternal.set(`${lead.tenantId}|${lead.externalId}`, lead);
    return lead;
  }
  let genCount = 0;
  const gen = () => `handle_${++genCount}`;

  const upsertByExternalId = (input: AbmExternalUpsertInput) =>
    upsertAbmLeadByExternalId(input, { getByExternalId, upsert, gen });

  return { byExternal, byId, upsertByExternalId };
}

const TENANT = "t1";
const KEY = "mcsk_test_secret_key_value";

function makeDeps(over: Partial<AbmSyncDeps> = {}): AbmSyncDeps & { linkCalls: Array<[string, string, string]> } {
  const store = makeFakeStore();
  const linkCalls: Array<[string, string, string]> = [];
  return {
    getEncryptedSyncKey: async (t) => (t === TENANT ? encryptSecret(KEY) : null),
    upsertByExternalId:  store.upsertByExternalId,
    linkProfile:         async (t, v, id) => { linkCalls.push([t, v, id]); },
    linkCalls,
    ...over,
  };
}

const body = (over: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  externalId: "crm-123",
  profile: { firstName: "Jan", company: "Acme" },
  ...over,
});

// ── verifyTenantApiKey (constant-time) ────────────────────────────────────────

describe("verifyTenantApiKey", () => {
  it("accepts the correct key against the stored (encrypted) value", () => {
    assert.equal(verifyTenantApiKey(KEY, encryptSecret(KEY)), true);
  });
  it("rejects a wrong key", () => {
    assert.equal(verifyTenantApiKey("wrong", encryptSecret(KEY)), false);
  });
  it("rejects when no key is stored, or the provided key is empty", () => {
    assert.equal(verifyTenantApiKey(KEY, null), false);
    assert.equal(verifyTenantApiKey(KEY, ""), false);
    assert.equal(verifyTenantApiKey("", encryptSecret(KEY)), false);
    assert.equal(verifyTenantApiKey(null, encryptSecret(KEY)), false);
  });
  it("does not treat a key that is a prefix of the real key as valid", () => {
    assert.equal(verifyTenantApiKey(KEY.slice(0, -1), encryptSecret(KEY)), false);
  });
});

// ── parseAbmSyncBody (strict) ─────────────────────────────────────────────────

describe("parseAbmSyncBody", () => {
  it("requires tenantId and externalId", () => {
    assert.equal(parseAbmSyncBody(body({ externalId: "" })).ok, false);
    assert.equal(parseAbmSyncBody(body({ tenantId: undefined })).ok, false);
    assert.equal(parseAbmSyncBody("nope").ok, false);
  });
  it("keeps only known profile keys and ignores unknown top-level fields", () => {
    const r = parseAbmSyncBody(body({
      profile: { firstName: "Jan", company: "Acme", hackerField: "x", role: "" },
      somethingUnknown: "ignored",
    }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.deepEqual(r.value.profile, { firstName: "Jan", company: "Acme" });
      assert.equal("somethingUnknown" in r.value, false);
    }
  });
  it("validates targetPath, status and expiresAt", () => {
    assert.equal(parseAbmSyncBody(body({ targetPath: "https://evil.com" })).ok, false);
    assert.equal(parseAbmSyncBody(body({ targetPath: "//evil.com" })).ok, false);
    assert.equal(parseAbmSyncBody(body({ status: "bogus" })).ok, false);
    assert.equal(parseAbmSyncBody(body({ expiresAt: "not-a-date" })).ok, false);
    const ok = parseAbmSyncBody(body({ targetPath: "/pricing", status: "paused", expiresAt: "2027-01-01T00:00:00Z" }));
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.value.targetPath, "/pricing");
      assert.equal(ok.value.status, "paused");
      assert.equal(ok.value.expiresAt, new Date("2027-01-01T00:00:00Z").toISOString());
    }
  });
});

// ── handleAbmSync — auth (fail-closed) ────────────────────────────────────────

describe("handleAbmSync — auth", () => {
  it("401 with no bearer", async () => {
    const res = await handleAbmSync(makeDeps(), { bearer: null, rawBody: body() });
    assert.equal(res.status, 401);
  });
  it("401 with a wrong key", async () => {
    const res = await handleAbmSync(makeDeps(), { bearer: "wrong", rawBody: body() });
    assert.equal(res.status, 401);
  });
  it("401 when no key is configured for the tenant", async () => {
    const deps = makeDeps({ getEncryptedSyncKey: async () => null });
    const res = await handleAbmSync(deps, { bearer: KEY, rawBody: body() });
    assert.equal(res.status, 401);
  });
  it("200 with the correct key", async () => {
    const res = await handleAbmSync(makeDeps(), { bearer: KEY, rawBody: body() });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.handle, "string");
    assert.equal(res.body.goPath, `/go/${res.body.handle}`);
    assert.equal(res.body.vanityPath, null);
    assert.equal(res.body.status, "active");
  });
  it("does not leak validation detail before auth (missing externalId still 401 when unauthenticated)", async () => {
    const res = await handleAbmSync(makeDeps(), { bearer: "wrong", rawBody: body({ externalId: "" }) });
    assert.equal(res.status, 401);
  });
});

// ── handleAbmSync — validation (post-auth) ────────────────────────────────────

describe("handleAbmSync — validation", () => {
  it("400 on a missing externalId when authenticated", async () => {
    const res = await handleAbmSync(makeDeps(), { bearer: KEY, rawBody: body({ externalId: "" }) });
    assert.equal(res.status, 400);
  });
});

// ── handleAbmSync — idempotency / create-vs-update ────────────────────────────

describe("handleAbmSync — idempotent upsert", () => {
  it("2× the same external_id returns the SAME handle and updates the fields", async () => {
    const deps = makeDeps();
    const first  = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ profile: { company: "Acme" } }) });
    const second = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ profile: { company: "Acme BV" } }) });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(first.body.handle, second.body.handle);   // handle stable across syncs
    assert.equal(first.event?.outcome, "created");
    assert.equal(second.event?.outcome, "updated");
  });

  it("a different external_id gets a different handle", async () => {
    const deps = makeDeps();
    const a = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ externalId: "crm-A" }) });
    const b = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ externalId: "crm-B" }) });
    assert.notEqual(a.body.handle, b.body.handle);
    assert.equal(a.event?.outcome, "created");
    assert.equal(b.event?.outcome, "created");
  });
});

// ── handleAbmSync — visitorKey link ───────────────────────────────────────────

describe("handleAbmSync — visitorKey link", () => {
  it("links an existing visitor profile to the lead when visitorKey is given", async () => {
    const deps = makeDeps();
    const res = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ visitorKey: "vk-1" }) });
    assert.equal(res.status, 200);
    assert.equal(deps.linkCalls.length, 1);
    const [t, v, leadId] = deps.linkCalls[0]!;
    assert.equal(t, TENANT);
    assert.equal(v, "vk-1");
    assert.equal(typeof leadId, "string");
  });

  it("does not link when no visitorKey is given", async () => {
    const deps = makeDeps();
    await handleAbmSync(deps, { bearer: KEY, rawBody: body() });
    assert.equal(deps.linkCalls.length, 0);
  });

  it("is fail-open: a linkProfile error still yields 200", async () => {
    const deps = makeDeps({ linkProfile: async () => { throw new Error("link boom"); } });
    const res = await handleAbmSync(deps, { bearer: KEY, rawBody: body({ visitorKey: "vk-1" }) });
    assert.equal(res.status, 200);
  });
});

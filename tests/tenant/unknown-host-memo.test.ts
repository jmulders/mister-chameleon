/**
 * Hostnames the database confirmed as unknown are remembered for a short
 * while, so repeated requests for them skip the database.
 */

import { describe, it, beforeEach } from "node:test";
import assert                       from "node:assert/strict";
import { readFileSync }             from "node:fs";
import {
  isUnknownHost,
  rememberUnknownHost,
  forgetUnknownHost,
  mayRememberUnknown,
  unknownHostCount,
  resetUnknownHosts,
  UNKNOWN_HOST_TTL_MS,
  UNKNOWN_HOST_MAX,
} from "@/tenant/unknown-host-memo";

const T0 = 1_000_000;

describe("remembering an unknown host", () => {
  beforeEach(() => resetUnknownHosts());

  it("knows nothing at the start", () => {
    assert.equal(isUnknownHost("deploy-abc.vercel.app", T0), false);
  });

  it("remembers a host for the length of the TTL", () => {
    rememberUnknownHost("deploy-abc.vercel.app", T0);
    assert.equal(isUnknownHost("deploy-abc.vercel.app", T0 + 1), true);
    assert.equal(isUnknownHost("deploy-abc.vercel.app", T0 + UNKNOWN_HOST_TTL_MS - 1), true);
  });

  it("forgets it when the TTL is over, so a domain added in the admin is picked up", () => {
    rememberUnknownHost("nieuw-domein.nl", T0);
    assert.equal(isUnknownHost("nieuw-domein.nl", T0 + UNKNOWN_HOST_TTL_MS), false);
    assert.equal(unknownHostCount(), 0);
  });

  it("does not care about case or spaces around the name", () => {
    rememberUnknownHost("  Deploy-ABC.vercel.app ", T0);
    assert.equal(isUnknownHost("deploy-abc.vercel.app", T0 + 1), true);
  });

  it("keeps hosts apart", () => {
    rememberUnknownHost("a.example", T0);
    assert.equal(isUnknownHost("b.example", T0 + 1), false);
  });

  it("can be told to forget a host at once", () => {
    rememberUnknownHost("a.example", T0);
    forgetUnknownHost("A.example");
    assert.equal(isUnknownHost("a.example", T0 + 1), false);
  });

  it("ignores an empty hostname", () => {
    rememberUnknownHost("", T0);
    assert.equal(unknownHostCount(), 0);
  });

  it("keeps a short TTL", () => {
    assert.ok(UNKNOWN_HOST_TTL_MS <= 5 * 60 * 1000);
  });
});

describe("size of the memory", () => {
  beforeEach(() => resetUnknownHosts());

  it("never grows past its ceiling", () => {
    for (let i = 0; i < UNKNOWN_HOST_MAX + 25; i++) rememberUnknownHost(`h${i}.example`, T0);
    assert.ok(unknownHostCount() <= UNKNOWN_HOST_MAX);
  });

  it("drops expired hosts first when it is full", () => {
    for (let i = 0; i < UNKNOWN_HOST_MAX; i++) rememberUnknownHost(`oud${i}.example`, T0);
    rememberUnknownHost("nieuw.example", T0 + UNKNOWN_HOST_TTL_MS + 1);
    assert.equal(unknownHostCount(), 1);
    assert.equal(isUnknownHost("nieuw.example", T0 + UNKNOWN_HOST_TTL_MS + 2), true);
  });
});

describe("which misses may be remembered", () => {
  const confirmed = { domainLookupDefinitive: true, persistedLookupOk: true, knownProductionHost: false };

  it("a miss the database confirmed", () => {
    assert.equal(mayRememberUnknown(confirmed), true);
  });

  it("not a miss after a failed domain lookup", () => {
    assert.equal(mayRememberUnknown({ ...confirmed, domainLookupDefinitive: false }), false);
  });

  it("not a miss after a failed read of the host cache", () => {
    assert.equal(mayRememberUnknown({ ...confirmed, persistedLookupOk: false }), false);
  });

  it("never a hard-coded production host", () => {
    assert.equal(mayRememberUnknown({ ...confirmed, knownProductionHost: true }), false);
  });
});

describe("wiring in tenant resolution", () => {
  const source = readFileSync("tenant/get-active-tenant.ts", "utf8");

  it("checks the memory after the static registry and before any database lookup", () => {
    const staticMatch = source.indexOf("const staticMatch = resolveTenantOrNull(host);");
    const memoCheck   = source.indexOf("if (isUnknownHost(hostKey)) return resolveTenant(host);");
    const dbLookup    = source.indexOf("await resolveTenantByDomainCached(host)");
    assert.ok(staticMatch > 0 && memoCheck > staticMatch && dbLookup > memoCheck);
  });

  it("only remembers through mayRememberUnknown, right before the fallback", () => {
    assert.equal((source.match(/rememberUnknownHost\(/g) ?? []).length, 1);
    const guard    = source.indexOf("if (mayRememberUnknown({");
    const remember = source.indexOf("rememberUnknownHost(hostKey);");
    const fallback = source.lastIndexOf("return resolveTenant(host);");
    assert.ok(guard > 0 && remember > guard && fallback > remember);
  });

  it("forgets a host as soon as it resolves to a tenant", () => {
    assert.match(source, /if \(storedTenant\) \{\s*forgetUnknownHost\(hostKey\);/);
  });
});

describe("a failed lookup is told apart from an empty one", () => {
  it("in the domain table", () => {
    const source = readFileSync("tenant/domain-store.ts", "utf8");
    assert.match(source, /return \{ row: null, ok: false \};/);
    assert.match(source, /return \{ row: data \?\? null, ok: true \};/);
  });

  it("in the scan of all tenants", () => {
    const source = readFileSync("tenant/tenant-store.ts", "utf8");
    assert.match(source, /return \{ tenants: \[\], ok: false \};/);
    assert.match(source, /return \{ tenant, definitive: tenant !== null \|\| lookupsOk \};/);
  });

  it("in the host cache", () => {
    const source = readFileSync("tenant/host-resolution-cache-store.ts", "utf8");
    assert.match(source, /if \(error\) return \{ settings: null, ok: false \};/);
  });
});

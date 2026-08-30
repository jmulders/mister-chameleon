/**
 * Tenant timezone (settings.timezone) validation — a typo would silently break
 * time-based rules, so validateTenantSettings must reject a non-IANA value.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateTenantSettings } from "../../tenant/tenant-store.ts";

// A minimally-valid TenantSettings (the validator requires these groups); we vary
// only `timezone` per case.
const base = {
  tenantId:   "acme",
  packageKey: "starter",
  features:   { experiments: false, ai: false, analytics: false },
  blocks:     { context: [], content: [] },
  ai:         { mode: "disabled" },
  cms:        { provider: "mock" },
  design:     { theme: "default" },
};

describe("validateTenantSettings — timezone", () => {
  it("accepts a valid IANA zone", () => {
    const r = validateTenantSettings({ ...base, timezone: "Europe/Amsterdam" });
    assert.equal(r.ok, true);
  });

  it("accepts absent / empty timezone (falls back to UTC downstream)", () => {
    assert.equal(validateTenantSettings({ ...base }).ok, true);
    assert.equal(validateTenantSettings({ ...base, timezone: "" }).ok, true);
  });

  it("rejects a non-IANA string", () => {
    const r = validateTenantSettings({ ...base, timezone: "Mars/Olympus" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /timezone/i);
  });

  it("rejects a non-string timezone", () => {
    assert.equal(validateTenantSettings({ ...base, timezone: 42 }).ok, false);
  });
});

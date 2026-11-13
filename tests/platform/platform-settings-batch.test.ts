/**
 * Reading several platform settings sections in one query gives each key the
 * result its own single read would have given.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  sectionsFromRows,
  sectionsFromError,
  PLATFORM_ENRICHER_KEYS,
} from "@/platform/platform-store";

describe("sections from one batched read", () => {
  it("gives a present row its value and timestamp", () => {
    const out = sectionsFromRows(
      ["weather"],
      [{ key: "weather", value: { enabled: true, cacheTtlMinutes: 30 }, updated_at: "2026-11-01T10:00:00Z" }],
    );
    assert.deepEqual(out["weather"], {
      ok: true,
      data: { enabled: true, cacheTtlMinutes: 30 },
      updatedAt: "2026-11-01T10:00:00Z",
    });
  });

  it("reads a key without a row as an empty, unconfigured section", () => {
    const out = sectionsFromRows(["weather", "maxmind"], [
      { key: "weather", value: { enabled: true }, updated_at: "2026-11-01T10:00:00Z" },
    ]);
    assert.deepEqual(out["maxmind"], { ok: true, data: {}, updatedAt: null });
  });

  it("reads a row with a null value as an empty section", () => {
    const out = sectionsFromRows(["crm"], [{ key: "crm", value: null, updated_at: null }]);
    assert.deepEqual(out["crm"], { ok: true, data: {}, updatedAt: null });
  });

  it("returns exactly the requested keys and ignores other rows", () => {
    const out = sectionsFromRows(["weather"], [
      { key: "weather", value: { enabled: false }, updated_at: null },
      { key: "stripe",  value: { secret: "x" },    updated_at: null },
    ]);
    assert.deepEqual(Object.keys(out), ["weather"]);
  });

  it("keeps the sections apart", () => {
    const out = sectionsFromRows(["enrichment", "crm"], [
      { key: "crm",        value: { provider: "hubspot" }, updated_at: null },
      { key: "enrichment", value: { leadinfo: true },      updated_at: null },
    ]);
    assert.deepEqual((out["enrichment"] as { data: unknown }).data, { leadinfo: true });
    assert.deepEqual((out["crm"] as { data: unknown }).data, { provider: "hubspot" });
  });
});

describe("a failed batched read", () => {
  it("fails every requested key with the wording of a single read", () => {
    const out = sectionsFromError(["weather", "crm"], "connection timeout");
    assert.deepEqual(out["weather"], { ok: false, error: "Failed to read platform settings [weather]: connection timeout" });
    assert.deepEqual(out["crm"],     { ok: false, error: "Failed to read platform settings [crm]: connection timeout" });
  });

  it("words an unexpected error as a single read does", () => {
    const out = sectionsFromError(["weather"], "fetch failed", true);
    assert.deepEqual(out["weather"], { ok: false, error: "Unexpected error reading platform settings [weather]: fetch failed" });
  });
});

describe("the enricher sections", () => {
  it("are the ten the enricher chain reads, each once", () => {
    assert.equal(PLATFORM_ENRICHER_KEYS.length, 10);
    assert.equal(new Set(PLATFORM_ENRICHER_KEYS).size, 10);
    assert.deepEqual([...PLATFORM_ENRICHER_KEYS].sort(), [
      "cbs_location", "crm", "enrichment", "firstparty_company_db", "ga4-history",
      "holidays", "maxmind", "openkvk", "reverse-geocode", "weather",
    ]);
  });
});

/**
 * The durable site-settings cache writes a row only when its content changed.
 */

import { describe, it, beforeEach } from "node:test";
import assert                       from "node:assert/strict";
import {
  persistSiteSettings,
  shouldPersistSiteSettings,
  resetSiteSettingsWriteGuard,
  PERSIST_CHANGED_EVERY_MS,
  type SiteSettingsCacheRow,
  type SiteSettingsCacheWriter,
} from "@/cms/providers/site-settings-cache-store";
import type { SiteSettingsData } from "@/cms/types";

const settings = (label: string) =>
  ({ siteName: label, nav: [{ label: "Prijzen", href: "/prijzen" }] }) as unknown as SiteSettingsData;

function recorder(fail = false): { write: SiteSettingsCacheWriter; rows: SiteSettingsCacheRow[] } {
  const rows: SiteSettingsCacheRow[] = [];
  return {
    rows,
    write: async (row) => {
      rows.push(row);
      return { error: fail ? { message: "database down" } : null };
    },
  };
}

const T0 = Date.parse("2026-11-13T16:00:00.000Z");

describe("site-settings cache writes", () => {
  beforeEach(() => resetSiteSettingsWriteGuard());

  it("writes the first time an instance sees a tenant and locale", async () => {
    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0]!.tenant_id, "statamic");
    assert.equal(r.rows[0]!.locale, "nl");
    assert.equal(r.rows[0]!.updated_at, "2026-11-13T16:00:00.000Z");
  });

  it("does not write the same content again, however often the page renders", async () => {
    const r = recorder();
    for (let i = 0; i < 50; i++) {
      await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0 + i * 1000);
    }
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0 + 24 * 3600 * 1000);
    assert.equal(r.rows.length, 1);
  });

  it("writes changed content once the interval has passed", async () => {
    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0);
    await persistSiteSettings("statamic", "nl", settings("B"), r.write, T0 + PERSIST_CHANGED_EVERY_MS);
    assert.equal(r.rows.length, 2);
    assert.equal((r.rows[1]!.settings as unknown as { siteName: string }).siteName, "B");
  });

  it("holds back two versions that keep alternating within the interval", async () => {
    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0);
    await persistSiteSettings("statamic", "nl", settings("B"), r.write, T0 + 1000);
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0 + 2000);
    await persistSiteSettings("statamic", "nl", settings("B"), r.write, T0 + 3000);
    assert.equal(r.rows.length, 1);
  });

  it("keeps tenants and locales apart", async () => {
    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0);
    await persistSiteSettings("statamic", "en", settings("A"), r.write, T0);
    await persistSiteSettings("nascita",  "nl", settings("A"), r.write, T0);
    await persistSiteSettings(null,       "nl", settings("A"), r.write, T0);
    assert.equal(r.rows.length, 4);
    assert.equal(r.rows[3]!.tenant_id, "_");
  });

  it("writes once when several renders arrive at the same moment", async () => {
    const r = recorder();
    await Promise.all(
      Array.from({ length: 9 }, () => persistSiteSettings("statamic", "nl", settings("A"), r.write, T0)),
    );
    assert.equal(r.rows.length, 1);
  });

  it("tries again after a failed write", async () => {
    const failing = recorder(true);
    await persistSiteSettings("statamic", "nl", settings("A"), failing.write, T0);
    assert.equal(failing.rows.length, 1);

    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0 + 1000);
    assert.equal(r.rows.length, 1);
  });

  it("keeps what it knew when a changed version fails to write", async () => {
    const ok = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), ok.write, T0);

    const failing = recorder(true);
    await persistSiteSettings("statamic", "nl", settings("B"), failing.write, T0 + PERSIST_CHANGED_EVERY_MS);
    assert.equal(failing.rows.length, 1);

    // A is still what the row holds, so A needs no write and B still does.
    assert.equal(shouldPersistSiteSettings("statamic:nl", JSON.stringify(settings("A")), T0 + 2 * PERSIST_CHANGED_EVERY_MS), false);
    assert.equal(shouldPersistSiteSettings("statamic:nl", JSON.stringify(settings("B")), T0 + 2 * PERSIST_CHANGED_EVERY_MS), true);
  });

  it("never throws, also when the writer does", async () => {
    await persistSiteSettings("statamic", "nl", settings("A"), async () => { throw new Error("boom"); }, T0);
    const r = recorder();
    await persistSiteSettings("statamic", "nl", settings("A"), r.write, T0 + 1000);
    assert.equal(r.rows.length, 1);
  });
});

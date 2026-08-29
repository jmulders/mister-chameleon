/**
 * demo-importer save payload — the render-toggle persistence guard.
 *
 * Bug: the demo-importer page has two independent "Save" buttons (Mirror
 * rendering + Demo lifetime), and each used to send only its OWN fields. Toggling
 * `renderEnabled` in one section and clicking Save in the other wrote a partial
 * patch that never carried `renderEnabled`, so the toggle looked on but the DB
 * stayed false. The fix routes BOTH saves through toDemoImporterSavePayload from a
 * single shared state. This pins that the payload always carries renderEnabled
 * (and every other UI-edited field), so no Save can drop the toggle again.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { toDemoImporterSavePayload } from "@/app/admin/platform/demo-importer/settings-payload";
import type { DemoImporterSettings } from "@/app/admin/platform/demo-importer/actions";

const settings = (o: Partial<DemoImporterSettings>): DemoImporterSettings =>
  ({ renderEnabled: false, renderTimeoutMs: 25_000, expiryDays: 7, ...o } as DemoImporterSettings);

describe("toDemoImporterSavePayload", () => {

  it("carries renderEnabled=true so a Save can never drop the toggle", () => {
    assert.equal(toDemoImporterSavePayload(settings({ renderEnabled: true })).renderEnabled, true);
  });

  it("carries renderEnabled=false too (explicit, not omitted)", () => {
    const p = toDemoImporterSavePayload(settings({ renderEnabled: false }));
    assert.equal(p.renderEnabled, false);
    assert.ok("renderEnabled" in p, "renderEnabled must always be present in the payload");
  });

  it("includes every UI-edited field (the full set both Save buttons write)", () => {
    const p = toDemoImporterSavePayload(settings({ renderEnabled: true, renderTimeoutMs: 30_000, expiryDays: 14 }));
    assert.deepEqual(p, { renderEnabled: true, renderTimeoutMs: 30_000, expiryDays: 14 });
  });
});

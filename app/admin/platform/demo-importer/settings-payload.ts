/**
 * The set of demo-importer settings the admin UI edits, packaged for a save.
 *
 * The page has two independent "Save" buttons (Mirror rendering + Demo lifetime).
 * They previously each sent only their OWN fields, so toggling `renderEnabled`
 * in one section and clicking Save in the other wrote a partial patch that never
 * carried `renderEnabled` — the toggle looked on but the DB stayed false. Every
 * Save now sends this full payload from a single shared state, so no field can
 * be dropped by whichever button is clicked. (Fields not edited here, e.g. legacy
 * crawl flags, are preserved by the action's merge over the stored row.)
 */

import type { DemoImporterSettings } from "./actions";

export type DemoImporterSavePayload = Pick<
  DemoImporterSettings,
  "renderEnabled" | "renderTimeoutMs" | "screenshotEnabled" | "expiryDays"
>;

export function toDemoImporterSavePayload(s: DemoImporterSettings): DemoImporterSavePayload {
  return {
    renderEnabled:     s.renderEnabled,
    renderTimeoutMs:   s.renderTimeoutMs,
    screenshotEnabled: s.screenshotEnabled,
    expiryDays:        s.expiryDays,
  };
}

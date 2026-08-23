/**
 * resolve-theme: the section-tabs top band must stay readable on a custom header.
 *
 * The band links read --nav-link (pinned to the header foreground). If the band
 * background stayed on the base --bg-subtle, a dark custom header (dark headerBg +
 * white headerFg) left white text on a light band. resolve-theme now pins
 * --header-topband-bg to the custom header bg (unless explicitly overridden).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import type { TenantSettings } from "../../tenant/types.ts";

function settingsWithLayout(layout: Record<string, string>): TenantSettings {
  return { design: { theme: "default", tokenOverrides: { layout } } } as unknown as TenantSettings;
}

describe("header top band pin", () => {
  it("pins --header-topband-bg to a custom dark header bg (coherent with --nav-link)", () => {
    const { vars } = resolveThemeForTenant(settingsWithLayout({ headerBg: "#0b1020", headerFg: "#ffffff" }));
    assert.equal(vars["--header-topband-bg"], "#0b1020", "band should follow the custom header bg");
    assert.equal(vars["--nav-link"], "#ffffff", "band links follow the header foreground");
    // Also keeps the scrolled header consistent (existing behaviour, guarded here).
    assert.equal(vars["--header-bg-scrolled"], "#0b1020");
  });

  it("an explicit headerTopbandBg override wins over the header-bg pin", () => {
    const { vars } = resolveThemeForTenant(
      settingsWithLayout({ headerBg: "#0b1020", headerFg: "#ffffff", headerTopbandBg: "#123456" }),
    );
    assert.equal(vars["--header-topband-bg"], "#123456");
  });

  it("does not force a top-band colour when the header is not customised", () => {
    const { vars } = resolveThemeForTenant(settingsWithLayout({ headerFg: "#ffffff" })); // fg only, no bg
    assert.equal(vars["--header-topband-bg"], undefined,
      "without a custom headerBg the band keeps its component-level fallback");
  });
});

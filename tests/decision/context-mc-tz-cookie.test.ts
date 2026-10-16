/**
 * buildDecisionContext — a malformed mc_tz cookie must never break the render.
 *
 * mc_tz is URL-encoded by the browser. A truncated / tampered value made the
 * unguarded decodeURIComponent throw a URIError out of buildDecisionContext,
 * taking the homepage render down. A decodable value that is not an IANA zone is
 * ignored too, so the tenant timezone applies instead of a bogus "client" zone.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDecisionContext } from "../../decision/context/build-decision-context.ts";

async function tzSource(cookieHeader: string): Promise<string | null> {
  let source: string | null = null;
  await buildDecisionContext({
    request: new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test" }) }),
    cookieHeader,
    timezone: "Europe/Amsterdam",
    onDebugInfo: (i) => { source = i.timeZoneSource; },
  });
  return source;
}

describe("buildDecisionContext — mc_tz cookie", () => {
  it("a malformed (undecodable) value does not throw and falls back to the tenant timezone", async () => {
    assert.equal(await tzSource("mc_tz=%E0%A4%A"), "tenant");
  });

  it("a decodable value that is not an IANA zone is ignored", async () => {
    assert.equal(await tzSource("mc_tz=Not%2FA_Zone"), "tenant");
  });

  it("a valid mc_tz is still used as the visitor's own timezone", async () => {
    assert.equal(await tzSource("mc_tz=" + encodeURIComponent("America/New_York")), "client");
  });
});

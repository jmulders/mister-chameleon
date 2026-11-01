/**
 * Favicon set for search results and browsers, and robots.txt never blocking it.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import path             from "node:path";

import { tenantIcons } from "@/lib/seo/icons";
import { robotsFor }   from "@/lib/seo/sitemap";

type IconDescriptor = { url: string; sizes?: string; type?: string };

const icons = tenantIcons(undefined) as { icon: IconDescriptor[]; apple: IconDescriptor };
const ALL = [...icons.icon, icons.apple];

describe("tenantIcons", () => {
  it("links the SVG, the 96 and 192 PNGs, the ICO and the touch icon", () => {
    assert.deepEqual(icons.icon.map((i) => i.url), ["/favicon.svg", "/favicon-96.png", "/favicon-192.png", "/favicon.ico"]);
    assert.equal(icons.icon.find((i) => i.url === "/favicon-96.png")?.sizes, "96x96");
    assert.equal(icons.apple.url, "/apple-touch-icon.png");
  });

  it("every linked file exists (public/, or app/favicon.ico)", () => {
    for (const { url } of ALL) {
      const file = url === "/favicon.ico" ? path.join("app", "favicon.ico") : path.join("public", url);
      assert.ok(fs.existsSync(file), `${url} → ${file}`);
    }
  });

  it("PNG files have the size they claim", () => {
    for (const { url, sizes } of ALL) {
      if (!url.endsWith(".png")) continue;
      const buf = fs.readFileSync(path.join("public", url));
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      const expected = sizes ?? (url === "/apple-touch-icon.png" ? "180x180" : "");
      assert.equal(`${w}x${h}`, expected, url);
    }
  });

  it("keeps a tenant's own favicon", () => {
    assert.deepEqual(tenantIcons("/tenants/acme/favicon.ico"), { icon: "/tenants/acme/favicon.ico" });
  });
});

describe("robots.txt and the icons", () => {
  it("blocks none of the icon files", () => {
    const rule = robotsFor("https://www.misterchameleon.nl").rules;
    const disallow = ((Array.isArray(rule) ? rule[0] : rule).disallow ?? []) as string[];
    for (const { url } of ALL) {
      assert.ok(!disallow.some((d) => url.startsWith(d)), `${url} is blocked`);
    }
  });
});

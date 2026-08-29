/**
 * proxifyAssets — route mirrored image URLs through /api/demo/asset
 *
 * Cross-origin <img>/CSS-background assets on a mirrored page break on the
 * source site's hotlink/Referer/CORP protection, showing grey blocks. proxifyAssets
 * rewrites absolute http(s) asset URLs to a same-origin proxy. These tests pin
 * the coverage — including the CSS cases that previously slipped through
 * (background shorthand, url() inside <style> blocks).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { proxifyAssets } from "@/demo/site-mirror";

const BASE  = "https://demo.example.com";
const PROX  = `${BASE}/api/demo/asset?u=`;
const enc   = (u: string) => encodeURIComponent(u);

describe("proxifyAssets", () => {

  it("proxies an absolute <img src>", () => {
    const out = proxifyAssets('<img src="https://cdn.nike.com/a.jpg">', BASE);
    assert.ok(out.includes(`src="${PROX}${enc("https://cdn.nike.com/a.jpg")}"`));
  });

  it("proxies each http descriptor in a srcset", () => {
    const out = proxifyAssets('<img srcset="https://x.test/a.jpg 1x, https://x.test/b.jpg 2x">', BASE);
    assert.ok(out.includes(`${PROX}${enc("https://x.test/a.jpg")} 1x`));
    assert.ok(out.includes(`${PROX}${enc("https://x.test/b.jpg")} 2x`));
  });

  it("proxies a <video poster>", () => {
    const out = proxifyAssets('<video poster="https://x.test/p.jpg"></video>', BASE);
    assert.ok(out.includes(`poster="${PROX}${enc("https://x.test/p.jpg")}"`));
  });

  it("proxies background-image longhand in an inline style", () => {
    const out = proxifyAssets(`<div style="background-image:url('https://x.test/bg.jpg')"></div>`, BASE);
    assert.ok(out.includes(`${PROX}${enc("https://x.test/bg.jpg")}`));
  });

  it("proxies the background shorthand url() in an inline style (previously missed)", () => {
    const out = proxifyAssets(`<div style="background: #000 url('https://x.test/hero.jpg') center/cover"></div>`, BASE);
    assert.ok(out.includes(`${PROX}${enc("https://x.test/hero.jpg")}`), "background shorthand url() must be proxied");
  });

  it("proxies url() inside a <style> block (previously missed)", () => {
    const html = `<style>.hero{background-image:url(https://x.test/s.jpg)} .b{mask-image:url("https://x.test/m.svg")}</style>`;
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes(`${PROX}${enc("https://x.test/s.jpg")}`), "style-block background-image must be proxied");
    assert.ok(out.includes(`${PROX}${enc("https://x.test/m.svg")}`), "style-block mask-image must be proxied");
  });

  it("leaves data: and relative URLs untouched", () => {
    const html = `<img src="data:image/png;base64,AAAA"><div style="background:url(/local/bg.png)"></div>`;
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes('src="data:image/png;base64,AAAA"'), "data: src untouched");
    assert.ok(out.includes("url(/local/bg.png)"), "relative url untouched");
    assert.ok(!out.includes("/api/demo/asset"), "nothing proxied");
  });

  it("leaves a data:-containing srcset untouched (base64 commas)", () => {
    const html = '<img srcset="data:image/gif;base64,R0lGOD, https://x.test/a.jpg 2x">';
    const out  = proxifyAssets(html, BASE);
    assert.equal(out, html, "mixed data: srcset is left intact to avoid corrupting base64");
  });
});

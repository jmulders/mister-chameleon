/**
 * proxifyAssets — route mirrored image URLs through /api/demo/asset
 *
 * Cross-origin <img>/CSS-background assets on a mirrored page break on the
 * source site's hotlink/Referer/CORP protection, showing grey blocks. proxifyAssets
 * rewrites every absolute http(s) image source to a same-origin proxy. These
 * tests pin the full coverage: src, srcset (incl. mixed data:), lazy attrs,
 * <source>/<picture>, <video>, image preload links, and CSS url() — while leaving
 * data:/relative untouched and never double-proxying.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { proxifyAssets } from "@/demo/site-mirror";

const BASE = "https://demo.example.com";
const PROX = `${BASE}/api/demo/asset?u=`;
const enc  = (u: string) => encodeURIComponent(u);
const P    = (u: string) => `${PROX}${enc(u)}`;

describe("proxifyAssets", () => {

  it("proxies an absolute <img src>", () => {
    const out = proxifyAssets('<img src="https://cdn.nike.com/a.jpg">', BASE);
    assert.ok(out.includes(`src="${P("https://cdn.nike.com/a.jpg")}"`));
  });

  it("proxies every candidate in a srcset", () => {
    const out = proxifyAssets('<img srcset="https://x.test/a.jpg 1x, https://x.test/b.jpg 2x">', BASE);
    assert.ok(out.includes(`${P("https://x.test/a.jpg")} 1x`));
    assert.ok(out.includes(`${P("https://x.test/b.jpg")} 2x`));
  });

  it("proxies the http candidates in a mixed data: srcset, leaving data: intact", () => {
    const html = '<img srcset="data:image/gif;base64,R0lGOD, https://x.test/a.jpg 2x">';
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes("data:image/gif;base64,R0lGOD"), "data: placeholder preserved");
    assert.ok(out.includes(`${P("https://x.test/a.jpg")} 2x`), "real candidate proxied");
  });

  it("proxies lazy attributes (data-src / data-srcset / data-original)", () => {
    const html = '<img data-src="https://x.test/l.jpg" data-srcset="https://x.test/l1.jpg 1x, https://x.test/l2.jpg 2x" data-original="https://x.test/o.jpg">';
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes(`data-src="${P("https://x.test/l.jpg")}"`));
    assert.ok(out.includes(`${P("https://x.test/l1.jpg")} 1x`));
    assert.ok(out.includes(`${P("https://x.test/l2.jpg")} 2x`));
    assert.ok(out.includes(`data-original="${P("https://x.test/o.jpg")}"`));
  });

  it("proxies <source srcset> inside <picture>", () => {
    const html = '<picture><source srcset="https://x.test/s.webp 1x"><img src="https://x.test/f.jpg"></picture>';
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes(`${P("https://x.test/s.webp")} 1x`));
    assert.ok(out.includes(`src="${P("https://x.test/f.jpg")}"`));
  });

  it("proxies <video> poster and src", () => {
    const out = proxifyAssets('<video poster="https://x.test/p.jpg" src="https://x.test/v.mp4"></video>', BASE);
    assert.ok(out.includes(`poster="${P("https://x.test/p.jpg")}"`));
    assert.ok(out.includes(`src="${P("https://x.test/v.mp4")}"`));
  });

  it("proxies an image preload <link> (href + imagesrcset), not a stylesheet link", () => {
    const preload = '<link rel="preload" as="image" href="https://x.test/lcp.jpg" imagesrcset="https://x.test/lcp1.jpg 1x, https://x.test/lcp2.jpg 2x">';
    const styles  = '<link rel="stylesheet" href="https://x.test/app.css">';
    const out = proxifyAssets(preload + styles, BASE);
    assert.ok(out.includes(`href="${P("https://x.test/lcp.jpg")}"`), "preload image href proxied");
    assert.ok(out.includes(`${P("https://x.test/lcp1.jpg")} 1x`), "imagesrcset proxied");
    assert.ok(out.includes('href="https://x.test/app.css"'), "stylesheet link left alone");
    assert.ok(!out.includes(`${PROX}${enc("https://x.test/app.css")}`));
  });

  it("proxies CSS url() — background shorthand (inline) and <style> block", () => {
    const html = `<div style="background: #000 url('https://x.test/hero.jpg') center/cover"></div>`
               + `<style>.b{mask-image:url("https://x.test/m.svg")}</style>`;
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes(P("https://x.test/hero.jpg")), "inline background shorthand proxied");
    assert.ok(out.includes(P("https://x.test/m.svg")), "style-block mask-image proxied");
  });

  it("leaves data: and relative URLs untouched", () => {
    const html = `<img src="data:image/png;base64,AAAA"><div style="background:url(/local/bg.png)"></div>`;
    const out  = proxifyAssets(html, BASE);
    assert.ok(out.includes('src="data:image/png;base64,AAAA"'));
    assert.ok(out.includes("url(/local/bg.png)"));
    assert.ok(!out.includes("/api/demo/asset"));
  });

  it("is idempotent — an already-proxied URL is not proxied again", () => {
    const once  = proxifyAssets('<img src="https://x.test/a.jpg">', BASE);
    const twice = proxifyAssets(once, BASE);
    assert.equal(twice, once, "second pass must be a no-op");
  });
});

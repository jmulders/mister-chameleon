/**
 * Unit tests for the server-side whole-block HTML renderer.
 *
 * Pure function, no infra — safe for the fast suite.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { renderBlockHtml, escapeHtml } from "../../lib/snippet/render-block-html.ts";

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
  });
  it("handles null/undefined", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });
});

describe("renderBlockHtml", () => {
  it("renders a feature block with its title and items", () => {
    const html = renderBlockHtml("feature", {
      title: "Why us",
      subtitle: "The difference",
      items: [
        { title: "Fast", body: "Live in a day" },
        { title: "Private", body: "No cookies" },
      ],
    });
    assert.ok(html, "expected HTML");
    assert.match(html!, /Why us/);
    assert.match(html!, /Fast/);
    assert.match(html!, /No cookies/);
    assert.match(html!, /data|section|div/); // it's markup
  });

  it("renders a cta block with a safe button href", () => {
    const html = renderBlockHtml("cta", {
      title: "Start now",
      text: "Free trial",
      cta: { label: "Get started", href: "/signup" },
    })!;
    assert.match(html, /Start now/);
    assert.match(html, /Get started/);
    assert.match(html, /href="\/signup"/);
  });

  it("renders a hero block with tag + ctas", () => {
    const html = renderBlockHtml("hero", {
      tag: "New",
      title: "Adaptive",
      subtitle: "Per visitor",
      ctas: [{ label: "Demo", href: "https://x.test" }, { label: "Docs", href: "/docs" }],
    })!;
    assert.match(html, /Adaptive/);
    assert.match(html, /Demo/);
    assert.match(html, /Docs/);
  });

  it("escapes untrusted variant text (no raw markup injected)", () => {
    const html = renderBlockHtml("cta", { title: "<script>alert(1)</script>", text: "x", cta: { label: "ok", href: "/" } })!;
    assert.ok(!html.includes("<script>alert(1)</script>"), "raw script must not appear");
    assert.match(html, /&lt;script&gt;/);
  });

  it("neutralises javascript: hrefs", () => {
    const html = renderBlockHtml("cta", { title: "t", text: "x", cta: { label: "go", href: "javascript:alert(1)" } })!;
    assert.ok(!/javascript:/i.test(html), "javascript: href must be dropped");
  });

  it("returns null for an unknown slot key", () => {
    assert.equal(renderBlockHtml("banner", { title: "x" }), null);
  });

  it("returns null when the variant has no usable content", () => {
    assert.equal(renderBlockHtml("feature", {}), null);
    assert.equal(renderBlockHtml("hero", { ctas: [] }), null);
  });

  // ── Spotlight media parity (proof_spotlight / feature_spotlight) ──────────────

  it("proof_spotlight without media is byte-identical to the card grid", () => {
    const items = [{ title: "98%", text: "tevreden" }];
    const spot = renderBlockHtml("proof", { id: "p", layoutVariant: "proof_spotlight", title: "T", items });
    const grid = renderBlockHtml("proof", { id: "p", layoutVariant: "proof_stats", title: "T", items });
    assert.equal(spot, grid);
  });

  it("proof_spotlight with media renders the media/quote split with a facade", () => {
    const html = renderBlockHtml("proof", {
      id: "p", layoutVariant: "proof_spotlight", title: "Cases",
      items: [{
        text: "Geweldige service", name: "Jan", role: "Eigenaar", organisation: "ACME",
        media: { kind: "video", source: "youtube", id: "aqz-KE-bpKQ" }, mediaSide: "right",
      }],
    })!;
    assert.ok(html.includes("data-mc-video-facade"), "video facade present");
    assert.ok(html.includes("youtube-nocookie.com"), "nocookie embed src");
    assert.ok(!html.includes("<iframe"), "no iframe before click");
    assert.ok(html.includes("order:1;"), "mediaSide right maps to order 1");
    assert.ok(html.includes("Geweldige service") && html.includes("Eigenaar · ACME"), "quote + attribution");
  });

  it("feature_spotlight without media is byte-identical to the card grid", () => {
    const items = [{ title: "Pakket A", body: "beschrijving" }];
    const spot = renderBlockHtml("feature", { id: "f", layoutVariant: "feature_spotlight", title: "T", items });
    const grid = renderBlockHtml("feature", { id: "f", layoutVariant: "feature_grid_3up", title: "T", items });
    assert.equal(spot, grid);
  });

  it("feature_spotlight with media renders the media/offer split", () => {
    const html = renderBlockHtml("feature", {
      id: "f", layoutVariant: "feature_spotlight", title: "Aanbod",
      items: [{
        title: "Pakket A", body: "alles inbegrepen", price: "vanaf EUR 1.250",
        ctaLabel: "Boek", ctaHref: "/boek",
        media: { kind: "image", url: "https://ex.com/a.jpg", alt: "x" }, mediaSide: "left",
      }],
    })!;
    assert.ok(html.includes('src="https://ex.com/a.jpg"'), "image rendered");
    assert.ok(html.includes("order:-1;"), "mediaSide left maps to order -1");
    assert.ok(html.includes("vanaf EUR 1.250") && html.includes(">Boek<"), "price + CTA");
  });

  // ── Hero layout parity on the snippet ────────────────────────────────────────

  const heroBase = { id: "h", title: "T", subtitle: "S", tag: "New", ctas: [{ label: "Go", href: "/go" }] };

  it("text-only heroes are byte-identical across every layoutVariant", () => {
    const baseline = renderBlockHtml("hero", { ...heroBase, layoutVariant: "" });
    for (const lv of ["hero_default", "hero_split", "hero_background", "hero_page_banner", "hero_editorial"]) {
      assert.equal(renderBlockHtml("hero", { ...heroBase, layoutVariant: lv }), baseline, `layout ${lv}`);
    }
  });

  it("hero_split with media renders a facade split (no iframe before click)", () => {
    const html = renderBlockHtml("hero", {
      ...heroBase, layoutVariant: "hero_split",
      media: { kind: "video", video: { source: "youtube", videoId: "aqz-KE-bpKQ" } },
    })!;
    assert.ok(html.includes("data-mc-video-facade"), "facade");
    assert.ok(html.includes("youtube-nocookie.com"), "nocookie");
    assert.ok(!html.includes("<iframe"), "no iframe before click");
    assert.ok(html.includes("display:flex"), "split layout");
  });

  it("hero_background video is a muted autoplay embed, not a facade", () => {
    const html = renderBlockHtml("hero", {
      ...heroBase, layoutVariant: "hero_background",
      media: { kind: "video", video: { source: "youtube", videoId: "aqz-KE-bpKQ" } },
    })!;
    assert.ok(html.includes("<iframe") && html.includes("autoplay=1") && html.includes("mute=1"), "autoplay muted embed");
    assert.ok(!html.includes("data-mc-video-facade"), "no facade for background");
    assert.ok(html.includes("linear-gradient"), "overlay");
  });

  it("hero_carousel renders the first slide statically", () => {
    const html = renderBlockHtml("hero", {
      ...heroBase, layoutVariant: "hero_carousel",
      slides: [{ heading: "Slide 1", subheading: "Sub 1", media: { kind: "image", url: "https://ex.com/s.jpg", alt: "" } }],
    })!;
    assert.ok(html.includes("Slide 1"), "first slide heading");
    assert.ok(html.includes('src="https://ex.com/s.jpg"'), "first slide media");
  });
});

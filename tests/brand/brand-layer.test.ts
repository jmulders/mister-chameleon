/**
 * The brand layer comes with the preset the operator applied, not with a tenant.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { brandLayerFor } from "@/lib/brand/brand-layer";
import { getDesignPreset, DESIGN_PRESET_GALLERY } from "@/tenant/design-presets-gallery";
import { buildCompleteLookDesign } from "@/lib/design/complete-look";
import { buildAdGalleryDesign } from "@/lib/design/ad-theme";

describe("brand layer follows the applied preset", () => {
  const card = getDesignPreset("mister-chameleon")!;

  it("is on for a design the Mister Chameleon preset was applied to", () => {
    assert.equal(brandLayerFor({ theme: "custom", brandLayer: "mister-chameleon" }), "mister-chameleon");
  });

  it("is off for a design without the flag, whichever tenant it belongs to", () => {
    assert.equal(brandLayerFor({ theme: "custom" }), null);
    assert.equal(brandLayerFor({ theme: "modern-saas" }), null);
    assert.equal(brandLayerFor(null), null);
    assert.equal(brandLayerFor(undefined), null);
  });

  it("is off once the operator switched to a curated theme, even if the flag lingers", () => {
    assert.equal(brandLayerFor({ theme: "modern-saas", brandLayer: "mister-chameleon" }), null);
    assert.equal(brandLayerFor({ theme: "default",     brandLayer: "mister-chameleon" }), null);
  });

  it("ignores a value it does not know", () => {
    const design = { theme: "custom", brandLayer: "something-else" } as unknown as Parameters<typeof brandLayerFor>[0];
    assert.equal(brandLayerFor(design), null);
  });

  it("is switched on by a contextual gallery preset that carries one", () => {
    // A rule picked the Mister Chameleon preset on a tenant that has another look.
    assert.equal(brandLayerFor({ theme: "modern-saas" }, card), "mister-chameleon");
  });

  it("survives a contextual colour preset, so a site that changes colour keeps its shapes", () => {
    // The live site switches gallery presets by time of day. On 14 Nov 2026 the
    // circles vanished whenever such a rule had fired.
    const other = getDesignPreset("aurora-purple-gold")!;
    assert.equal(brandLayerFor({ theme: "custom", brandLayer: "mister-chameleon" }, other), "mister-chameleon");
    // A contextual preset does not switch it on for a tenant that never had it.
    assert.equal(brandLayerFor({ theme: "custom" }, other), null);
    assert.equal(brandLayerFor({ theme: "modern-saas", brandLayer: "mister-chameleon" }, other), null);
  });

  it("is carried by exactly one preset in the gallery", () => {
    const withLayer = DESIGN_PRESET_GALLERY.filter((p) => p.brandLayer).map((p) => p.id);
    assert.deepEqual(withLayer, ["mister-chameleon"]);
  });

  it("is dropped when any look is built, so another preset takes the circles away", () => {
    const withCircles = { theme: "custom" as const, brandLayer: "mister-chameleon" as const };
    const other       = getDesignPreset("aurora-purple-gold")!;
    const next        = buildCompleteLookDesign(withCircles, other.tokenOverrides, other.baseTheme);
    assert.equal(next.brandLayer, undefined);
    assert.equal(brandLayerFor(next), null);
    // The ad look is built the same way and never carries the layer either.
    assert.equal(buildAdGalleryDesign(withCircles, "aurora-purple-gold")!.brandLayer, undefined);
  });

  it("is no longer decided by a tenant id or an environment variable", () => {
    const source = readFileSync("lib/brand/brand-layer.ts", "utf8");
    assert.doesNotMatch(source, /MARKETING_SITE_TENANT|process\.env|tenantId/);
    const layout = readFileSync("app/layout.tsx", "utf8");
    assert.match(layout, /data-brand=\{brandLayerFor\(tenantSettings\?\.design, galleryCard\)/);
  });

  it("is written by the gallery apply when the preset carries one", () => {
    const actions = readFileSync("app/admin/tenants/[tenantId]/actions.ts", "utf8");
    assert.match(actions, /preset\.brandLayer \? \{ brandLayer: preset\.brandLayer \} : \{\}/);
  });
});

describe("the brand stylesheet", () => {
  const css = readFileSync("app/brand/mister-chameleon.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("scopes every rule to the brand attribute, so no other tenant is touched", () => {
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
      .map((m) => m[2]!.trim())
      .filter(Boolean);
    assert.ok(selectors.length > 10, "the stylesheet has rules");
    for (const selector of selectors) {
      // A comma inside :is(…) separates alternatives of one scoped selector,
      // not selectors.
      for (const part of selector.split(/,(?![^()]*\))/)) {
        assert.ok(
          part.trim().startsWith('[data-brand="mister-chameleon"]'),
          `unscoped selector: ${part.trim()}`,
        );
      }
    }
  });

  it("only uses images that exist", () => {
    // Since the footer's bubbles left on 15 Nov 2026 the stylesheet uses no
    // image at all. The check stays for the day one comes back.
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);
    for (const url of urls) {
      assert.doesNotThrow(() => readFileSync(`public${url}`), `missing public${url}`);
    }
  });

  it("leaves the section headings alone", () => {
    // A trail of dots above every heading was tried and taken out again on
    // 13 Nov 2026. It rebuilds the logo's dots into another shape, which the
    // logo manual forbids.
    assert.doesNotMatch(css, /section-heading/);
  });

  describe("the newspaper photo icons", () => {
    const files = readdirSync("public/brand/icoon").filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)).sort();
    const urls  = [...css.matchAll(/\[data-part="feature-icon"\]\[data-icon="([a-z0-9-]+)"\] \{ --mc-photo: url\("\/brand\/icoon\/([a-z0-9-]+)\.png"\); \}/g)];
    const lists = [...css.matchAll(/\[data-part="feature-icon"\]:is\(([^)]*)\)(::after| svg)? \{([^}]*)\}/g)];

    it("have one rule per file and one file per rule", () => {
      // The owner asked on 15 Nov 2026 to carry the black-and-white newspaper
      // photo through to the icons. A rule without a file shows an empty
      // circle; a file without a rule is never shown.
      assert.ok(files.length >= 18, `only ${files.length} icons`);
      assert.deepEqual(urls.map((m) => m[1]!).sort(), files);
      for (const m of urls) assert.equal(m[1], m[2], "the rule points at another icon's file");
    });

    it("name the same icons in every rule that shapes them", () => {
      assert.equal(lists.length, 3, "the circle, its hidden line icon and its small circle");
      for (const m of lists) {
        const named = [...m[1]!.matchAll(/\[data-icon="([a-z0-9-]+)"\]/g)].map((x) => x[1]!).sort();
        assert.deepEqual(named, files);
      }
    });

    it("are a round photo on paper of its own, without the line icon", () => {
      const circle = lists.find((m) => m[2] === undefined)![3]!;
      assert.match(circle, /background-image:\s*var\(--mc-photo\)/);
      assert.match(circle, /background-size:\s*cover/);
      // A light paper, so black ink reads on a dark card as well.
      assert.match(circle, /background-color:\s*#f5efe2 !important/);
      assert.match(lists.find((m) => m[2] === " svg")![3]!, /display:\s*none/);
    });

    it("keep the small circle clear of the photo", () => {
      const circle = lists.find((m) => m[2] === undefined)![3]!;
      const after  = lists.find((m) => m[2] === "::after")![3]!;
      const size   = Number(/width:\s*(\d+)px/.exec(circle)![1]);
      const [left, top, small] = [/left:\s*(-?\d+)px/, /top:\s*(-?\d+)px/, /width:\s*(\d+)px/].map((re) => Number(re.exec(after)![1]));
      const distance = Math.hypot(left! + small! / 2 - size / 2, top! + small! / 2 - size / 2);
      assert.ok(distance >= size / 2 + small! / 2, "the circles overlap");
    });

    it("get the icon's name from the block, in small letters", () => {
      const block = readFileSync("components/blocks/sections/FeatureGridBlock.tsx", "utf8");
      const hooks = block.match(/data-part="feature-icon"/g)!.length;
      assert.equal(block.match(/data-icon=\{iconKey\(feature\.icon\)\}/g)!.length, hooks, "a feature icon without its name");
      assert.match(block, /function iconKey[^}]*toLowerCase\(\)/);
    });
  });

  it("takes the pale box away behind a house image", () => {
    // BlockMediaView paints var(--block-media-bg, …, #f4f4f5) behind its image.
    // A house image is see-through outside its circles, so the box would show.
    const rule = /\[data-brand="mister-chameleon"\] :has\(> img\[src\*="mc-rond-"\]\),\s*\[data-brand="mister-chameleon"\] :has\(> img\[src\*="mc-open-"\]\) \{([^}]*)\}/.exec(css);
    assert.ok(rule, "no rule for the frame of a house image");
    assert.match(rule[1]!, /background:\s*transparent !important/);
    assert.match(readFileSync("components/blocks/media/BlockMediaView.tsx", "utf8"), /background: "var\(--block-media-bg/, "the frame no longer paints a box; the rule may go");
  });

  it("leaves the footer alone", () => {
    // From 14 to 15 Nov 2026 the 21 circles of the business card sat in the
    // footer's corner. The user found them crammed, and the positioned footer
    // hid the buttons of the block above it on a phone (measured on production
    // at 375 px). The bubbles moved into the house images in the CMS.
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /site-footer|mc-bubbels|mc-band/);
    assert.equal(existsSync("public/brand/mc-bubbels.svg"), false);
    for (const file of ["components/layout/footer/FooterCorporate.tsx", "components/layout/footer/FooterMinimal.tsx"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /data-part="site-footer"/, `${file} still carries a hook nothing uses`);
    }
  });

  it("never uses the logo or its mark as decoration", () => {
    // docs/website/huisstijl.md: the mark does not stand on its own, cut off
    // or rotated. The favicon is the mark without the wordmark.
    assert.doesNotMatch(css, /favicon|logo[^']*\.svg/);
    assert.doesNotMatch(css, /rotate\(/);
  });

  it("keeps the circles solid", () => {
    // The house style has no transparent or blended circles.
    assert.doesNotMatch(css, /opacity|color-mix|rgba\(/);
  });

  it("uses the colours of the logo manual", () => {
    const manual = ["#e64415", "#e2001a", "#cb005a", "#a1057d", "#672180", "#00519e", "#006ab3", "#008fd3", "#00989c", "#41a62a", "#bdcd00"];
    const used   = [...css.matchAll(/--mc-[a-z]+:\s*(#[0-9a-f]{6})/g)].map((m) => m[1]!);
    assert.ok(used.length >= 10);
    for (const colour of used) assert.ok(manual.includes(colour), `${colour} is not in the manual`);
  });

  describe("the feature icons", () => {
    const pairs = [...css.matchAll(/nth-child\(6n \+ (\d)\) \{ --mc-icon: var\(--mc-([a-z]+)\);\s+--mc-icon-2: var\(--mc-([a-z]+)\); \}/g)]
      .map((m) => ({ n: Number(m[1]), large: m[2]!, small: m[3]! }));

    it("are a large circle with a smaller one beside it, as on the leaflets", () => {
      // The first version was one 40 px circle with a 20 px icon. On 14 Nov
      // 2026 the user said the icons could be better: it read as a stock set.
      assert.match(css, /\[data-part="feature-icon"\] \{[^}]*width: 56px !important/);
      assert.match(css, /\[data-part="feature-icon"\]::after \{[^}]*width: 16px/);
      assert.equal(pairs.length, 6, "six cards, six pairs");
      for (const pair of pairs) assert.notEqual(pair.large, pair.small, `card ${pair.n} has two circles of one colour`);
      assert.equal(new Set(pairs.map((p) => p.large)).size, 6, "six different large circles");
    });

    it("only put the white icon on a colour that carries it", () => {
      // White on these is at least 3.5 : 1; the bar for a graphic is 3 : 1.
      const carriesWhite = ["magenta", "navy", "teal", "plum", "blue", "purple", "red"];
      for (const pair of pairs) assert.ok(carriesWhite.includes(pair.large), `${pair.large} is too light for a white icon`);
    });

    it("keep the small circle clear of the large one", () => {
      // Large: centre 28,28 radius 28. Small: 16 px across at left 51, top -2.
      const after = /\[data-part="feature-icon"\]::after \{[^}]*left: (-?\d+)px;[^}]*top: (-?\d+)px;[^}]*width: (\d+)px/.exec(css)!;
      const [left, top, size] = [Number(after[1]), Number(after[2]), Number(after[3])];
      const distance = Math.hypot(left + size / 2 - 28, top + size / 2 - 28);
      assert.ok(distance >= 28 + size / 2, "the circles overlap");
      assert.ok(distance <= 28 + size / 2 + 6, "the small circle drifted away from the large one");
    });
  });

  it("gives the transparent images a sheet of paper where the ground is dark", () => {
    // The images are black ink with see-through whites. On the evening preset
    // (midnight-amber, #1a150c) the ink would vanish without this.
    const sheet = /\[data-brand="mister-chameleon"\]\[data-scheme="dark"\] img\[src\*="mc-open-"\] \{([^}]*)\}/.exec(css);
    assert.ok(sheet, "no sheet for a see-through image on a dark page");
    assert.match(sheet[1]!, /background-color:\s*var\(--foreground/);
    // An image on its own paper (mc-rond-) needs no sheet, and the images of
    // before 16 Nov 2026 are gone.
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(rules, /data-scheme="dark"\] img\[src\*="mc-rond-"/);
    assert.doesNotMatch(rules, /mc-gravure-|mc-foto-|mc-kop-/);
    const layout = readFileSync("app/layout.tsx", "utf8");
    assert.match(layout, /data-scheme=\{schemeFor\(/);
  });

  it("switches its movement off for visitors who ask for less motion", () => {
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
});

describe("the hooks the stylesheet relies on", () => {
  // A hyphenated attribute such as data-part passes the type check on any
  // component, but a component only passes on the props it knows. On 13 Nov
  // 2026 `data-part="feature-card"` sat on <Stack>, never reached the page, and
  // every feature icon got the same fallback colour.
  const files = [
    "components/primitives/Text.tsx",
    "components/primitives/Section.tsx",
    "components/primitives/Stack.tsx",
    "components/blocks/sections/ProcessStepsBlock.tsx",
    "components/blocks/sections/FeatureGridBlock.tsx",
    "components/blocks/sections/CtaSectionBlock.tsx",
    "components/layout/footer/FooterCorporate.tsx",
    "components/layout/footer/FooterMinimal.tsx",
  ];

  it("never writes data-part on a component, only on a real element", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // The opening tag of a component (capital first letter) up to its data-part.
      const onComponent = /<([A-Z][A-Za-z0-9.]*)\b(?:(?!<[A-Za-z/]|\/>)[\s\S])*?\sdata-part=/g;
      // `Tag` is the primitives' own variable for the element they render
      // ("section", "div", "h2"), so an attribute on it does reach the page.
      const hits = [...source.matchAll(onComponent)].map((m) => m[1]).filter((name) => name !== "Tag");
      assert.deepEqual(hits, [], `${file}: data-part on <${hits.join(">, <")}> is dropped; use the part prop`);
    }
  });

  it("gives every part the stylesheet styles a place in the blocks", () => {
    const css      = readFileSync("app/brand/mister-chameleon.css", "utf8");
    const styled   = new Set([...css.matchAll(/data-part="([a-z-]+)"/g)].map((m) => m[1]!));
    const sources  = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const part of styled) {
      const provided =
        sources.includes(`data-part="${part}"`) ||
        sources.includes(`part="${part}"`)      ||
        sources.includes(`"data-part": "${part}"`);
      assert.ok(provided, `no block provides data-part="${part}"`);
    }
  });
});

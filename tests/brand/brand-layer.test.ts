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
    const lists = [...css.matchAll(/\[data-part="feature-icon"\]:is\(([^)]*)\)(::before|::after| svg)? \{([^}]*)\}/g)];
    const rule  = (part: string | undefined) => lists.find((m) => m[2] === part)![3]!;
    const px    = (text: string, name: string) => Number(new RegExp(`(?:^|[\\s;])${name}:\\s*(-?\\d+)px`).exec(text)![1]);

    // The eight ways the coloured circles stand around the photo. Each is up to
    // three circles as x, y and radius on the canvas; a radius of 0 is no circle.
    const layouts = [...css.matchAll(/nth-child\(8n \+ (\d)\) \{([^}]*)\}/g)].map((m) => ({
      n: Number(m[1]),
      circles: [1, 2, 3]
        .map((i) => ({ x: px(m[2]!, `--mc-x${i}`), y: px(m[2]!, `--mc-y${i}`), r: px(m[2]!, `--mc-r${i}`) }))
        .filter((c) => c.r > 0),
    }));
    const sets = [...css.matchAll(/nth-child\(7n \+ (\d)\) \{ --mc-a: var\(--mc-([a-z]+)\); --mc-b: var\(--mc-([a-z]+)\); --mc-c: var\(--mc-([a-z]+)\); \}/g)]
      .map((m) => ({ n: Number(m[1]), colours: [m[2]!, m[3]!, m[4]!] }));
    // The canvas and the photo on it.
    const canvas = () => {
      const after = rule("::after");
      const size  = px(rule(undefined), "width");
      return {
        width: px(after, "width"), height: px(after, "height"),
        cx: -px(after, "left") + size / 2, cy: -px(after, "top") + size / 2, radius: size / 2,
        below: px(after, "top") + px(after, "height") - size,
      };
    };

    it("have one rule per file and one file per rule", () => {
      // The owner asked on 15 Nov 2026 to carry the black-and-white newspaper
      // photo through to the icons. A rule without a file shows an empty
      // circle; a file without a rule is never shown.
      assert.ok(files.length >= 18, `only ${files.length} icons`);
      assert.deepEqual(urls.map((m) => m[1]!).sort(), files);
      for (const m of urls) assert.equal(m[1], m[2], "the rule points at another icon's file");
    });

    it("name the same icons in every rule that shapes them", () => {
      assert.equal(lists.length, 4, "the box, its hidden line icon, the photo and the canvas of circles");
      for (const m of lists) {
        const named = [...m[1]!.matchAll(/\[data-icon="([a-z0-9-]+)"\]/g)].map((x) => x[1]!).sort();
        assert.deepEqual(named, files);
      }
    });

    it("are a round photo on paper of its own, without the line icon", () => {
      const photo = rule("::before");
      assert.match(photo, /background-image:\s*var\(--mc-photo\)/);
      assert.match(photo, /background-size:\s*cover/);
      assert.match(photo, /border-radius:\s*9999px/);
      // A light paper, so black ink reads on a dark card as well.
      assert.match(photo, /background-color:\s*#f5efe2/);
      assert.match(rule(" svg"), /display:\s*none/);
    });

    it("let the circles show through the photo and nothing else", () => {
      // The photo is multiplied over the circles behind it, as ink on coloured
      // paper. The box is its own group, or the photo would also be multiplied
      // over the card and lose its paper on a dark one.
      assert.match(rule("::before"), /mix-blend-mode:\s*multiply/);
      assert.match(rule(undefined), /isolation:\s*isolate/);
      assert.match(rule(undefined), /background-color:\s*transparent !important/);
      const layer = (text: string) => Number(/z-index:\s*(\d+)/.exec(text)![1]);
      assert.ok(layer(rule("::before")) > layer(rule("::after")), "the photo lies under its circles");
    });

    it("have two or three coloured circles, in eight different ways", () => {
      // The owner on 22 Nov 2026: every icon had the same small circle at the
      // same shoulder. Vary the place, the number and the colour.
      assert.deepEqual(layouts.map((l) => l.n), [1, 2, 3, 4, 5, 6, 7, 8]);
      for (const l of layouts) assert.ok(l.circles.length === 2 || l.circles.length === 3, `layout ${l.n} has ${l.circles.length} circles`);
      assert.ok(layouts.some((l) => l.circles.length === 2) && layouts.some((l) => l.circles.length === 3), "the number never changes");
      // The largest circle stands somewhere else in every layout: no two within 15 px.
      const large = layouts.map((l) => l.circles[0]!);
      for (const [i, a] of large.entries()) for (const b of large.slice(i + 1)) {
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 15, "two layouts put their large circle in the same place");
      }
    });

    it("lay a circle half behind the photo in every layout", () => {
      const { cx, cy, radius } = canvas();
      for (const l of layouts) {
        const gaps = l.circles.map((c) => ({ c, d: Math.hypot(c.x - cx, c.y - cy) }));
        // Behind the photo by at least 3 px and out from under it by at least 5.
        assert.ok(gaps.some(({ c, d }) => d <= radius + c.r - 3 && d + c.r - radius >= 5), `layout ${l.n} has no circle behind the photo`);
        // No circle that only just touches the photo: behind it, or 2 px clear.
        for (const { c, d } of gaps) assert.ok(d <= radius + c.r - 3 || d >= radius + c.r + 2, `layout ${l.n} has a circle that only touches the photo`);
      }
    });

    it("keep the circles on their canvas, off each other and off the title", () => {
      const { width, height, below } = canvas();
      // What is painted outside the canvas is cut off as a flat edge.
      for (const l of layouts) for (const c of l.circles) {
        assert.ok(c.x - c.r >= 0 && c.x + c.r <= width && c.y - c.r >= 0 && c.y + c.r <= height, `layout ${l.n} has a circle off its canvas`);
      }
      for (const l of layouts) for (const [i, a] of l.circles.entries()) for (const b of l.circles.slice(i + 1)) {
        assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r + 2, `layout ${l.n} has two coloured circles that touch`);
      }
      assert.ok(below <= 8, "the canvas reaches the title under the icon");
    });

    it("change colour on another beat than they change place", () => {
      const defined = new Set([...css.matchAll(/--mc-([a-z]+):\s*#[0-9a-f]{6}/g)].map((m) => m[1]!));
      assert.deepEqual(sets.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
      for (const s of sets) {
        assert.equal(new Set(s.colours).size, 3, `set ${s.n} uses a colour twice`);
        for (const colour of s.colours) assert.ok(defined.has(colour), `--mc-${colour} is not a colour of the house`);
      }
      assert.equal(new Set(sets.map((s) => s.colours[0])).size, 7, "two sets start with the same colour");
      // Seven sets against eight layouts: the same pair returns after 56 cards.
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      assert.equal(gcd(sets.length, layouts.length), 1);
    });

    it("paint a circle that is left out as nothing, in Safari as well", () => {
      // Found on an iPhone on 22 Nov 2026: a layout with two circles gives the
      // third a radius of 0. Drawn as a gradient over the whole canvas with its
      // stops at the radius, that came to stops at -0.5px and 0px, and Safari
      // filled the canvas with the third colour. Each circle now fills a square
      // of its own size, and a square of 0 by 0 is not painted.
      const after = rule("::after");
      assert.equal((after.match(/radial-gradient\(closest-side, var\(--mc-[abc]\) calc\(100% - 0\.5px\), transparent\)/g) ?? []).length, 3);
      assert.doesNotMatch(after, /circle at|calc\(var\(--mc-r\d\) - /, "a circle is drawn over the whole canvas again");
      for (const i of [1, 2, 3]) {
        assert.ok(after.includes(`calc(2 * var(--mc-r${i})) calc(2 * var(--mc-r${i}))`), `circle ${i} has no size of its own`);
        assert.ok(after.includes(`calc(var(--mc-x${i}) - var(--mc-r${i})) calc(var(--mc-y${i}) - var(--mc-r${i}))`), `circle ${i} is not placed by its centre`);
      }
      assert.match(after, /background-repeat:\s*no-repeat/);
    });

    it("hand the layout down from the card, not from the icon", () => {
      // Found on 22 Nov 2026: a default set on the icon itself won from the
      // value the card hands down, so every icon got the first layout.
      assert.doesNotMatch(css, /\[data-part="feature-icon"\][^{]*\{[^}]*--mc-(x1|a):/);
      assert.match(css, /\[data-brand="mister-chameleon"\] \{[^}]*--mc-x1:[^}]*--mc-a:/);
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
    // The house style has no transparent or faded circles. A photo may let the
    // circle behind it show through; the circle itself stays one full colour.
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

  it("gives sections less room above and below than the gallery's presets", () => {
    // The owner on 19 Nov 2026: a lot of empty room between the blocks on
    // /hoe-het-werkt. The gallery's presets all bring clamp(56px, 8vw, 128px);
    // at 1440 px wide that is 115 px, so 230 px between two sections.
    const rule = /\[data-brand="mister-chameleon"\] \[data-site\] \{\s*--section-py:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\);\s*\}/.exec(css);
    assert.ok(rule, "no section rhythm for the house style");
    const [min, vw, max] = [Number(rule[1]), Number(rule[2]), Number(rule[3])];
    assert.ok(max <= 72, "the room on a wide screen crept up again");
    assert.ok(min >= 32, "sections must not touch on a phone");
    assert.ok(Math.min(max, 14.4 * vw) <= 72, "at 1440 px wide it stays at 72 px or under");
    // The token is read by the Section primitive; if that changes, this rule does nothing.
    assert.match(readFileSync("components/primitives/Section.tsx", "utf8"), /var\(--section-py,/);
    // The preset itself agrees, so a tenant who applies it gets the same rhythm.
    const preset = getDesignPreset("mister-chameleon")!;
    assert.equal(JSON.stringify(preset).includes(`clamp(${min}px,${vw}vw,${max}px)`), true, "the preset and the brand layer disagree");
  });

  it("sets the text sections of an article or a case closer together", () => {
    // The owner on 25 Nov 2026: an article is full of white. Two text sections
    // sat 128 px apart on a wide screen. Inside an article they get half.
    const site = /\[data-brand="mister-chameleon"\] \[data-site\] \{\s*--section-py:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\);\s*\}/.exec(css)!;
    const rule = /\[data-brand="mister-chameleon"\] main:is\(\[data-page-kind="article"\], \[data-page-kind="case"\]\) \[data-part="text-section"\] \{\s*--section-py:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\);\s*\}/.exec(css);
    assert.ok(rule, "no rhythm for the text sections of an article");
    const [min, max] = [Number(rule[1]), Number(rule[3])];
    assert.ok(max * 2 <= Number(site[3]), "an article keeps at most half the room of a landing page");
    // Stack gap 6 puts 24 px between a title and its text. The room between two
    // sections must stay clearly above that, or a new title no longer reads as
    // a new part.
    assert.ok(min * 2 >= 36, "on a phone two sections run into each other");
    // The three hooks the rule hangs on. Without any of them it does nothing.
    const block = readFileSync("components/blocks/sections/TextSectionBlock.tsx", "utf8");
    assert.equal(block.match(/<Section part="text-section"/g)?.length, block.match(/<Section /g)?.length, "a text section variant lost its hook");
    assert.match(readFileSync("app/(site)/blog/[slug]/page.tsx", "utf8"), /<main data-page-kind="article">/);
    // A case under /cases is built like an article and shares the rule.
    assert.match(readFileSync("app/(site)/cases/[slug]/page.tsx", "utf8"), /<main data-page-kind="case">/);
    assert.match(readFileSync("components/primitives/Section.tsx", "utf8"), /data-part=\{part\}/);
  });

  it("keeps a hero headline of twenty characters on one line", () => {
    const css = readFileSync("app/brand/mister-chameleon.css", "utf8");
    // The column the split hero gives its headline, measured on production on
    // 21 Nov 2026, and the size the stylesheet sets at that width.
    const base = /\[data-part="display-title"\] \{\s*font-size: clamp\(([\d.]+)rem, ([\d.]+)vw, ([\d.]+)rem\) !important;/.exec(css);
    assert.ok(base, "the headline has a size of its own");
    const at1024 = /min-width: 1024px\) \{\s*\[data-brand="mister-chameleon"\] \[data-part="display-title"\] \{ font-size: ([\d.]+)rem/.exec(css);
    const at1280 = /min-width: 1280px\) \{\s*\[data-brand="mister-chameleon"\] \[data-part="display-title"\]:not\(\[data-align="center"\]\) \{ font-size: ([\d.]+)rem/.exec(css);
    assert.ok(at1024 && at1280, "the headline has a size for a wide screen");
    const WIDE_BOLD = 0.62;  // em a character, a wide bold face such as Montserrat
    const fits = (px: number, column: number) => 20 * WIDE_BOLD * px <= column;
    const vw = Number(base[2]), cap = Number(base[3]) * 16;
    assert.ok(fits(Math.min(cap, 375 * vw / 100), 343), "on a phone");
    assert.ok(fits(Math.min(cap, 768 * vw / 100), 384), "at 768");
    assert.ok(fits(Number(at1024[1]) * 16, 416), "at 1024");
    assert.ok(fits(Number(at1280[1]) * 16, 480), "from 1280");
  });

  it("keeps a headline of twenty-five capitals on one line", () => {
    const css = readFileSync("app/brand/mister-chameleon.css", "utf8");
    // "VIER KLANTEN, ÉÉN VERHAAL" in Montserrat 800, measured on production on
    // 22 Nov 2026 in the presets with capitals: 16.1 em.
    const LONGEST = 16.1;
    const caps = '\\[data-brand="mister-chameleon"\\]\\[data-headings="caps"\\] \\[data-part="display-title"\\]';
    const base = new RegExp(caps + " \\{\\s*font-size: clamp\\(([\\d.]+)rem, calc\\(\\(100vw - (\\d+)px\\) / ([\\d.]+)\\), ([\\d.]+)rem\\) !important;").exec(css);
    assert.ok(base, "capitals have a size of their own");
    const at1024 = new RegExp("min-width: 1024px\\) \\{\\s*" + caps + " \\{ font-size: ([\\d.]+)rem").exec(css);
    const at1280 = new RegExp("min-width: 1280px\\) \\{\\s*" + caps + ':not\\(\\[data-align="center"\\]\\) \\{ font-size: ([\\d.]+)rem').exec(css);
    assert.ok(at1024 && at1280, "capitals have a size for a wide screen");
    const [floor, gutters, divisor, cap] = [Number(base[1]) * 16, Number(base[2]), Number(base[3]), Number(base[4]) * 16];
    const sizeAt = (viewport: number) => Math.min(cap, Math.max(floor, (viewport - gutters) / divisor));
    // The column is the viewport less two gutters of 16 px on a phone, 384 px at 768.
    for (const viewport of [360, 375, 390, 414]) {
      assert.ok(LONGEST * sizeAt(viewport) <= viewport - 32, `on a phone of ${viewport} px`);
    }
    assert.ok(LONGEST * sizeAt(768) <= 384, "at 768");
    assert.ok(LONGEST * Number(at1024[1]) * 16 <= 416, "at 1024");
    assert.ok(LONGEST * Number(at1280[1]) * 16 <= 480, "from 1280");
    // A centred hero has the full width and keeps its large size on a wide screen.
    assert.match(css, new RegExp("min-width: 1024px\\) \\{[^}]*\\}\\s*" + caps + '\\[data-align="center"\\] \\{ font-size: 3rem'));
    // The layout tells the stylesheet when headings are in capitals.
    assert.match(readFileSync("app/layout.tsx", "utf8"), /data-headings=\{resolvedTheme\.vars\["--block-heading-transform"\] === "uppercase" \? "caps" : undefined\}/);
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
    "components/blocks/sections/TextSectionBlock.tsx",
    "components/blocks/sections/ArticleMetaBlock.tsx",
    "components/blocks/NotificationBlock.tsx",
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

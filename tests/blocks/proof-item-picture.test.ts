/**
 * A point in the proof block can carry a picture of its own.
 *
 * The owner asked on 25 Nov 2026 to give the content per context pictures where
 * that is possible. A proof block is three short points, title and text. The
 * spotlight layout takes pictures but shows one point at a time and leaves the
 * titles out, so the three-column layout learned to show a picture instead.
 *
 * The component is a .tsx file, which this test runner cannot import, so those
 * checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stillPicture } from "@/lib/media/block-media";
import { adaptiveItemToProofItem } from "@/lib/blocks/adaptive-item-to-block";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";

const URL = "https://cms.example.test/assets/scale.svg";

describe("stillPicture", () => {
  it("gives the address and the alt text of an image", () => {
    assert.deepEqual(stillPicture({ kind: "image", url: URL, alt: "A scale" }), { url: URL, alt: "A scale" });
    // Decoration has an empty alt, so a screen reader skips it.
    assert.deepEqual(stillPicture({ kind: "image", url: ` ${URL} ` }), { url: URL, alt: "" });
  });

  it("gives nothing for no media, an empty address, a video or an embed", () => {
    assert.equal(stillPicture(undefined), null);
    assert.equal(stillPicture(null), null);
    assert.equal(stillPicture({ kind: "image", url: "  " }), null);
    assert.equal(stillPicture({ kind: "video", url: "https://cms.example.test/a.mp4" }), null);
    assert.equal(stillPicture({ kind: "image", source: "youtube", id: "abc" }), null);
  });
});

describe("proof block, three columns", () => {
  const source  = readFileSync("components/blocks/ProofBlock.tsx", "utf8");
  const columns = source.slice(source.indexOf("// ── proof_stats (default)"));

  it("keeps the picture of an item on its way from the stored variant", () => {
    const item = adaptiveItemToProofItem({ title: "Measured", text: "With a control group.", media: { kind: "image", url: URL, alt: "" } });
    assert.deepEqual(stillPicture(item.media), { url: URL, alt: "" });
  });

  it("shows the picture above the title, the same size for every point", () => {
    assert.match(columns, /const picture = stillPicture\(item\.media\);/);
    const picture = columns.indexOf('data-part="proof-item-picture"');
    const title   = columns.indexOf("{item.title}", picture);
    assert.ok(picture > 0 && title > picture, "the picture must come before the title");
    const classes = /data-part="proof-item-picture"[\s\S]*?className="([^"]+)"/.exec(columns)![1].split(" ");
    // A fixed box and never cropped: the pictures are round and must stay whole.
    assert.ok(classes.includes("aspect-[16/9]") && classes.includes("w-60") && classes.includes("object-contain"));
    // A narrow column must not be pushed wider by the picture.
    assert.ok(classes.includes("max-w-full"));
  });

  it("draws nothing extra for a point without a picture", () => {
    assert.match(columns, /\{picture && \(/);
  });

  it("does not hold up the page for a picture below the fold", () => {
    assert.match(columns, /data-part="proof-item-picture"[\s\S]*?loading="lazy"/);
  });
});

describe("proof block in the snippet", () => {
  const items = [
    { title: "Measured", text: "With a control group.", media: { kind: "image" as const, url: URL, alt: "" } },
    { title: "Plain",    text: "No picture here." },
  ];

  it("shows the picture of a point in the card grid", () => {
    const html = renderBlockHtml("proof", { id: "p", title: "T", items })!;
    assert.equal(html.match(/<img /g)?.length, 1, "one picture, for the one point that has one");
    assert.match(html, new RegExp(`<img src="${URL}" alt=""`));
    assert.ok(html.indexOf("<img ") < html.indexOf("Measured"), "the picture stands above the title");
    assert.match(html, /object-fit:contain/);
  });

  it("is the card grid it was for points without a picture", () => {
    const plain = [{ title: "A", text: "a" }, { title: "B", text: "b" }];
    const html  = renderBlockHtml("proof", { id: "p", title: "T", items: plain })!;
    assert.doesNotMatch(html, /<img/);
  });

  it("escapes the address and the alt text", () => {
    const html = renderBlockHtml("proof", {
      id: "p", title: "T",
      items: [{ title: "A", text: "a", media: { kind: "image" as const, url: 'https://x.test/a.svg" onerror="x', alt: '"><script>' } }],
    })!;
    assert.doesNotMatch(html, /onerror="x/);
    assert.doesNotMatch(html, /<script>/);
  });
});

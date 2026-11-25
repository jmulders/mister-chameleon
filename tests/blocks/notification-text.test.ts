/**
 * A notification says what it is about, and its parts read as one message.
 *
 * On 25 Nov 2026 the owner found the toast for a returning visitor neither
 * good-looking nor logical. It showed a title ("Fijn dat je er weer bent") and
 * a button ("Naar de kennisbank"), and nothing that tied the two together. The
 * block did hold that line, as its subtitle. The mapper dropped it.
 *
 * The button also stood under the whole row, at the left edge under the image,
 * and the ground was a fixed blue that belongs to none of the site's themes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adaptiveVariantToNotificationData } from "@/lib/blocks/adaptive-variant-to-overlay";
import type { AdaptiveVariantContent } from "@/cms/types";

const block = readFileSync("components/blocks/NotificationBlock.tsx", "utf8");
const toast = block.slice(block.indexOf("// ── Corner toast"));

describe("notification, the line under the message", () => {
  const content = {
    title:    "Lees verder in de kennisbank",
    subtitle: "Artikelen over regels, meten en testen.",
    ctas:     [{ label: "Naar de kennisbank", href: "/kennisbank" }],
  } as AdaptiveVariantContent;

  it("carries the subtitle of the block as the text", () => {
    const data = adaptiveVariantToNotificationData(content, "notification_returning");
    assert.equal(data?.message, "Lees verder in de kennisbank");
    assert.equal(data?.text, "Artikelen over regels, meten en testen.");
  });

  it("leaves the text out when the block has no subtitle", () => {
    const data = adaptiveVariantToNotificationData({ ...content, subtitle: "" } as AdaptiveVariantContent, "k");
    assert.ok(data);
    assert.ok(!("text" in data), "an empty text must not reach the component");
  });

  it("reaches the component on a page", () => {
    const renderer = readFileSync("components/platform/TemplateRenderer.tsx", "utf8");
    assert.match(renderer, /text=\{effectiveContextData\.notification\.text\}/);
  });

  it("is shown under the message, and only when there is one", () => {
    assert.match(block, /\{text && <p className="font-normal[^"]*">\{text\}<\/p>\}/);
  });
});

describe("notification, the toast in a corner", () => {
  it("puts the button in the column of the text, not under the image", () => {
    const column = /<div className="flex min-w-0 flex-1 flex-col gap-1">([\s\S]*?)<\/div>\s*\{sideRight/.exec(toast);
    assert.ok(column, "the toast has no text column");
    assert.match(column[1]!, /\{body\}/);
    assert.match(column[1]!, /\{cta && /);
  });

  it("is one row: media, text, close", () => {
    assert.match(toast, /flex max-w-\[min\(24rem,calc\(100vw-2\.5rem\)\)\] items-start gap-3/);
    assert.doesNotMatch(toast, /flex-col gap-2 rounded-xl/);
  });
});

describe("notification, hooks for a brand layer", () => {
  it("names the notification, its severity and its position", () => {
    assert.match(block, /const hooks = \{ "data-part": "notification", "data-severity": severity, "data-position": pos \}/);
    // One modal, two banners and the toast.
    assert.equal(block.match(/\{\.\.\.hooks\}/g)?.length, 4);
    assert.match(block, /data-part="notification-cta"/);
    assert.match(block, /data-part="notification-dismiss"/);
  });

  it("gives a toast and a pop-up the card of the theme on misterchameleon.nl", () => {
    const css = readFileSync("app/brand/mister-chameleon.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = /\[data-part="notification"\]\[data-severity="info"\]:is\(\[data-position="left"\], \[data-position="right"\], \[data-position="center"\]\) \{([^}]*)\}/.exec(css);
    assert.ok(rule, "the brand layer has no rule for the notification");
    assert.match(rule[1]!, /background: var\(--card-bg/);
    assert.match(rule[1]!, /color: var\(--text/);
    // No colour of its own: every value comes from the theme.
    assert.doesNotMatch(rule[1]!.replace(/var\([^)]*\)\)?/g, "").replace(/rgb\(0 0 0 \/ [0-9.]+\)/g, ""), /#[0-9a-f]{3,6}|rgb\(/i);
  });

  it("leaves a full-width banner and the other severities alone", () => {
    const css = readFileSync("app/brand/mister-chameleon.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const line of css.split("\n").filter((l) => l.includes('[data-part="notification"]'))) {
      assert.match(line, /\[data-severity="info"\]:is\(\[data-position="left"\], \[data-position="right"\], \[data-position="center"\]\)/);
    }
  });
});

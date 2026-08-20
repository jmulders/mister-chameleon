/**
 * Book-demo snippet fallback — localization + author-CTA-wins injection.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { bookDemoHref, bookDemoLabel, withBookDemoFallback } from "@/lib/snippet/book-demo-fallback";
import type { ConversionBlockData } from "@/cms/types";

const ORIGIN = "https://app.example.com";

function conv(over: Partial<ConversionBlockData> = {}): ConversionBlockData {
  return { id: "c", title: "T", text: "x", ctas: [], ...over } as ConversionBlockData;
}

describe("book-demo href + label localization", () => {
  it("default locale has no prefix and English label", () => {
    assert.equal(bookDemoHref(ORIGIN, "en"), "https://app.example.com/book-demo");
    assert.equal(bookDemoLabel("en"), "Book a Demo");
  });
  it("nl uses the /nl prefix and Dutch label", () => {
    assert.equal(bookDemoHref(ORIGIN, "nl"), "https://app.example.com/nl/book-demo");
    assert.equal(bookDemoLabel("nl"), "Boek een demo");
  });
  it("de uses the /de prefix and German label", () => {
    assert.equal(bookDemoHref(ORIGIN, "de"), "https://app.example.com/de/book-demo");
    assert.equal(bookDemoLabel("de"), "Demo buchen");
  });
  it("an unknown locale falls back to the default label", () => {
    assert.equal(bookDemoLabel("fr"), "Book a Demo");
  });
});

describe("withBookDemoFallback", () => {
  it("injects a localized booking CTA for a book-demo block with no CTA", () => {
    const out = withBookDemoFallback(conv({ formKey: "book-demo", ctas: [] }), "nl", ORIGIN);
    assert.deepEqual(out.ctas, [{ label: "Boek een demo", href: "https://app.example.com/nl/book-demo" }]);
  });
  it("leaves an author-supplied CTA untouched (author wins)", () => {
    const authored = [{ label: "Plan gesprek", href: "/afspraak" }];
    const out = withBookDemoFallback(conv({ formKey: "book-demo", ctas: authored }), "nl", ORIGIN);
    assert.deepEqual(out.ctas, authored);
  });
  it("does nothing for a non book-demo conversion", () => {
    const input = conv({ formKey: "contact", ctas: [] });
    const out = withBookDemoFallback(input, "nl", ORIGIN);
    assert.equal(out, input);
  });
  it("does nothing when there is no formKey", () => {
    const input = conv({ ctas: [] });
    const out = withBookDemoFallback(input, "nl", ORIGIN);
    assert.equal(out, input);
  });
});

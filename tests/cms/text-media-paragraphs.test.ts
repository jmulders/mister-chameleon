/**
 * The text beside an image can have more than one paragraph.
 *
 * The owner found the texts on the site terse (19 Nov 2026) and asked for a
 * paragraph with an example in every block. The body of such a block is plain
 * text from a textarea; until then it became one paragraph whatever it held.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { plainTextToParagraphs } from "@/cms/mappers/page-config-mapper";

const texts = (body: string) =>
  (plainTextToParagraphs(body) ?? []).map((b) => (b as unknown as { children: Array<{ text: string }> }).children[0]!.text);

describe("text beside an image: paragraphs", () => {
  it("keeps a body without a blank line as one paragraph, as before", () => {
    const blocks = plainTextToParagraphs("Een regel is een zin in gewone taal.")!;
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0], {
      _type: "block", _key: "b0", style: "normal", markDefs: [],
      children: [{ _type: "span", _key: "s0", text: "Een regel is een zin in gewone taal.", marks: [] }],
    });
  });

  it("makes a paragraph of each block of text that a blank line sets apart", () => {
    assert.deepEqual(texts("De uitleg.\n\nHet voorbeeld."), ["De uitleg.", "Het voorbeeld."]);
    assert.deepEqual(texts("Een.\r\n\r\nTwee.\n \t\nDrie."), ["Een.", "Twee.", "Drie."]);
    assert.deepEqual(plainTextToParagraphs("Een.\n\nTwee.")!.map((b) => (b as unknown as { _key: string })._key), ["b0", "b1"]);
  });

  it("keeps a single line break inside its paragraph", () => {
    assert.deepEqual(texts("Regel een\nloopt hier door.\n\nNieuwe alinea."), ["Regel een loopt hier door.", "Nieuwe alinea."]);
  });

  it("drops empty paragraphs and gives nothing for a body without text", () => {
    assert.deepEqual(texts("\n\nAlleen dit.\n\n\n\n"), ["Alleen dit."]);
    assert.equal(plainTextToParagraphs("  \n\n \n"), undefined);
  });
});

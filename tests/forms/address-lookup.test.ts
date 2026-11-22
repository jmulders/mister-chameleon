/**
 * A form with a postcode and a house number fills in the street and the town.
 *
 * In the Netherlands a postcode with a house number decides the street and the
 * town. The form looks them up (PDOK, the national address register), fills
 * them in, and tells the visitor when the combination does not exist. When the
 * register does not answer, the form carries on without the check.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addressFieldKeys,
  lookupDutchAddress,
  resetAddressLookupMemory,
} from "../../lib/forms/address-lookup.ts";

type Doc = { straatnaam?: string; woonplaatsnaam?: string; postcode?: string; huisnummer?: number };

/** A stand-in for PDOK that records what it was asked. */
function pdok(docs: Doc[] | "down" | "broken" | "throws") {
  const asked: URL[] = [];
  const fetchImpl = (async (url: string | URL) => {
    asked.push(new URL(String(url)));
    if (docs === "throws") throw new Error("network");
    if (docs === "down") return new Response("", { status: 503 });
    if (docs === "broken") return new Response(JSON.stringify({ nothing: true }), { status: 200 });
    return new Response(JSON.stringify({ response: { numFound: docs.length, docs } }), { status: 200 });
  }) as typeof fetch;
  return { asked, fetchImpl };
}

const BINNENHOF: Doc = { straatnaam: "Binnenhof", woonplaatsnaam: "'s-Gravenhage", postcode: "2513AA", huisnummer: 20 };

beforeEach(() => resetAddressLookupMemory());

describe("addressFieldKeys", () => {
  it("finds the postcode and house-number fields by their keys", () => {
    assert.deepEqual(addressFieldKeys(["name", "postcode", "huisnummer", "email"]), { postcode: "postcode", houseNumber: "huisnummer" });
    assert.deepEqual(addressFieldKeys(["postal_code", "house_number"]), { postcode: "postal_code", houseNumber: "house_number" });
    assert.deepEqual(addressFieldKeys(["Postcode", "Huisnr"]), { postcode: "Postcode", houseNumber: "Huisnr" });
  });

  it("finds the street and town fields when the form has them", () => {
    assert.deepEqual(addressFieldKeys(["postcode", "huisnummer", "straat", "woonplaats"]), {
      postcode: "postcode", houseNumber: "huisnummer", street: "straat", city: "woonplaats",
    });
    assert.deepEqual(addressFieldKeys(["zip", "house_number", "street", "city"]), {
      postcode: "zip", houseNumber: "house_number", street: "street", city: "city",
    });
    assert.deepEqual(addressFieldKeys(["postcode", "huisnummer", "straatnaam", "plaats"]), {
      postcode: "postcode", houseNumber: "huisnummer", street: "straatnaam", city: "plaats",
    });
  });

  it("has nothing to look up without both a postcode and a house number", () => {
    assert.equal(addressFieldKeys(["name", "email", "message"]), null);
    assert.equal(addressFieldKeys(["postcode", "woonplaats"]), null);
    assert.equal(addressFieldKeys(["huisnummer", "straat"]), null);
    assert.equal(addressFieldKeys([]), null);
  });

  it("does not take a field for something it is not", () => {
    // "capacity" holds "city", "werkplaatsen" holds "plaats": neither is a town field.
    assert.deepEqual(addressFieldKeys(["postcode", "huisnummer", "capacity", "werkplaatsen"]), { postcode: "postcode", houseNumber: "huisnummer" });
  });
});

describe("lookupDutchAddress", () => {
  it("gives the street and the town of an address that exists", async () => {
    const p = pdok([BINNENHOF]);
    const out = await lookupDutchAddress("2513 aa", "20", { fetchImpl: p.fetchImpl });
    assert.deepEqual(out, { status: "ok", postcode: "2513AA", houseNumber: "20", street: "Binnenhof", city: "'s-Gravenhage" });
  });

  it("asks the address register for exactly this postcode and number, addresses only", async () => {
    const p = pdok([BINNENHOF]);
    await lookupDutchAddress("2513AA", "20", { fetchImpl: p.fetchImpl });
    assert.equal(p.asked.length, 1);
    assert.equal(p.asked[0].hostname, "api.pdok.nl");
    assert.equal(p.asked[0].searchParams.get("q"), "postcode:2513AA and huisnummer:20");
    assert.equal(p.asked[0].searchParams.get("fq"), "type:adres");
  });

  it("looks a number with a letter or an addition up by its number", async () => {
    const p = pdok([BINNENHOF]);
    const out = await lookupDutchAddress("2513AA", "20A", { fetchImpl: p.fetchImpl });
    assert.equal(out.status, "ok");
    assert.equal(p.asked[0].searchParams.get("q"), "postcode:2513AA and huisnummer:20");
  });

  it("says not found when the register has no such address", async () => {
    const out = await lookupDutchAddress("2513AA", "9999", { fetchImpl: pdok([]).fetchImpl });
    assert.deepEqual(out, { status: "not_found" });
  });

  it("says not found when the first hit is another address", async () => {
    const other = { ...BINNENHOF, huisnummer: 21 };
    assert.deepEqual(await lookupDutchAddress("2513AA", "20", { fetchImpl: pdok([other]).fetchImpl }), { status: "not_found" });
  });

  it("does not ask at all for something that is not a postcode and a number", async () => {
    for (const [postcode, number] of [["", "20"], ["2513AA", ""], ["2513", "20"], ["B-1000", "5"], ["2513AA", "abc"], [null, null]] as const) {
      const p = pdok([BINNENHOF]);
      assert.deepEqual(await lookupDutchAddress(postcode, number, { fetchImpl: p.fetchImpl }), { status: "invalid" });
      assert.equal(p.asked.length, 0);
    }
  });

  it("says error, not 'not found', when the register does not answer", async () => {
    for (const kind of ["down", "broken", "throws"] as const) {
      assert.deepEqual(await lookupDutchAddress("2513AA", "20", { fetchImpl: pdok(kind).fetchImpl }), { status: "error" }, kind);
    }
  });

  it("remembers an answer, so sending the form does not ask again", async () => {
    const p = pdok([BINNENHOF]);
    await lookupDutchAddress("2513AA", "20", { fetchImpl: p.fetchImpl });
    const again = await lookupDutchAddress("2513 AA", "20", { fetchImpl: p.fetchImpl });
    assert.equal(again.status, "ok");
    assert.equal(p.asked.length, 1);
  });

  it("remembers 'not found' too, and forgets after a day", async () => {
    const p = pdok([]);
    let now = 1_000;
    await lookupDutchAddress("2513AA", "9999", { fetchImpl: p.fetchImpl, now: () => now });
    await lookupDutchAddress("2513AA", "9999", { fetchImpl: p.fetchImpl, now: () => now });
    assert.equal(p.asked.length, 1);
    now += 25 * 60 * 60 * 1_000;
    await lookupDutchAddress("2513AA", "9999", { fetchImpl: p.fetchImpl, now: () => now });
    assert.equal(p.asked.length, 2);
  });

  it("never remembers an error", async () => {
    await lookupDutchAddress("2513AA", "20", { fetchImpl: pdok("down").fetchImpl });
    const p = pdok([BINNENHOF]);
    const out = await lookupDutchAddress("2513AA", "20", { fetchImpl: p.fetchImpl });
    assert.equal(out.status, "ok");
    assert.equal(p.asked.length, 1);
  });
});

describe("the wiring", () => {
  const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

  it("has every form section use the address help", () => {
    const block = read("components/blocks/sections/FormSectionBlock.tsx");
    assert.match(block, /useAddressAutofill\(formRef, fields\.map\(\(f\) => f\.key\), t\.address\.notFound\)/);
    assert.match(block, /error=\{fieldErrors\[field\.key\] \?\? address\.errors\[field\.key\]\}/);
    assert.match(block, /hint=\{address\.hints\[field\.key\]\}/);
  });

  it("keeps the address out of the address bar and out of any cache", () => {
    const route = read("app/api/forms/address/route.ts");
    assert.match(route, /export async function POST/);
    assert.doesNotMatch(route, /export async function GET/);
    assert.match(route, /"Cache-Control": "no-store"/);
    const hook = read("components/blocks/forms/useAddressAutofill.ts");
    assert.match(hook, /method:\s+"POST"/);
  });

  it("stops a submission only for an address that does not exist", () => {
    const route = read("app/api/forms/[formKey]/route.ts");
    const check = route.slice(route.indexOf("4b. A postcode with a house number"), route.indexOf("5. Resolve session"));
    assert.match(check, /found\.status === "not_found"/);
    assert.match(check, /status: 422/);
    assert.doesNotMatch(check, /found\.status === "error"/);
  });

  it("has the message in every language the forms speak", () => {
    const texts = read("lib/site-texts/forms.ts");
    assert.equal((texts.match(/address: \{\s+notFound: "/g) ?? []).length, 2);
  });
});

/**
 * Dutch address lookup for forms: postcode + house number → street and town.
 *
 * A form that asks for a postcode and a house number does not have to ask for
 * the street and the town as well: in the Netherlands the first two decide the
 * other two. The form fills them in, and tells the visitor when the
 * combination does not exist, before the form is sent.
 *
 * The source is the PDOK Locatieserver (Kadaster open data, the national
 * address register BAG). It needs no key. Only the postcode and the house
 * number go there, nothing that says who asked.
 *
 * Three outcomes are kept apart, because they mean different things:
 *   ok         the address exists: here are its street and town;
 *   not_found  PDOK answered and has no such address: tell the visitor;
 *   error      PDOK did not answer (timeout, 5xx): say nothing and let the
 *              form through. A hiccup at PDOK must not block a form.
 * `invalid` is what the visitor typed not being a postcode or a number yet.
 *
 * Pure apart from fetch, which can be handed in for tests.
 */

import { normalizeHouseNumber, normalizePostcode } from "@/context/form-location-context";

const PDOK_FREE_ENDPOINT = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
const DEFAULT_TIMEOUT_MS = 3_000;

export type AddressLookupResult =
  | { status: "ok"; postcode: string; houseNumber: string; street: string; city: string }
  | { status: "not_found" }
  | { status: "invalid" }
  | { status: "error" };

// ── Which fields of a form make up an address ────────────────────────────────

export interface AddressFieldKeys {
  postcode:    string;
  houseNumber: string;
  /** Present when the form has a field for it. Filled in from the lookup. */
  street?:     string;
  city?:       string;
}

const boundary = (words: string) => new RegExp(`(^|[^a-z])(${words})($|[^a-z])`);
const IS_POSTCODE     = /post.?code|postal|(^|[^a-z])zip($|[^a-z])/;
const IS_HOUSE_NUMBER = /huis.?nr|huis.?nummer|house.?no|house.?number/;
const IS_STREET       = boundary("straat|straatnaam|street|streetname");
const IS_CITY         = boundary("plaats|plaatsnaam|woonplaats|stad|city|town");

/**
 * Finds the address fields of a form by their keys, the same way the location
 * context does (context/form-location-context.ts). Null when the form has no
 * postcode field or no house-number field: then there is nothing to look up.
 */
export function addressFieldKeys(fieldKeys: readonly string[]): AddressFieldKeys | null {
  let postcode: string | undefined;
  let houseNumber: string | undefined;
  let street: string | undefined;
  let city: string | undefined;
  for (const key of fieldKeys) {
    const k = key.toLowerCase();
    if (!houseNumber && IS_HOUSE_NUMBER.test(k)) { houseNumber = key; continue; }
    if (!postcode && IS_POSTCODE.test(k))        { postcode = key; continue; }
    if (!street && IS_STREET.test(k))            { street = key; continue; }
    if (!city && IS_CITY.test(k))                { city = key; continue; }
  }
  if (!postcode || !houseNumber) return null;
  return { postcode, houseNumber, ...(street ? { street } : {}), ...(city ? { city } : {}) };
}

// ── A small memory of answers ────────────────────────────────────────────────
//
// An address does not move. Remembering an answer for a day saves the second
// request when the form is sent seconds after the visitor typed the address.
// Errors are never remembered.

const TTL_MS = 24 * 60 * 60 * 1_000;
const MAX    = 2_000;
const memory = new Map<string, { at: number; result: AddressLookupResult }>();

export function resetAddressLookupMemory(): void { memory.clear(); }

function remember(key: string, result: AddressLookupResult, now: number): void {
  if (memory.size >= MAX) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { at: now, result });
}

// ── The lookup ───────────────────────────────────────────────────────────────

export interface AddressLookupOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?:       () => number;
}

/**
 * Looks up one address. Never throws.
 *
 * A house number with a letter or an addition ("12A", "12-2") is looked up by
 * its number: the street and the town are the same for every addition.
 */
export async function lookupDutchAddress(
  rawPostcode: string | null | undefined,
  rawHouseNumber: string | null | undefined,
  options: AddressLookupOptions = {},
): Promise<AddressLookupResult> {
  const postcode    = normalizePostcode(rawPostcode);
  const houseNumber = normalizeHouseNumber(rawHouseNumber);
  if (!postcode || !houseNumber) return { status: "invalid" };

  const now = (options.now ?? Date.now)();
  const key = `${postcode}|${houseNumber}`;
  const known = memory.get(key);
  if (known && now - known.at < TTL_MS) return known.result;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      q:    `postcode:${postcode} and huisnummer:${houseNumber}`,
      fq:   "type:adres",
      fl:   "straatnaam,woonplaatsnaam,postcode,huisnummer",
      rows: "1",
    });
    const res = await (options.fetchImpl ?? fetch)(`${PDOK_FREE_ENDPOINT}?${params.toString()}`, {
      signal:  controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { status: "error" };
    const json = (await res.json()) as {
      response?: { docs?: Array<{ straatnaam?: unknown; woonplaatsnaam?: unknown; postcode?: unknown; huisnummer?: unknown }> };
    };
    const docs = json.response?.docs;
    if (!Array.isArray(docs)) return { status: "error" };

    const doc = docs[0];
    // PDOK ranks by relevance, so make sure the first hit is this very address.
    const sameAddress =
      doc !== undefined &&
      String(doc.postcode ?? "").toUpperCase() === postcode &&
      String(doc.huisnummer ?? "") === houseNumber;
    const street = sameAddress && typeof doc.straatnaam === "string" ? doc.straatnaam.trim() : "";
    const city   = sameAddress && typeof doc.woonplaatsnaam === "string" ? doc.woonplaatsnaam.trim() : "";

    const result: AddressLookupResult = street && city
      ? { status: "ok", postcode, houseNumber, street, city }
      : { status: "not_found" };
    remember(key, result, now);
    return result;
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

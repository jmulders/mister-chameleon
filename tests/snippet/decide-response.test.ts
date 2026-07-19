/**
 * decide-response — the /api/snippet/decide wire contract.
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   De selector-map komt als losse JSON uit de tenant-config in de DB, dus hij is
 *   ongetypeerd en kan rommel bevatten. sanitizeSelectorMap moet daar een schone
 *   string→string map van maken en niks anders doorlaten — een kapotte selector-
 *   waarde mag nooit als `selectors` naar de snippet lekken. En bij niks bruikbaars
 *   moet hij `undefined` geven zodat de response de sleutel wéglaat (backward-
 *   compatible: oude snippets zien dan gewoon geen selectors-veld).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { sanitizeSelectorMap } from "@/lib/snippet/decide-response";

describe("sanitizeSelectorMap", () => {
  it("keeps valid string→string entries", () => {
    const out = sanitizeSelectorMap({ "hero-title": ".hero h1", "cta": "a.btn" });
    assert.deepEqual(out, { "hero-title": ".hero h1", "cta": "a.btn" });
  });

  it("drops non-string and blank values", () => {
    const out = sanitizeSelectorMap({
      "a": ".ok",
      "b": 42,          // not a string
      "c": "",          // empty
      "d": "   ",       // whitespace only
      "e": null,
      "f": { x: 1 },
    });
    assert.deepEqual(out, { "a": ".ok" });
  });

  it("returns undefined when nothing usable remains", () => {
    assert.equal(sanitizeSelectorMap({}), undefined);
    assert.equal(sanitizeSelectorMap({ "a": "" }), undefined);
  });

  it("returns undefined for non-object input", () => {
    assert.equal(sanitizeSelectorMap(null), undefined);
    assert.equal(sanitizeSelectorMap(undefined), undefined);
    assert.equal(sanitizeSelectorMap("nope"), undefined);
    assert.equal(sanitizeSelectorMap(123), undefined);
  });
});

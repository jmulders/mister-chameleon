/**
 * Variant equality assertion for the CMS provider contract tests.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   The contract tests compare a provider's output to a fixture with
 *   deepStrictEqual, which treats `{ title: "x", media: undefined }` and
 *   `{ title: "x" }` as different objects. They are not different to any
 *   consumer: `block.media` is undefined either way.
 *
 *   Every mapper writes its optional fields unconditionally (`media: raw.media`),
 *   so an absent optional field arrives as an explicitly-undefined key. Each time
 *   a block type gained an optional field — layoutVariant, media, contentAlign,
 *   proofItems — all three provider suites went red without a single provider
 *   changing behaviour. The suites stayed red, and stopped being read.
 *
 *   So: compare on defined values only. An optional field that is set is still
 *   compared strictly, and a field the fixture expects but the provider drops
 *   still fails. What no longer fails is the absence of an absence.
 *
 * ─── What this does NOT relax ────────────────────────────────────────────────
 *
 *   `null` is a value and is compared as one — a mapper returning `media: null`
 *   where the fixture says `media: undefined` still fails, because those mean
 *   different things (explicitly empty vs not set).
 */

import assert from 'node:assert/strict';

/**
 * Recursively drop object keys whose value is `undefined`.
 * Arrays keep their length and index positions; only object keys are dropped.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Assert that a provider's block output matches the expected fixture, ignoring
 * keys that are present-but-undefined on either side.
 *
 * @param actual    What the provider returned.
 * @param expected  The fixture.
 * @param message   Optional assertion message.
 */
export function assertVariantEquals<T>(actual: T, expected: T, message?: string): void {
  assert.deepStrictEqual(stripUndefined(actual), stripUndefined(expected), message);
}

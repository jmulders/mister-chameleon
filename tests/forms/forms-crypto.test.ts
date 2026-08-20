/**
 * Form payload crypto — round-trip, plain fallback, and email-hash determinism.
 *
 * loadKey() reads process.env at call time, so each test sets or clears
 * FORMS_ENCRYPTION_KEY to exercise the keyed and keyless (dev) modes.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";

import { encryptPayload, decryptPayload, emailHash } from "@/lib/forms-crypto";

// A fixed 32-byte hex key for the encrypted-mode tests.
const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

function withKey(k: string | undefined, fn: () => void) {
  const prev = process.env.FORMS_ENCRYPTION_KEY;
  if (k === undefined) delete process.env.FORMS_ENCRYPTION_KEY;
  else process.env.FORMS_ENCRYPTION_KEY = k;
  try { fn(); }
  finally {
    if (prev === undefined) delete process.env.FORMS_ENCRYPTION_KEY;
    else process.env.FORMS_ENCRYPTION_KEY = prev;
  }
}

afterEach(() => { delete process.env.FORMS_ENCRYPTION_KEY; });

describe("forms-crypto payload", () => {
  it("round-trips a JSON payload with a key (enc:v1 format)", () => {
    withKey(KEY, () => {
      const plaintext = JSON.stringify({ email: "Jane@Example.com", message: "Hi, café" });
      const enc = encryptPayload(plaintext);
      assert.ok(enc.startsWith("enc:v1:"), "should be enc:v1 prefixed");
      assert.ok(!enc.includes("Jane@Example.com"), "ciphertext must not contain plaintext");
      assert.equal(decryptPayload(enc), plaintext);
    });
  });

  it("produces distinct ciphertext per call (random IV) but same plaintext", () => {
    withKey(KEY, () => {
      const p = JSON.stringify({ email: "a@b.com" });
      const e1 = encryptPayload(p);
      const e2 = encryptPayload(p);
      assert.notEqual(e1, e2, "IV should differ");
      assert.equal(decryptPayload(e1), p);
      assert.equal(decryptPayload(e2), p);
    });
  });

  it("falls back to plain: without a key and round-trips", () => {
    withKey(undefined, () => {
      const p = JSON.stringify({ email: "a@b.com" });
      const enc = encryptPayload(p);
      assert.ok(enc.startsWith("plain:"), "should be plain: prefixed");
      assert.equal(decryptPayload(enc), p);
    });
  });

  it("decrypts a plain: value even when a key IS set (mixed-mode reads)", () => {
    const p = JSON.stringify({ email: "a@b.com" });
    const plainStored = withKeyReturn(undefined, () => encryptPayload(p));
    withKey(KEY, () => {
      assert.equal(decryptPayload(plainStored), p);
    });
  });

  it("treats a legacy unformatted value as plaintext", () => {
    withKey(KEY, () => {
      assert.equal(decryptPayload("{\"legacy\":true}"), "{\"legacy\":true}");
    });
  });

  it("throws on enc:v1 without a key", () => {
    const enc = withKeyReturn(KEY, () => encryptPayload("secret"));
    withKey(undefined, () => {
      assert.throws(() => decryptPayload(enc), /FORMS_ENCRYPTION_KEY is not set/);
    });
  });
});

describe("forms-crypto emailHash", () => {
  it("is deterministic and normalises case + whitespace", () => {
    withKey(KEY, () => {
      const a = emailHash("  Jane@Example.com ");
      const b = emailHash("jane@example.com");
      assert.equal(a, b, "normalised inputs hash equally");
      assert.match(a, /^[0-9a-f]{64}$/, "hex sha256 digest");
    });
  });

  it("differs for different emails", () => {
    withKey(KEY, () => {
      assert.notEqual(emailHash("a@b.com"), emailHash("c@d.com"));
    });
  });

  it("keyed and keyless hashes differ (HMAC vs SHA-256) but are each stable", () => {
    const keyed   = withKeyReturn(KEY, () => emailHash("a@b.com"));
    const keyless = withKeyReturn(undefined, () => emailHash("a@b.com"));
    assert.notEqual(keyed, keyless, "keyed HMAC != unkeyed SHA-256");
    assert.equal(keyed,   withKeyReturn(KEY, () => emailHash("a@b.com")));
    assert.equal(keyless, withKeyReturn(undefined, () => emailHash("a@b.com")));
  });
});

// Helper: run fn with a given key mode and return its value.
function withKeyReturn<T>(k: string | undefined, fn: () => T): T {
  let out!: T;
  withKey(k, () => { out = fn(); });
  return out;
}

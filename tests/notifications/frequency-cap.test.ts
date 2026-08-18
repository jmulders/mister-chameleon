/**
 * Notification frequency-cap model — pure logic tests.
 *
 * Mocks window.sessionStorage / window.localStorage with an in-memory Storage and
 * injects the clock, so the suppress / dismiss logic is verified deterministically.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  isNotificationSuppressed,
  recordNotificationDismissal,
  ttlToMs,
  notifStorageKey,
  NOTIF_KEY_PREFIX,
} from "@/lib/notifications/frequency-cap";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

const session = new MemStorage();
const local   = new MemStorage();
// @ts-expect-error minimal window shim for the storage-backed util
globalThis.window = { sessionStorage: session, localStorage: local };

beforeEach(() => { session.clear(); local.clear(); });

describe("frequency-cap helpers", () => {
  it("ttlToMs converts hours and days", () => {
    assert.equal(ttlToMs(2, "hours"), 2 * 3_600_000);
    assert.equal(ttlToMs(3, "days"), 3 * 86_400_000);
    assert.equal(ttlToMs(0, "days"), 0);
    assert.equal(ttlToMs(undefined, "hours"), 0);
  });

  it("storage key is namespaced by id", () => {
    assert.equal(notifStorageKey("notification_default"), NOTIF_KEY_PREFIX + "notification_default");
  });
});

describe("always", () => {
  it("is never suppressed and records nothing", () => {
    assert.equal(isNotificationSuppressed("a", "always", 0), false);
    recordNotificationDismissal("a", "always");
    assert.equal(session.length + local.length, 0);
  });
});

describe("once_per_session", () => {
  it("suppressed after dismissal within the session", () => {
    assert.equal(isNotificationSuppressed("a", "once_per_session", 0), false);
    recordNotificationDismissal("a", "once_per_session");
    assert.equal(isNotificationSuppressed("a", "once_per_session", 0), true);
    // stored in session, not local
    assert.equal(session.length, 1);
    assert.equal(local.length, 0);
  });

  it("is per-id: dismissing one does not suppress another", () => {
    recordNotificationDismissal("a", "once_per_session");
    assert.equal(isNotificationSuppressed("a", "once_per_session", 0), true);
    assert.equal(isNotificationSuppressed("b", "once_per_session", 0), false);
  });
});

describe("once_per_period", () => {
  const ttlMs = ttlToMs(1, "days"); // 24h

  it("suppressed within the period, shown again after it elapses", () => {
    const t0 = 1_000_000_000_000;
    recordNotificationDismissal("a", "once_per_period", t0);
    assert.equal(local.length, 1);
    // 1 hour later → still suppressed
    assert.equal(isNotificationSuppressed("a", "once_per_period", ttlMs, t0 + 3_600_000), true);
    // just before ttl → suppressed
    assert.equal(isNotificationSuppressed("a", "once_per_period", ttlMs, t0 + ttlMs - 1), true);
    // after ttl → shown again
    assert.equal(isNotificationSuppressed("a", "once_per_period", ttlMs, t0 + ttlMs + 1), false);
  });
});

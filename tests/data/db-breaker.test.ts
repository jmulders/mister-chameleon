/**
 * The circuit breaker for database calls: after two timeouts in a row it
 * rejects calls for a while, then lets one probe through.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { RestBreaker, DatabaseUnavailableError } from "@/data/db-breaker";

const T0 = 1_000_000;

describe("closed breaker", () => {
  it("lets calls through", () => {
    const b = new RestBreaker(15_000);
    assert.equal(b.admit(T0), "pass");
    assert.equal(b.retryInMs(T0), 0);
  });

  it("stays closed after one timeout", () => {
    const b = new RestBreaker(15_000);
    assert.equal(b.timedOut(T0, "pass"), false);
    assert.equal(b.admit(T0 + 1), "pass");
  });

  it("forgets a timeout once the database answers", () => {
    const b = new RestBreaker(15_000);
    b.timedOut(T0, "pass");
    assert.equal(b.answered("pass"), false);
    assert.equal(b.timedOut(T0 + 10, "pass"), false);
    assert.equal(b.admit(T0 + 11), "pass");
  });
});

describe("opening", () => {
  it("opens on the second timeout in a row and says so once", () => {
    const b = new RestBreaker(15_000);
    assert.equal(b.timedOut(T0, "pass"), false);
    assert.equal(b.timedOut(T0, "pass"), true);
    assert.equal(b.timedOut(T0, "pass"), false, "a third timeout of the same round is not a new opening");
    assert.equal(b.admit(T0 + 1), "reject");
    assert.equal(b.retryInMs(T0 + 1000), 14_000);
  });

  it("rejects for the whole open time", () => {
    const b = new RestBreaker(15_000);
    b.timedOut(T0, "pass"); b.timedOut(T0, "pass");
    assert.equal(b.admit(T0 + 14_999), "reject");
  });
});

describe("probing", () => {
  const opened = () => {
    const b = new RestBreaker(15_000);
    b.timedOut(T0, "pass"); b.timedOut(T0, "pass");
    return b;
  };

  it("lets exactly one call through after the open time", () => {
    const b = opened();
    assert.equal(b.admit(T0 + 15_000), "probe");
    assert.equal(b.admit(T0 + 15_001), "reject");
    assert.equal(b.admit(T0 + 15_002), "reject");
  });

  it("closes when the probe is answered", () => {
    const b = opened();
    const admission = b.admit(T0 + 15_000);
    assert.equal(b.answered(admission), true);
    assert.equal(b.admit(T0 + 15_010), "pass");
    assert.equal(b.admit(T0 + 15_011), "pass");
  });

  it("stays open for another round when the probe times out", () => {
    const b = opened();
    const admission = b.admit(T0 + 15_000);
    assert.equal(b.timedOut(T0 + 17_000, admission), false, "it was already open");
    assert.equal(b.admit(T0 + 17_001), "reject");
    assert.equal(b.admit(T0 + 31_999), "reject");
    assert.equal(b.admit(T0 + 32_000), "probe");
  });

  it("frees the probe slot when the probe ends without a verdict", () => {
    const b = opened();
    const admission = b.admit(T0 + 15_000);
    b.inconclusive(admission);
    assert.equal(b.admit(T0 + 15_001), "probe");
  });

  it("closes when a call that was already under way is answered", () => {
    const b = opened();
    assert.equal(b.answered("pass"), true);
    assert.equal(b.admit(T0 + 1), "pass");
  });
});

describe("switched off", () => {
  it("never rejects with an open time of 0", () => {
    const b = new RestBreaker(0);
    for (let i = 0; i < 5; i++) assert.equal(b.timedOut(T0 + i, "pass"), false);
    assert.equal(b.admit(T0 + 10), "pass");
  });
});

describe("the error a rejected call gets", () => {
  it("carries its own name and the wait in seconds", () => {
    const err = new DatabaseUnavailableError(14_200);
    assert.equal(err.name, "DatabaseUnavailableError");
    assert.match(err.message, /15 s/);
  });
});

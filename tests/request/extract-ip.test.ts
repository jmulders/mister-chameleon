/**
 * extractIpFromRequest — the contract the synthetic-request builders rely on.
 *
 * Server-side enrichment (geo/company/weather/cbs-location) resolves the visitor
 * IP from x-forwarded-for → x-real-ip. Several code paths build a *synthetic*
 * Request for buildDecisionContext; if they omit these headers the IP comes back
 * null and the whole enrichment chain stalls (the bug this pins). These tests
 * lock the extraction behaviour so a regression in the header names/order is caught.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractIpFromRequest } from "@/lib/request-ip";

const reqWith = (headers: Record<string, string>) =>
  new Request("http://localhost/", { headers: new Headers(headers) });

describe("extractIpFromRequest", () => {

  it("takes the first value of x-forwarded-for (client IP before proxies)", () => {
    assert.equal(
      extractIpFromRequest(reqWith({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })),
      "203.0.113.7",
    );
  });

  it("trims whitespace around the forwarded IP", () => {
    assert.equal(extractIpFromRequest(reqWith({ "x-forwarded-for": "  203.0.113.7  " })), "203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    assert.equal(extractIpFromRequest(reqWith({ "x-real-ip": "198.51.100.9" })), "198.51.100.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is empty", () => {
    assert.equal(
      extractIpFromRequest(reqWith({ "x-forwarded-for": "", "x-real-ip": "198.51.100.9" })),
      "198.51.100.9",
    );
  });

  it("returns null when neither header is present (the stalled-enrichment case)", () => {
    assert.equal(extractIpFromRequest(reqWith({ "user-agent": "x" })), null);
  });
});

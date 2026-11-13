/**
 * Whether the Scenario Control console starts collapsed.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { startsMinimized } from "@/components/scenario/panel-start";

describe("how the console starts", () => {
  it("is collapsed for a first-time visitor", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "", stored: null }), true);
    assert.equal(startsMinimized({ pathname: "/prijzen", search: "?utm_source=linkedin", stored: null }), true);
  });

  it("is open for a visitor who opened it before", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "", stored: "0" }), false);
  });

  it("stays collapsed for a visitor who collapsed it", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "", stored: "1" }), true);
  });

  it("is open when the address asks for it", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "?scenario=true", stored: null }), false);
    assert.equal(startsMinimized({ pathname: "/", search: "?utm_source=x&scenario=true", stored: null }), false);
  });

  it("lets a remembered choice win over the address", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "?scenario=true", stored: "1" }), true);
  });

  it("does not open for another value of the parameter", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "?scenario=false", stored: null }), true);
    assert.equal(startsMinimized({ pathname: "/", search: "?scenario=1", stored: null }), true);
  });

  it("is always open on /demo-controls, whatever was remembered", () => {
    assert.equal(startsMinimized({ pathname: "/demo-controls", search: "", stored: null }), false);
    assert.equal(startsMinimized({ pathname: "/demo-controls", search: "", stored: "1" }), false);
  });

  it("treats an unknown stored value as a first visit", () => {
    assert.equal(startsMinimized({ pathname: "/", search: "", stored: "yes" }), true);
  });
});

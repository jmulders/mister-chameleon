/**
 * A listing of articles: which are shown, and in which order.
 *
 * On 21 Nov 2026 five articles went live. The knowledge base showed four of
 * them, in the order of their file names. The one dated that same day was held
 * back as "in the future", because its date came from the REST API with a time
 * of day and was compared with midnight.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { dateOnly, isPublishedBy, newestFirst } from "@/cms/providers/listing-dates";

describe("dateOnly", () => {
  it("reads the day from the file reader and from the REST API", () => {
    assert.equal(dateOnly("2026-11-21 09:00:00"), "2026-11-21");
    assert.equal(dateOnly("2026-11-21T09:00:00.000000Z"), "2026-11-21");
    assert.equal(dateOnly("2026-11-21"), "2026-11-21");
  });

  it("gives nothing for a value that is not a date", () => {
    assert.equal(dateOnly(undefined), undefined);
    assert.equal(dateOnly(""), undefined);
    assert.equal(dateOnly("morgen"), undefined);
    assert.equal(dateOnly(20261121), undefined);
  });
});

describe("isPublishedBy", () => {
  const afternoon = new Date(2026, 10, 21, 17, 0, 0);

  it("shows an article dated today, whatever its time of day", () => {
    assert.equal(isPublishedBy("2026-11-21T09:00:00.000000Z", afternoon), true);
    assert.equal(isPublishedBy("2026-11-21T23:00:00.000000Z", afternoon), true);
    assert.equal(isPublishedBy("2026-11-21 09:00:00", afternoon), true);
  });

  it("holds back an article dated tomorrow", () => {
    assert.equal(isPublishedBy("2026-11-22T00:00:00.000000Z", afternoon), false);
  });

  it("shows an article from the past and one without a date", () => {
    assert.equal(isPublishedBy("2026-07-23T09:00:00.000000Z", afternoon), true);
    assert.equal(isPublishedBy(undefined, afternoon), true);
  });
});

describe("newestFirst", () => {
  it("puts the newest article on top, whatever order the CMS gave", () => {
    const items = [
      { id: "toekomst",    date: "2026-07-23" },
      { id: "abm",         date: "2026-11-17" },
      { id: "opvolgen",    date: "2026-11-20" },
      { id: "verrijking",  date: "2026-11-19" },
      { id: "recruitment", date: "2026-11-18" },
      { id: "retargeting", date: "2026-11-21" },
    ];
    assert.deepEqual(newestFirst(items).map((i) => i.id),
      ["retargeting", "opvolgen", "verrijking", "recruitment", "abm", "toekomst"]);
  });

  it("keeps the given order within a day and puts an item without a date last", () => {
    const items = [{ id: "zonder" }, { id: "a", date: "2026-11-20" }, { id: "b", date: "2026-11-20" }];
    assert.deepEqual(newestFirst(items).map((i) => i.id), ["a", "b", "zonder"]);
  });

  it("does not change the list it was given", () => {
    const items = [{ id: "oud", date: "2026-01-01" }, { id: "nieuw", date: "2026-02-01" }];
    newestFirst(items);
    assert.deepEqual(items.map((i) => i.id), ["oud", "nieuw"]);
  });
});

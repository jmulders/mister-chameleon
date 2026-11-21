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
import { dateOnly, isPublishedBy, newestEntriesFirst, newestFirst, timeKey } from "@/cms/providers/listing-dates";

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

describe("timeKey", () => {
  it("gives both shapes of a CMS date the same sortable string", () => {
    assert.equal(timeKey("2026-11-21 09:00:00"), "2026-11-21 09:00:00");
    assert.equal(timeKey("2026-11-21T09:00:00.000000Z"), "2026-11-21 09:00:00");
    assert.equal(timeKey("2026-11-21T09:00"), "2026-11-21 09:00:00");
  });

  it("counts a date without a time as midnight, and no date as nothing", () => {
    assert.equal(timeKey("2026-11-21"), "2026-11-21 00:00:00");
    assert.equal(timeKey(undefined), "");
    assert.equal(timeKey("morgen"), "");
  });
});

describe("newestEntriesFirst", () => {
  it("orders articles of the same day on their time", () => {
    // The six articles of the evening of 21 Nov 2026 stood under the one of that
    // morning, in the order of their file names.
    const entries = [
      { slug: "retargeting",   date: "2026-11-21T09:00:00.000000Z" },
      { slug: "beginnen",      date: "2026-11-21T12:00:00.000000Z" },
      { slug: "bedrijfsnaam",  date: "2026-11-21T11:00:00.000000Z" },
      { slug: "meten",         date: "2026-11-21T14:00:00.000000Z" },
      { slug: "zonder-cookies", date: "2026-11-21T15:00:00.000000Z" },
      { slug: "regels-of-ai",  date: "2026-11-21T10:00:00.000000Z" },
      { slug: "advertentie",   date: "2026-11-21T13:00:00.000000Z" },
      { slug: "opvolgen",      date: "2026-11-20T09:00:00.000000Z" },
    ];
    assert.deepEqual(newestEntriesFirst(entries).map((e) => e.slug), [
      "zonder-cookies", "meten", "advertentie", "beginnen", "bedrijfsnaam", "regels-of-ai", "retargeting", "opvolgen",
    ]);
  });

  it("mixes the two shapes of a date, puts an entry without a date last and keeps ties in order", () => {
    const entries = [
      { slug: "zonder" },
      { slug: "b", date: "2026-11-21 09:00:00" },
      { slug: "a", date: "2026-11-21T09:00:00.000000Z" },
      { slug: "nieuwst", date: "2026-11-22" },
    ];
    assert.deepEqual(newestEntriesFirst(entries).map((e) => e.slug), ["nieuwst", "b", "a", "zonder"]);
  });

  it("stays in order through newestFirst, which sees the day only", () => {
    const ordered = newestEntriesFirst([
      { date: "2026-11-21T09:00:00.000000Z", id: "ochtend" },
      { date: "2026-11-21T15:00:00.000000Z", id: "middag" },
      { date: "2026-11-20T23:00:00.000000Z", id: "gisteren" },
    ]);
    const items = newestFirst(ordered.map((e) => ({ id: e.id, date: dateOnly(e.date) })));
    assert.deepEqual(items.map((i) => i.id), ["middag", "ochtend", "gisteren"]);
  });
});

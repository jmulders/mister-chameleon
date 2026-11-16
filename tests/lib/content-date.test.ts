/**
 * The date on a listing card.
 *
 * Regression: the knowledge base overview showed "2026-07-23T09:00:00.000000Z"
 * on a card. Statamic 6 delivers an entry date as a full instant, and the card
 * only understood "2026-07-23" and "2026-07-23 09:00".
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatContentDate } from "../../lib/content-date";
import { BLOCK_TEXTS } from "../../lib/site-texts/blocks";

const NL = BLOCK_TEXTS.nl.dateLocale;
const EN = BLOCK_TEXTS.en.dateLocale;

test("a Statamic 6 instant reads as a Dutch date", () => {
  assert.deepEqual(formatContentDate("2026-07-23T09:00:00.000000Z", NL), {
    dateTime: "2026-07-23T09:00:00.000Z",
    label:    "23 juli 2026",
  });
});

test("the same instant follows the site language", () => {
  assert.equal(formatContentDate("2026-07-23T09:00:00.000000Z", EN)?.label, "July 23, 2026");
});

test("a date without a time keeps its day and stays a plain date", () => {
  assert.deepEqual(formatContentDate("2024-09-01", NL), {
    dateTime: "2024-09-01",
    label:    "1 september 2024",
  });
});

test("a wall-clock date and time shows the day as written", () => {
  // No zone: nothing to convert, whatever zone the server or browser runs in.
  assert.deepEqual(formatContentDate("2026-08-01 00:00", NL), {
    dateTime: "2026-08-01",
    label:    "1 augustus 2026",
  });
  assert.equal(formatContentDate("2026-08-01T23:59:59", NL)?.label, "1 augustus 2026");
});

test("an instant is read in UTC unless a time zone is given", () => {
  const lateEvening = "2026-07-22T22:30:00.000000Z";
  assert.equal(formatContentDate(lateEvening, NL)?.label, "22 juli 2026");
  assert.equal(formatContentDate(lateEvening, NL, "Europe/Amsterdam")?.label, "23 juli 2026");
});

test("an offset is honoured and normalised to UTC in the datetime value", () => {
  assert.deepEqual(formatContentDate("2026-07-23T00:30:00+02:00", NL), {
    dateTime: "2026-07-22T22:30:00.000Z",
    label:    "22 juli 2026",
  });
  assert.equal(formatContentDate("2026-07-23T00:30:00+0200", NL)?.dateTime, "2026-07-22T22:30:00.000Z");
});

test("the label does not depend on the zone the process runs in", () => {
  const before = process.env.TZ;
  try {
    for (const tz of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
      process.env.TZ = tz;
      assert.equal(formatContentDate("2026-07-23T09:00:00.000000Z", NL)?.label, "23 juli 2026", tz);
      assert.equal(formatContentDate("2024-09-01", NL)?.label, "1 september 2024", tz);
    }
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
});

test("what is not a date comes back as null", () => {
  for (const raw of ["", "   ", "Binnenkort", "2026", "2026-02-31", "2026-13-01", "2026-07-23T25:00:00Z", null, undefined]) {
    assert.equal(formatContentDate(raw, NL), null, String(raw));
  }
});

test("an unknown time zone does not throw", () => {
  assert.equal(formatContentDate("2026-07-23T09:00:00Z", NL, "Mars/Olympus_Mons"), null);
});

test("the listing card writes its date through a <time> element", () => {
  const root   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const source = readFileSync(path.join(root, "components/blocks/listing/ResultCard.tsx"), "utf8");

  assert.match(source, /<time dateTime=\{formatted\.dateTime\}/);
  assert.match(source, /formatContentDate\(date, BLOCK_TEXTS\[locale\]\.dateLocale\)/);
  // The old dd-mm-yyyy helper returned the raw string for anything it could not split.
  assert.doesNotMatch(source, /\bformatDate\(/);
});

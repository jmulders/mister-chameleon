/**
 * The booking page never shows a visitor what went wrong on the server.
 *
 * On 25 Nov 2026 Google rejected the key of the calendar's service account.
 * The page for booking a demo then showed, in its red box, the raw answer:
 * `Google token exchange failed (400): {"error":"invalid_grant",...}`. The
 * route passed the server's message on and the page printed it.
 *
 * Three more things were wrong on that same screen. "Try again" only cleared
 * the message, after which the page said the day was full. The date was in
 * English on a Dutch page. And the time had AM and PM in every language.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getBookDemoTranslations } from "@/app/(site)/book-demo/_components/translations";

const availability = readFileSync("app/api/demo/availability/route.ts", "utf8");
const book         = readFileSync("app/api/demo/book/route.ts", "utf8");
const client       = readFileSync("app/(site)/book-demo/_components/BookDemoClient.tsx", "utf8");

/** Every NextResponse.json(...) call's first argument, as source text. */
const bodies = (source: string) => [...source.matchAll(/NextResponse\.json\(\s*([\s\S]*?)\s*,\s*\{\s*status/g)].map((m) => m[1]!);

describe("demo booking, what the server tells the visitor", () => {
  it("answers a calendar failure with a code, and logs the cause", () => {
    assert.match(availability, /logger\.error\("\[demo\/availability\] Calendar lookup failed", \{ date, error: result\.error \}\)/);
    assert.match(availability, /\{ ok: false, code: "calendar_unavailable" \}, \{ status: 503 \}/);
    assert.match(book, /logger\.error\("\[demo\/book\] Calendar booking failed"/);
    assert.match(book, /\{ ok: false, code: "calendar_unavailable" \}, \{ status: 500 \}/);
  });

  it("never puts the calendar library's own message in an answer", () => {
    for (const body of [...bodies(availability), ...bodies(book)]) {
      assert.doesNotMatch(body, /result\.error|bookingResult\.error/, `the answer ${body.slice(0, 60)} leaks a server message`);
    }
  });

  it("names a taken slot with its own code", () => {
    assert.match(book, /code: "slot_taken"/);
  });
});

describe("demo booking, what the page shows", () => {
  it("takes its texts from the translations, never from the answer", () => {
    assert.doesNotMatch(client, /data\.error/);
    assert.doesNotMatch(client, /setError\(data\./);
    assert.match(client, /error === "connect" \? t\.errorConnect : t\.errorCalendar/);
    assert.match(client, /submitError === "slot_taken" \? t\.errorSlotTaken/);
  });

  it("offers the contact page when the calendar cannot be reached", () => {
    assert.equal(client.match(/<a href=\{t\.contactHref\}/g)?.length, 2);
  });

  it("asks the server again on 'try again'", () => {
    assert.match(client, /onClick=\{\(\) => setAttempt\(\(n\) => n \+ 1\)\}/);
    assert.match(client, /\}, \[date, attempt\]\);/);
    assert.doesNotMatch(client, /onClick=\{\(\) => setError\(null\)\}/);
  });

  it("writes the date and the time in the language of the page", () => {
    assert.doesNotMatch(client, /toLocaleDateString\("en-GB"/);
    assert.equal(client.match(/formatDisplayDate\([a-z.]+, t\.dateLocale\)/g)?.length, 4);
    assert.equal(client.match(/formatTime\([a-z.]+, t\.hour12\)/g)?.length, 3);
    assert.doesNotMatch(client, /formatTime12h/);
  });
});

describe("demo booking, the texts", () => {
  for (const locale of ["en", "nl", "de"] as const) {
    it(`has the calendar message, its link and a date format in ${locale}`, () => {
      const t = getBookDemoTranslations(locale);
      assert.ok(t.errorCalendar.length > 40);
      assert.ok(t.errorCalendarLink.length > 3);
      assert.ok(t.errorSlotTaken.length > 10);
      assert.equal(t.contactHref, "/contact");
      // A real date in that language, not the raw string back.
      const written = new Date("2026-11-25T12:00:00Z").toLocaleDateString(t.dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
      assert.match(written, /2026/);
    });
  }

  it("is Dutch on the Dutch page: the weekday, the month and a 24-hour clock", () => {
    const t = getBookDemoTranslations("nl");
    assert.equal(t.dateLocale, "nl-NL");
    assert.equal(t.hour12, false);
    const written = new Date("2026-11-25T12:00:00Z").toLocaleDateString(t.dateLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    assert.equal(written, "woensdag 25 november 2026");
    // House style: no dashes, colons or semicolons, and no formal address.
    for (const text of [t.errorCalendar, t.errorCalendarLink, t.errorSlotTaken]) {
      assert.doesNotMatch(text, /[–—;:]/);
      assert.doesNotMatch(text, /\b(u|uw)\b/);
    }
  });
});

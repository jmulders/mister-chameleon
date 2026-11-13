/**
 * The mail that confirms a trial.
 *
 * It used to be English on the Dutch site and said that no credit card was
 * needed, while the checkout asks for a card. It now follows the language of
 * the site and repeats the promise the price page makes.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { buildTrialWelcomeMail } from "../../lib/trial/welcome-mail";

const INPUT = {
  name:      "Sanne <b>de Vries</b>",
  planLabel: "Growth",
  trialEnds: new Date("2026-11-27T12:00:00Z"),
  adminUrl:  "https://www.misterchameleon.nl",
};

describe("buildTrialWelcomeMail", () => {
  it("writes the Dutch mail in je-form with a Dutch date", () => {
    const mail = buildTrialWelcomeMail("nl", INPUT);
    assert.match(mail.subject, /^Welkom bij Mister Chameleon/);
    assert.match(mail.text, /27 november 2026/);
    assert.match(mail.text, /Je betaalt pas na 14 dagen/);
    assert.match(mail.text, /https:\/\/www\.misterchameleon\.nl\/admin/);
    assert.doesNotMatch(mail.text + mail.subject, /\b(u|uw)\b/i);
    assert.doesNotMatch(mail.text + mail.subject, /\b(your|trial|welcome)\b/i);
  });

  it("keeps the English mail for an English site", () => {
    const mail = buildTrialWelcomeMail("en", INPUT);
    assert.match(mail.subject, /^Welcome to Mister Chameleon/);
    assert.match(mail.text, /27 November 2026/);
  });

  for (const locale of ["nl", "en"] as const) {
    it(`makes no promise about a credit card and uses no dashes (${locale})`, () => {
      const mail = buildTrialWelcomeMail(locale, INPUT);
      const all  = `${mail.subject}\n${mail.text}\n${mail.html}`;
      assert.doesNotMatch(all, /credit ?card/i);
      assert.doesNotMatch(all, /[—–]/);
    });

    it(`escapes the name in the html and leaves it as typed in the text (${locale})`, () => {
      const mail = buildTrialWelcomeMail(locale, INPUT);
      assert.ok(mail.html.includes("Sanne &lt;b&gt;de Vries&lt;/b&gt;"));
      assert.ok(!mail.html.includes("<b>de Vries</b>"));
      assert.ok(mail.text.includes("Sanne <b>de Vries</b>"));
    });
  }
});

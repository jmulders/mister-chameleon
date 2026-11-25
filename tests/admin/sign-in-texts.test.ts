/**
 * The sign-in pages speak the language of the site.
 *
 * The owner put a login link in the menu of misterchameleon.nl on 25 Nov 2026
 * and landed on an English page ("Admin sign in"). The four pages of the way in
 * and the reset mail now take their texts from one dictionary, Dutch and
 * English.
 *
 * The pages are .tsx files, which this test runner cannot import, so those
 * checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SIGN_IN_TEXTS, isSignInPath, signInError, twoFaError, resetError, resetMail,
} from "@/lib/admin-auth/sign-in-texts";

const nl = SIGN_IN_TEXTS.nl;
const en = SIGN_IN_TEXTS.en;

/** Every text of a language as a string, the mail greeting filled in. */
const strings = (t: typeof nl): [string, string][] =>
  Object.entries(t).map(([key, value]) => [key, typeof value === "function" ? value("Anna") : value]);

describe("sign-in texts", () => {
  it("has every text in both languages", () => {
    assert.deepEqual(Object.keys(nl).sort(), Object.keys(en).sort());
    for (const [key, value] of [...strings(nl), ...strings(en)]) {
      assert.ok(value.trim().length > 0, `${key} is empty`);
    }
  });

  it("is really translated: no Dutch text equals the English one", () => {
    const same = strings(nl).filter(([key, value]) => value === (strings(en).find(([k]) => k === key)![1]));
    assert.deepEqual(same, []);
  });

  it("keeps to the house style in Dutch", () => {
    for (const [key, value] of strings(nl)) {
      assert.doesNotMatch(value, /[–—;:]/, `${key}: no dashes, semicolons or colons`);
      assert.doesNotMatch(value, /\b(u|uw)\b/i, `${key}: je, not u`);
    }
  });

  it("names both ways to say how long a link lasts the same", () => {
    // 45 minutes is RESET_TOKEN_TTL_MS. Every text that mentions it must agree.
    for (const t of [nl, en]) {
      for (const key of ["linkSent", "linkInvalid", "mailLinkNote"] as const) assert.match(t[key], /45/);
    }
  });
});

describe("sign-in pages", () => {
  it("counts the pages of the way in, and nothing else of the admin", () => {
    for (const p of ["/admin/login", "/admin/login/2fa", "/admin/forgot-password", "/admin/reset-password"]) {
      assert.equal(isSignInPath(p), true, p);
    }
    for (const p of ["/admin", "/admin/users", "/admin/loginx", "/dashboard", "/", "/inloggen"]) {
      assert.equal(isSignInPath(p), false, p);
    }
  });

  const pages = [
    "app/admin/login/page.tsx",
    "app/admin/login/2fa/page.tsx",
    "app/admin/forgot-password/page.tsx",
    "app/admin/reset-password/page.tsx",
  ];

  it("takes every text from the dictionary, in the language of the site", () => {
    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /const t\s+= SIGN_IN_TEXTS\[await getSiteLocale\(\)\];/, file);
      // Text between tags that is not an expression is a text someone hard-coded.
      // The product name is the one exception: it is the same in every language.
      const body  = source.slice(source.indexOf("return ("));
      const loose = [...body.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*</g)].map((m) => m[1]).filter((s) => s !== "Mister Chameleon Platform");
      assert.deepEqual(loose, [], `${file} holds text of its own`);
      // Same for a placeholder, except the two that show a format.
      const fixed = [...body.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]).filter((s) => /[a-z]{3}/i.test(s) && !/^x+-x+$/.test(s));
      assert.deepEqual(fixed, [], `${file} holds a placeholder of its own`);
    }
  });

  it("tells the browser which language the page is in", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    assert.match(layout, /isSignInPath\(_consentPathname\) \? await getSiteLocale\(\)/);
  });

  it("sends the reset mail in the language of the page it was asked on", () => {
    const action = readFileSync("app/admin/forgot-password/actions.ts", "utf8");
    assert.match(action, /sendAdminPasswordResetEmail\(user\.email, user\.name, raw, await getSiteLocale\(\)\)/);
  });
});

describe("sign-in error codes", () => {
  it("gives each code of the sign-in action its own text", () => {
    assert.equal(signInError(nl, "invalid_credentials"), nl.invalidCredentials);
    assert.equal(signInError(nl, "too_many_attempts"),   nl.tooManySignIns);
    assert.equal(signInError(nl, "account_disabled"),    nl.accountDisabled);
    assert.equal(signInError(nl, "session_expired"),     nl.sessionExpired);
    assert.equal(signInError(nl, "server_error"),        nl.serverError);
  });

  it("shows nothing for no code, or for one a visitor typed in the address", () => {
    assert.equal(signInError(nl, undefined), null);
    assert.equal(signInError(nl, "<script>"), null);
    assert.equal(resetError(nl, undefined), null);
    assert.equal(resetError(nl, "invalid"), null);
    assert.equal(twoFaError(nl, undefined), null);
  });

  it("still says something on the two-factor step for a code it does not know", () => {
    assert.equal(twoFaError(nl, "something_new"), nl.unknownError);
    assert.equal(twoFaError(nl, "invalid_code"), nl.invalidCode);
    assert.equal(twoFaError(nl, "invalid_backup_code"), nl.invalidBackupCode);
    assert.equal(twoFaError(nl, "too_many_attempts"), nl.tooManyAttempts);
  });

  it("covers the codes of the reset action", () => {
    assert.equal(resetError(en, "mismatch"), en.mismatch);
    assert.equal(resetError(en, "weak"),     en.weak);
    assert.equal(resetError(en, "server"),   en.resetFailed);
  });
});

describe("reset mail", () => {
  const link = "https://example.test/admin/reset-password?token=abc&x=1";

  it("is the mail it was in English", () => {
    const mail = resetMail(en, "Anna", link);
    assert.equal(mail.subject, "Reset your Mister Chameleon admin password");
    assert.equal(
      mail.text,
      "Hi Anna,\n\n" +
      "We received a request to reset your Mister Chameleon admin password.\n\n" +
      `Reset it here (this link expires in 45 minutes and can be used once):\n${link}\n\n` +
      "After resetting, sign in again with your new password and, if enabled, your two-factor code.\n\n" +
      "If you did not request this, you can safely ignore this email; your password stays unchanged.\n",
    );
    assert.equal(
      mail.html,
      "<p>Hi Anna,</p>" +
      "<p>We received a request to reset your Mister Chameleon admin password.</p>" +
      '<p><a href="https://example.test/admin/reset-password?token=abc&amp;x=1">Reset your password</a> (this link expires in 45 minutes and can be used once).</p>' +
      "<p>After resetting, sign in again with your new password and, if enabled, your two-factor code.</p>" +
      "<p>If you did not request this, you can safely ignore this email; your password stays unchanged.</p>",
    );
  });

  it("is Dutch for a Dutch site, with the link in both versions", () => {
    const mail = resetMail(nl, "Anna", link);
    assert.match(mail.subject, /wachtwoord/i);
    assert.match(mail.text, /^Hoi Anna,\n\n/);
    assert.ok(mail.text.includes(`\n${link}\n`), "the plain text must carry the link on a line of its own");
    assert.ok(mail.html.includes('href="https://example.test/admin/reset-password?token=abc&amp;x=1"'));
    assert.doesNotMatch(mail.text + mail.html, /Reset your password|sign in again/);
  });

  it("escapes a name in the HTML, in either language", () => {
    for (const t of [nl, en]) {
      const mail = resetMail(t, '<img src=x onerror="1">', link);
      assert.doesNotMatch(mail.html, /<img/);
      assert.match(mail.html, /&lt;img src=x onerror=&quot;1&quot;&gt;/);
    }
  });
});
